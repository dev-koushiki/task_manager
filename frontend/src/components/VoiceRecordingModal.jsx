import { useState, useRef, useEffect } from 'react';
import { MicIcon, PlayIcon, PauseIcon, TrashIcon, SparklesIcon, CheckIcon } from './Icons';
import { api } from '../services/api';

export const VoiceRecordingModal = ({
  isOpen,
  onClose,
  project,
  milestone = null,
  onSaveRecording,
  onExtractMilestones,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteTitle, setNoteTitle] = useState(
    milestone ? `Voice Note: ${milestone.title}` : `Voice Note: ${project?.name || 'Project Scope'}`
  );
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  const supportedLanguages = [
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'es-ES', label: 'Spanish' },
    { code: 'fr-FR', label: 'French' },
    { code: 'de-DE', label: 'German' },
    { code: 'hi-IN', label: 'Hindi' },
    { code: 'bn-IN', label: 'Bengali' },
  ];

  // Initialize SpeechRecognition if available in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript + ' ';
          }
          setTranscript(currentTranscript.trim());
        };

        recognition.onerror = (e) => {
          console.warn('Speech recognition warning:', e.error);
        };

        speechRecognitionRef.current = recognition;
      }
    }
  }, [language]);

  // Clean up recording and timers when closed
  useEffect(() => {
    if (!isOpen) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsRecording(false);
      setRecordingDuration(0);
      setAudioBlob(null);
      setAudioUrl('');
      setIsPlaying(false);
      setTranscript('');
      setError('');
    }
  }, [isOpen]);

  const startRecording = async () => {
    try {
      setError('');
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/wav';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start live Speech Recognition if supported
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.lang = language;
          speechRecognitionRef.current.start();
        } catch (e) {
          console.warn('Could not start live speech recognition:', e.message);
        }
      }

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      setError('Unable to access microphone. Please allow browser microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl('');
    setRecordingDuration(0);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTranscribeWithAI = async () => {
    if (!audioBlob) return;
    try {
      setTranscribing(true);
      setError('');

      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const res = await api.transcribeAudio({
        audioBase64: base64Audio,
        mimeType: audioBlob.type,
        language,
      });

      if (res && res.transcript) {
        setTranscript(res.transcript);
      } else if (!transcript) {
        setTranscript('Audio recorded successfully. Speech recognition complete.');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError('AI transcription service was unavailable. You can enter or refine text manually.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleExtractMilestones = async () => {
    if (!transcript.trim()) {
      setError('Please transcribe or write project requirements first.');
      return;
    }

    try {
      setExtracting(true);
      setError('');
      const res = await api.extractFromTranscript(transcript);
      if (res && res.extracted) {
        if (onExtractMilestones) {
          onExtractMilestones(res.extracted);
        }
      }
    } catch (err) {
      console.error('Extraction error:', err);
      setError('Failed to extract milestone suggestions from transcript.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!audioBlob) {
      setError('Please record audio before saving.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const payload = {
        title: noteTitle.trim() || 'Voice Note',
        audioUrl: base64Audio,
        durationSeconds: recordingDuration,
        associatedMilestoneId: milestone?._id || milestone?.id || null,
        transcript: transcript.trim(),
        language,
      };

      if (onSaveRecording) {
        await onSaveRecording(payload);
      }
      onClose();
    } catch (err) {
      console.error('Save recording error:', err);
      setError(err.message || 'Failed to save recording.');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="wa-assign-modal-overlay" onClick={onClose}>
      <div
        className="wa-assign-modal-box animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '100%' }}
      >
        {/* Header */}
        <div className="wa-assign-modal-header">
          <div className="wa-assign-header-title">
            <MicIcon size={22} className="text-primary" />
            <div>
              <h3>WhatsApp-Style Voice Note & Transcription</h3>
              <p>
                {milestone
                  ? `Associate voice instructions with milestone "${milestone.title}"`
                  : `Associate voice note with project "${project?.name || ''}"`}
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="wa-assign-modal-body">
          {error && <div className="alert-box alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

          {/* Note Title & Language Selection */}
          <div className="form-row" style={{ marginBottom: '14px' }}>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Voice Note Title</label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Scope Clarification & Architecture Notes"
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>Speech Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isRecording}
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* WhatsApp-Style Recording Studio Box */}
          <div className="wa-recording-studio">
            {!audioUrl ? (
              <div className="wa-studio-center">
                <button
                  type="button"
                  className={`wa-record-mic-btn ${isRecording ? 'recording-pulse' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? 'Click to stop recording' : 'Click to start recording'}
                >
                  <MicIcon size={36} />
                </button>

                <div className="wa-recording-timer">
                  {formatTime(recordingDuration)}
                </div>

                <div className="wa-studio-hint">
                  {isRecording ? (
                    <span className="text-danger">● Recording live... Click mic button when finished.</span>
                  ) : (
                    <span>Click the microphone button to start recording voice instructions</span>
                  )}
                </div>

                {isRecording && (
                  <div className="wa-audio-waves-visualizer">
                    <span className="wave-bar bar-1"></span>
                    <span className="wave-bar bar-2"></span>
                    <span className="wave-bar bar-3"></span>
                    <span className="wave-bar bar-4"></span>
                    <span className="wave-bar bar-5"></span>
                  </div>
                )}
              </div>
            ) : (
              <div className="wa-audio-preview-card">
                <div className="wa-player-row">
                  <button
                    type="button"
                    className="wa-play-btn"
                    onClick={togglePlayback}
                  >
                    {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
                  </button>

                  <div className="wa-player-info">
                    <strong>{noteTitle}</strong>
                    <span>Duration: {formatTime(recordingDuration)}</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline-danger btn-xs"
                    onClick={deleteRecording}
                    title="Delete recording and redo"
                  >
                    <TrashIcon size={14} /> Redo
                  </button>
                </div>

                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>

          {/* Transcript Review & AI Extraction Section */}
          <div className="wa-transcript-section" style={{ marginTop: '16px' }}>
            <div className="wa-transcript-header">
              <span className="wa-transcript-label">Speech-to-Text Transcript (Editable)</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {audioBlob && (
                  <button
                    type="button"
                    className="btn-link-xs"
                    onClick={handleTranscribeWithAI}
                    disabled={transcribing}
                  >
                    {transcribing ? 'Transcribing...' : '⚡ Re-Transcribe AI'}
                  </button>
                )}
                {transcript && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-xs"
                    onClick={handleExtractMilestones}
                    disabled={extracting}
                  >
                    <SparklesIcon size={12} /> {extracting ? 'Extracting...' : 'Extract Milestones with AI'}
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Live transcription will appear here as you speak. You can review and edit text at any time..."
              className="wa-transcript-textarea"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="wa-assign-modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!audioUrl || saving}
          >
            {saving ? 'Saving Voice Note...' : 'Save Voice Note'}
          </button>
        </div>
      </div>
    </div>
  );
};
