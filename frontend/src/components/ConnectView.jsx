import { useState, useEffect, useRef } from 'react';
import {
  VideoIcon,
  VideoOffIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  UsersIcon,
  MessageSquareIcon,
  HandIcon,
  RecordIcon,
  StopCircleIcon,
  CopyIcon,
  SparklesIcon,
  ShieldIcon,
  CalendarIcon,
  CheckCircleIcon,
  DownloadIcon,
} from './Icons';
import { api } from '../services/api';
import { useConnectMeeting } from '../context/ConnectMeetingContext';

export const ConnectView = ({
  user,
  initialRoomCode,
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
  const [recordedBlobSize, setRecordedBlobSize] = useState(0);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const audioContextRef = useRef(null);

  // Modal for displaying newly created room details (host explicitly enters room)
  const [createdRoomModal, setCreatedRoomModal] = useState({
    isOpen: false,
    roomCode: '',
    meetingLink: '',
    title: '',
  });

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
  });

  const showCustomAlert = (message, title = 'Notification', variant = 'info') => {
    setDialogState({
      isOpen: true,
      type: 'alert',
      variant,
      title,
      message,
      confirmText: 'Got It',
      cancelText: '',
      onConfirm: () => setDialogState((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const showCustomConfirm = (message, onConfirmAction, title = 'Please Confirm', variant = 'warning') => {
    setDialogState({
      isOpen: true,
      type: 'confirm',
      variant,
      title,
      message,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: () => {
        setDialogState((prev) => ({ ...prev, isOpen: false }));
        if (typeof onConfirmAction === 'function') onConfirmAction();
      },
    });
  };

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  // Hub Meeting Data
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [meetingHistory, setMeetingHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Google Integration State
  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: '', hasClientId: false });
  const [googleNotice, setGoogleNotice] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Video Element Refs
  const localVideoRef = useRef(null);
  const screenShareVideoRef = useRef(null);
  const remoteScreenVideoRef = useRef(null);
  const chatBottomRef = useRef(null);
  const myId = String(user?.id || user?._id || '');

  const remotePresenter = activePeers.find((p) => String(p.userId) !== myId && p.screenSharing);
  const isAnyonePresenting = isScreenSharing || Boolean(remotePresenter);

  // Synchronize activeTab with call status
  useEffect(() => {
    if (isInCall) {
      setActiveTab('room');
    } else if (activeTab === 'room') {
      setActiveTab('hub');
    }
  }, [isInCall]);

  // Wire local video element when camera is active in room
  useEffect(() => {
    if (activeTab === 'room' && localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play?.().catch(() => {});
      }
    }
  }, [activeTab, localStream, isCameraOn]);

  // Wire local screen sharing video element reactively
  useEffect(() => {
    if (activeTab === 'room' && isScreenSharing && screenStream && screenShareVideoRef.current) {
      if (screenShareVideoRef.current.srcObject !== screenStream) {
        screenShareVideoRef.current.srcObject = screenStream;
        screenShareVideoRef.current.play?.().catch(() => {});
      }
    }
  }, [activeTab, isScreenSharing, screenStream]);

  // Wire remote screen sharing video element reactively
  useEffect(() => {
    if (activeTab === 'room' && !isScreenSharing && remotePresenter && remoteScreenVideoRef.current) {
      const pId = String(remotePresenter.userId);
      const rStream = remoteStreams.get(pId);
      if (rStream && remoteScreenVideoRef.current.srcObject !== rStream) {
        remoteScreenVideoRef.current.srcObject = rStream;
        remoteScreenVideoRef.current.play?.().catch((err) => {
          console.warn('[ConnectView] Remote screen video play error:', err);
        });
      }
    }
  }, [activeTab, isScreenSharing, remotePresenter, remoteStreams, remoteStreamsTick]);

  // Load Hub data without automatic joining
  useEffect(() => {
    loadHubData();
    checkGoogleConnection();
  }, []);

  // Display connection errors cleanly via popup dialog
  useEffect(() => {
    if (connectionError) {
      showCustomAlert(connectionError, 'Meeting Notice', 'warning');
    }
  }, [connectionError]);

  // Auto-scroll chat container to bottom on new message
  useEffect(() => {
    if (activeSidePanel === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeSidePanel]);

  const loadHubData = async () => {
    try {
      setLoading(true);
      const [meetings, history] = await Promise.all([
        api.getMeetings ? api.getMeetings() : Promise.resolve([]),
        api.getConnectHistory ? api.getConnectHistory() : Promise.resolve([]),
      ]);
      const onlineUpcoming = (Array.isArray(meetings) ? meetings : []).filter(
        (m) => m.mode === 'online' && m.status !== 'completed' && m.status !== 'cancelled'
      );
      setUpcomingMeetings(onlineUpcoming);
      setMeetingHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      console.warn('Failed to load Connect hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkGoogleConnection = async () => {
    try {
      if (api.getGoogleAuthStatus) {
        const status = await api.getGoogleAuthStatus();
        setGoogleStatus(status);
      }
    } catch (_) {}
  };

  const handleConnectGoogle = async () => {
    try {
      setGoogleLoading(true);
      setGoogleNotice('');
      if (api.getGoogleOAuthUrl) {
        const res = await api.getGoogleOAuthUrl();
        if (res && res.url) {
          window.location.href = res.url;
        } else {
          setGoogleNotice('Google OAuth Client ID is not configured on server.');
        }
      }
    } catch (err) {
      setGoogleNotice(err.message || 'Failed to initiate Google Calendar connection.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDisconnectGoogle = () => {
    showCustomConfirm('Are you sure you want to disconnect Google Calendar integration?', async () => {
      try {
        if (api.disconnectGoogleAccount) {
          await api.disconnectGoogleAccount();
        }
        setGoogleStatus({ connected: false, email: '', hasClientId: false });
        showCustomAlert('Google account disconnected successfully.', 'Disconnected', 'success');
      } catch (err) {
        showCustomAlert(err.message || 'Failed to disconnect Google account.', 'Disconnect Error', 'danger');
      }
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
  // CALL LIFECYCLE & BUTTON CLICK HANDLERS
  // ----------------------------------------------------

  const handleStartInstantMeeting = async () => {
    try {
      setLoading(true);
      const res = await createInstantMeeting('Instant Connect Meeting');
      if (res && res.roomCode) {
        const meetingLink = `${window.location.origin}/connect?room=${encodeURIComponent(res.roomCode)}`;
        setCreatedRoomModal({
          isOpen: true,
          roomCode: res.roomCode,
          meetingLink,
          title: res.meeting?.title || 'Instant Connect Meeting',
        });
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
      setCreatedRoomModal((prev) => ({ ...prev, isOpen: false }));
      await joinMeeting(code);
      setActiveTab('room');
    } catch (err) {
      showCustomAlert(err.message || 'Unable to join meeting room.', 'Unable to Join', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveMeeting = () => {
    showCustomConfirm(
      'Are you sure you want to leave this meeting? You can rejoin anytime with the meeting room code.',
      async () => {
        stopRecordingSafely();
        await leaveMeeting();
        setActiveTab('hub');
        loadHubData();
      },
      'Leave Meeting',
      'warning'
    );
  };

  const handleEndMeetingForAll = () => {
    showCustomConfirm(
      'Are you sure you want to end this meeting for all participants? All active connections will terminate and final attendance records will be saved.',
      async () => {
        stopRecordingSafely();
        await endMeetingForEveryone();
        setActiveTab('hub');
        loadHubData();
      },
      'End Meeting for Everyone',
      'danger'
    );
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const handleHostAction = (action, value) => {
    sendHostAction(action, value);
  };

  const copyRoomLink = () => {
    const code = currentRoomCode || roomCodeInput;
    if (!code) return;
    const link = `${window.location.origin}/connect?room=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(link);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // MEETING RECORDING ENGINE
  // ----------------------------------------------------

  const stopRecordingSafely = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (_) {}
      audioContextRef.current = null;
    }
    setIsRecording(false);
  };

  const startMeetingRecording = async () => {
    try {
      recordedChunksRef.current = [];
      let captureStream = null;

      try {
        captureStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' },
          audio: true,
        });
      } catch (dispErr) {
        if (localStream && localStream.getVideoTracks().length > 0) {
          captureStream = localStream.clone();
        } else {
          showCustomAlert(
            'Screen capture permission was cancelled. Meeting recording could not be started.',
            'Recording Cancelled',
            'warning'
          );
          return;
        }
      }

      recordingStreamRef.current = captureStream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const dest = audioCtx.createMediaStreamDestination();

        if (captureStream.getAudioTracks().length > 0) {
          try {
            const dispAudioSource = audioCtx.createMediaStreamSource(new MediaStream(captureStream.getAudioTracks()));
            dispAudioSource.connect(dest);
          } catch (_) {}
        }

        if (localStream && localStream.getAudioTracks().length > 0) {
          try {
            const micSource = audioCtx.createMediaStreamSource(new MediaStream(localStream.getAudioTracks()));
            micSource.connect(dest);
          } catch (_) {}
        }

        remoteStreams.forEach((stream) => {
          if (stream && stream.getAudioTracks().length > 0) {
            try {
              const remoteSource = audioCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
              remoteSource.connect(dest);
            } catch (_) {}
          }
        });

        const mixedAudioTrack = dest.stream.getAudioTracks()[0];
        if (mixedAudioTrack) {
          captureStream.getAudioTracks().forEach((t) => captureStream.removeTrack(t));
          captureStream.addTrack(mixedAudioTrack);
        }
      }

      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      const recorder = new MediaRecorder(captureStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);
        setRecordedVideoUrl(videoUrl);
        setRecordedBlobSize(blob.size);
        setShowRecordModal(true);
        stopRecordingSafely();
      };

      captureStream.getVideoTracks()[0].onended = () => {
        stopMeetingRecording();
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      showCustomAlert(err.message || 'Failed to start meeting recording.', 'Recording Error', 'danger');
      stopRecordingSafely();
    }
  };

  const stopMeetingRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      showCustomConfirm(
        'Do you want to stop recording and prepare the downloadable video file?',
        stopMeetingRecording,
        'Stop Recording',
        'info'
      );
    } else {
      startMeetingRecording();
    }
  };

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
              {/* Screen Sharing Presentation Tile if Active */}
              {isAnyonePresenting && (
                <div className="presentation-screen-tile animate-scale-up">
                  {isScreenSharing ? (
                    <video
                      ref={screenShareVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="screen-share-video"
                    />
                  ) : (
                    <video
                      ref={remoteScreenVideoRef}
                      autoPlay
                      playsInline
                      muted
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
                  const hasVideoTrack = remoteStream && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks().some((t) => t.enabled);
                  const isCameraActive = peer.cameraOn !== false && hasVideoTrack;

                  return (
                    <div key={pId} className="video-tile remote-tile">
                      {/* Video playback element - muted to allow instant autoplay and prevent audio conflicts */}
                      {isCameraActive ? (
                        <video
                          autoPlay
                          playsInline
                          muted
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
                        {peer.handRaised && <span className="hand-tag-pill">✋</span>}
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

          {/* Floating Bottom Control Dock - Restored original centered layout */}
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
                                  {m.date}
                                </span>
                                <small className="text-muted">{m.startTime} - {m.endTime}</small>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="peer-avatar" style={{ width: '26px', height: '26px', fontSize: '11px' }}>
                                  {m.organizerName?.[0] || 'O'}
                                </div>
                                <span>{m.organizerName}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <UsersIcon size={14} className="text-muted" />
                                <span>{(m.participants || []).length} invited</span>
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
                                <small className="text-muted">
                                  {attendees.map((a) => a.name).filter(Boolean).slice(0, 3).join(', ')}
                                  {attendees.length > 3 ? ` +${attendees.length - 3} more` : ''}
                                </small>
                              </div>
                            </td>
                            <td>
                              <span className={`status-pill status-${m.status === 'completed' ? 'completed' : 'in-progress'}`}>
                                {m.status || 'completed'}
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

      {/* ----------------------------------------------------
          MODALS & CUSTOM POPUP DIALOGS
      ---------------------------------------------------- */}

      {/* Created Room Modal (host explicitly enters room) */}
      {createdRoomModal.isOpen && (
        <div className="taskflow-dialog-overlay" onClick={() => setCreatedRoomModal((prev) => ({ ...prev, isOpen: false }))}>
          <div className="meeting-record-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', margin: 'auto' }}>
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
        <div className="taskflow-dialog-overlay" onClick={() => setShowRecordModal(false)}>
          <div className="meeting-record-modal-content" onClick={(e) => e.stopPropagation()} style={{ margin: 'auto' }}>
            <div className="record-modal-header">
              <div className="record-modal-title">
                <CheckCircleIcon size={20} className="text-success" />
                <h3>Meeting Recording Ready</h3>
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
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                Your meeting has been recorded successfully ({formatTimer(recordingDuration)} —{' '}
                {(recordedBlobSize / (1024 * 1024)).toFixed(2)} MB). You can preview the recording below
                and download the video file to your local computer.
              </p>

              {recordedVideoUrl && (
                <div className="recorded-video-preview-wrapper">
                  <video src={recordedVideoUrl} controls playsInline className="recorded-video-player" />
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
                  download={`TaskFlow-Meeting-${currentRoomCode || 'Connekt'}-${new Date().toISOString().slice(0, 10)}.webm`}
                  className="btn btn-primary btn-sm"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <DownloadIcon size={16} />
                  <span>Download Recording</span>
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
              if (typeof dialogState.onConfirm === 'function') dialogState.onConfirm();
              else closeDialog();
            } else {
              closeDialog();
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
              {dialogState.variant === 'warning' && <ShieldIcon size={24} />}
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
                  onClick={closeDialog}
                >
                  {dialogState.cancelText || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                className={`taskflow-dialog-btn-confirm ${
                  dialogState.variant === 'danger' ? 'variant-danger' : ''
                }`}
                onClick={() => {
                  if (typeof dialogState.onConfirm === 'function') {
                    dialogState.onConfirm();
                  } else {
                    closeDialog();
                  }
                }}
                autoFocus
              >
                {dialogState.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
