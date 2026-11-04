import { useState, useEffect, useRef } from 'react';
import {
  VideoIcon,
  VideoOffIcon,
  MicIcon,
  MicOffIcon,
  ScreenShareIcon,
  HandIcon,
  PhoneOffIcon,
  UsersIcon,
  MessageSquareIcon,
  LockIcon,
  ShieldIcon,
  PlusIcon,
  CopyIcon,
  CheckCircleIcon,
  CalendarIcon,
  ClockIcon,
  SparklesIcon,
  SearchIcon,
  ExternalLinkIcon,
  SettingsIcon,
  AlertTriangleIcon,
  UserIcon,
  RecordIcon,
  StopCircleIcon,
  DownloadIcon,
} from './Icons';
import { api } from '../services/api';

export const ConnectView = ({
  user,
  initialRoomCode = '',
  onScheduleInCalendar,
  onBackToCalendar,
}) => {
  const [activeTab, setActiveTab] = useState('hub'); // 'hub' | 'room' | 'history'
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [currentRoomCode, setCurrentRoomCode] = useState(initialRoomCode || '');
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [isHost, setIsHost] = useState(false);

  // In-Call Media States
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSidePanel, setActiveSidePanel] = useState(''); // '' | 'participants' | 'chat' | 'info'
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // In-Call Participants and Chat
  const [activePeers, setActivePeers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [hostControls, setHostControls] = useState({ muteAll: false, lockMeeting: false });

  // Meeting Recording State & Refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(null);
  const [showRecordModal, setShowRecordModal] = useState(false);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const audioContextRef = useRef(null);

  // Custom Website Popup Dialog State (replaces native window.alert and window.confirm)
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    type: 'alert', // 'alert' | 'confirm'
    variant: 'info', // 'info' | 'danger' | 'warning' | 'success'
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: null,
    onCancel: null,
  });

  const showCustomAlert = (message, title = 'Notice', variant = 'info', onOk = null) => {
    setDialogState({
      isOpen: true,
      type: 'alert',
      variant,
      title,
      message,
      confirmText: 'OK',
      cancelText: 'Cancel',
      onConfirm: () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        if (onOk) onOk();
      },
      onCancel: () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        if (onOk) onOk();
      },
    });
  };

  const showCustomConfirm = ({
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    onConfirm,
    onCancel,
  }) => {
    setDialogState({
      isOpen: true,
      type: 'confirm',
      variant,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      },
      onCancel: () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        if (onCancel) onCancel();
      },
    });
  };

  // Out-of-Call Hub Data
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [meetingHistory, setMeetingHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Google Integration State
  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: '', hasClientId: false });
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [googleNotice, setGoogleNotice] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // WebRTC Media Stream References
  const myId = String(user?.id || user?._id || '');
  const localVideoRef = useRef(null);
  const screenShareVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // userId -> RTCPeerConnection
  const remoteStreamsRef = useRef(new Map()); // userId -> MediaStream
  const pendingCandidatesRef = useRef(new Map()); // userId -> Array of RTCIceCandidateInit
  const pollingIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const lastMuteAllTimestampRef = useRef(0);
  const chatBottomRef = useRef(null);
  const [peersTick, setPeersTick] = useState(0);

  // Auto-scroll chat container to the latest message
  useEffect(() => {
    if (activeSidePanel === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeSidePanel]);

  // Ensure local video element is wired when room view is active
  useEffect(() => {
    if (activeTab === 'room') {
      if (localVideoRef.current && localStreamRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play?.().catch(() => {});
      }
    }
  }, [activeTab, isCameraOn]);

  // Global user interaction listener to bypass browser audio autoplay restrictions
  useEffect(() => {
    if (activeTab !== 'room') return;
    const unlockAllMedia = () => {
      document.querySelectorAll('audio, video').forEach((el) => {
        if (el.paused && el.srcObject && !el.muted) {
          el.play().catch(() => {});
        }
      });
    };
    window.addEventListener('click', unlockAllMedia, { passive: true });
    window.addEventListener('touchstart', unlockAllMedia, { passive: true });
    window.addEventListener('keydown', unlockAllMedia, { passive: true });
    return () => {
      window.removeEventListener('click', unlockAllMedia);
      window.removeEventListener('touchstart', unlockAllMedia);
      window.removeEventListener('keydown', unlockAllMedia);
    };
  }, [activeTab]);

  // Initialize or check if loaded with an initialRoomCode
  useEffect(() => {
    loadHubData();
    checkGoogleStatus();

    // Check if redirect contains room code or google OAuth callback
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const googleAuthCode = params.get('code');

    if (googleAuthCode) {
      handleGoogleAuthCallback(googleAuthCode);
    } else if (roomParam || initialRoomCode) {
      handleJoinRoom(roomParam || initialRoomCode);
    }

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) {}
      }
    };
  }, []);

  const loadHubData = async () => {
    try {
      setLoading(true);
      const [meetingsData, historyData] = await Promise.all([
        api.getMeetings().catch(() => []),
        api.getMeetingHistory().catch(() => []),
      ]);

      const onlineOnly = (meetingsData || []).filter(
        (m) => (m.mode === 'online' || m.roomCode) && m.status !== 'cancelled'
      );
      setUpcomingMeetings(onlineOnly);
      setMeetingHistory(historyData || []);
    } catch (err) {
      console.warn('Failed to load Connect hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkGoogleStatus = async () => {
    try {
      const st = await api.getGoogleStatus();
      setGoogleStatus(st || { connected: false, email: '' });
    } catch (err) {
      console.warn('Google status check failed:', err);
    }
  };

  const handleGoogleAuthCallback = async (code) => {
    try {
      setGoogleLoading(true);
      const origin = window.location.origin;
      const redirectUri = `${origin}/connect`;
      const res = await api.connectGoogleCallback(code, redirectUri);
      setGoogleNotice(res.message || 'Google Account successfully connected!');
      checkGoogleStatus();
      // Clean query parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setGoogleNotice(err.message || 'Google authorization failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setGoogleLoading(true);
      const authInfo = await api.getGoogleAuthUrl();
      if (authInfo.configured && authInfo.authUrl) {
        window.location.href = authInfo.authUrl;
      } else {
        // Fallback simulation mode for local testing without OAuth secrets
        const res = await api.connectGoogleCallback(null, null, true);
        setGoogleNotice('Connected in Developer Test Mode (Simulation).');
        checkGoogleStatus();
      }
    } catch (err) {
      showCustomAlert(err.message || 'Failed to initialize Google authorization.', 'Google Authorization', 'danger');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    showCustomConfirm({
      title: 'Disconnect Google Account?',
      message: 'Are you sure you want to disconnect your Google account from TaskFlow? Calendar sync will be disabled.',
      confirmText: 'Disconnect',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.disconnectGoogle();
          checkGoogleStatus();
          setGoogleNotice('Google account disconnected.');
          showCustomAlert('Google account disconnected successfully.', 'Disconnected', 'info');
        } catch (err) {
          showCustomAlert(err.message || 'Failed to disconnect Google account.', 'Disconnect Error', 'danger');
        }
      },
    });
  };

  const handleSyncMeeting = async (meetingId) => {
    try {
      const res = await api.syncMeetingWithGoogle(meetingId);
      showCustomAlert(res.message || 'Meeting synchronized with Google Calendar.', 'Google Calendar', 'success');
      loadHubData();
    } catch (err) {
      showCustomAlert(err.message || 'Google sync failed. Please connect Google account first.', 'Sync Failed', 'danger');
    }
  };

  // ----------------------------------------------------
  // WEBRTC CALLING ENGINE & ROOM LIFECYCLE
  // ----------------------------------------------------

  const initLocalMedia = async () => {
    try {
      // Release any prior tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play?.().catch(() => {});
      }
      setIsCameraOn(true);
      setIsMicOn(true);

      // Attach tracks to any established peer connections
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
    } catch (err) {
      console.warn('Camera/Microphone permission denied or unavailable:', err.message);
      // Fallback audio-only or empty stream
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setIsCameraOn(false);
        setIsMicOn(true);
        peerConnectionsRef.current.forEach((pc) => {
          audioStream.getAudioTracks().forEach((track) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
            if (sender) {
              sender.replaceTrack(track).catch(() => {});
            } else {
              try { pc.addTrack(track, audioStream); } catch (_) {}
            }
          });
        });
        return audioStream;
      } catch (e) {
        setIsCameraOn(false);
        setIsMicOn(false);
        return null;
      }
    }
  };

  const handleStartInstantMeeting = async () => {
    try {
      setLoading(true);
      const res = await api.createConnectRoom('Instant Connect Meeting');
      if (res && res.roomCode) {
        handleJoinRoom(res.roomCode);
      }
    } catch (err) {
      showCustomAlert(err.message || 'Failed to create meeting room.', 'Meeting Creation Failed', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (codeToJoin) => {
    const code = (codeToJoin || roomCodeInput || '').trim();
    if (!code) {
      showCustomAlert('Please enter a valid meeting room code.', 'Room Code Required', 'warning');
      return;
    }

    try {
      setLoading(true);
      // Verify room & permissions
      const roomData = await api.getConnectRoom(code);
      if (!roomData || !roomData.meeting) {
        showCustomAlert('Meeting room not found or access denied. Please verify your room code.', 'Room Not Found', 'danger');
        return;
      }

      setCurrentRoomCode(roomData.roomCode || code);
      setActiveMeeting(roomData.meeting);
      setIsHost(Boolean(roomData.isHost));
      setHostControls(roomData.hostControls || { muteAll: false, lockMeeting: false });
      if (roomData.chatMessages && Array.isArray(roomData.chatMessages)) {
        setChatMessages(roomData.chatMessages);
      }

      // Register join attendance in DB
      await api.joinConnectRoom(code);

      // Start local media
      await initLocalMedia();

      setActiveTab('room');
      setCallDuration(0);

      // Start duration counter
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Start polling for active peers, signaling, and chat
      startRoomPolling(code);
    } catch (err) {
      showCustomAlert(err.message || 'Unable to join meeting room.', 'Unable to Join', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const startRoomPolling = (code) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const [signalData, chatData] = await Promise.all([
          api.getConnectSignals(code).catch(() => ({ signals: [], activePeers: [] })),
          api.getConnectChat(code).catch(() => []),
        ]);

        if (signalData.meetingStatus === 'completed') {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          cleanupCallSession();
          showCustomAlert(
            'This meeting has been ended by the host. All attendance records have been saved.',
            'Meeting Ended',
            'warning'
          );
          return;
        }

        if (signalData.activePeers && Array.isArray(signalData.activePeers)) {
          setActivePeers(signalData.activePeers);

          // Establish WebRTC mesh connections with all active peers in the room
          signalData.activePeers.forEach(async (peer) => {
            const peerId = String(peer.userId);
            if (!peerId || peerId === myId) return;

            let pc = peerConnectionsRef.current.get(peerId);
            const isInitiator = myId > peerId;
            const needsConnection = !pc || pc.connectionState === 'failed' || pc.connectionState === 'closed';

            if (needsConnection && isInitiator) {
              try {
                pc = createPeerConnection(peerId, code, true);
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                await pc.setLocalDescription(offer);
                await api.sendConnectSignal(code, peerId, offer, 'offer');
              } catch (err) {
                console.warn('Failed to initiate WebRTC offer to peer:', peerId, err.message);
              }
            }
          });

          // Clean up remote streams for peers who have disconnected
          const activePeerIdSet = new Set(signalData.activePeers.map((p) => String(p.userId)));
          for (const [rId, pc] of peerConnectionsRef.current.entries()) {
            if (!activePeerIdSet.has(rId)) {
              try { pc.close(); } catch (_) {}
              peerConnectionsRef.current.delete(rId);
              remoteStreamsRef.current.delete(rId);
              pendingCandidatesRef.current.delete(rId);
              setPeersTick((t) => t + 1);
            }
          }
        }

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

        if (chatData && Array.isArray(chatData)) {
          setChatMessages((prev) => {
            const map = new Map();
            // Retain any pending optimistic messages that have not yet arrived from server
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

        // Process queued WebRTC signals
        if (signalData.signals && signalData.signals.length > 0) {
          await handleIncomingSignals(signalData.signals, code);
        }
      } catch (e) {
        // Polling error silently suppressed during brief transitions
      }
    }, 1200);
  };

  const handleIncomingSignals = async (signals, code) => {
    for (const item of signals) {
      const { senderId, signal, type } = item;
      const sId = String(senderId);
      if (!sId || sId === myId) continue;

      try {
        let pc = peerConnectionsRef.current.get(sId);
        const signalType = type || signal?.type;

        if (signalType === 'offer') {
          if (!pc || pc.signalingState !== 'stable') {
            if (pc) {
              try { pc.close(); } catch (_) {}
            }
            pc = createPeerConnection(sId, code, false);
          }

          const sdpData = signal.sdp ? signal : (signal.signal || signal);
          await pc.setRemoteDescription(new RTCSessionDescription(sdpData));

          // Drain queued ICE candidates
          const pending = pendingCandidatesRef.current.get(sId) || [];
          for (const cand of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingCandidatesRef.current.delete(sId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await api.sendConnectSignal(code, sId, answer, 'answer');
        } else if (signalType === 'answer') {
          if (pc && pc.signalingState === 'have-local-offer') {
            const sdpData = signal.sdp ? signal : (signal.signal || signal);
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
          if (candidateData && candidateData.candidate) {
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
        console.warn('Signaling processing error with peer:', sId, err.message);
      }
    }
  };

  const createPeerConnection = (remoteUserId, code, isOfferer) => {
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

    // Add local tracks (Audio and Camera/Screen)
    const streamToPublish = screenStreamRef.current || localStreamRef.current;
    if (streamToPublish) {
      streamToPublish.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, streamToPublish);
        } catch (_) {}
      });
    }

    // Handle ICE candidates found locally
    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate) {
        api.sendConnectSignal(code, remoteUserId, { candidate: event.candidate }, 'candidate').catch(() => {});
      }
    };

    // Handle incoming remote media tracks (Audio and Video)
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
      setPeersTick((t) => t + 1);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try { pc.restartIce(); } catch (_) {}
      }
      setPeersTick((t) => t + 1);
    };

    return pc;
  };

  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks[0].enabled = nextState;
        setIsMicOn(nextState);
        api.sendConnectPeerState(currentRoomCode, { micOn: nextState }).catch(() => {});
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoTracks[0].enabled;
        videoTracks[0].enabled = nextState;
        setIsCameraOn(nextState);
        api.sendConnectPeerState(currentRoomCode, { cameraOn: nextState }).catch(() => {});
      }
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    // Revert video track in local video element
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play?.().catch(() => {});
    }

    // Revert video track across all active RTCPeerConnections
    const camTrack = localStreamRef.current ? localStreamRef.current.getVideoTracks()[0] : null;
    peerConnectionsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender && camTrack) {
        sender.replaceTrack(camTrack).catch(() => {});
      }
    });

    api.sendConnectPeerState(currentRoomCode, { screenSharing: false }).catch(() => {});
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenSharing();
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = displayStream;
        setIsScreenSharing(true);

        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = displayStream;
          screenShareVideoRef.current.play?.().catch(() => {});
        }

        const screenTrack = displayStream.getVideoTracks()[0];

        // Replace video track across all active peer connections so remotes see the screen!
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack).catch(() => {});
          } else {
            try { pc.addTrack(screenTrack, displayStream); } catch (_) {}
          }
        });

        api.sendConnectPeerState(currentRoomCode, { screenSharing: true }).catch(() => {});

        screenTrack.onended = () => {
          stopScreenSharing();
        };
      } catch (err) {
        console.warn('Screen share cancelled or not allowed:', err.message);
      }
    }
  };

  // -------------------------------------------------------------------
  // Meeting Recording (Screen / Meeting Tab Video + Mixed Microphone Audio)
  // -------------------------------------------------------------------
  const startRecording = async () => {
    try {
      recordedChunksRef.current = [];
      let recordStream = null;

      // Method 1: Ask user to capture the meeting tab/window with system audio
      if (navigator.mediaDevices?.getDisplayMedia) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'browser',
            },
            audio: true, // Captures other participants and tab sounds
          });

          // Mix local microphone into audio track so the recorder's voice is included
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              const audioCtx = new AudioCtx();
              audioContextRef.current = audioCtx;
              const dest = audioCtx.createMediaStreamDestination();

              let hasAudioSource = false;
              const displayAudioTracks = displayStream.getAudioTracks();
              if (displayAudioTracks.length > 0) {
                const displaySource = audioCtx.createMediaStreamSource(
                  new MediaStream([displayAudioTracks[0]])
                );
                displaySource.connect(dest);
                hasAudioSource = true;
              }

              if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
                const micTrack = localStreamRef.current.getAudioTracks()[0];
                const micSource = audioCtx.createMediaStreamSource(new MediaStream([micTrack]));
                micSource.connect(dest);
                hasAudioSource = true;
              }

              const mixedAudioTracks = hasAudioSource
                ? dest.stream.getAudioTracks()
                : displayStream.getAudioTracks();

              recordStream = new MediaStream([
                ...displayStream.getVideoTracks(),
                ...mixedAudioTracks,
              ]);
            } else {
              recordStream = displayStream;
            }
          } catch (mixErr) {
            console.warn('Audio mixing error, using display stream directly:', mixErr);
            recordStream = displayStream;
          }

          // If the user clicks Chrome's blue "Stop sharing" bar, stop recording cleanly
          const videoTrack = displayStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = () => {
              stopRecording();
            };
          }
        } catch (displayErr) {
          if (displayErr.name === 'NotAllowedError' || displayErr.name === 'AbortError') {
            return; // User cancelled prompt
          }
          console.warn('Display capture failed, falling back to local stream:', displayErr);
        }
      }

      // Method 2 fallback: If displayMedia is not available or rejected
      if (!recordStream) {
        if (localStreamRef.current) {
          recordStream = localStreamRef.current;
        } else {
          showCustomAlert('Cannot access camera or screen to record.', 'Recording Error', 'warning');
          return;
        }
      }

      recordingStreamRef.current = recordStream;

      // Detect best supported MIME type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4',
      ];
      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (window.MediaRecorder?.isTypeSupported?.(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const recorder = new MediaRecorder(
        recordStream,
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = selectedMimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setRecordedVideoUrl(url);
          setShowRecordModal(true);

          // Auto-download recorded meeting
          const meetingTitle = (activeMeeting?.title || 'Connect_Meeting').replace(/[^a-z0-9_-]/gi, '_');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const filename = `TaskFlow_${meetingTitle}_${timestamp}.${ext}`;

          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
          }, 200);
        }

        // Cleanup display capture tracks without touching active local camera/mic
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach((t) => {
            const isLocal =
              localStreamRef.current &&
              (t === localStreamRef.current.getVideoTracks()[0] ||
                t === localStreamRef.current.getAudioTracks()[0]);
            if (!isLocal) {
              try { t.stop(); } catch (_) {}
            }
          });
          recordingStreamRef.current = null;
        }

        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch (_) {}
          audioContextRef.current = null;
        }

        setIsRecording(false);
        setRecordingDuration(0);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      showCustomAlert('Unable to start recording: ' + (err.message || 'Permission denied'), 'Recording Error', 'danger');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Error stopping media recorder:', err);
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || !currentRoomCode) return;
    const text = chatInput.trim();
    setChatInput('');

    const myName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || 'Me';
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMsg = {
      id: tempId,
      senderId: myId,
      senderName: myName,
      text,
      timestamp: new Date().toISOString(),
    };

    // Optimistically show message immediately
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await api.sendConnectChat(currentRoomCode, text);
      if (res && res.chatMessage) {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.chatMessage : m))
        );
      }
    } catch (err) {
      console.warn('Failed to send chat message:', err);
    }
  };

  const handleHostAction = async (action, value) => {
    if (!isHost) return;
    try {
      await api.sendConnectHostAction(currentRoomCode, action, value);
      setHostControls((prev) => ({ ...prev, [action]: value }));
      if (action === 'muteAll' && value) {
        setIsMicOn(false);
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
        }
      }
    } catch (err) {
      showCustomAlert(err.message || 'Host action failed.', 'Host Action Error', 'danger');
    }
  };

  const handleLeaveMeeting = () => {
    showCustomConfirm({
      title: 'Leave Meeting?',
      message: 'Are you sure you want to leave this meeting? You can rejoin anytime with your room code.',
      confirmText: 'Leave Meeting',
      cancelText: 'Stay',
      variant: 'danger',
      onConfirm: async () => {
        try {
          if (currentRoomCode) {
            await api.leaveConnectRoom(currentRoomCode).catch(() => {});
          }
        } finally {
          cleanupCallSession();
        }
      },
    });
  };

  const handleEndMeetingForAll = () => {
    showCustomConfirm({
      title: 'End Meeting for All?',
      message: 'End this meeting for all participants? All active peers will be disconnected and attendance records will be saved.',
      confirmText: 'End Meeting for All',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          if (currentRoomCode) {
            await api.endConnectRoom(currentRoomCode).catch(() => {});
          }
        } finally {
          cleanupCallSession();
        }
      },
    });
  };

  const cleanupCallSession = () => {
    // Stop tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    // Close peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();

    // Clear intervals
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Safely stop active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }

    setActiveTab('hub');
    setCurrentRoomCode('');
    setActiveMeeting(null);
    setIsScreenSharing(false);
    setIsHandRaised(false);
    loadHubData();
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/connect?room=${currentRoomCode}`;
    navigator.clipboard.writeText(link);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const unlockAudio = () => {
    document.querySelectorAll('audio, video').forEach((m) => {
      if (m.paused && m.srcObject && !m.muted) {
        m.play().catch(() => {});
      }
    });
  };

  const remotePresenter = activePeers.find(
    (p) => String(p.userId) !== myId && p.screenSharing
  );
  const isAnyonePresenting = isScreenSharing || Boolean(remotePresenter);

  return (
    <div className="connect-module-container animate-fade-in">
      {/* ----------------------------------------------------
          VIEW 1: IN-CALL VIDEO MEETING ROOM (GOOGLE MEET-LIKE)
      ---------------------------------------------------- */}
      {activeTab === 'room' && (
        <div className="in-call-experience-wrapper" onClick={unlockAudio}>
          {/* Top Meeting Header Bar */}
          <div className="call-top-bar">
            <div className="call-top-left">
              <div className="call-live-indicator">
                <span className="live-dot animate-pulse"></span>
                <strong>LIVE</strong>
                <span className="call-timer-badge">{formatTimer(callDuration)}</span>
              </div>
              {isRecording && (
                <div className="recording-status-pill" title="Meeting is currently being recorded">
                  <span className="rec-dot"></span>
                  <strong>REC</strong>
                  <span>{formatTimer(recordingDuration)}</span>
                </div>
              )}
              <h3 className="call-meeting-title">{activeMeeting?.title || 'Connect Video Meeting'}</h3>
              <div className="call-room-code-badge" onClick={copyRoomLink} title="Click to copy join link">
                <CopyIcon size={13} />
                <span>{currentRoomCode}</span>
                {copiedNotice && <span className="copied-pill">Copied!</span>}
              </div>
            </div>

            <div className="call-top-right">
              {activeMeeting?.googleSynced && (
                <span className="badge-google-synced" title="Synchronized with Google Calendar">
                  Google Synced
                </span>
              )}
              {isHost && (
                <span className="badge-host-crown">
                  <ShieldIcon size={12} /> Host Controls Active
                </span>
              )}
            </div>
          </div>

          {/* Main Stage & Video Tiles */}
          <div className="call-stage-area">
            <div className={`video-gallery-grid ${isAnyonePresenting ? 'presentation-mode' : ''}`}>
              {/* Screen Sharing Presentation Tile if Active (Local OR Remote) */}
              {isAnyonePresenting && (
                <div className="presentation-screen-tile animate-scale-up">
                  {isScreenSharing ? (
                    <video
                      ref={(el) => {
                        screenShareVideoRef.current = el;
                        if (el && screenStreamRef.current && el.srcObject !== screenStreamRef.current) {
                          el.srcObject = screenStreamRef.current;
                          el.play?.().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="screen-share-video"
                    />
                  ) : (
                    <video
                      ref={(el) => {
                        const rStream = remoteStreamsRef.current.get(String(remotePresenter?.userId));
                        if (el && rStream && el.srcObject !== rStream) {
                          el.srcObject = rStream;
                          el.play?.().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      className="screen-share-video"
                    />
                  )}
                  <div className="tile-user-tag">
                    <ScreenShareIcon size={14} />{' '}
                    {isScreenSharing
                      ? 'You are presenting your screen'
                      : `${remotePresenter?.name || 'Participant'} is presenting`}
                  </div>
                </div>
              )}

              {/* Local Participant Tile */}
              <div className={`video-tile ${isMicOn ? 'mic-active' : ''} ${isHandRaised ? 'hand-raised-glow' : ''}`}>
                <video
                  ref={(el) => {
                    localVideoRef.current = el;
                    if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                      el.srcObject = localStreamRef.current;
                      el.play?.().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`camera-video-element ${!isCameraOn ? 'hidden' : ''}`}
                />
                {!isCameraOn && (
                  <div className="camera-off-avatar">
                    <div className="avatar-circle-lg">
                      {user?.firstName?.[0] || 'U'}
                      {user?.lastName?.[0] || ''}
                    </div>
                  </div>
                )}
                <div className="tile-user-tag">
                  <span>{user?.firstName || 'You'} (You)</span>
                  {isHost && <span className="host-tag-pill">Host</span>}
                  {isHandRaised && <span className="hand-tag-pill">✋</span>}
                  <span className={`mic-tag-icon ${isMicOn ? 'text-success' : 'text-danger'}`}>
                    {isMicOn ? <MicIcon size={12} /> : <MicOffIcon size={12} />}
                  </span>
                </div>
              </div>

              {/* Remote Participants Tiles */}
              {activePeers
                .filter((p) => String(p.userId) !== myId)
                .map((peer) => {
                  const pId = String(peer.userId);
                  const remoteStream = remoteStreamsRef.current.get(pId);
                  const hasVideoTrack = remoteStream && remoteStream.getVideoTracks().some((t) => t.readyState === 'live');
                  const isCameraActive = peer.cameraOn !== false && hasVideoTrack;

                  return (
                    <div key={pId} className="video-tile remote-tile">
                      {/* Audio element ensures remote voice plays regardless of camera state */}
                      {remoteStream && (
                        <audio
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && el.srcObject !== remoteStream) {
                              el.srcObject = remoteStream;
                              el.play().catch((err) => console.warn('Audio playback error:', err));
                            }
                          }}
                        />
                      )}

                      {isCameraActive ? (
                        <video
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && el.srcObject !== remoteStream) {
                              el.srcObject = remoteStream;
                              el.play().catch((err) => console.warn('Video playback error:', err));
                            }
                          }}
                          className="camera-video-element"
                        />
                      ) : (
                        <div className="camera-off-avatar">
                          <div className="avatar-circle-lg">
                            {peer.name?.[0] || 'P'}
                          </div>
                          <span className="camera-off-pill">Camera Off</span>
                        </div>
                      )}
                      <div className="tile-user-tag">
                        <span>{peer.name || 'Participant'}</span>
                        {peer.isHost && <span className="host-tag-pill">Host</span>}
                        {peer.screenSharing && (
                          <span className="host-tag-pill" style={{ background: '#2563eb' }}>
                            <ScreenShareIcon size={12} /> Presenting
                          </span>
                        )}
                        <span className={`mic-tag-icon ${peer.micOn !== false ? 'text-success' : 'text-danger'}`}>
                          {peer.micOn !== false ? <MicIcon size={12} /> : <MicOffIcon size={12} />}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {/* Empty peer notice when alone */}
              {activePeers.filter((p) => String(p.userId) !== myId).length === 0 && (
                <div className="waiting-peers-tile animate-fade-in">
                  <UsersIcon size={32} className="text-muted" />
                  <h4>You are the only person in this meeting</h4>
                  <p>Share the room code or invitation link with team members to collaborate.</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copyRoomLink}>
                    <CopyIcon size={14} /> <span>Copy Invite Link</span>
                  </button>
                </div>
              )}
            </div>

            {/* In-Call Sliding Sidebar (Participants / Chat / Info) */}
            {activeSidePanel && (
              <div className="call-side-drawer animate-fade-in">
                <div className="drawer-header">
                  <h4>
                    {activeSidePanel === 'participants' && `Participants (${activePeers.length || 1})`}
                    {activeSidePanel === 'chat' && 'Meeting Messages'}
                    {activeSidePanel === 'info' && 'Joining Information'}
                  </h4>
                  <button type="button" className="close-btn" onClick={() => setActiveSidePanel('')}>
                    &times;
                  </button>
                </div>

                {/* 1. Participants List */}
                {activeSidePanel === 'participants' && (
                  <div className="drawer-body">
                    {isHost && (
                      <div className="host-quick-actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleHostAction('muteAll', !hostControls.muteAll)}
                        >
                          {hostControls.muteAll ? 'Unmute All Participants' : 'Mute All Participants'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleHostAction('lockMeeting', !hostControls.lockMeeting)}
                        >
                          {hostControls.lockMeeting ? 'Unlock Meeting Room' : 'Lock Meeting Room'}
                        </button>
                      </div>
                    )}

                    <div className="drawer-participants-list">
                      <div className="drawer-peer-item me">
                        <div className="peer-avatar">{user?.firstName?.[0] || 'U'}</div>
                        <div className="peer-info">
                          <strong>{user?.firstName} {user?.lastName} (You)</strong>
                          <span className="peer-role">{isHost ? 'Meeting Host' : 'Participant'}</span>
                        </div>
                        <div className="peer-status-icons">
                          {isMicOn ? <MicIcon size={14} className="text-success" /> : <MicOffIcon size={14} className="text-danger" />}
                          {isCameraOn ? <VideoIcon size={14} className="text-success" /> : <VideoOffIcon size={14} className="text-muted" />}
                        </div>
                      </div>

                      {activePeers
                        .filter((p) => String(p.userId) !== myId)
                        .map((p) => (
                          <div key={p.userId} className="drawer-peer-item">
                            <div className="peer-avatar">{p.name?.[0] || 'P'}</div>
                            <div className="peer-info">
                              <strong>{p.name}</strong>
                              <span className="peer-role">{p.isHost ? 'Meeting Host' : 'Participant'}</span>
                            </div>
                            <div className="peer-status-icons">
                              {p.micOn !== false ? <MicIcon size={14} className="text-success" /> : <MicOffIcon size={14} className="text-danger" />}
                              {p.cameraOn !== false ? <VideoIcon size={14} className="text-success" /> : <VideoOffIcon size={14} className="text-muted" />}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* 2. In-Call Chat */}
                {activeSidePanel === 'chat' && (
                  <div className="drawer-body chat-drawer-body">
                    <div className="chat-messages-container">
                      {chatMessages.length === 0 ? (
                        <p className="no-chat-yet">Messages sent here are visible to everyone in this call.</p>
                      ) : (
                        chatMessages.map((m, idx) => {
                          const isMine =
                            String(m.senderId) === myId ||
                            (m.senderId && (m.senderId === user?.id || m.senderId === user?._id)) ||
                            (m.senderName &&
                              m.senderName.toLowerCase() ===
                                `${user?.firstName || ''} ${user?.lastName || ''}`.trim().toLowerCase());
                          return (
                            <div key={m.id || idx} className={`chat-bubble-row ${isMine ? 'mine' : ''}`}>
                              <div className="chat-meta">
                                <strong>{isMine ? 'You' : m.senderName}</strong>
                                <span>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              </div>
                              <div className="chat-text-bubble">{m.text}</div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    <form className="chat-input-form" onSubmit={handleSendChat}>
                      <input
                        type="text"
                        placeholder="Send a message to everyone..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="chat-field"
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={!chatInput.trim()}>
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. Joining Info */}
                {activeSidePanel === 'info' && (
                  <div className="drawer-body">
                    <div className="joining-info-box">
                      <label>Meeting Title</label>
                      <p>{activeMeeting?.title}</p>
                    </div>
                    <div className="joining-info-box">
                      <label>Room Code</label>
                      <p><strong>{currentRoomCode}</strong></p>
                    </div>
                    <div className="joining-info-box">
                      <label>Direct Join URL</label>
                      <p className="url-text">{`${window.location.origin}/connect?room=${currentRoomCode}`}</p>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={copyRoomLink}>
                        <CopyIcon size={14} /> <span>Copy Joining Info</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Floating Bottom Control Dock */}
          <div className="call-controls-dock">
            {/* Mic Toggle */}
            <button
              type="button"
              className={`control-circle-btn ${isMicOn ? 'btn-active' : 'btn-danger'}`}
              onClick={toggleMicrophone}
              title={isMicOn ? 'Turn microphone off' : 'Turn microphone on'}
            >
              {isMicOn ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
            </button>

            {/* Camera Toggle */}
            <button
              type="button"
              className={`control-circle-btn ${isCameraOn ? 'btn-active' : 'btn-danger'}`}
              onClick={toggleCamera}
              title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {isCameraOn ? <VideoIcon size={20} /> : <VideoOffIcon size={20} />}
            </button>

            {/* Screen Share */}
            <button
              type="button"
              className={`control-circle-btn ${isScreenSharing ? 'btn-highlight' : 'btn-control-secondary'}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop sharing screen' : 'Share entire screen or window'}
            >
              <ScreenShareIcon size={20} />
            </button>

            {/* Raise Hand */}
            <button
              type="button"
              className={`control-circle-btn ${isHandRaised ? 'btn-highlight' : 'btn-control-secondary'}`}
              onClick={() => setIsHandRaised(!isHandRaised)}
              title={isHandRaised ? 'Lower hand' : 'Raise hand'}
            >
              <HandIcon size={20} />
            </button>

            {/* Record Meeting */}
            <button
              type="button"
              className={`control-circle-btn ${isRecording ? 'btn-recording' : 'btn-control-secondary'}`}
              onClick={toggleRecording}
              title={isRecording ? `Stop Recording (${formatTimer(recordingDuration)})` : 'Record Meeting'}
            >
              {isRecording ? <StopCircleIcon size={20} /> : <RecordIcon size={20} />}
            </button>

            {/* Participants Toggle */}
            <button
              type="button"
              className={`control-circle-btn ${activeSidePanel === 'participants' ? 'btn-active' : 'btn-control-secondary'}`}
              onClick={() => setActiveSidePanel(activeSidePanel === 'participants' ? '' : 'participants')}
              title="Participants list"
            >
              <UsersIcon size={20} />
              <span className="dock-badge">{activePeers.length || 1}</span>
            </button>

            {/* Chat Toggle */}
            <button
              type="button"
              className={`control-circle-btn ${activeSidePanel === 'chat' ? 'btn-active' : 'btn-control-secondary'}`}
              onClick={() => setActiveSidePanel(activeSidePanel === 'chat' ? '' : 'chat')}
              title="Meeting chat"
            >
              <MessageSquareIcon size={20} />
              {chatMessages.length > 0 && <span className="dock-dot"></span>}
            </button>

            {/* Info Toggle */}
            <button
              type="button"
              className={`control-circle-btn ${activeSidePanel === 'info' ? 'btn-active' : 'btn-control-secondary'}`}
              onClick={() => setActiveSidePanel(activeSidePanel === 'info' ? '' : 'info')}
              title="Meeting info"
            >
              <SparklesIcon size={20} />
            </button>

            {/* Leave / End Call Button */}
            <button
              type="button"
              className="control-circle-btn btn-leave-call"
              onClick={isHost ? handleEndMeetingForAll : handleLeaveMeeting}
              title={isHost ? 'End meeting for all' : 'Leave meeting'}
            >
              <PhoneOffIcon size={20} />
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          VIEW 2: CONNECT HUB (LOBBY, UPCOMING & HISTORY)
      ---------------------------------------------------- */}
      {activeTab !== 'room' && (
        <div className="connect-hub-layout animate-fade-in">
          {/* Header Banner */}
          <div className="connect-hero-card">
            <div className="connect-hero-content">
              <div className="connect-badge-capsule">
                <VideoIcon size={16} /> Built-in WebRTC Video System
              </div>
              <h2>Connekt</h2>
              <p className="hero-subtext">
                Native Google Meet-style audio/video calling built directly inside TaskFlow. Schedule,
                join, present screens, chat, and keep automatic attendance records.
              </p>

              {/* Quick Actions Bar */}
              <div className="hero-actions-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartInstantMeeting}
                  disabled={loading}
                >
                  <VideoIcon size={18} />
                  <span>Start Instant Meeting</span>
                </button>

                <div className="join-code-input-group">
                  <input
                    type="text"
                    placeholder="Enter meeting room code (con-xxx-yyy)"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value)}
                    className="join-input"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleJoinRoom(roomCodeInput)}
                    disabled={!roomCodeInput.trim()}
                  >
                    Join
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onScheduleInCalendar || onBackToCalendar}
                >
                  <CalendarIcon size={16} />
                  <span>Schedule in Calendar</span>
                </button>
              </div>
            </div>

            {/* Google Calendar Status Pill Card */}
            <div className="google-status-sidebar-card">
              <div className="google-card-header">
                <SparklesIcon size={18} className="text-accent" />
                <strong>Google Integration</strong>
              </div>
              <p className="google-card-status">
                {googleStatus.connected ? (
                  <span className="text-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircleIcon size={14} /> Connected: {googleStatus.email}
                  </span>
                ) : (
                  <span className="text-muted">Not Connected (OAuth Ready)</span>
                )}
              </p>
              {googleNotice && <p className="google-notice-text">{googleNotice}</p>}
              <div className="google-card-actions">
                {googleStatus.connected ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={handleDisconnectGoogle}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={handleConnectGoogle}
                    disabled={googleLoading}
                  >
                    {googleLoading ? 'Connecting...' : 'Connect Google Calendar'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hub Navigation Tabs */}
          <div className="connect-hub-nav-tabs">
            <button
              type="button"
              className={`hub-tab-btn ${activeTab === 'hub' ? 'active' : ''}`}
              onClick={() => setActiveTab('hub')}
            >
              Upcoming Online Meetings ({upcomingMeetings.length})
            </button>
            <button
              type="button"
              className={`hub-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Meeting History & Attendance Records ({meetingHistory.length})
            </button>
          </div>

          {/* TAB 1: UPCOMING MEETINGS */}
          {activeTab === 'hub' && (
            <div className="upcoming-meetings-section animate-fade-in">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading scheduled meetings...</p>
                </div>
              ) : upcomingMeetings.length === 0 ? (
                <div className="empty-state animate-fade-in">
                  <VideoIcon size={40} className="text-muted" />
                  <h3>No upcoming video meetings</h3>
                  <p>Start an instant meeting above or schedule a new meeting with the Calendar.</p>
                  <button type="button" className="btn btn-primary" onClick={handleStartInstantMeeting} style={{ marginTop: '12px' }}>
                    <VideoIcon size={16} /> <span>Start Instant Meeting</span>
                  </button>
                </div>
              ) : (
                <div className="history-table-wrapper animate-scale-up">
                  <table className="task-table connect-upcoming-table">
                    <thead>
                      <tr>
                        <th>Meeting Title & Room</th>
                        <th>Date & Schedule</th>
                        <th>Organizer</th>
                        <th>Participants</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingMeetings.map((m) => {
                        const isToday = m.date === new Date().toISOString().split('T')[0];
                        return (
                          <tr key={m._id || m.id}>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{m.title}</strong>
                                  <span className="room-code-tag" style={{ display: 'inline-flex', alignItems: 'center', margin: 0 }}>
                                    Room: {m.roomCode || 'con-room'}
                                  </span>
                                </div>
                                {m.agenda && <p className="meeting-card-agenda" style={{ marginTop: '2px' }}>{m.agenda}</p>}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span className={`meeting-day-pill ${isToday ? 'today' : ''}`} style={{ width: 'fit-content' }}>
                                  {isToday ? 'TODAY' : m.date}
                                </span>
                                <span className="meta-item" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  <ClockIcon size={13} /> {m.startTime} - {m.endTime}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <UserIcon size={14} className="text-muted" />
                                <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{m.organizerName}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <UsersIcon size={14} className="text-muted" />
                                <span style={{ color: 'var(--text-muted)' }}>{m.participants?.length || 0} participants</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleJoinRoom(m.roomCode || m._id)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <VideoIcon size={14} />
                                  <span>Join Meeting</span>
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => {
                                    const link = `${window.location.origin}/connect?room=${m.roomCode}`;
                                    navigator.clipboard.writeText(link);
                                    showCustomAlert('Meeting link copied to clipboard!', 'Link Copied', 'success');
                                  }}
                                  title="Copy meeting link"
                                  style={{ padding: '6px 8px' }}
                                >
                                  <CopyIcon size={14} />
                                </button>

                                {googleStatus.connected && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleSyncMeeting(m._id || m.id)}
                                    title="Sync to Google Calendar & Google Meet"
                                  >
                                    Sync Google
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MEETING HISTORY & ATTENDANCE RECORDS */}
          {activeTab === 'history' && (
            <div className="meeting-history-section animate-fade-in">
              <div className="history-table-wrapper">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th>Meeting Title</th>
                      <th>Date & Time</th>
                      <th>Organizer</th>
                      <th>Mode</th>
                      <th>Attendance Record</th>
                      <th>Minutes & Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetingHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          No past meeting history or attendance records logged yet.
                        </td>
                      </tr>
                    ) : (
                      meetingHistory.map((m) => {
                        const attendees = Array.isArray(m.attendance) ? m.attendance : [];
                        return (
                          <tr key={m._id || m.id}>
                            <td>
                              <strong>{m.title}</strong>
                              {m.roomCode && <span className="room-subtag">Room: {m.roomCode}</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span>{m.date}</span>
                                <small className="text-muted">{m.startTime} - {m.endTime}</small>
                              </div>
                            </td>
                            <td>{m.organizerName}</td>
                            <td>
                              <span className={`status-pill status-${m.mode === 'online' ? 'completed' : 'not-started'}`}>
                                {m.mode === 'online' ? 'Online Connect' : 'Offline In-Person'}
                              </span>
                            </td>
                            <td>
                              <div className="attendance-cell">
                                <strong>{attendees.length} logged attendees</strong>
                                {attendees.length > 0 && (
                                  <div className="attendees-compact-list">
                                    {attendees.slice(0, 3).map((a, i) => (
                                      <span key={i} className="attendee-pill" title={`Joined: ${new Date(a.joinedAt).toLocaleTimeString()}`}>
                                        {a.name} ({Math.round((a.durationSeconds || 60) / 60)}m)
                                      </span>
                                    ))}
                                    {attendees.length > 3 && (
                                      <span className="attendee-pill text-muted">+{attendees.length - 3} more</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`status-pill status-${m.status || 'completed'}`}>
                                {(m.status || 'completed').toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meeting Recording Review & Download Modal */}
      {showRecordModal && (
        <div className="modal-backdrop" onClick={() => setShowRecordModal(false)}>
          <div className="meeting-record-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="record-modal-header">
              <div className="record-modal-title">
                <CheckCircleIcon size={20} className="text-success" />
                <h3>Meeting Recording Saved</h3>
              </div>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setShowRecordModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  fontSize: '22px',
                  cursor: 'pointer',
                  lineHeight: '1',
                  padding: '4px',
                }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="record-modal-body">
              <p className="record-modal-subtext">
                Your meeting recording is complete and has been downloaded to your computer. You can play it below or download another copy anytime.
              </p>

              {recordedVideoUrl && (
                <div className="record-video-preview-wrapper">
                  <video
                    src={recordedVideoUrl}
                    controls
                    playsInline
                    className="record-preview-video"
                  />
                </div>
              )}
            </div>

            <div className="record-modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowRecordModal(false)}
              >
                Close
              </button>
              {recordedVideoUrl && (
                <a
                  href={recordedVideoUrl}
                  download={`TaskFlow_Meeting_${new Date().toISOString().slice(0, 10)}.webm`}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <DownloadIcon size={16} />
                  <span>Download Again</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom TaskFlow In-Website Dialog / Popup Modal */}
      {dialogState.isOpen && (
        <div
          className="taskflow-dialog-overlay"
          onClick={() => {
            if (dialogState.type === 'alert') {
              dialogState.onConfirm?.();
            } else {
              dialogState.onCancel?.();
            }
          }}
        >
          <div
            className="taskflow-dialog-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={`taskflow-dialog-icon-wrapper variant-${dialogState.variant}`}>
              {dialogState.variant === 'danger' && <PhoneOffIcon size={24} />}
              {dialogState.variant === 'warning' && <AlertTriangleIcon size={24} />}
              {dialogState.variant === 'success' && <CheckCircleIcon size={24} />}
              {dialogState.variant === 'info' && <SparklesIcon size={24} />}
            </div>

            <h3 className="taskflow-dialog-title">{dialogState.title}</h3>
            <p className="taskflow-dialog-message">{dialogState.message}</p>

            <div className="taskflow-dialog-actions">
              {dialogState.type === 'confirm' && (
                <button
                  type="button"
                  className="taskflow-dialog-btn-cancel"
                  onClick={dialogState.onCancel}
                >
                  {dialogState.cancelText}
                </button>
              )}
              <button
                type="button"
                className={`taskflow-dialog-btn-confirm ${
                  dialogState.variant === 'danger' ? 'variant-danger' : ''
                }`}
                onClick={dialogState.onConfirm}
                autoFocus
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
