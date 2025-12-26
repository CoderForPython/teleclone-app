
import React, { useState, useEffect, useRef } from 'react';
import { User, CallData } from '../types';
import { db } from '../services/db';

interface CallOverlayProps {
  currentUser: User;
  activeCall: CallData;
  onClose: () => void;
  theme: 'light' | 'dark';
}

const CallOverlay: React.FC<CallOverlayProps> = ({ currentUser, activeCall, onClose, theme }) => {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(
    activeCall.status === 'accepted' ? 'active' : 'ringing'
  );
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const durationIntervalRef = useRef<number | null>(null);
  
  // Audio Context for Volume Boost
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const isCaller = activeCall.callerId === currentUser.id;
  const callPathId = activeCall.receiverId;

  useEffect(() => {
    setupWebRTC();
    
    const unsubscribe = db.subscribeToIncomingCall(callPathId, (updatedCall) => {
      if (!updatedCall || updatedCall.status === 'ended' || updatedCall.status === 'rejected') {
        cleanup();
        onClose();
      } else if (isCaller && updatedCall.status === 'accepted' && updatedCall.answer) {
        if (pcRef.current && pcRef.current.signalingState !== 'stable' && !pcRef.current.currentRemoteDescription) {
          pcRef.current.setRemoteDescription(new RTCSessionDescription(updatedCall.answer))
            .then(() => setCallStatus('active'))
            .catch(e => console.error("Error setting remote description:", e));
        }
      } else if (!isCaller && updatedCall.status === 'accepted') {
        setCallStatus('active');
      }
    });

    return () => {
      unsubscribe();
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (callStatus === 'active') {
      durationIntervalRef.current = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  }, [callStatus]);

  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  useEffect(() => {
    // Basic volume setting
    if (audioRef.current) {
      // Increased base levels: Speaker 100%, Earpiece 60% (was 30%)
      audioRef.current.volume = isSpeaker ? 1.0 : 0.6;
    }
    
    // Apply GainNode boost if available (2x boost)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isSpeaker ? 2.5 : 1.5;
    }
  }, [isSpeaker]);

  const setupWebRTC = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        remoteStreamRef.current = remoteStream;
        
        // Initialize Audio Context for Volume Boost
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          const source = ctx.createMediaStreamSource(remoteStream);
          const gainNode = ctx.createGain();
          const destination = ctx.createMediaStreamDestination();
          
          gainNode.gain.value = isSpeaker ? 2.5 : 1.5; // High initial boost
          
          source.connect(gainNode);
          gainNode.connect(destination);
          
          audioCtxRef.current = ctx;
          gainNodeRef.current = gainNode;
          
          if (audioRef.current) {
            audioRef.current.srcObject = destination.stream;
          }
        } else if (audioRef.current) {
          audioRef.current.srcObject = remoteStream;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          db.sendIceCandidate(activeCall.id, isCaller ? 'caller' : 'receiver', event.candidate);
        }
      };

      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await db.initiateCall({
          ...activeCall,
          offer: { sdp: offer.sdp, type: offer.type }
        });

        db.subscribeToIceCandidates(activeCall.id, 'receiver', (candidate) => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {});
        });
      } else {
        if (activeCall.offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(activeCall.offer));
        }
        db.subscribeToIceCandidates(activeCall.id, 'caller', (candidate) => {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => {});
        });
      }
    } catch (err) {
      console.error("WebRTC Setup Error:", err);
      alert("Не удалось получить доступ к микрофону.");
      onClose();
    }
  };

  const handleAccept = async () => {
    if (!pcRef.current) return;
    try {
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      await db.updateCall(callPathId, {
        status: 'accepted',
        answer: { sdp: answer.sdp, type: answer.type }
      });
      setCallStatus('active');
    } catch (err) {
      console.error("Accept Call Error:", err);
    }
  };

  const handleReject = async () => {
    await db.updateCall(callPathId, { status: 'rejected' });
    cleanup();
    onClose();
  };

  const handleEndCall = async () => {
    await db.endCall(callPathId);
    cleanup();
    onClose();
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fixed inset-0 z-[100] ${theme === 'dark' ? 'bg-slate-950/95' : 'bg-slate-900/95'} backdrop-blur-xl flex flex-col items-center justify-between p-4 md:p-8 text-white overflow-hidden`}>
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500 rounded-full blur-[120px]"></div>
      </div>

      {/* Header Info */}
      <div className={`relative z-10 flex flex-col items-center mt-12 md:mt-16 p-6 rounded-3xl transition-all duration-500 bg-black/20 backdrop-blur-md border border-white/5 shadow-xl`}>
        <div className="relative mb-6">
          <div className={`absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-40 transition-all duration-1000 ${callStatus === 'ringing' ? 'scale-150 animate-pulse' : 'scale-100'}`}></div>
          <img 
            src={isCaller ? activeCall.receiverId : activeCall.callerAvatar} 
            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover shadow-2xl relative z-10" 
            alt="Avatar" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${isCaller ? activeCall.receiverId : activeCall.callerName}`;
            }}
          />
        </div>
        <h2 className="text-xl md:text-2xl font-bold mb-1 text-center shadow-sm">
          {isCaller ? (activeCall.receiverId) : activeCall.callerName}
        </h2>
        <p className="text-blue-300 font-black tracking-widest uppercase text-[9px] md:text-xs drop-shadow-md">
          {callStatus === 'ringing' ? (isCaller ? 'Вызов...' : 'Входящий звонок...') : (callStatus === 'active' ? formatTime(callDuration) : 'Подключение...')}
          {' • АУДИОЗВОНОК'}
        </p>
      </div>

      {/* Audio element (Hidden) */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Call Controls */}
      <div className="relative z-10 flex flex-col items-center space-y-6 md:space-y-8 mb-12 md:mb-16 w-full max-w-sm">
        {callStatus === 'ringing' && !isCaller ? (
          <div className="flex justify-around w-full px-8">
            <button 
              onClick={handleReject}
              className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center text-2xl shadow-2xl hover:bg-red-600 transition-all transform active:scale-90"
            >
              <i className="fa-solid fa-phone-slash rotate-[135deg]"></i>
            </button>
            <button 
              onClick={handleAccept}
              className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center text-2xl shadow-2xl hover:bg-green-600 transition-all transform animate-bounce active:scale-90"
            >
              <i className="fa-solid fa-phone"></i>
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center space-x-8 w-full px-4">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-lg md:text-xl transition-all shadow-lg ${isMuted ? 'bg-red-500 text-white ring-4 ring-red-500/20' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-md'}`}
              >
                <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
              </button>
              
              <button 
                onClick={() => setIsSpeaker(!isSpeaker)}
                className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-lg md:text-xl transition-all shadow-lg ${isSpeaker ? 'bg-white text-slate-900 ring-4 ring-white/20' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-md'}`}
              >
                <i className={`fa-solid ${isSpeaker ? 'fa-volume-high' : 'fa-volume-low'}`}></i>
              </button>
            </div>
            <button 
              onClick={handleEndCall}
              className="w-16 h-16 bg-red-600 text-white rounded-full flex items-center justify-center text-2xl shadow-2xl hover:bg-red-700 transition-all transform active:scale-90 ring-4 ring-red-600/20"
            >
              <i className="fa-solid fa-phone-slash"></i>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CallOverlay;
