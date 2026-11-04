import { useState, useEffect } from 'react';
import { useConnectMeeting } from '../context/ConnectMeetingContext';
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  PhoneOffIcon,
  MaximizeIcon,
  ExternalLinkIcon,
} from './Icons';

export const FloatingMeetingBar = ({ onReturnToConnect, isVisible = true }) => {
  const {
    isInCall,
    activeMeeting,
    currentRoomCode,
    callDuration,
    isMicOn,
    isCameraOn,
    toggleMicrophone,
    toggleCamera,
    leaveMeeting,
    activePeers,
  } = useConnectMeeting();

  // Format call duration into MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  if (!isInCall || !isVisible) {
    return null;
  }

  const meetingTitle = activeMeeting?.title || 'Connect Meeting';
  const peerCount = activePeers.length;

  return (
    <aside
      className="taskflow-floating-meeting-bar animate-fade-in"
      aria-label="Active Meeting Controls"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        borderRadius: '16px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        color: '#f8fafc',
        fontFamily: 'inherit',
      }}
    >
      {/* Live Indicator & Meeting Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            boxShadow: '0 0 10px #10b981',
            animation: 'pulse 2s infinite',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#f8fafc',
                maxWidth: '180px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={meetingTitle}
            >
              {meetingTitle}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#93c5fd',
                fontWeight: 500,
              }}
            >
              {peerCount} {peerCount === 1 ? 'peer' : 'peers'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(callDuration)} • Room: {currentRoomCode}
          </span>
        </div>
      </div>

      <div style={{ width: '1px', height: '28px', background: 'rgba(255, 255, 255, 0.15)' }} />

      {/* Control Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={toggleMicrophone}
          title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
          style={{
            background: isMicOn ? 'rgba(255, 255, 255, 0.1)' : '#ef4444',
            color: '#f8fafc',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {isMicOn ? <MicIcon size={16} /> : <MicOffIcon size={16} />}
        </button>

        {/* Camera Toggle */}
        <button
          type="button"
          onClick={toggleCamera}
          title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
          style={{
            background: isCameraOn ? 'rgba(255, 255, 255, 0.1)' : '#ef4444',
            color: '#f8fafc',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {isCameraOn ? <VideoIcon size={16} /> : <VideoOffIcon size={16} />}
        </button>

        {/* Return to Full Meeting Interface */}
        <button
          type="button"
          onClick={onReturnToConnect}
          title="Return to full meeting interface"
          style={{
            background: 'rgba(59, 130, 246, 0.25)',
            color: '#bfdbfe',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '10px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <MaximizeIcon size={14} />
          <span>Expand</span>
        </button>

        {/* Leave Meeting */}
        <button
          type="button"
          onClick={leaveMeeting}
          title="Leave meeting"
          style={{
            background: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <PhoneOffIcon size={14} />
          <span>Leave</span>
        </button>
      </div>
    </aside>
  );
};
