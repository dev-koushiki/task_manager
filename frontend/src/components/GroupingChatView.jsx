import { useState, useEffect, useRef } from 'react';
import {
  MessageSquareIcon,
  UsersIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  CheckCircleIcon,
  EditIcon,
  TrashIcon,
  CornerDownRightIcon,
  CheckSquareIcon,
  SquareIcon,
  UserIcon,
  BuildingIcon,
  BriefcaseIcon,
  SparklesIcon,
  MicIcon,
  PaperclipIcon,
  PlayIcon,
  PauseIcon,
  DownloadIcon,
  FileTextIcon,
} from './Icons';
import { api } from '../services/api';

const formatDuration = (secs) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const VoiceMessagePlayer = ({ fileUrl, duration = 0, isMine = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((e) => console.error(e));
    }
  };

  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className={`wa-voice-player ${isMine ? 'mine' : 'theirs'}`}>
      <audio ref={audioRef} src={fileUrl} preload="metadata" />
      <button
        type="button"
        className="wa-voice-play-btn"
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </button>

      <div className="wa-voice-track-wrap">
        <div className="wa-voice-waveform">
          {[25, 45, 65, 35, 80, 50, 95, 65, 40, 75, 90, 45, 60, 35, 70, 45, 55, 75, 35, 50].map((h, i) => {
            const barProgress = (i / 20) * 100;
            const isPlayed = barProgress <= progressPercent;
            return (
              <span
                key={i}
                className={`wa-waveform-bar ${isPlayed ? 'played' : ''}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <div className="wa-voice-time-row">
          <span>{formatDuration(isPlaying ? currentTime : audioDuration || duration)}</span>
          <a
            href={fileUrl}
            download={`voice_note_${Math.round(audioDuration || duration || 0)}s.webm`}
            className="wa-voice-dl-link"
            title="Download voice recording"
          >
            <DownloadIcon size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};

export const GroupingChatView = ({ user }) => {
  const currentUserId = String(user?.id || user?._id || '');
  const isAdmin = user?.role === 'admin';

  // State: Conversations and Active Chat
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { messageId, senderName, text }
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'groups' | 'direct'
  const [conversationSearch, setConversationSearch] = useState('');

  // State: Modal for Create Group / Group Details / Start Direct
  const [modalMode, setModalMode] = useState(''); // '' | 'create' | 'details' | 'direct'
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // Form State for Group Creation / Editing
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [addMembersMode, setAddMembersMode] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  // Voice note recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

  // File attachment state
  const [attachedFile, setAttachedFile] = useState(null); // { name, size, type, dataUrl, isImage }
  const fileInputRef = useRef(null);

  // Polling ref and scroll ref
  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    loadInitialData();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Poll messages every 2.5 seconds when a group is open
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (selectedGroup?._id) {
      pollingRef.current = setInterval(() => {
        pollLatestMessages(selectedGroup._id);
      }, 2500);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedGroup]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [groupsData, empsData] = await Promise.all([
        api.getGroups().catch(() => []),
        api.getEmployees().catch(() => []),
      ]);
      setGroups(groupsData || []);
      const parsedEmps = Array.isArray(empsData) ? empsData : (empsData?.employees || []);
      setEmployees(parsedEmps);

      // If groups exist, select first conversation
      if (groupsData && groupsData.length > 0 && !selectedGroup) {
        handleSelectGroup(groupsData[0]);
      }
    } catch (err) {
      console.warn('Failed to load grouping data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGroup = async (group) => {
    setSelectedGroup(group);
    setReplyingTo(null);
    setAddMembersMode(false);
    setIsEditingDetails(false);
    setEditGroupName(group.name);
    setEditGroupDesc(group.description || '');

    try {
      setMessagesLoading(true);
      const msgs = await api.getGroupMessages(group._id);
      setMessages(msgs || []);

      // Clear unread count locally
      setGroups((prev) =>
        prev.map((g) => (g._id === group._id ? { ...g, unreadCount: 0 } : g))
      );
    } catch (err) {
      console.warn('Failed to load group messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const pollLatestMessages = async (groupId) => {
    try {
      const msgs = await api.getGroupMessages(groupId);
      if (Array.isArray(msgs)) {
        setMessages(msgs);
      }
    } catch (e) {
      // background poll error suppressed
    }
  };

  // Voice Recording Handlers
  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Voice recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecordingVoice(true);
      setVoiceDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setVoiceDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Microphone access was denied. Please allow microphone access in your browser settings to record voice messages.');
    }
  };

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setVoiceDuration(0);
  };

  const handleSendVoiceRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const finalDuration = voiceDuration;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const mime = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mime });
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64Audio = reader.result;
        await sendActualMessage({
          text: '',
          messageType: 'voice',
          fileUrl: base64Audio,
          fileName: `voice_note_${Date.now()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`,
          fileSize: audioBlob.size,
          fileType: mime,
          audioDuration: finalDuration,
        });
      };

      reader.readAsDataURL(audioBlob);
      setIsRecordingVoice(false);
      setVoiceDuration(0);
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  // File Attachment Handlers
  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 12 * 1024 * 1024; // 12MB limit
    if (file.size > maxSize) {
      alert('Selected file is too large. Please select a file under 12MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataUrl: reader.result,
        isImage: file.type.startsWith('image/'),
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!chatInput.trim() && !attachedFile) || !selectedGroup?._id) return;

    const text = chatInput.trim();
    const file = attachedFile;
    const reply = replyingTo ? { ...replyingTo } : null;

    setChatInput('');
    setAttachedFile(null);
    setReplyingTo(null);

    let messageType = 'text';
    if (file) {
      messageType = file.isImage ? 'image' : 'file';
    }

    await sendActualMessage({
      text,
      replyTo: reply,
      messageType,
      fileUrl: file?.dataUrl || '',
      fileName: file?.name || '',
      fileSize: file?.size || 0,
      fileType: file?.type || '',
    });
  };

  const sendActualMessage = async (payload) => {
    if (!selectedGroup?._id) return;

    const tempId = 'temp_' + Date.now();
    const optimisticMsg = {
      _id: tempId,
      groupId: selectedGroup._id,
      senderId: currentUserId,
      senderName: `${user?.firstName || 'You'} ${user?.lastName || ''}`.trim(),
      createdAt: new Date().toISOString(),
      ...payload,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await api.sendGroupMessage(selectedGroup._id, payload);
      if (res && res.chatMessage) {
        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? res.chatMessage : m))
        );
        // Refresh conversations list to update preview
        api.getGroups().then((g) => setGroups(g || [])).catch(() => {});
      }
    } catch (err) {
      alert(err.message || 'Failed to send message.');
    }
  };

  // Group Creation & Direct Chat Modals
  const handleOpenCreateModal = () => {
    setNewGroupName('');
    setNewGroupDesc('');
    setSelectedEmployeeIds([]);
    setEmployeeSearch('');
    setModalMode('create');
    api.getEmployees()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.employees || []);
        if (list.length > 0) setEmployees(list);
      })
      .catch(() => {});
  };

  const handleOpenDirectModal = () => {
    setSelectedEmployeeIds([]);
    setEmployeeSearch('');
    setModalMode('direct');
    api.getEmployees()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.employees || []);
        if (list.length > 0) setEmployees(list);
      })
      .catch(() => {});
  };

  const handleToggleSelectEmployee = (empId) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((e) => e._id || e.id));
    }
  };

  const handleCreateGroup = async (e) => {
    e?.preventDefault();
    if (!newGroupName.trim()) {
      alert('Please enter a group name.');
      return;
    }

    try {
      const res = await api.createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        memberIds: selectedEmployeeIds,
      });

      if (res && res.group) {
        setGroups((prev) => [res.group, ...prev]);
        handleSelectGroup(res.group);
        setModalMode('');
        showNotificationNotice(`Group "${res.group.name}" created with ${selectedEmployeeIds.length + 1} members!`);
      }
    } catch (err) {
      alert(err.message || 'Failed to create group.');
    }
  };

  // Direct 1-on-1 Chat
  const handleStartDirectChat = async (targetUser) => {
    try {
      const targetId = targetUser._id || targetUser.id;
      const res = await api.getDirectChat(targetId);
      if (res && res.group) {
        // Add to list if not already present
        setGroups((prev) => {
          const exists = prev.some((g) => g._id === res.group._id);
          return exists ? prev : [res.group, ...prev];
        });
        handleSelectGroup(res.group);
        setModalMode('');
      }
    } catch (err) {
      alert(err.message || 'Failed to start direct conversation.');
    }
  };

  // Edit Group Details
  const handleSaveGroupDetails = async () => {
    if (!editGroupName.trim() || !selectedGroup?._id) return;
    try {
      const res = await api.updateGroup(selectedGroup._id, {
        name: editGroupName.trim(),
        description: editGroupDesc.trim(),
      });
      if (res && res.group) {
        setSelectedGroup(res.group);
        setGroups((prev) =>
          prev.map((g) => (g._id === res.group._id ? res.group : g))
        );
        setIsEditingDetails(false);
        showNotificationNotice('Group details updated successfully.');
      }
    } catch (err) {
      alert(err.message || 'Failed to update group details.');
    }
  };

  // Add Members to existing group
  const handleAddMembersToGroup = async () => {
    if (selectedEmployeeIds.length === 0 || !selectedGroup?._id) return;
    try {
      const res = await api.addGroupMembers(selectedGroup._id, selectedEmployeeIds);
      if (res && res.group) {
        setSelectedGroup(res.group);
        setGroups((prev) =>
          prev.map((g) => (g._id === res.group._id ? res.group : g))
        );
        setAddMembersMode(false);
        setSelectedEmployeeIds([]);
        showNotificationNotice('Members successfully added to the group.');
      }
    } catch (err) {
      alert(err.message || 'Failed to add members.');
    }
  };

  // Remove Member from existing group
  const handleRemoveMember = async (targetUserId, memberName) => {
    const isSelf = targetUserId === currentUserId;
    const confirmMsg = isSelf
      ? 'Are you sure you want to leave this group?'
      : `Remove ${memberName} from this group?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.removeGroupMember(selectedGroup._id, targetUserId);
      if (res && res.group) {
        if (isSelf) {
          // Remove from list if self left
          setGroups((prev) => prev.filter((g) => g._id !== selectedGroup._id));
          setSelectedGroup(null);
          setModalMode('');
        } else {
          setSelectedGroup(res.group);
          setGroups((prev) =>
            prev.map((g) => (g._id === res.group._id ? res.group : g))
          );
        }
        showNotificationNotice(isSelf ? 'You have left the group.' : `${memberName} removed.`);
      }
    } catch (err) {
      alert(err.message || 'Failed to remove member.');
    }
  };

  const showNotificationNotice = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), 3500);
  };

  // Filter conversations
  const filteredConversations = groups.filter((g) => {
    const query = conversationSearch.toLowerCase().trim();
    const title = (g.displayName || g.name || '').toLowerCase();
    const lastMsg = (g.lastMessage?.text || '').toLowerCase();
    const matchesQuery = !query || title.includes(query) || lastMsg.includes(query);

    if (filterTab === 'groups') return matchesQuery && !g.isDirectChat;
    if (filterTab === 'direct') return matchesQuery && g.isDirectChat;
    return matchesQuery;
  });

  // Filter employees for tables
  const filteredEmployees = employees.filter((emp) => {
    const q = employeeSearch.toLowerCase().trim();
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''} ${emp.name || ''}`.trim().toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    const role = (emp.positionTitle || emp.role || emp.designation || '').toLowerCase();
    return !q || fullName.includes(q) || email.includes(q) || dept.includes(q) || role.includes(q);
  });

  // Current group member IDs for "Add Members" exclusion
  const existingGroupMemberIds = new Set(
    (selectedGroup?.members || []).map((m) => String(m.userId))
  );

  const availableEmployeesToAdd = filteredEmployees.filter(
    (emp) => !existingGroupMemberIds.has(String(emp._id || emp.id))
  );

  return (
    <div className="grouping-module-container animate-fade-in">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="grouping-toast-banner animate-slide-down">
          <CheckCircleIcon size={16} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main WhatsApp-like Layout */}
      <div className="whatsapp-layout-wrapper">
        {/* ========================================================
            LEFT PANE: CONVERSATION LIST & SEARCH
        ======================================================== */}
        <div className="whatsapp-sidebar-pane">
          {/* Header */}
          <div className="whatsapp-sidebar-header">
            <div className="user-profile-summary">
              <div className="wa-avatar-circle-sm">
                {user?.firstName?.[0] || 'U'}
              </div>
              <div className="user-title-wrap">
                <strong>{user?.firstName || 'User'}</strong>
                <span className="user-role-badge">{isAdmin ? 'Administrator' : 'Team Member'}</span>
              </div>
            </div>

            <div className="header-action-buttons">
              <button
                type="button"
                className="btn-icon-action"
                title="Create New Group"
                onClick={handleOpenCreateModal}
              >
                <PlusIcon size={18} />
              </button>
              <button
                type="button"
                className="btn-icon-action"
                title="Start 1-on-1 Direct Chat"
                onClick={handleOpenDirectModal}
              >
                <MessageSquareIcon size={18} />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="whatsapp-search-box">
            <SearchIcon size={16} className="search-icon-muted" />
            <input
              type="text"
              placeholder="Search or start new chat..."
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              className="search-input-field"
            />
            {conversationSearch && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setConversationSearch('')}
              >
                &times;
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="whatsapp-filter-pills">
            <button
              type="button"
              className={`wa-filter-pill ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              All ({groups.length})
            </button>
            <button
              type="button"
              className={`wa-filter-pill ${filterTab === 'groups' ? 'active' : ''}`}
              onClick={() => setFilterTab('groups')}
            >
              Groups ({groups.filter((g) => !g.isDirectChat).length})
            </button>
            <button
              type="button"
              className={`wa-filter-pill ${filterTab === 'direct' ? 'active' : ''}`}
              onClick={() => setFilterTab('direct')}
            >
              Direct ({groups.filter((g) => g.isDirectChat).length})
            </button>
          </div>

          {/* Conversation List */}
          <div className="whatsapp-conversation-list">
            {loading ? (
              <div className="wa-conv-loading-state">
                <div className="spinner-border text-primary" style={{ width: '24px', height: '24px' }}></div>
                <p>Loading chats and groups...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="wa-conv-empty-state">
                <MessageSquareIcon size={32} className="text-muted" />
                <p>No conversations found</p>
                <button
                  type="button"
                  className="btn btn-outline btn-xs"
                  onClick={handleOpenCreateModal}
                >
                  <PlusIcon size={13} /> Create Group
                </button>
              </div>
            ) : (
              filteredConversations.map((group) => {
                const isSelected = selectedGroup?._id === group._id;
                const isDirect = group.isDirectChat;
                const displayName = group.displayName || group.name;
                const lastMsg = group.lastMessage?.text || 'No messages yet';
                const lastTime = group.lastMessage?.timestamp
                  ? new Date(group.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div
                    key={group._id}
                    className={`wa-conversation-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <div className={`wa-conv-avatar ${isDirect ? 'direct' : 'group'}`}>
                      {isDirect ? (
                        displayName?.[0] || 'U'
                      ) : (
                        <UsersIcon size={18} />
                      )}
                    </div>

                    <div className="wa-conv-content">
                      <div className="wa-conv-top-row">
                        <span className="wa-conv-title" title={displayName}>
                          {displayName}
                        </span>
                        {lastTime && <span className="wa-conv-time">{lastTime}</span>}
                      </div>

                      <div className="wa-conv-bottom-row">
                        <span className="wa-conv-snippet" title={lastMsg}>
                          {group.lastMessage?.senderName && `${group.lastMessage.senderName}: `}
                          {lastMsg}
                        </span>
                        {group.unreadCount > 0 && (
                          <span className="wa-conv-unread-pill">{group.unreadCount}</span>
                        )}
                        {!isDirect && (
                          <span className="wa-conv-member-count" title={`${group.members?.length || 0} members`}>
                            {group.members?.length || 0}m
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================
            CENTER PANE: CHAT WINDOW & MESSAGES
        ======================================================== */}
        <div className="whatsapp-chat-pane">
          {selectedGroup ? (
            <>
              {/* Chat Header */}
              <div className="whatsapp-chat-header">
                <div
                  className="wa-chat-header-info"
                  onClick={() => setModalMode('details')}
                  title="Click to view group details"
                >
                  <div className={`wa-chat-header-avatar ${selectedGroup.isDirectChat ? 'direct' : 'group'}`}>
                    {selectedGroup.isDirectChat ? (
                      selectedGroup.displayName?.[0] || 'U'
                    ) : (
                      <UsersIcon size={20} />
                    )}
                  </div>
                  <div className="wa-chat-header-text">
                    <h3>{selectedGroup.displayName || selectedGroup.name}</h3>
                    <p>
                      {selectedGroup.isDirectChat
                        ? selectedGroup.otherParticipant?.email || 'Direct Conversation'
                        : `${selectedGroup.members?.length || 0} members · Click for group info`}
                    </p>
                  </div>
                </div>

                <div className="chat-header-actions">
                  {!selectedGroup.isDirectChat && (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        setAddMembersMode(false);
                        setModalMode('details');
                      }}
                    >
                      <UsersIcon size={14} /> Group Info
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Message History */}
              <div className="whatsapp-messages-viewport">
                {messagesLoading ? (
                  <div className="wa-messages-loading">
                    <div className="spinner-border text-primary" style={{ width: '24px', height: '24px' }}></div>
                    <span>Loading conversation history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="wa-messages-empty-state">
                    <SparklesIcon size={32} className="text-primary" />
                    <h4>Start the conversation</h4>
                    <p>Send a message to collaborate with your team members in real time.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMine = String(msg.senderId) === currentUserId;
                    const timeStr = msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div
                        key={msg._id || idx}
                        className={`whatsapp-bubble-row ${isMine ? 'mine' : 'theirs'}`}
                      >
                        <div className="whatsapp-bubble">
                          {/* Sender name in group chats */}
                          {!isMine && !selectedGroup.isDirectChat && (
                            <span className="wa-bubble-sender-name">
                              {msg.senderName}
                            </span>
                          )}

                          {/* Quoted Reply Preview */}
                          {msg.replyTo && (
                            <div className="wa-bubble-quoted-reply">
                              <span className="wa-quote-sender">{msg.replyTo.senderName}</span>
                              <p className="wa-quote-text">{msg.replyTo.text}</p>
                            </div>
                          )}

                          {/* Voice Note Player */}
                          {(msg.messageType === 'voice' || (msg.fileUrl && (msg.fileType?.includes('audio') || msg.messageType === 'voice'))) && (
                            <VoiceMessagePlayer
                              fileUrl={msg.fileUrl}
                              duration={msg.audioDuration}
                              isMine={isMine}
                            />
                          )}

                          {/* Image Attachment Preview */}
                          {(msg.messageType === 'image' || (msg.fileUrl && msg.fileType?.startsWith('image/'))) && (
                            <div className="wa-bubble-image-wrap">
                              <img
                                src={msg.fileUrl}
                                alt={msg.fileName || 'Attachment photo'}
                                className="wa-bubble-image"
                                onClick={() => window.open(msg.fileUrl, '_blank')}
                              />
                            </div>
                          )}

                          {/* Generic Document / File Attachment Card */}
                          {(msg.messageType === 'file' || (msg.fileUrl && msg.messageType !== 'voice' && !msg.fileType?.startsWith('image/'))) && (
                            <div className="wa-bubble-file-card">
                              <div className="wa-file-card-icon">
                                <FileTextIcon size={22} />
                              </div>
                              <div className="wa-file-card-info">
                                <strong className="wa-file-card-name" title={msg.fileName || 'Document'}>
                                  {msg.fileName || 'Attachment'}
                                </strong>
                                <span className="wa-file-card-size">{formatFileSize(msg.fileSize)}</span>
                              </div>
                              <a
                                href={msg.fileUrl}
                                download={msg.fileName || 'document'}
                                className="wa-file-card-download"
                                title="Download file"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <DownloadIcon size={15} />
                              </a>
                            </div>
                          )}

                          {/* Message Text */}
                          {msg.text && <div className="wa-bubble-text">{msg.text}</div>}

                          {/* Bubble Footer: Time & Action */}
                          <div className="wa-bubble-meta">
                            <span className="wa-bubble-time">{timeStr}</span>
                            <button
                              type="button"
                              className="wa-bubble-reply-btn"
                              title="Reply to this message"
                              onClick={() =>
                                setReplyingTo({
                                  messageId: msg._id,
                                  senderName: msg.senderName,
                                  text: msg.text || msg.fileName || 'Attachment',
                                })
                              }
                            >
                              <CornerDownRightIcon size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="whatsapp-input-container">
                {/* Active Reply Banner */}
                {replyingTo && (
                  <div className="wa-replying-banner animate-fade-in">
                    <div className="replying-left-accent"></div>
                    <div className="wa-replying-content">
                      <span className="wa-replying-title">
                        Replying to <strong>{replyingTo.senderName}</strong>
                      </span>
                      <p className="wa-replying-text">{replyingTo.text}</p>
                    </div>
                    <button
                      type="button"
                      className="wa-close-reply-btn"
                      onClick={() => setReplyingTo(null)}
                    >
                      &times;
                    </button>
                  </div>
                )}

                {/* Attached File Preview Banner */}
                {attachedFile && (
                  <div className="wa-attached-preview-banner animate-slide-up">
                    <div className="wa-attached-preview-info">
                      {attachedFile.isImage ? (
                        <img
                          src={attachedFile.dataUrl}
                          alt={attachedFile.name}
                          className="wa-attached-thumbnail"
                        />
                      ) : (
                        <div className="wa-attached-icon-wrap">
                          <FileTextIcon size={20} className="text-primary" />
                        </div>
                      )}
                      <div className="wa-attached-details">
                        <span className="wa-attached-name" title={attachedFile.name}>
                          {attachedFile.name}
                        </span>
                        <span className="wa-attached-size">
                          {formatFileSize(attachedFile.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="wa-remove-attachment-btn"
                      onClick={handleRemoveAttachment}
                      title="Remove attachment"
                    >
                      &times;
                    </button>
                  </div>
                )}

                {/* Live Voice Recording Bar OR Normal Input Form */}
                {isRecordingVoice ? (
                  <div className="wa-recording-active-bar animate-fade-in">
                    <div className="wa-recording-pulse-dot"></div>
                    <span className="wa-recording-label">Recording voice note...</span>
                    <span className="wa-recording-timer">{formatDuration(voiceDuration)}</span>
                    <div className="wa-recording-waves">
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <button
                      type="button"
                      className="wa-cancel-rec-btn"
                      onClick={handleCancelRecording}
                      title="Cancel recording"
                    >
                      <TrashIcon size={18} />
                    </button>
                    <button
                      type="button"
                      className="wa-send-rec-btn"
                      onClick={handleSendVoiceRecording}
                      title="Send voice note"
                    >
                      <SendIcon size={16} />
                    </button>
                  </div>
                ) : (
                  <form className="whatsapp-input-form" onSubmit={handleSendMessage}>
                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
                    />

                    {/* Paperclip / File Sharing Option */}
                    <button
                      type="button"
                      className="whatsapp-icon-btn"
                      onClick={handleTriggerFileInput}
                      title="Attach file or photo"
                    >
                      <PaperclipIcon size={19} />
                    </button>

                    {/* Mic Option for Audio Recording */}
                    <button
                      type="button"
                      className="whatsapp-icon-btn whatsapp-mic-btn"
                      onClick={handleStartRecording}
                      title="Record voice message"
                    >
                      <MicIcon size={19} />
                    </button>

                    {/* Text Message / Caption Input */}
                    <input
                      type="text"
                      placeholder={attachedFile ? 'Add a caption...' : 'Type a message...'}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="whatsapp-message-input"
                      autoFocus
                    />

                    {/* Send Message Button */}
                    <button
                      type="submit"
                      className="whatsapp-send-btn"
                      disabled={!chatInput.trim() && !attachedFile}
                      title="Send message"
                    >
                      <SendIcon size={18} />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            /* Welcome / Zero State */
            <div className="whatsapp-welcome-stage">
              <div className="wa-welcome-card animate-scale-up">
                <div className="wa-welcome-icon-circle">
                  <MessageSquareIcon size={48} className="text-primary" />
                </div>
                <h2>TaskFlow Group & Communication</h2>
                <p>
                  Connect with teams, squads, and colleagues in real time. Create custom project
                  groups or start direct individual chats with WhatsApp-style messaging and replies.
                </p>

                <div className="wa-welcome-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleOpenCreateModal}
                  >
                    <PlusIcon size={16} /> <span>Create New Group</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleOpenDirectModal}
                  >
                    <UserIcon size={16} /> <span>Start Direct Chat</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          MODAL 1: CREATE GROUP (WITH SEARCHABLE EMPLOYEE TABLE)
      ======================================================== */}
      {modalMode === 'create' && (
        <div className="grouping-modal-overlay animate-fade-in">
          <div className="grouping-modal-box animate-scale-up">
            <div className="grouping-modal-header">
              <div className="grouping-modal-title-wrap">
                <UsersIcon size={20} className="text-primary" />
                <h3>Create New Team Group</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setModalMode('')}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateGroup}>
              <div className="grouping-modal-body">
                {/* Group Details Form */}
                <div className="form-group mb-3">
                  <label className="form-label">
                    Group Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Sprint Alpha Team, UI/UX Working Group..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group mb-4">
                  <label className="form-label">
                    Description / Purpose <span className="text-muted">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Core team collaboration for milestone delivery..."
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                  />
                </div>

                {/* Searchable Employees Table */}
                <div className="grouping-emp-selection-section">
                  <div className="grouping-selection-header-row">
                    <div>
                      <h4 className="grouping-selection-title">Select Group Members</h4>
                      <p className="grouping-selection-subtitle">
                        Choose team members to include in this group ({selectedEmployeeIds.length} selected)
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={handleSelectAllEmployees}
                    >
                      {selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="grouping-selection-search-bar">
                    <SearchIcon size={15} className="text-muted" />
                    <input
                      type="text"
                      placeholder="Search employees by name, role, department..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="grouping-selection-search-input"
                    />
                    {employeeSearch && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setEmployeeSearch('')}
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {/* Searchable Table */}
                  <div className="grouping-emp-table-wrapper">
                    <table className="grouping-emp-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>Select</th>
                          <th>Employee</th>
                          <th>Department</th>
                          <th>Designation / Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-4 text-muted">
                              {employeeSearch ? (
                                <>No employees matching &quot;{employeeSearch}&quot;</>
                              ) : (
                                <>No employees found in your organization directory.</>
                              )}
                            </td>
                          </tr>
                        ) : (
                          filteredEmployees.map((emp) => {
                            const empId = emp._id || emp.id;
                            const isSelected = selectedEmployeeIds.includes(empId);
                            const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.email || 'Employee';
                            const roleDisplay = emp.positionTitle || emp.designation || (emp.role ? emp.role.replace(/_/g, ' ') : 'Contributor');
                            const deptDisplay = emp.department || 'General';
                            const avatarInitial = (emp.firstName?.[0] || emp.name?.[0] || emp.email?.[0] || 'E').toUpperCase();

                            return (
                              <tr
                                key={empId}
                                className={isSelected ? 'row-selected' : ''}
                                onClick={() => handleToggleSelectEmployee(empId)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="wa-btn-checkbox"
                                    onClick={() => handleToggleSelectEmployee(empId)}
                                  >
                                    {isSelected ? (
                                      <CheckSquareIcon size={18} className="text-primary" />
                                    ) : (
                                      <SquareIcon size={18} className="text-muted" />
                                    )}
                                  </button>
                                </td>
                                <td>
                                  <div className="wa-table-emp-cell">
                                    <div className="wa-avatar-circle-xs">{avatarInitial}</div>
                                    <div className="wa-table-emp-info">
                                      <strong>{fullName}</strong>
                                      <span>{emp.email}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="wa-badge-dept">
                                    <BuildingIcon size={12} /> {deptDisplay}
                                  </span>
                                </td>
                                <td>
                                  <span className="wa-badge-role">
                                    <BriefcaseIcon size={12} /> {roleDisplay}
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
              </div>

              <div className="grouping-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalMode('')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!newGroupName.trim()}
                >
                  <PlusIcon size={16} /> <span>Create Group</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: GROUP DETAILS & MEMBER MANAGEMENT
      ======================================================== */}
      {modalMode === 'details' && selectedGroup && (
        <div className="grouping-modal-overlay animate-fade-in">
          <div className="grouping-modal-box animate-scale-up">
            <div className="grouping-modal-header">
              <div className="grouping-modal-title-wrap">
                <UsersIcon size={20} className="text-primary" />
                <h3>Group Information & Members</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setModalMode('')}
              >
                &times;
              </button>
            </div>

            <div className="grouping-modal-body">
              {/* Group Metadata Card */}
              <div className="wa-group-info-card">
                {isEditingDetails ? (
                  <div className="edit-group-form animate-fade-in">
                    <div className="form-group mb-2">
                      <label className="form-label">Group Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                      />
                    </div>
                    <div className="form-group mb-3">
                      <label className="form-label">Description</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editGroupDesc}
                        onChange={(e) => setEditGroupDesc(e.target.value)}
                      />
                    </div>
                    <div className="wa-edit-btn-row">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveGroupDetails}
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsEditingDetails(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="view-group-details">
                    <div className="wa-details-header-row">
                      <div>
                        <h3>{selectedGroup.name}</h3>
                        <p>{selectedGroup.description || 'No description provided.'}</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setIsEditingDetails(true)}
                      >
                        <EditIcon size={14} /> Edit Details
                      </button>
                    </div>
                    <div className="wa-details-meta-pill">
                      Created by {selectedGroup.createdByName || 'Admin'} · {selectedGroup.members?.length || 0} Members
                    </div>
                  </div>
                )}
              </div>

              {/* Members Section */}
              <div className="group-members-section">
                <div className="wa-members-header-row">
                  <h4>Group Members ({selectedGroup.members?.length || 0})</h4>
                  {!selectedGroup.isDirectChat && (
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      onClick={() => {
                        setAddMembersMode(!addMembersMode);
                        setSelectedEmployeeIds([]);
                        setEmployeeSearch('');
                      }}
                    >
                      <PlusIcon size={13} /> {addMembersMode ? 'Cancel Add' : 'Add Members'}
                    </button>
                  )}
                </div>

                {/* Add Members Drawer / Table if active */}
                {addMembersMode && (
                  <div className="add-members-drawer animate-fade-in mb-3">
                    <div className="grouping-selection-search-bar mb-2">
                      <SearchIcon size={15} className="text-muted" />
                      <input
                        type="text"
                        placeholder="Search colleagues to add..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        className="grouping-selection-search-input"
                      />
                    </div>

                    <div className="grouping-emp-table-wrapper" style={{ maxHeight: '180px' }}>
                      <table className="grouping-emp-table">
                        <tbody>
                          {availableEmployeesToAdd.length === 0 ? (
                            <tr>
                              <td colSpan="3" className="text-center py-3 text-muted">
                                All colleagues in organization are already in this group.
                              </td>
                            </tr>
                          ) : (
                            availableEmployeesToAdd.map((emp) => {
                              const empId = emp._id || emp.id;
                              const isSelected = selectedEmployeeIds.includes(empId);
                              return (
                                <tr
                                  key={empId}
                                  onClick={() => handleToggleSelectEmployee(empId)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td style={{ width: '36px' }}>
                                    <button
                                      type="button"
                                      className="wa-btn-checkbox"
                                      onClick={() => handleToggleSelectEmployee(empId)}
                                    >
                                      {isSelected ? (
                                        <CheckSquareIcon size={16} className="text-primary" />
                                      ) : (
                                        <SquareIcon size={16} className="text-muted" />
                                      )}
                                    </button>
                                  </td>
                                  <td>
                                    <strong>{`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.email}</strong>
                                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                                      {emp.department || 'General'} · {emp.positionTitle || emp.role || 'Contributor'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {selectedEmployeeIds.length > 0 && (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleAddMembersToGroup}
                        >
                          Add Selected ({selectedEmployeeIds.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Existing Members List */}
                <div className="wa-existing-members-list">
                  {selectedGroup.members?.map((member) => {
                    const isGroupCreator = selectedGroup.createdBy === member.userId;
                    const isSelf = member.userId === currentUserId;

                    return (
                      <div key={member.userId} className="wa-member-list-item">
                        <div className="wa-member-left-info">
                          <div className="wa-avatar-circle-xs">{member.name?.[0] || 'M'}</div>
                          <div className="wa-member-names">
                            <strong>
                              {member.name} {isSelf && '(You)'}
                            </strong>
                            <span>{member.email}</span>
                          </div>
                        </div>

                        <div className="wa-member-right-controls">
                          {isGroupCreator ? (
                            <span className="wa-badge-admin">Creator</span>
                          ) : member.role === 'admin' ? (
                            <span className="wa-badge-admin">Admin</span>
                          ) : (
                            <span className="wa-badge-member">Member</span>
                          )}

                          {/* Remove button for creator / org admin */}
                          {!selectedGroup.isDirectChat && (isAdmin || selectedGroup.createdBy === currentUserId || isSelf) && (
                            <button
                              type="button"
                              className="wa-btn-remove-member"
                              title={isSelf ? 'Leave group' : 'Remove member'}
                              onClick={() => handleRemoveMember(member.userId, member.name)}
                            >
                              <TrashIcon size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grouping-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalMode('')}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: START 1-ON-1 DIRECT CHAT (SEARCHABLE TABLE)
      ======================================================== */}
      {modalMode === 'direct' && (
        <div className="grouping-modal-overlay animate-fade-in">
          <div className="grouping-modal-box animate-scale-up">
            <div className="grouping-modal-header">
              <div className="grouping-modal-title-wrap">
                <MessageSquareIcon size={20} className="text-primary" />
                <h3>Start Direct 1-on-1 Chat</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setModalMode('')}
              >
                &times;
              </button>
            </div>

            <div className="grouping-modal-body">
              <div className="grouping-selection-search-bar mb-3">
                <SearchIcon size={15} className="text-muted" />
                <input
                  type="text"
                  placeholder="Search colleague by name, email, department..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="grouping-selection-search-input"
                  autoFocus
                />
              </div>

              <div className="grouping-emp-table-wrapper">
                <table className="grouping-emp-table">
                  <thead>
                    <tr>
                      <th>Colleague</th>
                      <th>Department</th>
                      <th>Designation / Role</th>
                      <th style={{ width: '90px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.filter((e) => String(e._id || e.id) !== String(currentUserId)).length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          {employeeSearch ? (
                            <>No colleagues matching &quot;{employeeSearch}&quot;</>
                          ) : (
                            <>No other colleagues found in your organization directory.</>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees
                        .filter((e) => String(e._id || e.id) !== String(currentUserId))
                        .map((emp) => {
                          const empId = emp._id || emp.id;
                          const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.email || 'Colleague';
                          const roleDisplay = emp.positionTitle || emp.designation || (emp.role ? emp.role.replace(/_/g, ' ') : 'Contributor');
                          const deptDisplay = emp.department || 'General';
                          const avatarInitial = (emp.firstName?.[0] || emp.name?.[0] || emp.email?.[0] || 'C').toUpperCase();

                          return (
                            <tr key={empId}>
                              <td>
                                <div className="wa-table-emp-cell">
                                  <div className="wa-avatar-circle-xs">{avatarInitial}</div>
                                  <div className="wa-table-emp-info">
                                    <strong>{fullName}</strong>
                                    <span>{emp.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="wa-badge-dept">
                                  <BuildingIcon size={12} /> {deptDisplay}
                                </span>
                              </td>
                              <td>
                                <span className="wa-badge-role">
                                  <BriefcaseIcon size={12} /> {roleDisplay}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-xs"
                                  onClick={() => handleStartDirectChat(emp)}
                                >
                                  Message
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grouping-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalMode('')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
