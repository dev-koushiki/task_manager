import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';

const ConnectMeetingContext = createContext(null);

export const useConnectMeeting = () => {
  const context = useContext(ConnectMeetingContext);
  if (!context) {
    throw new Error('useConnectMeeting must be used within a ConnectMeetingProvider');
  }
  return context;
};

export const ConnectMeetingProvider = ({ children, user }) => {
  // Resilient user ID resolution (authenticated user or persistent guest)
  const [resolvedMyId, setResolvedMyId] = useState(() => {
    if (user?.id || user?._id) return String(user.id || user._id);
    if (typeof window !== 'undefined') {
      try {
        let gid = localStorage.getItem('tm_guest_id');
        if (!gid) {
          gid = 'guest_' + Math.random().toString(36).substring(2, 9);
          localStorage.setItem('tm_guest_id', gid);
        }
        return gid;
      } catch (_) {}
    }
    return '';
  });

  useEffect(() => {
    if (user?.id || user?._id) {
      setResolvedMyId(String(user.id || user._id));
    }
  }, [user]);

  const myId = resolvedMyId;

  // Active Session State
  const [isInCall, setIsInCall] = useState(false);
  const [currentRoomCode, setCurrentRoomCode] = useState('');
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [activePeers, setActivePeers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [hostControls, setHostControls] = useState({ muteAll: false, lockMeeting: false });
  const [connectionError, setConnectionError] = useState('');

  // Media Track States
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  // Reactive Remote Streams Map (peerId -> MediaStream)
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [remoteStreamsTick, setRemoteStreamsTick] = useState(0);

  // References
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const remoteStreamsRef = useRef(new Map()); // peerId -> MediaStream
  const remoteAudioElementsRef = useRef(new Map()); // peerId -> HTMLAudioElement
  const pendingCandidatesRef = useRef(new Map()); // peerId -> Array of candidate data
  const lastProcessedOfferSdpRef = useRef(new Map()); // peerId -> sdp string
  const lastProcessedAnswerSdpRef = useRef(new Map()); // peerId -> sdp string
  const peerMissingPollsRef = useRef(new Map()); // peerId -> missing count
  const connectionAttemptTimeRef = useRef(new Map()); // peerId -> timestamp
  const pollingIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const lastMuteAllTimestampRef = useRef(0);
  const roomCodeRef = useRef('');

  // Persistent DOM container for remote audio elements to guarantee playback in Chromium & WebRTC
  const ensureAudioContainer = () => {
    if (typeof document === 'undefined') return null;
    let container = document.getElementById('taskflow-connect-audio-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'taskflow-connect-audio-container';
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-9999;';
      document.body.appendChild(container);
    }
    return container;
  };

  // Global user interaction listener to unlock audio autoplay across all browsers
  const unlockAudio = useCallback(() => {
    // 1. Play background audio elements in persistent container
    remoteAudioElementsRef.current.forEach((audioEl) => {
      if (audioEl && audioEl.paused && audioEl.srcObject) {
        audioEl.play().catch(() => {});
      }
    });
    // 2. Play any audio elements in persistent container
    if (typeof document !== 'undefined') {
      const container = document.getElementById('taskflow-connect-audio-container');
      if (container) {
        container.querySelectorAll('audio').forEach((el) => {
          if (el && el.paused && el.srcObject) {
            el.play().catch(() => {});
          }
        });
      }
    }
  }, []);

  useEffect(() => {
    const handleUserGesture = () => unlockAudio();
    window.addEventListener('click', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture, { passive: true });
    window.addEventListener('touchstart', handleUserGesture, { passive: true });

    return () => {
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
    };
  }, [unlockAudio]);

  // Clean up audio element for a specific peer
  const cleanupPeerAudio = (peerId) => {
    const audioEl = remoteAudioElementsRef.current.get(peerId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        if (audioEl.parentNode) {
          audioEl.parentNode.removeChild(audioEl);
        }
      } catch (_) {}
      remoteAudioElementsRef.current.delete(peerId);
    }
  };

  // Attach an incoming audio track to a dedicated HTML5 Audio element in persistent DOM container
  const attachRemoteAudio = useCallback((peerId, track) => {
    if (!track || track.kind !== 'audio') return;

    const container = ensureAudioContainer();
    let audioEl = remoteAudioElementsRef.current.get(peerId);
    if (!audioEl) {
      const existing = container ? container.querySelector(`#remote-audio-${peerId}`) : null;
      if (existing) {
        audioEl = existing;
      } else {
        audioEl = document.createElement('audio');
        audioEl.id = `remote-audio-${peerId}`;
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.muted = false;
        audioEl.volume = 1.0;
        if (container) {
          container.appendChild(audioEl);
        }
      }
      remoteAudioElementsRef.current.set(peerId, audioEl);
    }

    const audioStream = new MediaStream([track]);
    if (!audioEl.srcObject || audioEl.srcObject.getAudioTracks()[0]?.id !== track.id) {
      audioEl.srcObject = audioStream;
    }

    const playAudio = () => {
      if (audioEl && audioEl.paused) {
        audioEl.play().catch((err) => {
          console.warn(`[ConnectAudio] Autoplay waiting for user gesture for peer ${peerId}:`, err.message);
        });
      }
    };

    playAudio();
    track.onunmute = playAudio;
  }, []);

  // Initialize local microphone and camera
  const initLocalMedia = async () => {
    // Release any previous tracks first
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    let stream = null;
    let cameraAvailable = true;

    // 1. Try audio + video
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (avErr) {
      console.warn('[ConnectWebRTC] Audio+Video getUserMedia failed, attempting audio-only fallback:', avErr.message);
      cameraAvailable = false;
    }

    // 2. Fallback to audio-only if camera is unavailable or denied
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (audioErr) {
        console.error('[ConnectWebRTC] Microphone permission denied or unavailable:', audioErr.message);
        setConnectionError('Microphone permission denied or no audio input device found.');
        stream = new MediaStream();
        cameraAvailable = false;
      }
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsCameraOn(cameraAvailable && stream.getVideoTracks().length > 0);
    setIsMicOn(stream.getAudioTracks().length > 0 && stream.getAudioTracks()[0].enabled);

    // Attach local media to any existing peer connections
    peerConnectionsRef.current.forEach((pc) => {
      stream.getTracks().forEach((track) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          try { pc.addTrack(track, stream); } catch (_) {}
        }
      });
    });

    return stream;
  };

  // Create an RTCPeerConnection for a remote peer
  const createPeerConnection = useCallback((remoteUserId, code) => {
    let pc = peerConnectionsRef.current.get(remoteUserId);
    if (pc && pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
      return pc;
    }
    if (pc) {
      try { pc.close(); } catch (_) {}
    }

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    };

    pc = new RTCPeerConnection(configuration);
    peerConnectionsRef.current.set(remoteUserId, pc);

    // Attach local media tracks and ensure bidirectional transceivers
    try {
      // 1. Microphone Audio
      let audioSender = null;
      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        try {
          audioSender = pc.addTrack(audioTrack, localStreamRef.current);
        } catch (_) {}
      }
      const hasAudioTransceiver = pc.getTransceivers().some((t) => t.sender === audioSender || t.receiver?.track?.kind === 'audio');
      if (!hasAudioTransceiver) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      // 2. Video (Camera or Screen Share)
      const activeVideoTrack = screenStreamRef.current
        ? screenStreamRef.current.getVideoTracks()[0]
        : (localStreamRef.current ? localStreamRef.current.getVideoTracks()[0] : null);

      const activeVideoStream = screenStreamRef.current || localStreamRef.current;
      let videoSender = null;
      if (activeVideoTrack && activeVideoStream) {
        try {
          videoSender = pc.addTrack(activeVideoTrack, activeVideoStream);
        } catch (_) {}
      }
      const hasVideoTransceiver = pc.getTransceivers().some((t) => t.sender === videoSender || t.receiver?.track?.kind === 'video');
      if (!hasVideoTransceiver) {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }
    } catch (_) {}

    // ICE candidate discovery - serialize properly with toJSON
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidatePayload = event.candidate.toJSON
          ? event.candidate.toJSON()
          : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
            };
        api.sendConnectSignal(code, remoteUserId, candidatePayload, 'candidate').catch(() => {});
      }
    };

    // Remote media track received
    pc.ontrack = (event) => {
      let stream = remoteStreamsRef.current.get(remoteUserId);
      if (!stream) {
        stream = event.streams?.[0] || new MediaStream();
        remoteStreamsRef.current.set(remoteUserId, stream);
      }

      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!stream.getTracks().some((t) => t.id === track.id)) {
            stream.addTrack(track);
          }
        });
      }
      if (event.track && !stream.getTracks().some((t) => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      // If audio track, attach to dedicated audio player in persistent DOM container
      if (event.track.kind === 'audio') {
        attachRemoteAudio(remoteUserId, event.track);
      }

      // Listen for unmuting or track activation
      event.track.onunmute = () => {
        if (event.track.kind === 'audio') {
          attachRemoteAudio(remoteUserId, event.track);
        }
        setRemoteStreams(new Map(remoteStreamsRef.current));
        setRemoteStreamsTick((t) => t + 1);
      };

      // Update reactive state map for immediate UI re-rendering
      setRemoteStreams(new Map(remoteStreamsRef.current));
      setRemoteStreamsTick((t) => t + 1);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try { pc.restartIce(); } catch (_) {}
      }
      setRemoteStreams(new Map(remoteStreamsRef.current));
      setRemoteStreamsTick((t) => t + 1);
    };

    return pc;
  }, [attachRemoteAudio]);

  // Helper to renegotiate all active peer connections when tracks change
  const renegotiateWithPeers = useCallback(async (code) => {
    if (!code) return;
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      try {
        if (pc.signalingState !== 'stable') continue;
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        const offerPayload = offer.toJSON ? offer.toJSON() : { type: offer.type, sdp: offer.sdp };
        await api.sendConnectSignal(code, peerId, offerPayload, 'offer');
      } catch (err) {
        console.warn('[ConnectWebRTC] Renegotiation error with peer:', peerId, err.message);
      }
    }
  }, []);

  // Process incoming WebRTC signals
  const handleIncomingSignals = useCallback(async (signals, code) => {
    for (const item of signals) {
      const { senderId, signal, type } = item;
      const sId = String(senderId);
      if (!sId || sId === myId) continue;

      try {
        let pc = peerConnectionsRef.current.get(sId);
        const signalType = type || signal?.type;

        if (signalType === 'offer') {
          const sdpData = signal.sdp ? signal : (signal.signal || signal);
          const rawSdp = typeof sdpData === 'string' ? sdpData : (sdpData.sdp || JSON.stringify(sdpData));

          // Deduplicate offers to prevent unnecessary renegotiation
          if (lastProcessedOfferSdpRef.current.get(sId) === rawSdp) {
            continue;
          }

          // Polite Peer / Offer collision handling
          const isPolite = myId < sId;
          const offerCollision = pc && pc.signalingState !== 'stable';

          if (offerCollision && !isPolite) {
            // Impolite peer drops colliding offer; polite peer will roll back
            continue;
          }

          if (offerCollision && isPolite) {
            if (pc) {
              try { pc.close(); } catch (_) {}
            }
            pc = null;
          }

          if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
            pc = createPeerConnection(sId, code);
          }

          lastProcessedOfferSdpRef.current.set(sId, rawSdp);

          await pc.setRemoteDescription(new RTCSessionDescription(sdpData));

          // Drain queued ICE candidates
          const pending = pendingCandidatesRef.current.get(sId) || [];
          for (const cand of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(sId);

          const answer = await pc.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(answer);

          const answerPayload = answer.toJSON ? answer.toJSON() : { type: answer.type, sdp: answer.sdp };
          await api.sendConnectSignal(code, sId, answerPayload, 'answer');
        } else if (signalType === 'answer') {
          const sdpData = signal.sdp ? signal : (signal.signal || signal);
          const rawSdp = typeof sdpData === 'string' ? sdpData : (sdpData.sdp || JSON.stringify(sdpData));

          if (lastProcessedAnswerSdpRef.current.get(sId) === rawSdp) {
            continue;
          }
          lastProcessedAnswerSdpRef.current.set(sId, rawSdp);

          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(sdpData));

            // Drain queued ICE candidates
            const pending = pendingCandidatesRef.current.get(sId) || [];
            for (const cand of pending) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingCandidatesRef.current.delete(sId);
          }
        } else if (signalType === 'candidate' || signal?.candidate) {
          const candidateData = signal.candidate || signal;
          if (candidateData && (candidateData.candidate || candidateData.sdpMid !== undefined)) {
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(candidateData)).catch(() => {});
            } else {
              if (!pendingCandidatesRef.current.has(sId)) {
                pendingCandidatesRef.current.set(sId, []);
              }
              pendingCandidatesRef.current.get(sId).push(candidateData);
            }
          }
        }
      } catch (err) {
        console.warn('[ConnectWebRTC] Signal handling error with peer:', sId, err.message);
      }
    }
  }, [myId, createPeerConnection]);

  // Start polling loop for active peers, signals, and chat
  const startRoomPolling = useCallback((code) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const [signalData, chatData] = await Promise.all([
          api.getConnectSignals(code).catch(() => ({ signals: [], activePeers: [] })),
          api.getConnectChat(code).catch(() => []),
        ]);

        if (signalData.meetingStatus === 'completed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          cleanupSessionState();
          return;
        }

        if (signalData.activePeers && Array.isArray(signalData.activePeers)) {
          setActivePeers(signalData.activePeers);

          // Establish peer connections with active peers without creating duplicate connections
          signalData.activePeers.forEach(async (peer) => {
            const peerId = String(peer.userId);
            if (!peerId || peerId === myId) return;

            // Reset missing poll counter since peer is present in activePeers
            peerMissingPollsRef.current.delete(peerId);

            let pc = peerConnectionsRef.current.get(peerId);
            const isInitiator = myId > peerId;

            const isDead = pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed');
            if (isDead) {
              try { pc.close(); } catch (_) {}
              peerConnectionsRef.current.delete(peerId);
              pc = null;
            }

            const isConnecting = pc && (pc.connectionState === 'connecting' || pc.signalingState === 'have-local-offer');
            const isConnected = pc && (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected');

            // If connection attempt stalled for over 8 seconds without success, allow clean retry
            const attemptTime = connectionAttemptTimeRef.current.get(peerId) || 0;
            const isStalled = isConnecting && (Date.now() - attemptTime > 8000);

            if (isStalled) {
              try { pc.close(); } catch (_) {}
              peerConnectionsRef.current.delete(peerId);
              pc = null;
            }

            const needsConnection = !pc && !isConnected;

            if (needsConnection && isInitiator) {
              try {
                connectionAttemptTimeRef.current.set(peerId, Date.now());
                pc = createPeerConnection(peerId, code);
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                const offerPayload = offer.toJSON ? offer.toJSON() : { type: offer.type, sdp: offer.sdp };
                await api.sendConnectSignal(code, peerId, offerPayload, 'offer');
              } catch (err) {
                console.warn('[ConnectWebRTC] Offer initiation error:', peerId, err.message);
              }
            }
          });

          // Clean up disconnected peers with debounce grace period (protects against single-poll drops)
          const activePeerIdSet = new Set(signalData.activePeers.map((p) => String(p.userId)));
          let hasPruned = false;
          for (const [rId, pc] of peerConnectionsRef.current.entries()) {
            if (!activePeerIdSet.has(rId)) {
              const missingCount = (peerMissingPollsRef.current.get(rId) || 0) + 1;
              peerMissingPollsRef.current.set(rId, missingCount);

              // Only disconnect if missing for 6 consecutive polls (~7-8 seconds) AND connection is not live
              const isConnectionAlive = pc && (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected');
              if (missingCount >= 6 && !isConnectionAlive) {
                try { pc.close(); } catch (_) {}
                peerConnectionsRef.current.delete(rId);
                remoteStreamsRef.current.delete(rId);
                cleanupPeerAudio(rId);
                pendingCandidatesRef.current.delete(rId);
                lastProcessedOfferSdpRef.current.delete(rId);
                lastProcessedAnswerSdpRef.current.delete(rId);
                peerMissingPollsRef.current.delete(rId);
                connectionAttemptTimeRef.current.delete(rId);
                hasPruned = true;
              }
            }
          }
          if (hasPruned) {
            setRemoteStreams(new Map(remoteStreamsRef.current));
            setRemoteStreamsTick((t) => t + 1);
          }
        }

        // Host controls
        if (signalData.hostControls) {
          setHostControls(signalData.hostControls);
          const muteTs = signalData.hostControls.muteAllTimestamp || 0;
          if (
            signalData.hostControls.muteAll &&
            muteTs &&
            muteTs !== lastMuteAllTimestampRef.current &&
            !isHost
          ) {
            lastMuteAllTimestampRef.current = muteTs;
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
            }
            setIsMicOn(false);
          }
        }

        // Chat messages (preserved intact)
        if (chatData && Array.isArray(chatData)) {
          setChatMessages((prev) => {
            const map = new Map();
            prev.filter((m) => String(m.id || '').startsWith('temp_')).forEach((m) => map.set(m.id, m));
            chatData.forEach((m) => {
              const key = m.id || `${m.senderId}_${new Date(m.timestamp).getTime()}_${m.text}`;
              map.set(key, m);
            });
            const merged = Array.from(map.values());
            merged.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
            return merged;
          });
        }

        // Process queued signals
        if (signalData.signals && signalData.signals.length > 0) {
          await handleIncomingSignals(signalData.signals, code);
        }
      } catch (err) {
        // Silently tolerate brief network transition
      }
    }, 1200);
  }, [myId, isHost, createPeerConnection, handleIncomingSignals]);

  // Clean up all local media, peer connections, and audio elements
  const cleanupSessionState = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Stop local camera/mic stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    // Stop screen share stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      try { pc.close(); } catch (_) {}
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();

    // Clean up all remote audio elements
    remoteAudioElementsRef.current.forEach((audioEl) => {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        if (audioEl.parentNode) {
          audioEl.parentNode.removeChild(audioEl);
        }
      } catch (_) {}
    });
    remoteAudioElementsRef.current.clear();
    pendingCandidatesRef.current.clear();
    lastProcessedOfferSdpRef.current.clear();
    lastProcessedAnswerSdpRef.current.clear();
    peerMissingPollsRef.current.clear();
    connectionAttemptTimeRef.current.clear();

    // Reset state
    setIsInCall(false);
    setCurrentRoomCode('');
    roomCodeRef.current = '';
    setActiveMeeting(null);
    setIsHost(false);
    setCallDuration(0);
    setActivePeers([]);
    setChatMessages([]);
    setIsMicOn(true);
    setIsCameraOn(true);
    setIsScreenSharing(false);
    setIsHandRaised(false);
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setRemoteStreamsTick(0);
  };

  // Explicit Join Meeting function
  const joinMeeting = async (codeToJoin) => {
    const code = (codeToJoin || '').trim();
    if (!code) {
      throw new Error('Please enter a valid meeting room code.');
    }

    setConnectionError('');

    // Unlock audio context on join gesture
    unlockAudio();

    // 1. Verify room exists and user is authorized
    const roomData = await api.getConnectRoom(code);
    if (!roomData || !roomData.meeting) {
      throw new Error('Meeting room not found or access denied. Please verify your room code.');
    }

    // 2. Register join attendance on server
    const joinRes = await api.joinConnectRoom(code);
    if (joinRes?.participantId) {
      setResolvedMyId(String(joinRes.participantId));
    }

    // 3. Acquire local media (mic + camera)
    await initLocalMedia();

    // 4. Update state to in-call
    setCurrentRoomCode(roomData.roomCode || code);
    roomCodeRef.current = roomData.roomCode || code;
    setActiveMeeting(roomData.meeting);
    setIsHost(Boolean(roomData.isHost));
    setHostControls(roomData.hostControls || { muteAll: false, lockMeeting: false });
    if (roomData.chatMessages && Array.isArray(roomData.chatMessages)) {
      setChatMessages(roomData.chatMessages);
    }

    setIsInCall(true);
    setCallDuration(0);

    // 5. Start call duration timer
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // 6. Start polling loop for peers and signals
    startRoomPolling(code);

    return roomData;
  };

  // Create an Instant Meeting room (WITHOUT auto-joining)
  const createInstantMeeting = async (title = 'Instant Connect Meeting') => {
    setConnectionError('');
    const res = await api.createConnectRoom(title);
    if (!res || !res.roomCode) {
      throw new Error('Failed to create instant meeting room.');
    }
    return res;
  };

  // Leave active meeting
  const leaveMeeting = async () => {
    const code = currentRoomCode || roomCodeRef.current;
    if (code) {
      try {
        await api.leaveConnectRoom(code);
      } catch (err) {
        console.warn('[ConnectWebRTC] Leave meeting server notification error:', err.message);
      }
    }
    cleanupSessionState();
  };

  // Host ends meeting for everyone
  const endMeetingForEveryone = async () => {
    const code = currentRoomCode || roomCodeRef.current;
    if (code && isHost) {
      try {
        await api.endConnectRoom(code);
      } catch (err) {
        console.warn('[ConnectWebRTC] End meeting server notification error:', err.message);
      }
    }
    cleanupSessionState();
  };

  // Toggle Microphone (Mute / Unmute)
  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks[0].enabled = nextState;
        setIsMicOn(nextState);
        const code = currentRoomCode || roomCodeRef.current;
        if (code) {
          api.sendConnectPeerState(code, { micOn: nextState }).catch(() => {});
        }
      }
    }
  };

  // Toggle Camera (On / Off)
  const toggleCamera = async () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoTracks[0].enabled;
        videoTracks[0].enabled = nextState;
        setIsCameraOn(nextState);
        const code = currentRoomCode || roomCodeRef.current;
        if (code) {
          api.sendConnectPeerState(code, { cameraOn: nextState }).catch(() => {});
        }
      } else {
        // If camera track was not present, try acquiring one
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = camStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);
          setIsCameraOn(true);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              await sender.replaceTrack(newVideoTrack).catch(() => {});
            } else {
              try { pc.addTrack(newVideoTrack, localStreamRef.current); } catch (_) {}
            }
          }
          const code = currentRoomCode || roomCodeRef.current;
          if (code) {
            api.sendConnectPeerState(code, { cameraOn: true }).catch(() => {});
            await renegotiateWithPeers(code);
          }
        } catch (e) {
          console.warn('[ConnectWebRTC] Failed to activate camera track:', e.message);
        }
      }
    }
  };

  // Stop Screen Sharing
  const stopScreenSharing = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    // Revert video track to camera on all peer connections
    const camTrack = localStreamRef.current ? localStreamRef.current.getVideoTracks()[0] : null;
    for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
      try {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(camTrack || null).catch(() => {});
        }
      } catch (_) {}
    }

    const code = currentRoomCode || roomCodeRef.current;
    if (code) {
      api.sendConnectPeerState(code, { screenSharing: false }).catch(() => {});
      await renegotiateWithPeers(code);
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenSharing();
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = displayStream;
        setScreenStream(displayStream);
        setIsScreenSharing(true);

        const screenTrack = displayStream.getVideoTracks()[0];
        screenTrack.onended = () => stopScreenSharing();

        // Replace outgoing video track on all peer connections
        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
          try {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              await sender.replaceTrack(screenTrack);
            } else {
              pc.addTrack(screenTrack, displayStream);
            }
          } catch (err) {
            console.warn('[ConnectWebRTC] Screen track attach error:', err.message);
          }
        }

        const code = currentRoomCode || roomCodeRef.current;
        if (code) {
          api.sendConnectPeerState(code, { screenSharing: true }).catch(() => {});
          await renegotiateWithPeers(code);
        }
      } catch (err) {
        console.warn('[ConnectWebRTC] Screen sharing cancelled or denied:', err.message);
      }
    }
  };

  // Toggle Hand Raised
  const toggleHandRaised = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    const code = currentRoomCode || roomCodeRef.current;
    if (code) {
      api.sendConnectPeerState(code, { handRaised: nextState }).catch(() => {});
    }
  };

  // Send In-Call Chat Message (preserved intact)
  const sendChatMessage = async (text) => {
    const trimmed = (text || '').trim();
    const code = currentRoomCode || roomCodeRef.current;
    if (!trimmed || !code) return;

    // Optimistic message
    const tempMsg = {
      id: `temp_${Date.now()}`,
      senderId: myId,
      senderName: `${user?.firstName || 'You'} ${user?.lastName || ''}`.trim() || 'You',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempMsg]);

    try {
      await api.sendConnectChat(code, trimmed);
    } catch (err) {
      console.warn('[ConnectWebRTC] Failed to send chat message:', err.message);
    }
  };

  // Host Action (Mute All / Lock Meeting)
  const sendHostAction = async (action, value) => {
    const code = currentRoomCode || roomCodeRef.current;
    if (!code || !isHost) return;

    try {
      const res = await api.sendConnectHostAction(code, action, value);
      if (res && res.hostControls) {
        setHostControls(res.hostControls);
      }
    } catch (err) {
      console.warn('[ConnectWebRTC] Host action failed:', err.message);
    }
  };

  return (
    <ConnectMeetingContext.Provider
      value={{
        isInCall,
        currentRoomCode,
        activeMeeting,
        isHost,
        callDuration,
        activePeers,
        chatMessages,
        hostControls,
        connectionError,
        isMicOn,
        isCameraOn,
        isScreenSharing,
        isHandRaised,
        localStream,
        screenStream,
        remoteStreams,
        remoteStreamsTick,
        joinMeeting,
        createInstantMeeting,
        leaveMeeting,
        endMeetingForEveryone,
        toggleMicrophone,
        toggleCamera,
        toggleScreenShare,
        toggleHandRaised,
        sendChatMessage,
        sendHostAction,
        unlockAudio,
      }}
    >
      {children}
    </ConnectMeetingContext.Provider>
  );
};
