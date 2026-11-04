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
import { useConnectMeeting } from '../context/ConnectMeetingContext';

export const ConnectView = ({
  user,
  initialRoomCode = '',
  onScheduleInCalendar,
  onBackToCalendar,
}) => {
  const {
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
  } = useConnectMeeting();

  // Navigation tab within Connect: 'hub' | 'room' | 'history'
  const [activeTab, setActiveTab] = useState(isInCall ? 'room' : 'hub');
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode || '');
  const [activeSidePanel, setActiveSidePanel] = useState(''); // '' | 'participants' | 'chat' | 'info'
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Meeting Recording State & Refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(null);
  const [showRecordModal, setShowRecordModal] = useState(false);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Modal for displaying newly created room details (Phase 2 requirement: host explicitly enters room)
  const [createdRoomModal, setCreatedRoomModal] = useState({
    isOpen: false,
    roomCode: '',
    meetingLink: '',
    title: '',
  });

  // Custom Website Popup Dialog State
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    type: 'alert',
    variant: 'info',
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
  const [googleNotice, setGoogleNotice] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Video Element Refs
  const localVideoRef = useRef(null);
  const screenShareVideoRef = useRef(null);
  const chatBottomRef = useRef(null);
  const myId = String(user?.id || user?._id || '');

  // Synchronize activeTab with call status
  useEffect(() => {
    if (isInCall) {
      setActiveTab('room');
    } else if (activeTab === 'room') {
      setActiveTab('hub');
    }
  }, [isInCall]);

  // Auto-scroll chat container to the latest message
  useEffect(() => {
    if (activeSidePanel === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeSidePanel]);

  // Wire local video element when camera is active in room
  useEffect(() => {
    if (activeTab === 'room' && localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play?.().catch(() => {});
      }
    }
  }, [activeTab, localStream, isCameraOn]);

  // Initialize Hub data without automatic joining (Phase 2 Fix)
  useEffect(() => {
    loadHubData();
    checkGoogleStatus();

    // Check URL parameters for OAuth or prefilled room code
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const googleAuthCode = params.get('code');

    if (googleAuthCode) {
      handleGoogleAuthCallback(googleAuthCode);
    } else if (roomParam) {
      // Prefill the room input field so the user can review and explicitly click Join
      setRoomCodeInput(roomParam);
    } else if (initialRoomCode) {
      setRoomCodeInput(initialRoomCode);
    }

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
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
        await api.connectGoogleCallback(null, null, true);
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
      const res = await api.syncMeetingToGoogle(meetingId);
      showCustomAlert(res.message || 'Meeting synced to Google Calendar & Meet!', 'Google Sync', 'success');
      loadHubData();
    } catch (err) {
      showCustomAlert(err.message || 'Failed to sync meeting to Google Calendar.', 'Sync Error', 'danger');
    }
  };

  // Phase 2: Host clicks Create Instant Meeting -> Creates Room and shows details without auto-joining
  const handleStartInstantMeeting = async () => {
    try {
      setLoading(true);
      const res = await createInstantMeeting('Instant Connect Meeting');
      if (res && res.roomCode) {
        const fullLink = `${window.location.origin}/connect?room=${res.roomCode}`;
        setCreatedRoomModal({
          isOpen: true,
          roomCode: res.roomCode,
          meetingLink: fullLink,
          title: res.meeting?.title || 'Instant Connect Meeting',
        });
        loadHubData();
      }
    } catch (err) {
      showCustomAlert(err.message || 'Failed to create meeting room.', 'Meeting Creation Failed', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: Explicit Join Meeting action
  const handleJoinRoom = async (codeToJoin) => {
    const code = (codeToJoin || roomCodeInput || '').trim();
    if (!code) {
      showCustomAlert('Please enter a valid meeting room code.', 'Room Code Required', 'warning');
      return;
    }

    try {
      setLoading(true);
      await joinMeeting(code);
      setCreatedRoomModal((prev) => ({ ...prev, isOpen: false }));
      setActiveTab('room');
    } catch (err) {
      showCustomAlert(err.message || 'Unable to join meeting room. Please check the room code.', 'Unable to Join', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Explicit Leave Meeting action
  const handleLeaveMeeting = () => {
    showCustomConfirm({
      title: 'Leave Meeting?',
      message: 'Are you sure you want to leave this meeting? Your attendance time will be recorded.',
      confirmText: 'Leave',
      cancelText: 'Stay',
      variant: 'danger',
      onConfirm: async () => {
        await leaveMeeting();
        setActiveTab('hub');
        loadHubData();
      },
    });
  };

  // Host ends meeting for everyone
  const handleEndMeetingForAll = () => {
    showCustomConfirm({
      title: 'End Meeting for Everyone?',
      message: 'This will disconnect all active participants and conclude the meeting session. Attendance records will be permanently saved.',
      confirmText: 'End Meeting',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        await endMeetingForEveryone();
        setActiveTab('hub');
        loadHubData();
      },
    });
  };

  // In-call chat submit
  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput;
    setChatInput('');
    await sendChatMessage(text);
  };

  // Host Action (Mute All / Lock Meeting)
  const handleHostAction = async (action, value) => {
    await sendHostAction(action, value);
  };

  // Copy Room Link to Clipboard
  const copyRoomLink = () => {
    const link = `${window.location.origin}/connect?room=${currentRoomCode}`;
    navigator.clipboard.writeText(link);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  // Meeting Screen & Audio Recording
  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    } else {
      try {
        const streamToRecord = screenStream || localStream;
        if (!streamToRecord) {
          showCustomAlert('No active media stream found to record.', 'Recording Error', 'warning');
          return;
        }

        recordedChunksRef.current = [];
        const options = { mimeType: 'video/webm;codecs=vp9,opus' };
        let recorder;
        try {
          recorder = new MediaRecorder(streamToRecord, options);
        } catch {
          recorder = new MediaRecorder(streamToRecord);
        }

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedVideoUrl(url);
          setShowRecordModal(true);

          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `TaskFlow_Meeting_${currentRoomCode}_${new Date().toISOString().slice(0, 10)}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 100);
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        setRecordingDuration(0);

        recordingIntervalRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        showCustomAlert(err.message || 'Failed to start meeting recording.', 'Recording Error', 'danger');
      }
    }
  };

  // Format MM:SS for display
  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Presentation check
  const remotePresenter = activePeers.find((p) => p.screenSharing && String(p.userId) !== myId);
  const isAnyonePresenting = isScreenSharing || Boolean(remotePresenter);

  return (
    <div className="connect-module-root animate-fade-in">
      {/* ----------------------------------------------------
          VIEW 1: IN-CALL EXPERIENCE (ROOM VIEW)
      ---------------------------------------------------- */}
      {activeTab === 'room' && (
        <div className="in-call-experience-wrapper" onClick={unlockAudio}>
          {/* Top Meeting Header Bar */}
          <div className="call-top-bar">
            <div className="call-top-left">
              <span className="live-pulse-dot" />
              <h3 className="call-meeting-title">{activeMeeting?.title || 'Connect Video Meeting'}</h3>
              <div className="call-room-code-badge" onClick={copyRoomLink} title="Click to copy join link">
                <CopyIcon size={13} />
                <span>{currentRoomCode}</span>
                {copiedNotice && <span className="copied-pill">Link Copied!</span>}
              </div>
            </div>

            <div className="call-top-right">
              <div className="call-timer-chip">
                <ClockIcon size={14} />
                <span>{formatTimer(callDuration)}</span>
              </div>
              <div className="peers-count-chip">
                <UsersIcon size={14} />
                <span>{activePeers.length || 1} in call</span>
              </div>
              {hostControls.lockMeeting && (
                <div className="call-locked-chip" title="Meeting locked by host">
                  <LockIcon size={13} />
                  <span>Locked</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Stage & Video Tiles */}
          <div className="call-stage-area">
            <div className={`video-gallery-grid ${isAnyonePresenting ? 'presentation-mode' : ''}`}>
              {/* Screen Sharing Presentation Tile if Active */}
              {isAnyonePresenting && (
                <div className="presentation-screen-tile animate-scale-up">
                  {isScreenSharing ? (
                    <video
                      ref={(el) => {
                        screenShareVideoRef.current = el;
                        if (el && screenStream && el.srcObject !== screenStream) {
                          el.srcObject = screenStream;
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
                        const rStream = remoteStreams.get(String(remotePresenter?.userId));
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
                    if (el && localStream && el.srcObject !== localStream) {
                      el.srcObject = localStream;
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
                  const remoteStream = remoteStreams.get(pId);
                  const hasVideoTrack = remoteStream && remoteStream.getVideoTracks().some((t) => t.readyState === 'live');
                  const isCameraActive = peer.cameraOn !== false && hasVideoTrack;

                  return (
                    <div key={pId} className="video-tile remote-tile">
                      {isCameraActive ? (
                        <video
                          autoPlay
                          playsInline
                          ref={(el) => {
                            if (el && remoteStream && el.srcObject !== remoteStream) {
                              el.srcObject = remoteStream;
                              el.play?.().catch((err) => console.warn('Video playback error:', err));
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

              {/* Empty peer notice when alone in room */}
              {activePeers.filter((p) => String(p.userId) !== myId).length === 0 && (
                <div className="waiting-peer-card">
                  <div className="pulse-avatar-ring">
                    <UsersIcon size={32} />
                  </div>
                  <h4>You are the only person in this meeting</h4>
                  <p>Share the room code or invitation link with team members to collaborate.</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copyRoomLink}>
                    <CopyIcon size={14} /> <span>Copy Invite Link</span>
                  </button>
                </div>
              )}
            </div>

            {/* In-Call Collapsible Side Panel (Participants / Chat / Info) */}
            {activeSidePanel && (
              <div className="call-side-panel animate-scale-up">
                <div className="side-panel-header">
                  <h4>
                    {activeSidePanel === 'participants' && `Participants (${activePeers.length || 1})`}
                    {activeSidePanel === 'chat' && 'In-Call Chat'}
                    {activeSidePanel === 'info' && 'Meeting Information'}
                  </h4>
                  <button type="button" className="close-btn" onClick={() => setActiveSidePanel('')}>
                    &times;
                  </button>
                </div>

                {/* Panel 1: Participants List with Host Controls */}
                {activeSidePanel === 'participants' && (
                  <div className="side-panel-body">
                    {isHost && (
                      <div className="host-controls-box">
                        <span className="host-box-title">Host Controls</span>
                        <div className="host-actions-grid">
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
                      </div>
                    )}

                    <div className="participants-stack-list">
                      <div className="peer-row me-row">
                        <div className="peer-avatar">
                          {user?.firstName?.[0] || 'U'}
                        </div>
                        <div className="peer-info">
                          <strong>{user?.firstName || 'You'} {user?.lastName || ''} (You)</strong>
                          <small>{user?.email}</small>
                        </div>
                        <div className="peer-status-icons">
                          {isMicOn ? <MicIcon size={14} className="text-success" /> : <MicOffIcon size={14} className="text-danger" />}
                          {isCameraOn ? <VideoIcon size={14} className="text-success" /> : <VideoOffIcon size={14} className="text-muted" />}
                        </div>
                      </div>

                      {activePeers
                        .filter((p) => String(p.userId) !== myId)
                        .map((peer, i) => (
                          <div key={peer.userId || i} className="peer-row">
                            <div className="peer-avatar">
                              {peer.name?.[0] || 'P'}
                            </div>
                            <div className="peer-info">
                              <strong>{peer.name || 'Participant'}</strong>
                              <small>{peer.email}</small>
                            </div>
                            <div className="peer-status-icons">
                              {peer.micOn !== false ? <MicIcon size={14} className="text-success" /> : <MicOffIcon size={14} className="text-danger" />}
                              {peer.cameraOn !== false ? <VideoIcon size={14} className="text-success" /> : <VideoOffIcon size={14} className="text-muted" />}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Panel 2: In-Call Real-Time Chat */}
                {activeSidePanel === 'chat' && (
                  <div className="side-panel-body chat-panel-body">
                    <div className="chat-messages-container">
                      {chatMessages.length === 0 ? (
                        <p className="empty-chat-text">No messages yet. Send a message to start chatting with participants.</p>
                      ) : (
                        chatMessages.map((msg, i) => {
                          const isMine = String(msg.senderId) === myId;
                          return (
                            <div key={msg.id || i} className={`chat-bubble-wrap ${isMine ? 'mine' : 'theirs'}`}>
                              <span className="chat-sender-name">{isMine ? 'You' : msg.senderName}</span>
                              <div className="chat-bubble-content">
                                <p>{msg.text}</p>
                                <span className="chat-time-tag">
                                  {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    <form onSubmit={handleSendChat} className="chat-composer-form">
                      <input
                        type="text"
                        placeholder="Type a message to participants..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="chat-input-field"
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={!chatInput.trim()}>
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {/* Panel 3: Meeting Information */}
                {activeSidePanel === 'info' && (
                  <div className="side-panel-body info-panel-body">
                    <div className="info-item">
                      <label>Meeting Title</label>
                      <p>{activeMeeting?.title || 'Connect Meeting'}</p>
                    </div>
                    {activeMeeting?.agenda && (
                      <div className="info-item">
                        <label>Agenda</label>
                        <p>{activeMeeting.agenda}</p>
                      </div>
                    )}
                    <div className="info-item">
                      <label>Room Code</label>
                      <div className="code-box-row">
                        <code>{currentRoomCode}</code>
                        <button type="button" className="btn btn-secondary btn-xs" onClick={copyRoomLink}>
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="info-item">
                      <label>Join Link</label>
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

          {/* Bottom Dock Control Bar */}
          <div className="call-bottom-dock">
            {/* Microphone Toggle */}
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
              onClick={toggleHandRaised}
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
                    disabled={!roomCodeInput.trim() || loading}
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

            {/* Google Calendar Status Card */}
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
                  <h3>Select a meeting or create a new meeting to get started</h3>
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
                                  disabled={loading}
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

      {/* Phase 2: Host Created Room Modal (Room created, presents link, host explicitly enters) */}
      {createdRoomModal.isOpen && (
        <div className="modal-backdrop" onClick={() => setCreatedRoomModal((prev) => ({ ...prev, isOpen: false }))}>
          <div className="meeting-record-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="record-modal-header">
              <div className="record-modal-title">
                <CheckCircleIcon size={20} className="text-success" />
                <h3>Meeting Room Created!</h3>
              </div>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setCreatedRoomModal((prev) => ({ ...prev, isOpen: false }))}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="record-modal-body" style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Your meeting room has been successfully initialized. You can copy the invitation link to share with colleagues and click below to enter the room when you are ready.
              </p>

              <div style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.2))', padding: '14px', borderRadius: '10px', marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Room Code</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <code style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-color, #3b82f6)' }}>
                    {createdRoomModal.roomCode}
                  </code>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(createdRoomModal.roomCode);
                      showCustomAlert('Room code copied!', 'Copied', 'success');
                    }}
                  >
                    <CopyIcon size={12} /> Copy Code
                  </button>
                </div>
              </div>

              <div style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.2))', padding: '14px', borderRadius: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invitation Link</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {createdRoomModal.meetingLink}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(createdRoomModal.meetingLink);
                      showCustomAlert('Meeting link copied to clipboard!', 'Copied', 'success');
                    }}
                  >
                    <CopyIcon size={12} /> Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="record-modal-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCreatedRoomModal((prev) => ({ ...prev, isOpen: false }))}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleJoinRoom(createdRoomModal.roomCode)}
              >
                <VideoIcon size={14} />
                <span>Enter Meeting Room</span>
              </button>
            </div>
          </div>
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
