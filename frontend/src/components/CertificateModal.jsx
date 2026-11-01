import React, { useState, useEffect, useRef } from 'react';
import {
  AwardIcon,
  CheckCircleIcon,
  ShieldIcon,
  AlertTriangleIcon,
} from './Icons';
import {
  generateCertificateCanvas,
  downloadCertificatePdf,
  downloadCertificatePng,
  downloadCertificateJpeg,
} from '../utils/certificateGenerator';
import { api } from '../services/api';

export const CertificateModal = ({
  isOpen,
  onClose,
  initialData = {},
  isAdmin = false,
  onAwardApproved,
}) => {
  const [employeeName, setEmployeeName] = useState(initialData.employeeName || '');
  const [employeeId, setEmployeeId] = useState(initialData.employeeIdNumber || initialData.employeeId || '');
  const [employeePhoto, setEmployeePhoto] = useState(initialData.employeePhoto || '');
  const [awardTitle, setAwardTitle] = useState(initialData.title || 'Employee of the Month');
  const [awardType, setAwardType] = useState(initialData.type || 'month');
  const [period, setPeriod] = useState(
    initialData.period ||
      new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  );
  const [customComment, setCustomComment] = useState(
    initialData.customComment ||
      'In recognition of distinguished dedication, technical excellence, and outstanding contributions to organizational milestones.'
  );

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [generatedCanvas, setGeneratedCanvas] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Generate certificate preview
  const updateCertificatePreview = async () => {
    try {
      setPreviewLoading(true);
      const canvas = await generateCertificateCanvas({
        employeeName,
        employeeId,
        employeePhoto,
        awardTitle,
        period,
        customComment,
        companyName: initialData.companyName || 'TaskFlow Enterprise',
      });
      setGeneratedCanvas(canvas);
      setPreviewUrl(canvas.toDataURL('image/png', 0.8));
    } catch (err) {
      console.error('Failed to generate preview canvas:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCertificatePreview();
    }
  }, [isOpen, employeeName, employeeId, employeePhoto, awardTitle, period, customComment]);

  // Handle Photo Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEmployeePhoto(event.target?.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Download Handlers
  const handleDownloadPdf = () => {
    if (!generatedCanvas) return;
    const cleanName = employeeName.replace(/\s+/g, '_');
    downloadCertificatePdf(generatedCanvas, `Certificate_${cleanName}_${period}.pdf`);
  };

  const handleDownloadPng = () => {
    if (!generatedCanvas) return;
    const cleanName = employeeName.replace(/\s+/g, '_');
    downloadCertificatePng(generatedCanvas, `Certificate_${cleanName}_${period}.png`);
  };

  const handleDownloadJpeg = () => {
    if (!generatedCanvas) return;
    const cleanName = employeeName.replace(/\s+/g, '_');
    downloadCertificateJpeg(generatedCanvas, `Certificate_${cleanName}_${period}.jpg`);
  };

  // Admin Approve Award
  const handleApproveAward = async () => {
    if (!initialData.employeeId && !initialData.id) {
      alert('Target employee not specified for approval.');
      return;
    }
    try {
      setIsSaving(true);
      const res = await api.approveRecognitionAward({
        employeeId: initialData.employeeId || initialData.id,
        employeeIdNumber: employeeId,
        type: awardType,
        period,
        title: awardTitle,
        customComment,
        employeePhoto,
      });

      if (generatedCanvas) {
        // Save certificate image thumbnail to backend
        try {
          const pngDataUrl = generatedCanvas.toDataURL('image/png', 0.6);
          await api.saveRecognitionCertificate({
            awardId: res.award?._id,
            certificatePngUrl: pngDataUrl,
          });
        } catch (saveErr) {
          console.warn('Could not persist preview thumbnail:', saveErr.message);
        }
      }

      alert(`Official Recognition '${awardTitle}' approved and issued to ${employeeName}!`);
      if (onAwardApproved) onAwardApproved(res.award);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to approve recognition');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wa-assign-modal-overlay" onClick={onClose}>
      <div
        className="wa-assign-modal-box cert-modal-box animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wa-assign-modal-header">
          <div className="d-flex align-items-center gap-2">
            <div className="progress-icon-badge" style={{ width: '38px', height: '38px' }}>
              <AwardIcon size={18} />
            </div>
            <div>
              <h3 className="wa-assign-title">Official Certificate Generator</h3>
              <p className="wa-assign-subtitle">
                High-resolution, printable PDF & PNG/JPEG certificate with security border & official seal
              </p>
            </div>
          </div>
          <button type="button" className="wa-assign-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="cert-modal-body">
          {/* LEFT: Controls & Input Form */}
          <div className="cert-form-column">
            <div className="form-group mb-2">
              <label>Employee Full Name *</label>
              <input
                type="text"
                className="form-control"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="e.g. Devon Miles"
                required
              />
            </div>

            <div className="form-group mb-2">
              <label>Employee ID *</label>
              <input
                type="text"
                className="form-control"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP-1048"
                required
              />
            </div>

            <div className="form-group mb-2">
              <label>Recognition Award Category *</label>
              <select
                className="form-control"
                value={awardTitle}
                onChange={(e) => {
                  setAwardTitle(e.target.value);
                  if (e.target.value.includes('Year')) {
                    setAwardType('year');
                    setPeriod(`${new Date().getFullYear()}`);
                  } else {
                    setAwardType('month');
                    setPeriod(new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }));
                  }
                }}
              >
                <option value="Employee of the Month">Employee of the Month</option>
                <option value="Employee of the Year">Employee of the Year</option>
                <option value="Outstanding Technical Achievement Award">Outstanding Technical Achievement Award</option>
                <option value="Leadership & Excellence Award">Leadership & Excellence Award</option>
              </select>
            </div>

            <div className="form-group mb-2">
              <label>Award Period *</label>
              <input
                type="text"
                className="form-control"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. October 2026 or 2026"
                required
              />
            </div>

            <div className="form-group mb-2">
              <label>Employee Photograph (Optional)</label>
              <input
                type="file"
                accept="image/*"
                className="form-control"
                onChange={handlePhotoUpload}
              />
              {employeePhoto && (
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={employeePhoto}
                    alt="Preview"
                    style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                    onClick={() => setEmployeePhoto('')}
                  >
                    Remove Photo
                  </button>
                </div>
              )}
            </div>

            <div className="form-group mb-3">
              <label>Custom Feedback / Citation *</label>
              <textarea
                rows={3}
                className="form-control"
                value={customComment}
                onChange={(e) => setCustomComment(e.target.value)}
                placeholder="Enter personalized commendation for the certificate..."
                required
              />
            </div>

            {/* DOWNLOAD BUTTONS */}
            <div className="cert-download-actions">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleDownloadPdf}
                disabled={!generatedCanvas}
              >
                Download PDF (Printable 300 DPI)
              </button>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={handleDownloadPng}
                  disabled={!generatedCanvas}
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={handleDownloadJpeg}
                  disabled={!generatedCanvas}
                >
                  Download JPEG
                </button>
              </div>
            </div>

            {/* ADMIN APPROVE BUTTON */}
            {isAdmin && initialData && (
              <div style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button
                  type="button"
                  className="btn btn-success btn-block"
                  onClick={handleApproveAward}
                  disabled={isSaving}
                  style={{ background: '#10b981', color: '#ffffff', width: '100%', fontWeight: 700 }}
                >
                  {isSaving ? 'Approving & Publishing...' : '✓ Approve & Issue Official Award'}
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Live Visual Certificate Preview */}
          <div className="cert-preview-column">
            <div className="cert-preview-header">
              <span>Live Vector Preview</span>
              <span className="badge badge-gold">Official Template</span>
            </div>
            <div className="cert-preview-stage">
              {previewLoading ? (
                <div className="progress-spinner" />
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Certificate Preview"
                  className="cert-preview-image animate-fade-in"
                />
              ) : (
                <p>Generating preview...</p>
              )}
            </div>
          </div>
        </div>

        <div className="wa-assign-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
