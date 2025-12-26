
import React, { useState, useEffect, useRef } from 'react';
import { User, CallData } from '../types';
import { db } from '../services/db';

interface CallOverlayProps {
  currentUser: User;
  activeCall: CallData;
  onClose: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ currentUser, activeCall, onClose }) => {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(
    activeCall.status === 'accepted' ? 'active' : 'ringing'
  );
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationIntervalRef = useRef<number | null>(null);

  const isCaller = activeCall.callerId === currentUser.id;
  const isVideo = activeCall.type === 'video';
  const callPathId = activeCall.receiverId;

  // Sync stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [callStatus, isVideo]);

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
    if (localStreamRef.current && isVideo) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isCameraOff;
      });
    }
  }, [isCameraOff, isVideo]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isSpeaker ? 1.0 : 0.3;
    }
  }, [isSpeaker]);

  const setupWebRTC = async () => {
    try {
      const constraints = { 
        audio: true, 
        video: isVideo 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
        console.log("Remote track received:", event.streams[0]);
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
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
      alert("Не удалось получить доступ к микрофону или камере.");
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
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-between p-4 md:p-8 text-white overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500 rounded-full blur-[120px]"></div>
      </div>

      {/* Remote Video Container */}
      <div className={`absolute inset-0 z-0 bg-black transition-opacity duration-700 ${isVideo && callStatus === 'active' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        {callStatus === 'active' && !remoteStreamRef.current && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-blue-400 mb-4"></i>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-100">Установка соединения...</p>
          </div>
        )}
      </div>

      {/* Header Info */}
      <div className={`relative z-10 flex flex-col items-center mt-4 md:mt-8 p-4 rounded-3xl transition-all duration-500 ${callStatus === 'active' ? 'bg-black/20 backdrop-blur-md border border-white/5 shadow-xl' : 'bg-transparent'}`}>
        {(!isVideo || callStatus !== 'active') && (
          <div className="relative mb-4">
            <div className={`absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-40 transition-all duration-1000 ${callStatus === 'ringing' ? 'scale-150 animate-pulse' : 'scale-100'}`}></div>
            <img 
              src={isCaller ? activeCall.receiverId : activeCall.callerAvatar} 
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/20 object-cover shadow-2xl relative z-10" 
              alt="Avatar" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${isCaller ? activeCall.receiverId : activeCall.callerName}`;
              }}
            />
          </div>
        )}
        <h2 className="text-xl md:text-2xl font-bold mb-1 text-center shadow-sm">
          {isCaller ? (activeCall.receiverId) : activeCall.callerName}
        </h2>
        <p className="text-blue-300 font-black tracking-widest uppercase text-[9px] md:text-xs drop-shadow-md">
          {callStatus === 'ringing' ? (isCaller ? 'Вызов...' : 'Входящий звонок...') : (callStatus === 'active' ? formatTime(callDuration) : 'Подключение...')}
          {isVideo ? ' • ВИДЕО' : ' • АУДИО'}
        </p>
      </div>

      {/* Hidden audio for non-video calls */}
      {!isVideo && <audio ref={remoteVideoRef} autoPlay playsInline />}

      {/* Call Controls */}
      <div className="relative z-10 flex flex-col items-center space-y-6 md:space-y-8 mb-4 md:mb-8 w-full max-w-sm">
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
            <div className="flex justify-center space-x-4 md:space-x-6 w-full px-4">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl transition-all shadow-lg ${isMuted ? 'bg-red-500 text-white ring-4 ring-red-500/20' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-md'}`}
              >
                <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
              </button>
              
              {isVideo && (
                <button 
                  onClick={() => setIsCameraOff(!isCameraOff)}
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl transition-all shadow-lg ${isCameraOff ? 'bg-red-500 text-white ring-4 ring-red-500/20' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-md'}`}
                >
                  <i className={`fa-solid ${isCameraOff ? 'fa-video-slash' : 'fa-video'}`}></i>
                </button>
              )}

              <button 
                onClick={() => setIsSpeaker(!isSpeaker)}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl transition-all shadow-lg ${isSpeaker ? 'bg-white text-slate-900 ring-4 ring-white/20' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-md'}`}
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
