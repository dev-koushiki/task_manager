import React, { useState, useEffect, useRef } from 'react';
import {
  AwardIcon,
  CheckCircleIcon,
  ShieldIcon,
  AlertTriangleIcon,
  DownloadIcon,
  Share2Icon,
  UploadIcon,
  CopyIcon,
  SparklesIcon,
} from './Icons';
import {
  generateCertificateCanvas,
  downloadCertificatePdf,
  downloadCertificatePng,
  getCertificateBlob,
  CERTIFICATE_TEMPLATES,
} from '../utils/certificateGenerator';
import { api } from '../services/api';

export const CertificateModal = ({
  isOpen,
  onClose,
  initialData = {},
  isAdmin = false,
  isHR = false,
  user = null,
  employees = [],
  onAwardApproved,
}) => {
  // Navigation tab inside the studio
  const [activeStudioTab, setActiveStudioTab] = useState('award'); // 'award' | 'template'

  // Determine authorized HR access:
  // Authorized if admin, isHR prop, role hr, hierarchy level 1, or canManageEmployees permission, or HR department/designation
  const userRole = (user?.role || '').toLowerCase();
  const userDept = (user?.department || '').toLowerCase();
  const userDesig = (user?.designation || user?.positionTitle || '').toLowerCase();
  const perms = user?.permissions || {};
  const hasEmployeeMgmt = Boolean(perms.canManageEmployees);

  const isAuthorizedHR =
    isAdmin ||
    isHR ||
    userRole === 'admin' ||
    userRole === 'hr' ||
    user?.hierarchyLevel === 1 ||
    hasEmployeeMgmt ||
    userDept.includes('human resources') ||
    userDept === 'hr' ||
    userDept.includes('hr &') ||
    /\bhr\b/.test(userDesig) ||
    userDesig.includes('human resources');

  // If user is not authorized HR, they can only view/download certificates issued to them
  const isViewMode = Boolean(
    !isAuthorizedHR ||
    initialData.isViewMode ||
    initialData.approvedAt ||
    (initialData._id && initialData.mode !== 'issue')
  );

  // Recipient & Award Details State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeePhoto, setEmployeePhoto] = useState('');
  const [awardTitle, setAwardTitle] = useState('Employee of the Month');
  const [awardType, setAwardType] = useState('month');
  const [period, setPeriod] = useState(
    new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  );
  const [customComment, setCustomComment] = useState(
    'In recognition of distinguished dedication, technical excellence, and outstanding contributions to organizational milestones.'
  );

  // Organization & Template Configuration
  const [templateId, setTemplateId] = useState(
    () => localStorage.getItem('taskflow_cert_template') || 'classic-gold'
  );
  const [customTemplateImage, setCustomTemplateImage] = useState(
    () => localStorage.getItem('taskflow_cert_custom_bg') || ''
  );
  const [companyName, setCompanyName] = useState(
    () => user?.companyName || localStorage.getItem('taskflow_cert_org_name') || 'TaskFlow Enterprise'
  );
  const [companyLogo, setCompanyLogo] = useState(
    () => localStorage.getItem('taskflow_cert_org_logo') || ''
  );
  const [signatoryName, setSignatoryName] = useState(
    () => localStorage.getItem('taskflow_cert_sig_name') || 'Elena Rostova'
  );
  const [signatoryTitle, setSignatoryTitle] = useState(
    () => localStorage.getItem('taskflow_cert_sig_title') || 'Chief Executive Officer'
  );

  // Employee Roster for HR Selection
  const [orgEmployees, setOrgEmployees] = useState(employees || []);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Preview & Processing State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [generatedCanvas, setGeneratedCanvas] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');

  // Synchronize state whenever modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      const incomingEmpId = initialData.employeeId || initialData._id || initialData.id || '';
      setSelectedEmpId(incomingEmpId);
      setEmployeeName(initialData.employeeName || '');
      setEmployeeId(initialData.employeeIdNumber || (typeof initialData.employeeId === 'string' && initialData.employeeId.startsWith('EMP') ? initialData.employeeId : ''));
      setEmployeePhoto(initialData.employeePhoto || '');
      setAwardTitle(initialData.title || initialData.awardTitle || 'Employee of the Month');
      setAwardType(initialData.type || (initialData.title?.includes('Year') ? 'year' : 'month'));
      setPeriod(
        initialData.period ||
          new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
      );
      setCustomComment(
        initialData.customComment ||
          initialData.description ||
          'In recognition of distinguished dedication, technical excellence, and outstanding contributions to organizational milestones.'
      );
      if (initialData.companyName) {
        setCompanyName(initialData.companyName);
      } else if (user?.companyName) {
        setCompanyName(user.companyName);
      }
      if (initialData.signatoryName) setSignatoryName(initialData.signatoryName);
      if (initialData.signatoryTitle) setSignatoryTitle(initialData.signatoryTitle);
    }
  }, [isOpen, initialData, user]);

  // Load actual organization employees for HR to choose from
  useEffect(() => {
    if (isOpen && isAuthorizedHR && !isViewMode) {
      if (Array.isArray(employees) && employees.length > 0) {
        setOrgEmployees(employees);
      } else {
        setLoadingEmployees(true);
        api.getEmployees()
          .then((data) => {
            if (Array.isArray(data)) {
              setOrgEmployees(data);
            }
          })
          .catch((err) => {
            console.warn('Could not fetch organization employees for certificate studio:', err);
          })
          .finally(() => setLoadingEmployees(false));
      }
    }
  }, [isOpen, isAuthorizedHR, isViewMode, employees]);

  // Handle employee selection from verified roster
  const handleSelectEmployee = (empId) => {
    setSelectedEmpId(empId);
    if (!empId) {
      setEmployeeName('');
      setEmployeeId('');
      setEmployeePhoto('');
      return;
    }
    const emp = orgEmployees.find((e) => String(e._id || e.id) === String(empId));
    if (emp) {
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Unnamed Employee';
      setEmployeeName(fullName);
      const code = emp.employeeId || emp.employeeIdNumber || `EMP-${(emp._id || emp.id).toString().slice(-4).toUpperCase()}`;
      setEmployeeId(code);
      if (emp.avatar || emp.photo) {
        setEmployeePhoto(emp.avatar || emp.photo);
      }
      if (emp.companyName) {
        setCompanyName(emp.companyName);
      }
    }
  };

  // Update certificate preview canvas
  const updateCertificatePreview = async () => {
    try {
      setPreviewLoading(true);
      const canvas = await generateCertificateCanvas({
        employeeName: employeeName || 'Honored Recipient',
        employeeId: employeeId || 'EMP-VERIFIED',
        employeePhoto,
        awardTitle,
        period,
        customComment,
        companyName,
        signatoryName,
        signatoryTitle,
        templateId,
        customTemplateImage,
        companyLogo,
      });
      setGeneratedCanvas(canvas);
      setPreviewUrl(canvas.toDataURL('image/png', 0.85));
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
  }, [
    isOpen,
    employeeName,
    employeeId,
    employeePhoto,
    awardTitle,
    period,
    customComment,
    templateId,
    customTemplateImage,
    companyName,
    companyLogo,
    signatoryName,
    signatoryTitle,
  ]);

  // Handle Employee Photo Upload
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

  // Handle Organization Custom Template Upload
  const handleCustomTemplateUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        setCustomTemplateImage(result);
        setTemplateId('custom');
        try {
          localStorage.setItem('taskflow_cert_custom_bg', result);
          localStorage.setItem('taskflow_cert_template', 'custom');
        } catch (_) {}
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Company Logo Upload
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        setCompanyLogo(result);
        try {
          localStorage.setItem('taskflow_cert_org_logo', result);
        } catch (_) {}
      };
      reader.readAsDataURL(file);
    }
  };

  // Unified Download Handler (PDF high-resolution printable)
  const handleDownload = () => {
    if (!generatedCanvas) return;
    const cleanName = (employeeName || 'Employee').replace(/\s+/g, '_');
    const cleanPeriod = (period || 'Period').replace(/\s+/g, '_');
    downloadCertificatePdf(generatedCanvas, `Certificate_${cleanName}_${cleanPeriod}.pdf`);
  };

  // Share Handler
  const handleShare = async () => {
    if (!generatedCanvas) return;
    const shareTitle = `${awardTitle} - ${employeeName || 'Honored Employee'}`;
    const shareText = `Proud to receive the ${awardTitle} certificate from ${companyName}!`;

    // Try native Web Share API with file support first (e.g. mobile, Chrome, Safari, Edge)
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await getCertificateBlob(generatedCanvas, 'image/png');
        const file = new File([blob], `${shareTitle.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            files: [file],
          });
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed, opening share modal:', err);
        } else {
          return;
        }
      }
    }

    // Open in-app share modal
    setShowShareModal(true);
  };

  // Copy Image to Clipboard
  const handleCopyImageToClipboard = async () => {
    if (!generatedCanvas) return;
    try {
      const blob = await getCertificateBlob(generatedCanvas, 'image/png');
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setShareFeedback('Certificate image copied to clipboard! Paste it into Slack, Teams, or WhatsApp.');
        setTimeout(() => setShareFeedback(''), 4500);
      } else {
        downloadCertificatePng(generatedCanvas, 'Certificate.png');
        setShareFeedback('Certificate image downloaded to your device!');
        setTimeout(() => setShareFeedback(''), 4500);
      }
    } catch (err) {
      downloadCertificatePng(generatedCanvas, 'Certificate.png');
      setShareFeedback('Certificate image downloaded to your device for sharing!');
      setTimeout(() => setShareFeedback(''), 4500);
    }
  };

  const handleShareLinkedIn = () => {
    const text = encodeURIComponent(`Honored to receive the ${awardTitle} recognition from ${companyName}! 🏆`);
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${text}`, '_blank');
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`🎉 Proud to receive the ${awardTitle} certificate from ${companyName}!`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(`Proud to be awarded ${awardTitle} by ${companyName}! 🌟`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`${awardTitle} - ${employeeName}`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease find the official certificate honoring ${employeeName} for the ${awardTitle} (${period}) from ${companyName}.\n\nBest regards,\n${companyName}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // HR Approve & Issue Award
  const handleApproveAward = async () => {
    const targetEmpId = selectedEmpId || initialData.employeeId || initialData._id || initialData.id;
    if (!targetEmpId) {
      alert('Please select an authorized employee from your organization roster.');
      return;
    }
    if (!employeeName.trim()) {
      alert('Employee name is required.');
      return;
    }
    try {
      setIsSaving(true);
      const res = await api.approveRecognitionAward({
        employeeId: targetEmpId,
        employeeIdNumber: employeeId,
        type: awardType,
        period,
        title: awardTitle,
        customComment,
        employeePhoto,
        templateId,
      });

      if (generatedCanvas && res?.award?._id) {
        try {
          const pngDataUrl = generatedCanvas.toDataURL('image/png', 0.6);
          await api.saveRecognitionCertificate({
            awardId: res.award._id,
            certificatePngUrl: pngDataUrl,
          });
        } catch (saveErr) {
          console.warn('Could not persist preview thumbnail:', saveErr.message);
        }
      }

      alert(`Official Recognition '${awardTitle}' successfully approved and issued to ${employeeName}!`);
      if (onAwardApproved) onAwardApproved(res.award);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to approve and issue recognition award.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentTemplateName =
    templateId === 'custom'
      ? 'Custom Organization Template'
      : CERTIFICATE_TEMPLATES[templateId]?.name || 'Executive Gold';

  return (
    <div className="wa-assign-modal-overlay" onClick={onClose}>
      <div
        className="wa-assign-modal-box cert-modal-box animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="wa-assign-modal-header">
          <div className="d-flex align-items-center gap-2">
            <div className="progress-icon-badge" style={{ width: '42px', height: '42px' }}>
              <AwardIcon size={20} />
            </div>
            <div>
              <h3 className="wa-assign-title">Official Certificate & Recognition Studio</h3>
              <p className="wa-assign-subtitle">
                Professional, tamper-evident corporate credentials with customizable organization branding
              </p>
            </div>
          </div>
          <button type="button" className="wa-assign-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Body: Left Controls, Right Preview */}
        <div className="cert-modal-body">
          {/* LEFT: Controls & Configuration Column */}
          <div className="cert-form-column">
            {/* Studio Navigation Tabs */}
            <div className="cert-studio-tabs">
              <button
                type="button"
                className={`cert-studio-tab-btn ${activeStudioTab === 'award' ? 'active' : ''}`}
                onClick={() => setActiveStudioTab('award')}
              >
                <span>Award Details</span>
              </button>
              <button
                type="button"
                className={`cert-studio-tab-btn ${activeStudioTab === 'template' ? 'active' : ''}`}
                onClick={() => setActiveStudioTab('template')}
              >
                <span>Organization & Template</span>
              </button>
            </div>

            {/* TAB 1: Award Details Form */}
            {activeStudioTab === 'award' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* HR EMPLOYEE SELECTOR (Only in creation mode for authorized HR) */}
                {isAuthorizedHR && !isViewMode ? (
                  <div className="form-group mb-1">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <label className="form-sublabel m-0">Select Recipient Employee *</label>
                      {loadingEmployees && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Loading roster...</span>
                      )}
                    </div>
                    <select
                      className="form-control"
                      value={selectedEmpId}
                      onChange={(e) => handleSelectEmployee(e.target.value)}
                      required
                      style={{ fontWeight: selectedEmpId ? 600 : 400 }}
                    >
                      <option value="">-- Choose authorized employee from your organization --</option>
                      {orgEmployees.map((emp) => {
                        const id = emp._id || emp.id;
                        const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Employee';
                        const code = emp.employeeId || emp.employeeIdNumber || `EMP-${id.toString().slice(-4).toUpperCase()}`;
                        const dept = emp.department || emp.team || 'General';
                        const desig = emp.designation || emp.positionTitle || emp.role || 'Member';
                        return (
                          <option key={id} value={id}>
                            {fullName} ({code}) — {desig} • {dept}
                          </option>
                        );
                      })}
                    </select>
                    {selectedEmpId && (
                      <div className="d-flex align-items-center gap-1 mt-1" style={{ fontSize: '11px', color: '#059669' }}>
                        <CheckCircleIcon size={13} />
                        <span>Verified employee in your authorized organization</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* VIEW MODE RECIPIENT DISPLAY */
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(79, 70, 229, 0.05)',
                      border: '1px solid rgba(79, 70, 229, 0.15)',
                      borderRadius: '10px',
                      marginBottom: '4px',
                    }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <AwardIcon size={16} className="text-amber-500" />
                      <strong style={{ fontSize: '13px' }}>Recipient: {employeeName || 'Honored Colleague'}</strong>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)' }}>
                      ID: <span className="font-mono">{employeeId || 'N/A'}</span> • Period: <strong>{period}</strong>
                    </div>
                  </div>
                )}

                <div className="form-group mb-1">
                  <label className="form-sublabel">Employee Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="Select an employee above"
                    readOnly={Boolean(isAuthorizedHR && !isViewMode && selectedEmpId)}
                    disabled={isViewMode}
                    style={selectedEmpId ? { background: 'var(--bg-subtle, #f8fafc)' } : {}}
                    required
                  />
                </div>

                <div className="form-group mb-1">
                  <label className="form-sublabel">Employee ID *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. EMP-1048"
                    readOnly={Boolean(isAuthorizedHR && !isViewMode && selectedEmpId)}
                    disabled={isViewMode}
                    style={selectedEmpId ? { background: 'var(--bg-subtle, #f8fafc)' } : {}}
                    required
                  />
                </div>

                <div className="form-group mb-1">
                  <label className="form-sublabel">Recognition Award Category *</label>
                  <select
                    className="form-control"
                    value={awardTitle}
                    disabled={isViewMode}
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
                    <option value="Distinguished Innovation Award">Distinguished Innovation Award</option>
                    <option value="Certificate of Appreciation">Certificate of Appreciation</option>
                    <option value="Star Performer of the Quarter">Star Performer of the Quarter</option>
                  </select>
                </div>

                <div className="form-group mb-1">
                  <label className="form-sublabel">Award Period *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={period}
                    disabled={isViewMode}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="e.g. November 2026 or 2026"
                    required
                  />
                </div>

                {!isViewMode && (
                  <div className="form-group mb-1">
                    <label className="form-sublabel">Employee Photograph (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-control"
                      onChange={handlePhotoUpload}
                    />
                    {employeePhoto && (
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={employeePhoto}
                          alt="Preview"
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => setEmployeePhoto('')}
                        >
                          Remove Photo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group mb-2">
                  <label className="form-sublabel">Custom Citation / Commendation *</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={customComment}
                    disabled={isViewMode}
                    onChange={(e) => setCustomComment(e.target.value)}
                    placeholder="Enter personalized commendation for the certificate..."
                    required
                  />
                </div>
              </div>
            )}

            {/* TAB 2: Organization & Custom Template Branding */}
            {activeStudioTab === 'template' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-sublabel">Select Corporate Certificate Template</label>
                  <div className="cert-template-grid">
                    {/* Preset 1: Classic Gold */}
                    <div
                      className={`cert-template-card ${templateId === 'classic-gold' ? 'active' : ''}`}
                      onClick={() => {
                        setTemplateId('classic-gold');
                        localStorage.setItem('taskflow_cert_template', 'classic-gold');
                      }}
                    >
                      <div
                        className="cert-template-preview-bar"
                        style={{ background: 'linear-gradient(90deg, #AA771C, #D4AF37, #FEE180)' }}
                      />
                      <span className="cert-template-card-title">Executive Gold</span>
                      <span className="cert-template-card-badge">Classic Corporate</span>
                    </div>

                    {/* Preset 2: Modern Navy */}
                    <div
                      className={`cert-template-card ${templateId === 'modern-navy' ? 'active' : ''}`}
                      onClick={() => {
                        setTemplateId('modern-navy');
                        localStorage.setItem('taskflow_cert_template', 'modern-navy');
                      }}
                    >
                      <div
                        className="cert-template-preview-bar"
                        style={{ background: 'linear-gradient(90deg, #0284C7, #38BDF8, #6366F1)' }}
                      />
                      <span className="cert-template-card-title">Modern Navy</span>
                      <span className="cert-template-card-badge">Tech & Modern</span>
                    </div>

                    {/* Preset 3: Emerald Elite */}
                    <div
                      className={`cert-template-card ${templateId === 'emerald-elite' ? 'active' : ''}`}
                      onClick={() => {
                        setTemplateId('emerald-elite');
                        localStorage.setItem('taskflow_cert_template', 'emerald-elite');
                      }}
                    >
                      <div
                        className="cert-template-preview-bar"
                        style={{ background: 'linear-gradient(90deg, #065F46, #10B981, #D4AF37)' }}
                      />
                      <span className="cert-template-card-title">Emerald Elite</span>
                      <span className="cert-template-card-badge">Leadership</span>
                    </div>

                    {/* Preset 4: Royal Crimson */}
                    <div
                      className={`cert-template-card ${templateId === 'royal-crimson' ? 'active' : ''}`}
                      onClick={() => {
                        setTemplateId('royal-crimson');
                        localStorage.setItem('taskflow_cert_template', 'royal-crimson');
                      }}
                    >
                      <div
                        className="cert-template-preview-bar"
                        style={{ background: 'linear-gradient(90deg, #881337, #BE123C, #F59E0B)' }}
                      />
                      <span className="cert-template-card-title">Royal Crimson</span>
                      <span className="cert-template-card-badge">Prestige & Honors</span>
                    </div>

                    {/* Custom Organization Template Option */}
                    <div className="cert-template-custom-box">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong style={{ fontSize: '12.5px' }}>🏢 Organization Custom Template</strong>
                        {templateId === 'custom' && (
                          <span className="badge badge-gold">Active Template</span>
                        )}
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                        Upload your organization's custom certificate background to completely replace default styling.
                      </p>
                      {!isViewMode && (
                        <input
                          type="file"
                          accept="image/*"
                          className="form-control"
                          style={{ fontSize: '12px' }}
                          onChange={handleCustomTemplateUpload}
                        />
                      )}
                      {customTemplateImage && (
                        <div className="d-flex align-items-center justify-content-between" style={{ marginTop: '4px' }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${templateId === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => {
                              setTemplateId('custom');
                              localStorage.setItem('taskflow_cert_template', 'custom');
                            }}
                          >
                            {templateId === 'custom' ? '✓ Using Custom Template' : 'Use Custom Template'}
                          </button>
                          {!isViewMode && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', padding: '3px 8px', color: '#ef4444' }}
                              onClick={() => {
                                setCustomTemplateImage('');
                                setTemplateId('classic-gold');
                                localStorage.removeItem('taskflow_cert_custom_bg');
                                localStorage.setItem('taskflow_cert_template', 'classic-gold');
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Organization Details */}
                <div className="form-group mb-1">
                  <label className="form-sublabel">Organization Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={companyName}
                    disabled={isViewMode}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      try { localStorage.setItem('taskflow_cert_org_name', e.target.value); } catch (_) {}
                    }}
                    placeholder="e.g. Acme Corporation"
                  />
                </div>

                {!isViewMode && (
                  <div className="form-group mb-1">
                    <label className="form-sublabel">Company Logo (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-control"
                      onChange={handleLogoUpload}
                    />
                    {companyLogo && (
                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={companyLogo} alt="Logo" style={{ height: '24px', objectFit: 'contain' }} />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '2px 6px' }}
                          onClick={() => {
                            setCompanyLogo('');
                            localStorage.removeItem('taskflow_cert_org_logo');
                          }}
                        >
                          Remove Logo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="d-flex gap-2">
                  <div className="form-group flex-1">
                    <label className="form-sublabel">Signatory Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={signatoryName}
                      disabled={isViewMode}
                      onChange={(e) => {
                        setSignatoryName(e.target.value);
                        try { localStorage.setItem('taskflow_cert_sig_name', e.target.value); } catch (_) {}
                      }}
                      placeholder="e.g. Elena Rostova"
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label className="form-sublabel">Signatory Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={signatoryTitle}
                      disabled={isViewMode}
                      onChange={(e) => {
                        setSignatoryTitle(e.target.value);
                        try { localStorage.setItem('taskflow_cert_sig_title', e.target.value); } catch (_) {}
                      }}
                      placeholder="e.g. Chief Executive Officer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS: Single Download Button & Share Button */}
            <div className="cert-download-actions">
              <button
                type="button"
                className="cert-btn-primary"
                onClick={handleDownload}
                disabled={!generatedCanvas || previewLoading}
                title="Download high-resolution official printable certificate (PDF)"
              >
                <DownloadIcon size={18} />
                <span>Download Certificate</span>
              </button>

              <button
                type="button"
                className="cert-btn-secondary"
                onClick={handleShare}
                disabled={!generatedCanvas || previewLoading}
                title="Share certificate to LinkedIn, WhatsApp, email, or copy to clipboard"
              >
                <Share2Icon size={18} />
                <span>Share</span>
              </button>
            </div>

            {/* HR APPROVE & ISSUE BUTTON (HR ONLY, HIDDEN IN VIEW MODE) */}
            {isAuthorizedHR && !isViewMode && (
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-success btn-block d-flex align-items-center justify-content-center gap-2"
                  onClick={handleApproveAward}
                  disabled={isSaving || !selectedEmpId}
                  style={{
                    background: selectedEmpId ? '#10b981' : '#94a3b8',
                    color: '#ffffff',
                    width: '100%',
                    fontWeight: 700,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: selectedEmpId ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <CheckCircleIcon size={16} />
                  <span>{isSaving ? 'Approving & Publishing...' : '✓ Approve & Issue Official Award'}</span>
                </button>
                {!selectedEmpId && (
                  <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px', textAlign: 'center' }}>
                    Please select an employee from your organization roster above.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Live Visual Certificate Preview */}
          <div className="cert-preview-column">
            <div className="cert-preview-header">
              <span>Live Vector Preview</span>
              <span className="badge badge-gold">{currentTemplateName}</span>
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
                <p style={{ color: '#94a3b8' }}>Generating preview...</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="wa-assign-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* IN-APP SHARE POPUP MODAL */}
      {showShareModal && (
        <div className="cert-share-overlay" onClick={() => setShowShareModal(false)}>
          <div className="cert-share-card" onClick={(e) => e.stopPropagation()}>
            <div className="cert-share-header">
              <h4>Share Certificate</h4>
              <button
                type="button"
                className="wa-assign-close-btn"
                onClick={() => setShowShareModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
              Share this official recognition credential with colleagues, networks, or on social media.
            </p>

            {shareFeedback && (
              <div className="share-copy-pill animate-fade-in">
                {shareFeedback}
              </div>
            )}

            <div className="cert-share-options-list">
              <button
                type="button"
                className="cert-share-option-btn"
                onClick={handleCopyImageToClipboard}
              >
                <div className="share-btn-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#4f46e5' }}>
                  <CopyIcon size={18} />
                </div>
                <div>
                  <div>Copy Certificate Image</div>
                  <small style={{ color: 'var(--text-muted, #64748b)' }}>Paste directly into Slack, Teams, or chats</small>
                </div>
              </button>

              <button
                type="button"
                className="cert-share-option-btn"
                onClick={handleShareLinkedIn}
              >
                <div className="share-btn-icon-wrapper" style={{ background: 'rgba(10, 102, 194, 0.15)', color: '#0a66c2' }}>
                  💼
                </div>
                <div>
                  <div>Share to LinkedIn</div>
                  <small style={{ color: 'var(--text-muted, #64748b)' }}>Post your achievement to your professional network</small>
                </div>
              </button>

              <button
                type="button"
                className="cert-share-option-btn"
                onClick={handleShareWhatsApp}
              >
                <div className="share-btn-icon-wrapper" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25d366' }}>
                  💬
                </div>
                <div>
                  <div>Share to WhatsApp</div>
                  <small style={{ color: 'var(--text-muted, #64748b)' }}>Send to team channels or colleagues</small>
                </div>
              </button>

              <button
                type="button"
                className="cert-share-option-btn"
                onClick={handleShareTwitter}
              >
                <div className="share-btn-icon-wrapper" style={{ background: 'rgba(0, 0, 0, 0.08)', color: 'inherit' }}>
                  ✖️
                </div>
                <div>
                  <div>Share to X / Twitter</div>
                  <small style={{ color: 'var(--text-muted, #64748b)' }}>Broadcast your milestone</small>
                </div>
              </button>

              <button
                type="button"
                className="cert-share-option-btn"
                onClick={handleShareEmail}
              >
                <div className="share-btn-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                  ✉️
                </div>
                <div>
                  <div>Email Certificate</div>
                  <small style={{ color: 'var(--text-muted, #64748b)' }}>Send via email client</small>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
