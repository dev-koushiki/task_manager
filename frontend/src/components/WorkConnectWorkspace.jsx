import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { workConnectService } from '../services/workConnectService';
import {
  MonitorIcon,
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  Share2Icon,
  MessageSquareIcon,
  XIcon,
  ShieldIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  SendIcon,
  PenToolIcon,
  CornerUpRightIcon,
  Trash2Icon,
  PhoneOffIcon,
  ClockIcon,
  FileTextIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
} from './Icons';

export const WorkConnectWorkspace = ({
  session,
  currentUser,
  onLeaveSession,
  onSessionEnded,
}) => {
  const [sessionData, setSessionData] = useState(session);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenActive, setIsRemoteScreenActive] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [connectionQuality, setConnectionQuality] = useState('good'); // 'excellent' | 'good' | 'poor' | 'reconnecting'
  const [activeTool, setActiveTool] = useState('marker'); // 'marker' | 'arrow' | 'highlighter' | 'pointer' | 'none'
  const [annotationColor, setAnnotationColor] = useState('#ef4444');
  const [annotations, setAnnotations] = useState([]);
  const [remotePointer, setRemotePointer] = useState(null);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [updateTaskFlag, setUpdateTaskFlag] = useState(true);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [durationTimer, setDurationTimer] = useState(0);

  const screenVideoRef = useRef(null);
  const localCamVideoRef = useRef(null);
  const annotationCanvasRef = useRef(null);
  const chatScrollRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentLineRef = useRef([]);

  const isRequester = session?.requester?._id === currentUser?._id;
  const isReceiver = session?.receiver?._id === currentUser?._id;
  const peerUser = isRequester ? session?.receiver : session?.requester;
  const screenOwner = sessionData?.screenSharing?.owner === currentUser?._id ? currentUser : peerUser;
  const isCurrentUserScreenOwner = sessionData?.screenSharing?.owner === currentUser?._id;

  // Session Duration Counter
  useEffect(() => {
    const startTime = session?.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const interval = setInterval(() => {
      setDurationTimer(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.startedAt]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // WorkConnect WebRTC & Signaling Setup
  useEffect(() => {
    if (!session?._id) return;

    // Join session in service
    workConnectService.joinSession(session._id, currentUser, isRequester);

    // Subscribe to remote streams
    const unsubRemoteStream = workConnectService.on('remote_stream', ({ stream, track }) => {
      if (screenVideoRef.current && track.kind === 'video') {
        screenVideoRef.current.srcObject = stream;
        setIsRemoteScreenActive(true);
      }
    });

    const unsubLocalScreen = workConnectService.on('local_screen_stream', (stream) => {
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        setIsScreenSharing(true);
      }
    });

    const unsubLocalScreenStopped = workConnectService.on('local_screen_stopped', () => {
      setIsScreenSharing(false);
    });

    const unsubScreenStatus = workConnectService.on('screen_sharing_status', (active) => {
      setIsRemoteScreenActive(active);
    });

    const unsubLocalCam = workConnectService.on('local_camera_stream', (stream) => {
      if (localCamVideoRef.current) {
        localCamVideoRef.current.srcObject = stream;
      }
    });

    const unsubLocalCamStopped = workConnectService.on('local_camera_stopped', () => {
      if (localCamVideoRef.current) {
        localCamVideoRef.current.srcObject = null;
      }
    });

    const unsubChat = workConnectService.on('chat_message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    const unsubAnnotation = workConnectService.on('annotation', (ann) => {
      if (ann.tool === 'pointer') {
        setRemotePointer(ann);
      } else {
        setAnnotations((prev) => [...prev, ann]);
      }
    });

    const unsubClearAnnotations = workConnectService.on('clear_annotations', () => {
      setAnnotations([]);
      setRemotePointer(null);
      clearCanvas();
    });

    const unsubConnState = workConnectService.on('connection_state', (state) => {
      if (state === 'connected') setConnectionQuality('excellent');
      else if (state === 'connecting') setConnectionQuality('reconnecting');
      else if (state === 'failed') setConnectionQuality('poor');
    });

    const unsubSessionEnded = workConnectService.on('session_ended', () => {
      setSummaryModalOpen(true);
    });

    const unsubPermissions = workConnectService.on('permissions_updated', (newPerms) => {
      setSessionData((prev) => ({ ...prev, permissions: newPerms }));
    });

    return () => {
      unsubRemoteStream();
      unsubLocalScreen();
      unsubLocalScreenStopped();
      unsubScreenStatus();
      unsubLocalCam();
      unsubLocalCamStopped();
      unsubChat();
      unsubAnnotation();
      unsubClearAnnotations();
      unsubConnState();
      unsubSessionEnded();
      unsubPermissions();
    };
  }, [session?._id, currentUser?._id, isRequester]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Redraw canvas whenever annotations change
  useEffect(() => {
    redrawCanvas();
  }, [annotations]);

  // Resize canvas overlay to match video element
  useEffect(() => {
    const handleResize = () => {
      if (screenVideoRef.current && annotationCanvasRef.current) {
        const video = screenVideoRef.current;
        const canvas = annotationCanvasRef.current;
        canvas.width = video.clientWidth || 800;
        canvas.height = video.clientHeight || 450;
        redrawCanvas();
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isScreenSharing, isRemoteScreenActive]);

  const clearCanvas = () => {
    const canvas = annotationCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const redrawCanvas = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    annotations.forEach((ann) => {
      ctx.save();
      ctx.strokeStyle = ann.color || '#ef4444';
      ctx.fillStyle = ann.color || '#ef4444';
      ctx.lineWidth = ann.tool === 'highlighter' ? 14 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (ann.tool === 'highlighter') {
        ctx.globalAlpha = 0.35;
      }

      if (ann.tool === 'arrow' && ann.start && ann.end) {
        const fromX = ann.start.x * w;
        const fromY = ann.start.y * h;
        const toX = ann.end.x * w;
        const toY = ann.end.y * h;

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        const angle = Math.atan2(toY - fromY, toX - fromX);
        const headlen = 16;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.lineTo(toX, toY);
        ctx.fill();
      } else if (Array.isArray(ann.points) && ann.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x * w, ann.points[0].y * h);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x * w, ann.points[i].y * h);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  };

  // Canvas Mouse / Touch Handlers for Drawing
  const handleCanvasMouseDown = (e) => {
    if (activeTool === 'none') return;
    if (!sessionData?.permissions?.allowAnnotations && !isCurrentUserScreenOwner) {
      return;
    }

    const rect = annotationCanvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (activeTool === 'pointer') {
      const pointerAnn = {
        tool: 'pointer',
        color: annotationColor,
        point: { x, y },
        user: currentUser?.firstName || 'User',
      };
      setRemotePointer(pointerAnn);
      workConnectService.sendAnnotation(pointerAnn);
      return;
    }

    isDrawingRef.current = true;
    currentLineRef.current = [{ x, y }];
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawingRef.current && activeTool !== 'pointer') return;
    const rect = annotationCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (activeTool === 'pointer') {
      const pointerAnn = {
        tool: 'pointer',
        color: annotationColor,
        point: { x, y },
        user: currentUser?.firstName || 'User',
      };
      setRemotePointer(pointerAnn);
      workConnectService.sendAnnotation(pointerAnn);
      return;
    }

    if (isDrawingRef.current) {
      currentLineRef.current.push({ x, y });

      // Immediate temporary preview
      const canvas = annotationCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.strokeStyle = annotationColor;
      ctx.lineWidth = activeTool === 'highlighter' ? 14 : 3;
      ctx.lineCap = 'round';
      if (activeTool === 'highlighter') ctx.globalAlpha = 0.35;

      const lastPoint = currentLineRef.current[currentLineRef.current.length - 2];
      ctx.beginPath();
      ctx.moveTo(lastPoint.x * canvas.width, lastPoint.y * canvas.height);
      ctx.lineTo(x * canvas.width, y * canvas.height);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentLineRef.current.length > 1) {
      let newAnnotation;
      if (activeTool === 'arrow') {
        newAnnotation = {
          tool: 'arrow',
          color: annotationColor,
          start: currentLineRef.current[0],
          end: currentLineRef.current[currentLineRef.current.length - 1],
        };
      } else {
        newAnnotation = {
          tool: activeTool,
          color: annotationColor,
          points: currentLineRef.current,
        };
      }

      setAnnotations((prev) => [...prev, newAnnotation]);
      workConnectService.sendAnnotation(newAnnotation);
    }
    currentLineRef.current = [];
  };

  const handleClearAnnotations = () => {
    setAnnotations([]);
    setRemotePointer(null);
    clearCanvas();
    workConnectService.clearAnnotations();
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await workConnectService.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await workConnectService.startScreenShare();
        setIsScreenSharing(true);
      }
    } catch (err) {
      alert(`Screen share error: ${err.message || 'Permission denied'}`);
    }
  };

  // Toggle Microphone
  const handleToggleMic = async () => {
    try {
      const newState = !isMicOn;
      await workConnectService.toggleMicrophone(newState);
      setIsMicOn(newState);
    } catch (err) {
      alert(`Microphone error: ${err.message || 'Could not access microphone'}`);
    }
  };

  // Toggle Camera
  const handleToggleCam = async () => {
    try {
      const newState = !isCamOn;
      await workConnectService.toggleCamera(newState);
      setIsCamOn(newState);
    } catch (err) {
      alert(`Camera error: ${err.message || 'Could not access camera'}`);
    }
  };

  // Send Chat
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    const msg = workConnectService.sendChatMessage(inputMessage);
    if (msg) {
      setChatMessages((prev) => [...prev, msg]);
      setInputMessage('');
    }
  };

  // Save Permissions
  const handleSavePermissions = async (updatedPerms) => {
    try {
      const res = await api.updateWorkConnectPermissions(sessionData._id, updatedPerms);
      if (res && res.success) {
        setSessionData((prev) => ({ ...prev, permissions: updatedPerms }));
        workConnectService.sendSignal({
          type: 'permissions_updated',
          permissions: updatedPerms,
        });
        setPermissionsModalOpen(false);
      }
    } catch (err) {
      alert(`Could not save permissions: ${err.message}`);
    }
  };

  // End Session Confirmation
  const handleInitiateEndSession = () => {
    if (window.confirm('Are you sure you want to end this remote assistance session?')) {
      setSummaryModalOpen(true);
    }
  };

  // Submit Summary and Finish
  const handleSubmitSummaryAndEnd = async () => {
    setIsSavingSummary(true);
    try {
      await api.endWorkConnectSession(sessionData._id, {
        assistanceSummary: summaryText,
        updateAttachedTask: updateTaskFlag,
      });

      workConnectService.sendSignal({ type: 'end_session' });
      await workConnectService.leaveSession();
      if (onSessionEnded) onSessionEnded();
    } catch (err) {
      alert(`Error ending session: ${err.message}`);
    } finally {
      setIsSavingSummary(false);
    }
  };

  return (
    <div className="workconnect-workspace animate-fade-in">
      {/* Top Session Header Bar */}
      <header className="workspace-header">
        <div className="workspace-header-left">
          <div className="workspace-badge">
            <span className="live-pulse-dot" />
            <span className="font-bold text-xs uppercase tracking-wider">Live Assistance</span>
          </div>

          <div className="workspace-session-id">
            <span className="text-muted text-xs">Session:</span>
            <span className="font-mono text-xs font-semibold">{sessionData?.sessionId}</span>
          </div>

          <div className="workspace-timer">
            <ClockIcon size={14} />
            <span>{formatDuration(durationTimer)}</span>
          </div>

          {sessionData?.attachedTask && (
            <div className="workspace-task-pill" title="Attached Task Context">
              <FileTextIcon size={13} />
              <span className="truncate max-w-[220px]">
                {sessionData.attachedTask.title || 'Task Collaboration'}
              </span>
            </div>
          )}
        </div>

        <div className="workspace-header-right">
          {/* Peer Card */}
          <div className="workspace-peer-chip">
            <div className="peer-avatar-circle">
              {peerUser?.firstName?.charAt(0) || 'U'}
            </div>
            <div className="peer-details text-xs">
              <div className="font-semibold">{peerUser?.firstName} {peerUser?.lastName}</div>
              <div className="text-muted text-[11px]">{peerUser?.designation || peerUser?.role || 'Colleague'}</div>
            </div>
          </div>

          {/* Connection Quality Indicator */}
          <div className={`quality-chip quality-${connectionQuality}`} title={`Connection: ${connectionQuality}`}>
            <span className="quality-dot" />
            <span className="text-xs capitalize font-medium">{connectionQuality}</span>
          </div>

          {/* Permissions button (only for screen owner / requester) */}
          <button
            type="button"
            className="btn btn-sm btn-outline workspace-perm-btn"
            onClick={() => setPermissionsModalOpen(true)}
            title="Session Permissions"
          >
            <ShieldIcon size={14} />
            <span className="hidden sm:inline">Permissions</span>
          </button>
        </div>
      </header>

      {/* Main Center Area: Screen View + Side Chat */}
      <div className="workspace-body">
        <div className="workspace-stage">
          {/* Central Screen Area */}
          <div className="workspace-screen-container">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className={`workspace-video ${isScreenSharing || isRemoteScreenActive ? 'active' : 'idle'}`}
            />

            {/* Empty state when no screen is shared */}
            {!isScreenSharing && !isRemoteScreenActive && (
              <div className="workspace-empty-stage">
                <div className="empty-stage-icon">
                  <MonitorIcon size={48} />
                </div>
                <h3>No Screen Currently Shared</h3>
                <p>
                  Click <strong>"Share Screen"</strong> below to broadcast your display or application window, or wait for {peerUser?.firstName || 'colleague'} to share.
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-3"
                  onClick={handleToggleScreenShare}
                >
                  <Share2Icon size={16} />
                  <span>Start Screen Sharing</span>
                </button>
              </div>
            )}

            {/* HTML5 Canvas Overlay for Annotations */}
            <canvas
              ref={annotationCanvasRef}
              className={`workspace-annotation-canvas ${activeTool !== 'none' ? 'drawing-active' : ''}`}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />

            {/* Remote animated pointer dot */}
            {remotePointer && remotePointer.point && (
              <div
                className="remote-pointer-dot animate-ping-once"
                style={{
                  left: `${remotePointer.point.x * 100}%`,
                  top: `${remotePointer.point.y * 100}%`,
                  backgroundColor: remotePointer.color || '#ef4444',
                }}
              >
                <div className="pointer-user-tag">{remotePointer.user}</div>
              </div>
            )}

            {/* PIP Webcam Thumbnail */}
            {isCamOn && (
              <div className="workspace-pip-camera">
                <video ref={localCamVideoRef} autoPlay playsInline muted className="pip-video" />
                <span className="pip-label">You</span>
              </div>
            )}

            {/* Screen Owner Watermark Pill */}
            {(isScreenSharing || isRemoteScreenActive) && (
              <div className="workspace-screen-badge">
                <MonitorIcon size={14} />
                <span>Screen: {isCurrentUserScreenOwner ? 'Your Screen' : `${peerUser?.firstName}'s Screen`}</span>
              </div>
            )}
          </div>

          {/* Floating Annotation Toolbar */}
          {(isScreenSharing || isRemoteScreenActive) && (
            <div className="workspace-annotation-bar animate-fade-in">
              <span className="annotation-label text-xs font-semibold text-muted">Tools:</span>
              <button
                type="button"
                className={`tool-btn ${activeTool === 'marker' ? 'active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'marker' ? 'none' : 'marker')}
                title="Pen Marker"
              >
                <PenToolIcon size={15} />
              </button>
              <button
                type="button"
                className={`tool-btn ${activeTool === 'arrow' ? 'active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'arrow' ? 'none' : 'arrow')}
                title="Draw Arrow"
              >
                <CornerUpRightIcon size={15} />
              </button>
              <button
                type="button"
                className={`tool-btn ${activeTool === 'highlighter' ? 'active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'highlighter' ? 'none' : 'highlighter')}
                title="Highlighter"
              >
                <span className="font-bold text-xs">H</span>
              </button>
              <button
                type="button"
                className={`tool-btn ${activeTool === 'pointer' ? 'active' : ''}`}
                onClick={() => setActiveTool(activeTool === 'pointer' ? 'none' : 'pointer')}
                title="Live Pointer"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              </button>

              <div className="color-swatches">
                {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-dot ${annotationColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setAnnotationColor(color)}
                  />
                ))}
              </div>

              <button
                type="button"
                className="tool-btn text-danger"
                onClick={handleClearAnnotations}
                title="Clear Annotations"
              >
                <Trash2Icon size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Right Side Live Chat & Collaboration Drawer */}
        {chatOpen && (
          <aside className="workspace-chat-sidebar animate-slide-left">
            <div className="chat-sidebar-header">
              <div className="flex items-center gap-2">
                <MessageSquareIcon size={16} />
                <span className="font-semibold text-sm">Session Chat</span>
              </div>
              <button
                type="button"
                className="close-drawer-btn"
                onClick={() => setChatOpen(false)}
                title="Hide Chat"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Task summary header inside chat if attached */}
            {sessionData?.attachedTask && (
              <div className="chat-task-context">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Attached Task</div>
                <div className="text-xs font-semibold text-main truncate">{sessionData.attachedTask.title}</div>
                <div className="text-[11px] text-muted">Status: {sessionData.attachedTask.status || 'In Progress'}</div>
              </div>
            )}

            <div className="chat-messages-container" ref={chatScrollRef}>
              {chatMessages.length === 0 ? (
                <div className="chat-empty-state">
                  <p className="text-xs text-muted">
                    No messages yet. Send a note, link, or code snippet to {peerUser?.firstName}.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMine = msg.senderId === currentUser?._id;
                  return (
                    <div
                      key={msg.id}
                      className={`chat-bubble-wrapper ${isMine ? 'mine' : 'theirs'}`}
                    >
                      <div className="chat-meta text-[11px] text-muted mb-1">
                        <span className="font-medium">{isMine ? 'You' : msg.senderName}</span>
                        <span className="ml-1 text-[10px]">{msg.timestamp}</span>
                      </div>
                      <div className="chat-bubble-content text-xs">
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendChat} className="chat-input-bar">
              <input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="chat-text-input"
              />
              <button type="submit" className="chat-send-btn" disabled={!inputMessage.trim()}>
                <SendIcon size={14} />
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Bottom Main Controls Bar */}
      <footer className="workspace-controls-bar">
        <div className="controls-group">
          {/* Mic */}
          <button
            type="button"
            className={`control-btn ${isMicOn ? 'active-green' : 'inactive'}`}
            onClick={handleToggleMic}
            title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isMicOn ? <MicIcon size={18} /> : <MicOffIcon size={18} />}
            <span className="text-xs font-medium">{isMicOn ? 'Mute' : 'Mic On'}</span>
          </button>

          {/* Camera */}
          <button
            type="button"
            className={`control-btn ${isCamOn ? 'active-green' : 'inactive'}`}
            onClick={handleToggleCam}
            title={isCamOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {isCamOn ? <VideoIcon size={18} /> : <VideoOffIcon size={18} />}
            <span className="text-xs font-medium">{isCamOn ? 'Cam Off' : 'Camera'}</span>
          </button>

          {/* Screen Share */}
          <button
            type="button"
            className={`control-btn ${isScreenSharing ? 'active-blue' : ''}`}
            onClick={handleToggleScreenShare}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <MonitorIcon size={18} />
            <span className="text-xs font-medium">{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
          </button>

          {/* Chat Toggle */}
          <button
            type="button"
            className={`control-btn ${chatOpen ? 'active-neutral' : ''}`}
            onClick={() => setChatOpen(!chatOpen)}
            title="Toggle Live Chat"
          >
            <MessageSquareIcon size={18} />
            <span className="text-xs font-medium">Chat</span>
          </button>
        </div>

        <div className="controls-group">
          {/* End Session Button */}
          <button
            type="button"
            className="control-btn end-call-btn"
            onClick={handleInitiateEndSession}
            title="End Remote Assistance Session"
          >
            <PhoneOffIcon size={18} />
            <span className="text-xs font-semibold">End Assistance</span>
          </button>
        </div>
      </footer>

      {/* Session Permissions Modal */}
      {permissionsModalOpen && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-md">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <ShieldIcon size={20} className="text-primary" />
                <h3 className="modal-title">Session Permissions</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setPermissionsModalOpen(false)}
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-xs text-muted">
                Control what {peerUser?.firstName} is permitted to do during this collaboration session. Changes apply immediately.
              </p>

              <div className="permission-toggle-item">
                <div>
                  <div className="font-semibold text-sm">Allow Voice Communication</div>
                  <div className="text-xs text-muted">Enable microphone audio streaming</div>
                </div>
                <input
                  type="checkbox"
                  checked={sessionData?.permissions?.allowVoice !== false}
                  onChange={(e) =>
                    handleSavePermissions({
                      ...sessionData?.permissions,
                      allowVoice: e.target.checked,
                    })
                  }
                  className="permission-checkbox"
                />
              </div>

              <div className="permission-toggle-item">
                <div>
                  <div className="font-semibold text-sm">Allow Video Camera</div>
                  <div className="text-xs text-muted">Enable webcam video feeds</div>
                </div>
                <input
                  type="checkbox"
                  checked={sessionData?.permissions?.allowVideo !== false}
                  onChange={(e) =>
                    handleSavePermissions({
                      ...sessionData?.permissions,
                      allowVideo: e.target.checked,
                    })
                  }
                  className="permission-checkbox"
                />
              </div>

              <div className="permission-toggle-item">
                <div>
                  <div className="font-semibold text-sm">Allow Screen Annotations</div>
                  <div className="text-xs text-muted">Let helper draw markers, highlights, and arrows on the screen</div>
                </div>
                <input
                  type="checkbox"
                  checked={sessionData?.permissions?.allowAnnotations !== false}
                  onChange={(e) =>
                    handleSavePermissions({
                      ...sessionData?.permissions,
                      allowAnnotations: e.target.checked,
                    })
                  }
                  className="permission-checkbox"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex gap-2">
                <AlertTriangleIcon size={16} className="shrink-0 mt-0.5" />
                <span>
                  Remote mouse and keyboard control is securely disabled by browser policy.
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPermissionsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Session Assistance Summary Modal */}
      {summaryModalOpen && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-dialog-modern max-w-lg">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <CheckCircleIcon size={20} className="text-success" />
                <h3 className="modal-title">Assistance Summary</h3>
              </div>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-xs text-muted">
                Session ended after <strong>{formatDuration(durationTimer)}</strong> with {peerUser?.firstName} {peerUser?.lastName}. Optionally provide a summary of the assistance provided.
              </p>

              <div>
                <label className="label-text text-xs font-semibold block mb-1">
                  Assistance Notes / Resolution Details:
                </label>
                <textarea
                  rows={4}
                  className="form-textarea w-full text-xs"
                  placeholder="e.g. Guided employee through the database migration steps and verified the schema changes."
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                />
              </div>

              {sessionData?.attachedTask && (
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateTaskFlag}
                    onChange={(e) => setUpdateTaskFlag(e.target.checked)}
                    className="checkbox-custom"
                  />
                  <span>
                    Append this summary to task: <strong>{sessionData.attachedTask.title}</strong>
                  </span>
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSavingSummary}
                onClick={handleSubmitSummaryAndEnd}
              >
                {isSavingSummary ? 'Saving...' : 'Finish & Return to WorkConnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkConnectWorkspace;
