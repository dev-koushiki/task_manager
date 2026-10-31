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
  const localVideoRef = useRef(null);
  const screenShareVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // userId -> RTCPeerConnection
  const remoteStreamsRef = useRef(new Map()); // userId -> MediaStream
  const pollingIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

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
      alert(err.message || 'Failed to initialize Google authorization.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect your Google account from TaskFlow?')) return;
    try {
      await api.disconnectGoogle();
      checkGoogleStatus();
      setGoogleNotice('Google account disconnected.');
    } catch (err) {
      alert(err.message || 'Failed to disconnect Google account.');
    }
  };

  const handleSyncMeeting = async (meetingId) => {
    try {
      const res = await api.syncMeetingWithGoogle(meetingId);
      alert(res.message || 'Meeting synchronized with Google Calendar.');
      loadHubData();
    } catch (err) {
      alert(err.message || 'Google sync failed. Please connect Google account first.');
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
      }
      setIsCameraOn(true);
      setIsMicOn(true);
      return stream;
    } catch (err) {
      console.warn('Camera/Microphone permission denied or unavailable:', err.message);
      // Fallback audio-only or empty stream
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setIsCameraOn(false);
        setIsMicOn(true);
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
      alert(err.message || 'Failed to create meeting room.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (codeToJoin) => {
    const code = (codeToJoin || roomCodeInput || '').trim();
    if (!code) {
      alert('Please enter a valid meeting room code.');
      return;
    }

    try {
      setLoading(true);
      // Verify room & permissions
      const roomData = await api.getConnectRoom(code);
      if (!roomData || !roomData.meeting) {
        alert('Meeting room not found or access denied.');
        return;
      }

      setCurrentRoomCode(code);
      setActiveMeeting(roomData.meeting);
      setIsHost(Boolean(roomData.isHost));
      setHostControls(roomData.hostControls || { muteAll: false, lockMeeting: false });
      setChatMessages(roomData.chatMessages || []);

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
      alert(err.message || 'Unable to join meeting room.');
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

        if (signalData.activePeers) {
          setActivePeers(signalData.activePeers);
        }
        if (chatData && Array.isArray(chatData)) {
          setChatMessages(chatData);
        }

        // Process queued WebRTC signals
        if (signalData.signals && signalData.signals.length > 0) {
          handleIncomingSignals(signalData.signals, code);
        }
      } catch (e) {
        // Polling error silently suppressed during brief transitions
      }
    }, 1500);
  };

  const handleIncomingSignals = async (signals, code) => {
    for (const item of signals) {
      const { senderId, signal, type } = item;
      try {
        let pc = peerConnectionsRef.current.get(senderId);

        if (!pc) {
          pc = createPeerConnection(senderId, code);
        }

        if (type === 'offer' || signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await api.sendConnectSignal(code, senderId, answer, 'answer');
        } else if (type === 'answer' || signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (type === 'candidate' || signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate || signal));
        }
      } catch (err) {
        console.warn('Signaling processing error:', err.message);
      }
    }
  };

  const createPeerConnection = (remoteUserId, code) => {
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }],
    };

    const pc = new RTCPeerConnection(configuration);
    peerConnectionsRef.current.set(remoteUserId, pc);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        api.sendConnectSignal(code, remoteUserId, { candidate: event.candidate }, 'candidate').catch(() => {});
      }
    };

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      remoteStreamsRef.current.set(remoteUserId, remoteStream);
      // Force state update to re-render video tiles
      setActivePeers((prev) => [...prev]);
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
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      setIsScreenSharing(false);
      // Revert video track in local view
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = displayStream;
        setIsScreenSharing(true);

        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = displayStream;
        }

        displayStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
      } catch (err) {
        console.warn('Screen share cancelled or not allowed:', err.message);
      }
    }
  };

  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || !currentRoomCode) return;
    const text = chatInput.trim();
    setChatInput('');

    try {
      const res = await api.sendConnectChat(currentRoomCode, text);
      if (res && res.chatMessage) {
        setChatMessages((prev) => [...prev, res.chatMessage]);
      }
    } catch (err) {
      alert(err.message || 'Failed to send message.');
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
      alert(err.message || 'Host action failed.');
    }
  };

  const handleLeaveMeeting = async () => {
    if (!window.confirm('Are you sure you want to leave this meeting?')) return;

    try {
      if (currentRoomCode) {
        await api.leaveConnectRoom(currentRoomCode).catch(() => {});
      }
    } finally {
      cleanupCallSession();
    }
  };

  const handleEndMeetingForAll = async () => {
    if (!window.confirm('End this meeting for all participants? All attendance records will be saved.')) return;

    try {
      if (currentRoomCode) {
        await api.endConnectRoom(currentRoomCode).catch(() => {});
      }
    } finally {
      cleanupCallSession();
    }
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

  return (
    <div className="connect-module-container animate-fade-in">
      {/* ----------------------------------------------------
          VIEW 1: IN-CALL VIDEO MEETING ROOM (GOOGLE MEET-LIKE)
      ---------------------------------------------------- */}
      {activeTab === 'room' && (
        <div className="in-call-experience-wrapper">
          {/* Top Meeting Header Bar */}
          <div className="call-top-bar">
            <div className="call-top-left">
              <div className="call-live-indicator">
                <span className="live-dot animate-pulse"></span>
                <strong>LIVE</strong>
                <span className="call-timer-badge">{formatTimer(callDuration)}</span>
              </div>
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
            <div className={`video-gallery-grid ${isScreenSharing ? 'presentation-mode' : ''}`}>
              {/* Screen Sharing Presentation Tile if Active */}
              {isScreenSharing && (
                <div className="presentation-screen-tile animate-scale-up">
                  <video ref={screenShareVideoRef} autoPlay playsInline muted className="screen-share-video" />
                  <div className="tile-user-tag">
                    <ScreenShareIcon size={14} /> You are presenting your screen
                  </div>
                </div>
              )}

              {/* Local Participant Tile */}
              <div className={`video-tile ${isMicOn ? 'mic-active' : ''} ${isHandRaised ? 'hand-raised-glow' : ''}`}>
                <video
                  ref={localVideoRef}
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
                .filter((p) => p.userId !== user?.id && p.userId !== user?._id)
                .map((peer) => {
                  const remoteStream = remoteStreamsRef.current.get(peer.userId);
                  return (
                    <div key={peer.userId} className="video-tile remote-tile">
                      {remoteStream ? (
                        <video
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && remoteStream && el.srcObject !== remoteStream) {
                              el.srcObject = remoteStream;
                            }
                          }}
                          className="camera-video-element"
                        />
                      ) : (
                        <div className="camera-off-avatar">
                          <div className="avatar-circle-lg">
                            {peer.name?.[0] || 'P'}
                          </div>
                        </div>
                      )}
                      <div className="tile-user-tag">
                        <span>{peer.name || 'Participant'}</span>
                        {peer.isHost && <span className="host-tag-pill">Host</span>}
                        <span className={`mic-tag-icon ${peer.micOn !== false ? 'text-success' : 'text-danger'}`}>
                          {peer.micOn !== false ? <MicIcon size={12} /> : <MicOffIcon size={12} />}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {/* Empty peer notice when alone */}
              {activePeers.filter((p) => p.userId !== user?.id && p.userId !== user?._id).length === 0 && (
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
                        .filter((p) => p.userId !== user?.id && p.userId !== user?._id)
                        .map((p) => (
                          <div key={p.userId} className="drawer-peer-item">
                            <div className="peer-avatar">{p.name?.[0] || 'P'}</div>
                            <div className="peer-info">
                              <strong>{p.name}</strong>
                              <span className="peer-role">{p.isHost ? 'Meeting Host' : 'Participant'}</span>
                            </div>
                            <div className="peer-status-icons">
                              {p.micOn !== false ? <MicIcon size={14} className="text-success" /> : <MicOffIcon size={14} className="text-danger" />}
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
                        chatMessages.map((m, idx) => (
                          <div key={m.id || idx} className={`chat-bubble-row ${m.senderId === user?.id ? 'mine' : ''}`}>
                            <div className="chat-meta">
                              <strong>{m.senderName}</strong>
                              <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="chat-text-bubble">{m.text}</div>
                          </div>
                        ))
                      )}
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
              className={`control-circle-btn ${isScreenSharing ? 'btn-highlight' : 'btn-secondary'}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop sharing screen' : 'Share entire screen or window'}
            >
              <ScreenShareIcon size={20} />
            </button>

            {/* Raise Hand */}
            <button
              type="button"
              className={`control-circle-btn ${isHandRaised ? 'btn-highlight' : 'btn-secondary'}`}
              onClick={() => setIsHandRaised(!isHandRaised)}
              title={isHandRaised ? 'Lower hand' : 'Raise hand'}
            >
              <HandIcon size={20} />
            </button>

            {/* Participants Toggle */}
            <button
              type="button"
              className={`control-circle-btn ${activeSidePanel === 'participants' ? 'btn-active' : 'btn-secondary'}`}
              onClick={() => setActiveSidePanel(activeSidePanel === 'participants' ? '' : 'participants')}
              title="Participants list"
            >
              <UsersIcon size={20} />
              <span className="dock-badge">{activePeers.length || 1}</span>
            </button>

            {/* Chat Toggle */}
            <button
              type="button"
              className={`control-circle-btn ${activeSidePanel === 'chat' ? 'btn-active' : 'btn-secondary'}`}
              onClick={() => setActiveSidePanel(activeSidePanel === 'chat' ? '' : 'chat')}
              title="Meeting chat"
            >
              <MessageSquareIcon size={20} />
              {chatMessages.length > 0 && <span className="dock-dot"></span>}
            </button>

            {/* Info Toggle */}
            <button
              type="button"
              className={`control-circle-btn ${activeSidePanel === 'info' ? 'btn-active' : 'btn-secondary'}`}
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
              <h2>Connect · Video Meetings & Google Workspace</h2>
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
                <div className="upcoming-meetings-grid">
                  {upcomingMeetings.map((m) => {
                    const isToday = m.date === new Date().toISOString().split('T')[0];
                    return (
                      <div key={m._id || m.id} className="connect-meeting-card animate-scale-up">
                        <div className="card-top-status">
                          <span className={`meeting-day-pill ${isToday ? 'today' : ''}`}>
                            {isToday ? 'TODAY' : m.date}
                          </span>
                          <span className="room-code-tag">Room: {m.roomCode || 'con-room'}</span>
                        </div>

                        <h4 className="meeting-card-title">{m.title}</h4>
                        {m.agenda && <p className="meeting-card-agenda">{m.agenda}</p>}

                        <div className="meeting-card-meta">
                          <span className="meta-item">
                            <ClockIcon size={13} /> {m.startTime} - {m.endTime}
                          </span>
                          <span className="meta-item">
                            <UserIcon size={13} /> Organizer: <strong>{m.organizerName}</strong>
                          </span>
                          <span className="meta-item">
                            <UsersIcon size={13} /> {m.participants?.length || 0} participants
                          </span>
                        </div>

                        <div className="meeting-card-actions-row">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleJoinRoom(m.roomCode || m._id)}
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
                              alert('Meeting link copied to clipboard!');
                            }}
                            title="Copy link"
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
                      </div>
                    );
                  })}
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
    </div>
  );
};
