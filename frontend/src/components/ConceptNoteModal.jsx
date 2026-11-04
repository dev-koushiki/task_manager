import { useState, useRef } from 'react';
import { SparklesIcon, CalendarIcon, PlusIcon, TrashIcon, CheckIcon } from './Icons';
import { api } from '../services/api';

export const ConceptNoteModal = ({ isOpen, onClose, onProjectCreated }) => {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview'
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // AI Extracted & Editable Form State
  const [extractedData, setExtractedData] = useState({
    title: '',
    description: '',
    department: 'General',
    objectives: [],
    expectedDeliverables: [],
    phases: [],
    startDate: '',
    targetCompletionDate: '',
    suggestedMilestones: [],
  });

  const fileInputRef = useRef(null);

  const departments = [
    'General',
    'Engineering',
    'Product',
    'Design',
    'Marketing',
    'Sales',
    'Operations',
    'Finance',
    'Human Resources',
  ];

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  const handleAnalyze = async () => {
    if (!file && !pastedText.trim()) {
      setError('Please upload a PDF/DOCX document or paste concept note text.');
      return;
    }

    try {
      setAnalyzing(true);
      setError('');

      let fileData = '';
      let filename = '';
      let mimeType = '';

      if (file) {
        filename = file.name;
        mimeType = file.type || '';
        // Convert to base64
        fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const response = await api.analyzeConceptNote({
        fileData,
        filename,
        mimeType,
        rawText: pastedText,
      });

      if (response && response.analysis) {
        const a = response.analysis;
        setExtractedData({
          title: a.title || 'New Project Initiative',
          description: a.description || '',
          department: a.department || 'General',
          objectives: Array.isArray(a.objectives) ? a.objectives : [],
          expectedDeliverables: Array.isArray(a.expectedDeliverables) ? a.expectedDeliverables : [],
          phases: Array.isArray(a.phases) ? a.phases : [],
          startDate: a.startDate || '',
          targetCompletionDate: a.targetCompletionDate || '',
          suggestedMilestones: (a.suggestedMilestones || []).map((m, idx) => ({
            id: 'm_' + idx,
            included: true,
            title: m.title || '',
            description: m.description || '',
            suggestedDeadline: m.suggestedDeadline || '',
            phase: m.phase || '',
          })),
        });
        setStep('preview');
      } else {
        throw new Error('Analysis response was empty.');
      }
    } catch (err) {
      console.error('Concept note error:', err);
      setError(err.message || 'Failed to analyze document. Please check format.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMilestoneChange = (index, field, value) => {
    setExtractedData((prev) => {
      const updated = [...prev.suggestedMilestones];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, suggestedMilestones: updated };
    });
  };

  const handleAddMilestone = () => {
    setExtractedData((prev) => ({
      ...prev,
      suggestedMilestones: [
        ...prev.suggestedMilestones,
        {
          id: 'm_' + Date.now(),
          included: true,
          title: 'New Milestone Deliverable',
          description: 'Milestone scope and deliverables',
          suggestedDeadline: prev.targetCompletionDate || '',
          phase: '',
        },
      ],
    }));
  };

  const handleRemoveMilestone = (index) => {
    setExtractedData((prev) => ({
      ...prev,
      suggestedMilestones: prev.suggestedMilestones.filter((_, i) => i !== index),
    }));
  };

  const handleSaveProject = async () => {
    if (!extractedData.title.trim()) {
      setError('Project title is required.');
      return;
    }
    if (!extractedData.targetCompletionDate) {
      setError('Please set a target completion date.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const activeMilestones = extractedData.suggestedMilestones
        .filter((m) => m.included)
        .map((m) => ({
          title: m.title,
          description: m.description,
          deadline: m.suggestedDeadline || extractedData.targetCompletionDate,
          dueDate: m.suggestedDeadline || extractedData.targetCompletionDate,
          phase: m.phase,
          status: 'not-started',
        }));

      const newProjectPayload = {
        name: extractedData.title.trim(),
        description: extractedData.description.trim(),
        department: extractedData.department,
        startDate: extractedData.startDate || '',
        targetCompletionDate: extractedData.targetCompletionDate,
        deadline: extractedData.targetCompletionDate,
        objectives: extractedData.objectives,
        expectedDeliverables: extractedData.expectedDeliverables,
        phases: extractedData.phases,
        milestones: activeMilestones,
        conceptNote: {
          originalFilename: file ? file.name : 'Pasted Text Concept Note',
          uploadedAt: new Date(),
        },
      };

      const created = await api.createProject(newProjectPayload);
      if (onProjectCreated) {
        onProjectCreated(created);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create project from concept note.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wa-assign-modal-overlay" onClick={onClose}>
      <div
        className="wa-assign-modal-box animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px', width: '100%', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="wa-assign-modal-header">
          <div className="wa-assign-header-title">
            <SparklesIcon size={22} className="text-accent" />
            <div>
              <h3>Concept Note AI Project & Milestone Extractor</h3>
              <p>
                {step === 'upload'
                  ? 'Upload PDF or DOCX concept note to extract title, scope, deadlines & milestones.'
                  : 'Review & edit AI-extracted project information before confirming.'}
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="wa-assign-modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
          {error && <div className="alert-box alert-error" style={{ marginBottom: '14px' }}>{error}</div>}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="concept-upload-view">
              <div
                className="concept-drop-zone"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div className="drop-zone-icon">
                  <SparklesIcon size={36} className="text-primary" />
                </div>
                <h4>Upload Project Concept Note</h4>
                <p>Supports <strong>PDF</strong>, <strong>DOCX (Word)</strong>, and <strong>TXT</strong> files</p>
                {file ? (
                  <div className="selected-file-badge">
                    <span>📄 {file.name}</span>
                    <small>({(file.size / 1024).toFixed(1)} KB)</small>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Choose Document
                  </button>
                )}
              </div>

              <div style={{ margin: '18px 0 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span>— OR PASTE TEXT DIRECTLY —</span>
              </div>

              <div className="form-group">
                <textarea
                  rows={4}
                  placeholder="Paste concept note text, scope statement, or project requirements here..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="concept-text-area"
                />
              </div>

              {analyzing && (
                <div className="concept-ai-analyzing-box">
                  <div className="spinner-border text-primary" role="status"></div>
                  <div>
                    <strong>Analyzing document with AI...</strong>
                    <p>Extracting project objectives, timelines, deliverables, and suggesting milestones.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PREVIEW & EDIT BEFORE SAVING */}
          {step === 'preview' && (
            <div className="concept-preview-view">
              <div className="concept-preview-notice">
                <SparklesIcon size={16} className="text-accent" />
                <span>
                  <strong>AI extraction complete!</strong> Review and adjust fields below before saving.
                  Missing dates or requirements are not invented and can be set manually.
                </span>
              </div>

              {/* Title & Department */}
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Project Title *</label>
                  <input
                    type="text"
                    value={extractedData.title}
                    onChange={(e) =>
                      setExtractedData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="Project Name"
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label>Domain / Department *</label>
                  <select
                    value={extractedData.department}
                    onChange={(e) =>
                      setExtractedData((prev) => ({ ...prev, department: e.target.value }))
                    }
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="form-row">
                <div className="form-group">
                  <label>Project Start Date</label>
                  <input
                    type="date"
                    value={extractedData.startDate}
                    onChange={(e) =>
                      setExtractedData((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Target Completion Date *</label>
                  <input
                    type="date"
                    value={extractedData.targetCompletionDate}
                    onChange={(e) =>
                      setExtractedData((prev) => ({
                        ...prev,
                        targetCompletionDate: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Project Description / Scope</label>
                <textarea
                  rows={3}
                  value={extractedData.description}
                  onChange={(e) =>
                    setExtractedData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Strategic objectives and deliverables scope..."
                />
              </div>

              {/* Suggested Milestones Section */}
              <div className="concept-milestones-section">
                <div className="concept-milestones-header">
                  <div>
                    <h4>Suggested Milestones ({extractedData.suggestedMilestones.length})</h4>
                    <p>Milestones will be placed directly underneath this project.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={handleAddMilestone}
                  >
                    <PlusIcon size={12} /> Add Milestone
                  </button>
                </div>

                <div className="concept-milestone-cards-list">
                  {extractedData.suggestedMilestones.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      className={`concept-milestone-card ${m.included ? 'included' : 'excluded'}`}
                    >
                      <div className="m-card-top-row">
                        <label className="m-checkbox-label">
                          <input
                            type="checkbox"
                            checked={m.included}
                            onChange={(e) =>
                              handleMilestoneChange(idx, 'included', e.target.checked)
                            }
                          />
                          <span>Milestone #{idx + 1}</span>
                        </label>
                        <button
                          type="button"
                          className="btn-link-danger-xs"
                          onClick={() => handleRemoveMilestone(idx)}
                          title="Remove milestone"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>

                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <input
                          type="text"
                          value={m.title}
                          onChange={(e) =>
                            handleMilestoneChange(idx, 'title', e.target.value)
                          }
                          placeholder="Milestone title"
                          disabled={!m.included}
                        />
                      </div>

                      <div className="form-row" style={{ marginBottom: '6px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px' }}>Deadline</label>
                          <input
                            type="date"
                            value={m.suggestedDeadline}
                            onChange={(e) =>
                              handleMilestoneChange(idx, 'suggestedDeadline', e.target.value)
                            }
                            disabled={!m.included}
                          />
                        </div>

                        <div className="form-group" style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px' }}>Phase / Sprint Tag</label>
                          <input
                            type="text"
                            value={m.phase}
                            placeholder="e.g. Phase 1"
                            onChange={(e) =>
                              handleMilestoneChange(idx, 'phase', e.target.value)
                            }
                            disabled={!m.included}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: '0' }}>
                        <input
                          type="text"
                          value={m.description}
                          onChange={(e) =>
                            handleMilestoneChange(idx, 'description', e.target.value)
                          }
                          placeholder="Milestone description & deliverables"
                          disabled={!m.included}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wa-assign-modal-footer">
          {step === 'upload' ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={analyzing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary glow-effect"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing with AI...' : 'Analyze Concept Note with AI'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('upload')}
                disabled={saving}
              >
                Back to Upload
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveProject}
                disabled={saving}
              >
                {saving ? 'Creating Project...' : 'Confirm & Create Project'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
