// WorkConnect Native WebRTC and Real-Time Signaling Service
import { io } from 'socket.io-client';
import { api } from './api';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

class WorkConnectService {
  constructor() {
    this.socket = null;
    this.peerConnection = null;
    this.activeSessionId = null;
    this.currentUser = null;
    this.isInitiator = false;
    this.localScreenStream = null;
    this.localAudioStream = null;
    this.localVideoStream = null;
    this.remoteStream = new MediaStream();
    this.pollingInterval = null;
    this.lastSignalTimestamp = 0;
    this.listeners = new Map();
    this.iceCandidatesQueue = [];
    this.connectionState = 'disconnected';
  }

  // Subscribe to service events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in WorkConnect listener [${event}]:`, err);
        }
      });
    }
  }

  // Initialize Socket.IO connection if available
  initSocket(user) {
    this.currentUser = user;
    if (this.socket && this.socket.connected) {
      if (user?._id) {
        this.socket.emit('register_user', user._id);
      }
      return;
    }

    try {
      const socketUrl = window.location.origin.includes('localhost')
        ? 'http://localhost:5000'
        : window.location.origin;

      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        if (user?._id) {
          this.socket.emit('register_user', user._id);
        }
        this.emit('socket_connected', true);
      });

      this.socket.on('signal', (data) => {
        this.handleIncomingSignal(data);
      });

      this.socket.on('employee_status_update', (data) => {
        this.emit('status_update', data);
      });

      this.socket.on('workconnect_incoming_request', (data) => {
        this.emit('incoming_request', data);
      });

      this.socket.on('workconnect_request_accepted', (data) => {
        this.emit('request_accepted', data);
      });

      this.socket.on('workconnect_request_rejected', (data) => {
        this.emit('request_rejected', data);
      });

      this.socket.on('workconnect_session_ended', (data) => {
        this.emit('session_ended', data);
      });

      this.socket.on('disconnect', () => {
        this.emit('socket_disconnected', false);
      });
    } catch (err) {
      console.warn('Socket.IO initialization fallback to HTTP polling:', err);
    }
  }

  // Join a collaboration workspace session
  async joinSession(sessionId, user, isInitiator = false) {
    this.activeSessionId = sessionId;
    this.currentUser = user;
    this.isInitiator = isInitiator;
    this.lastSignalTimestamp = Date.now() - 5000;
    this.connectionState = 'connecting';
    this.emit('connection_state', 'connecting');

    // Socket.IO room join
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_session', sessionId);
    }

    // Initialize WebRTC PeerConnection
    this.setupPeerConnection();

    // Start signaling fallback polling (for serverless environments / reliability)
    this.startSignalingPolling();

    // If initiator, create and send WebRTC Offer
    if (this.isInitiator) {
      try {
        await this.createOffer();
      } catch (err) {
        console.warn('Could not create initial WebRTC offer yet:', err.message);
      }
    }
  }

  // Set up RTCPeerConnection and stream event handling
  setupPeerConnection() {
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {
        // ignore
      }
    }

    this.remoteStream = new MediaStream();
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.emit('remote_stream', { stream: event.streams[0], track: event.track });
      } else {
        this.remoteStream.addTrack(event.track);
        this.emit('remote_stream', { stream: this.remoteStream, track: event.track });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.connectionState = state;
      this.emit('connection_state', state);
      if (state === 'failed') {
        this.restartIce();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.emit('ice_state', state);
    };
  }

  // Send signal via socket or REST endpoint
  async sendSignal(payload) {
    if (!this.activeSessionId) return;

    const signalData = {
      sessionId: this.activeSessionId,
      senderId: this.currentUser?._id,
      ...payload,
      timestamp: Date.now(),
    };

    // Fast path: Socket.IO
    if (this.socket && this.socket.connected) {
      this.socket.emit('signal', signalData);
    }

    // Guaranteed path: REST signal queue
    try {
      await api.sendWorkConnectSignal(this.activeSessionId, signalData);
    } catch (err) {
      console.warn('Signal send via REST error:', err.message);
    }
  }

  // Poll for signals (useful in serverless Vercel environments)
  startSignalingPolling() {
    this.stopSignalingPolling();
    this.pollingInterval = setInterval(async () => {
      if (!this.activeSessionId) return;
      try {
        const res = await api.getWorkConnectSignals(this.activeSessionId, this.lastSignalTimestamp);
        if (res && res.success && Array.isArray(res.signals)) {
          for (const sig of res.signals) {
            const sigTime = new Date(sig.createdAt || Date.now()).getTime();
            if (sigTime > this.lastSignalTimestamp) {
              this.lastSignalTimestamp = sigTime;
            }
            // Skip own signals
            if (sig.sender?.toString() === this.currentUser?._id?.toString()) {
              continue;
            }
            this.handleIncomingSignal(sig);
          }
        }
      } catch (err) {
        // Polling error silenced
      }
    }, 1000);
  }

  stopSignalingPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // Handle incoming signaling messages
  async handleIncomingSignal(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'offer':
        await this.handleOffer(data.offer || data.sdp);
        break;
      case 'answer':
        await this.handleAnswer(data.answer || data.sdp);
        break;
      case 'ice-candidate':
        await this.handleCandidate(data.candidate);
        break;
      case 'annotation':
        this.emit('annotation', data.annotation);
        break;
      case 'clear_annotations':
        this.emit('clear_annotations');
        break;
      case 'chat_message':
        this.emit('chat_message', data.message);
        break;
      case 'screen_sharing_status':
        this.emit('screen_sharing_status', data.active);
        break;
      case 'permissions_updated':
        this.emit('permissions_updated', data.permissions);
        break;
      case 'end_session':
        this.emit('session_ended', data);
        break;
      default:
        break;
    }
  }

  // WebRTC: Create Offer
  async createOffer() {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.peerConnection.setLocalDescription(offer);
      await this.sendSignal({
        type: 'offer',
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
      });
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
    }
  }

  // WebRTC: Handle Offer
  async handleOffer(offer) {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      // Flush queued candidates
      while (this.iceCandidatesQueue.length > 0) {
        const c = this.iceCandidatesQueue.shift();
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
      }
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      await this.sendSignal({
        type: 'answer',
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });
    } catch (err) {
      console.error('Error handling WebRTC offer:', err);
    }
  }

  // WebRTC: Handle Answer
  async handleAnswer(answer) {
    if (!this.peerConnection) return;
    try {
      if (this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        while (this.iceCandidatesQueue.length > 0) {
          const c = this.iceCandidatesQueue.shift();
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(c));
        }
      }
    } catch (err) {
      console.error('Error handling WebRTC answer:', err);
    }
  }

  // WebRTC: Handle ICE Candidate
  async handleCandidate(candidate) {
    if (!candidate) return;
    try {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.iceCandidatesQueue.push(candidate);
      }
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }

  // WebRTC: ICE Restart
  async restartIce() {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      await this.sendSignal({
        type: 'offer',
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
      });
    } catch (err) {
      console.warn('ICE restart error:', err);
    }
  }

  // Screen Sharing: native getDisplayMedia with browser consent
  async startScreenShare() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        },
        audio: true,
      });

      this.localScreenStream = stream;
      const videoTrack = stream.getVideoTracks()[0];

      if (this.peerConnection && videoTrack) {
        const senders = this.peerConnection.getSenders();
        const existingSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (existingSender) {
          await existingSender.replaceTrack(videoTrack);
        } else {
          this.peerConnection.addTrack(videoTrack, stream);
        }
        await this.createOffer();
      }

      // Handle user stopping screen share from the browser bar
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      await this.sendSignal({
        type: 'screen_sharing_status',
        active: true,
      });

      this.emit('local_screen_stream', stream);
      return stream;
    } catch (err) {
      console.error('Screen sharing initiation error:', err);
      throw err;
    }
  }

  // Stop Screen Share
  async stopScreenShare() {
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => t.stop());
      this.localScreenStream = null;
    }

    if (this.peerConnection) {
      const senders = this.peerConnection.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        try {
          this.peerConnection.removeTrack(videoSender);
          await this.createOffer();
        } catch {
          // ignore
        }
      }
    }

    await this.sendSignal({
      type: 'screen_sharing_status',
      active: false,
    });

    this.emit('local_screen_stopped');
  }

  // Voice Communication: Microphone capture
  async toggleMicrophone(enabled) {
    try {
      if (enabled) {
        if (!this.localAudioStream) {
          this.localAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
        }
        const audioTrack = this.localAudioStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          if (this.peerConnection) {
            const senders = this.peerConnection.getSenders();
            const existingAudioSender = senders.find((s) => s.track && s.track.kind === 'audio');
            if (existingAudioSender) {
              await existingAudioSender.replaceTrack(audioTrack);
            } else {
              this.peerConnection.addTrack(audioTrack, this.localAudioStream);
            }
            await this.createOffer();
          }
        }
        return true;
      } else {
        if (this.localAudioStream) {
          this.localAudioStream.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
        }
        return false;
      }
    } catch (err) {
      console.error('Error toggling microphone:', err);
      throw err;
    }
  }

  // Video Communication: Webcam capture
  async toggleCamera(enabled) {
    try {
      if (enabled) {
        if (!this.localVideoStream) {
          this.localVideoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
        }
        const videoTrack = this.localVideoStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = true;
          this.emit('local_camera_stream', this.localVideoStream);
        }
        return true;
      } else {
        if (this.localVideoStream) {
          this.localVideoStream.getVideoTracks().forEach((t) => {
            t.enabled = false;
            t.stop();
          });
          this.localVideoStream = null;
        }
        this.emit('local_camera_stopped');
        return false;
      }
    } catch (err) {
      console.error('Error toggling camera:', err);
      throw err;
    }
  }

  // Screen Annotation: Send drawing events to peer
  sendAnnotation(annotation) {
    this.sendSignal({
      type: 'annotation',
      annotation,
    });
  }

  // Clear annotations
  clearAnnotations() {
    this.sendSignal({
      type: 'clear_annotations',
    });
  }

  // Live Chat: Send in-session message
  sendChatMessage(text) {
    if (!text || !text.trim()) return;
    const msg = {
      id: `wc_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: this.currentUser?._id,
      senderName: `${this.currentUser?.firstName || ''} ${this.currentUser?.lastName || ''}`.trim() || 'Colleague',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    this.sendSignal({
      type: 'chat_message',
      message: msg,
    });

    return msg;
  }

  // Leave / Terminate session
  async leaveSession() {
    this.stopSignalingPolling();

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((t) => t.stop());
      this.localScreenStream = null;
    }

    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach((t) => t.stop());
      this.localAudioStream = null;
    }

    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach((t) => t.stop());
      this.localVideoStream = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {
        // ignore
      }
      this.peerConnection = null;
    }

    if (this.socket && this.socket.connected && this.activeSessionId) {
      this.socket.emit('leave_session', this.activeSessionId);
    }

    this.activeSessionId = null;
    this.connectionState = 'disconnected';
    this.emit('connection_state', 'disconnected');
  }
}

export const workConnectService = new WorkConnectService();
export default workConnectService;
