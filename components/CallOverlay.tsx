
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
  const [isSpeaker, setIsSpeaker] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const durationIntervalRef = useRef<number | null>(null);

  const isCaller = activeCall.callerId === currentUser.id;
  // Always listen to the call node indexed by receiverId
  const callPathId = activeCall.receiverId;

  useEffect(() => {
    setupWebRTC();
    
    // Subscribe to the shared call node
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
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = isSpeaker ? 1.0 : 0.3;
    }
  }, [isSpeaker]);

  const setupWebRTC = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
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
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-between p-8 md:p-12 text-white">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center mt-8 md:mt-12">
        <div className="relative mb-6">
          <div className={`absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-40 transition-all duration-1000 ${callStatus === 'ringing' ? 'scale-150 animate-pulse' : 'scale-100'}`}></div>
          <img 
            src={activeCall.callerId === currentUser.id ? 'https://picsum.photos/seed/call/200' : activeCall.callerAvatar} 
            className="w-28 h-28 md:w-40 md:h-40 rounded-full border-4 border-white/20 object-cover shadow-2xl relative z-10" 
            alt="Avatar" 
          />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold mb-2 text-center">{isCaller ? (activeCall.receiverId) : activeCall.callerName}</h2>
        <p className="text-blue-300 font-medium tracking-wide uppercase text-xs md:text-sm">
          {callStatus === 'ringing' ? 'Ringing...' : (callStatus === 'active' ? formatTime(callDuration) : 'Connecting...')}
        </p>
      </div>

      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="relative z-10 flex flex-col items-center space-y-6 md:space-y-8 mb-8 md:mb-12 w-full max-w-xs">
        {callStatus === 'ringing' && !isCaller ? (
          <div className="flex justify-around w-full">
            <button 
              onClick={handleReject}
              className="w-14 h-14 md:w-16 md:h-16 bg-red-500 rounded-full flex items-center justify-center text-xl md:text-2xl shadow-lg hover:bg-red-600 transition-all transform active:scale-90"
            >
              <i className="fa-solid fa-phone-slash rotate-[135deg]"></i>
            </button>
            <button 
              onClick={handleAccept}
              className="w-14 h-14 md:w-16 md:h-16 bg-green-500 rounded-full flex items-center justify-center text-xl md:text-2xl shadow-lg hover:bg-green-600 transition-all transform animate-bounce active:scale-90"
            >
              <i className="fa-solid fa-phone"></i>
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center space-x-6 md:space-x-8 w-full">
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'}`}
              >
                <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
              </button>
              <button 
                onClick={() => setIsSpeaker(!isSpeaker)}
                className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl transition-all ${isSpeaker ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'}`}
              >
                <i className={`fa-solid ${isSpeaker ? 'fa-volume-high' : 'fa-volume-low'}`}></i>
              </button>
            </div>
            <button 
              onClick={handleEndCall}
              className="w-14 h-14 md:w-16 md:h-16 bg-red-500 rounded-full flex items-center justify-center text-xl md:text-2xl shadow-xl hover:bg-red-600 transition-all transform active:scale-90"
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
