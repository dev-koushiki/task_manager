import { useState, useEffect, useRef } from 'react';
import {
  UserIcon,
  MailIcon,
  PhoneIcon,
  BuildingIcon,
  BriefcaseIcon,
  MapPinIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  EditIcon,
  ShieldIcon,
  LockIcon,
  SparklesIcon,
  CameraIcon,
  GraduationCapIcon,
  ExternalLinkIcon,
  GithubIcon,
  LinkedinIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
} from './Icons';
import { api } from '../services/api';

/**
 * Calculates dynamic profile completion based on completed personal and professional fields.
 * Total: 17 field checks totaling 100%.
 */
export const calculateProfileCompletion = (u) => {
  if (!u) {
    return {
      percentage: 0,
      message: "Let's get started!",
      badgeClass: 'tier-starter',
      completedCount: 0,
      totalCount: 17,
      items: [],
      pendingItems: [],
    };
  }

  const checks = [
    // Personal Information (9 fields = 50% total)
    {
      id: 'profilePhoto',
      category: 'personal',
      label: 'Profile Photo',
      completed: Boolean(u.profilePhoto && String(u.profilePhoto).trim().length > 0),
      weight: 10,
    },
    {
      id: 'firstName',
      category: 'personal',
      label: 'First Name',
      completed: Boolean(u.firstName && String(u.firstName).trim().length > 0),
      weight: 5,
    },
    {
      id: 'lastName',
      category: 'personal',
      label: 'Last Name',
      completed: Boolean(u.lastName && String(u.lastName).trim().length > 0),
      weight: 5,
    },
    {
      id: 'dateOfBirth',
      category: 'personal',
      label: 'Date of Birth',
      completed: Boolean(u.dateOfBirth && String(u.dateOfBirth).trim().length > 0),
      weight: 5,
    },
    {
      id: 'phone',
      category: 'personal',
      label: 'Phone Number',
      completed: Boolean(u.phone && String(u.phone).trim().length > 0),
      weight: 5,
    },
    {
      id: 'personalEmail',
      category: 'personal',
      label: 'Personal Email',
      completed: Boolean(u.personalEmail && String(u.personalEmail).trim().length > 0),
      weight: 5,
    },
    {
      id: 'address',
      category: 'personal',
      label: 'Current Address',
      completed: Boolean(u.address && String(u.address).trim().length > 0),
      weight: 5,
    },
    {
      id: 'city',
      category: 'personal',
      label: 'City',
      completed: Boolean(u.city && String(u.city).trim().length > 0),
      weight: 5,
    },
    {
      id: 'state',
      category: 'personal',
      label: 'State',
      completed: Boolean(u.state && String(u.state).trim().length > 0),
      weight: 5,
    },

    // Professional Information (8 fields = 50% total)
    {
      id: 'designation',
      category: 'professional',
      label: 'Job Title / Designation',
      completed: Boolean(
        (u.designation && String(u.designation).trim().length > 0) ||
        (u.positionTitle && String(u.positionTitle).trim().length > 0)
      ),
      weight: 6,
    },
    {
      id: 'department',
      category: 'professional',
      label: 'Department',
      completed: Boolean(u.department && String(u.department).trim().length > 0),
      weight: 6,
    },
    {
      id: 'bio',
      category: 'professional',
      label: 'Professional Bio',
      completed: Boolean(u.bio && String(u.bio).trim().length > 0),
      weight: 8,
    },
    {
      id: 'skills',
      category: 'professional',
      label: 'Technical Skills',
      completed: Boolean(
        (Array.isArray(u.skills) && u.skills.length > 0) ||
        (Array.isArray(u.expertise) && u.expertise.length > 0)
      ),
      weight: 8,
    },
    {
      id: 'workExperience',
      category: 'professional',
      label: 'Work Experience',
      completed: Boolean(Array.isArray(u.workExperience) && u.workExperience.length > 0),
      weight: 8,
    },
    {
      id: 'education',
      category: 'professional',
      label: 'Education',
      completed: Boolean(Array.isArray(u.education) && u.education.length > 0),
      weight: 8,
    },
    {
      id: 'githubUrl',
      category: 'professional',
      label: 'GitHub Profile URL',
      completed: Boolean(u.githubUrl && String(u.githubUrl).trim().length > 0),
      weight: 3,
    },
    {
      id: 'linkedinUrl',
      category: 'professional',
      label: 'LinkedIn Profile URL',
      completed: Boolean(u.linkedinUrl && String(u.linkedinUrl).trim().length > 0),
      weight: 3,
    },
  ];

  const totalScore = checks.reduce((sum, item) => sum + (item.completed ? item.weight : 0), 0);
  const percentage = Math.min(100, Math.round(totalScore));
  const completedCount = checks.filter((c) => c.completed).length;

  let message = "Let's get started!";
  let badgeClass = 'tier-starter';
  if (percentage >= 91) {
    message = 'Your profile is complete!';
    badgeClass = 'tier-complete';
  } else if (percentage >= 61) {
    message = 'Almost there!';
    badgeClass = 'tier-high';
  } else if (percentage >= 31) {
    message = 'Good progress! Keep going.';
    badgeClass = 'tier-mid';
  }

  return {
    percentage,
    message,
    badgeClass,
    completedCount,
    totalCount: checks.length,
    items: checks,
    pendingItems: checks.filter((c) => !c.completed),
  };
};

export const EmployeeProfileView = ({ user, isAdmin, onProfileUpdated }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'security'
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingProfessional, setIsEditingProfessional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);

  const fileInputRef = useRef(null);

  // Form states
  const [personalForm, setPersonalForm] = useState({
    firstName: '',
    lastName: '',
    profilePhoto: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    personalEmail: '',
    address: '',
    city: '',
    state: '',
    country: '',
  });

  const [professionalForm, setProfessionalForm] = useState({
    designation: '',
    bio: '',
    skills: [],
    expertise: [],
    workExperience: [],
    education: [],
    githubUrl: '',
    linkedinUrl: '',
  });

  // Inputs for adding tags/items
  const [skillInput, setSkillInput] = useState('');
  const [expertiseInput, setExpertiseInput] = useState('');

  // Experience entry draft
  const [expDraft, setExpDraft] = useState({ title: '', company: '', duration: '', description: '' });
  const [isAddingExp, setIsAddingExp] = useState(false);

  // Education entry draft
  const [eduDraft, setEduDraft] = useState({ degree: '', institution: '', year: '' });
  const [isAddingEdu, setIsAddingEdu] = useState(false);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Sync state from user prop
  useEffect(() => {
    if (user) {
      setPersonalForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        profilePhoto: user.profilePhoto || '',
        dateOfBirth: user.dateOfBirth || '',
        gender: user.gender || '',
        phone: user.phone || '',
        personalEmail: user.personalEmail || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || '',
      });

      setProfessionalForm({
        designation: user.designation || '',
        bio: user.bio || '',
        skills: Array.isArray(user.skills) ? [...user.skills] : [],
        expertise: Array.isArray(user.expertise) ? [...user.expertise] : [],
        workExperience: Array.isArray(user.workExperience) ? [...user.workExperience] : [],
        education: Array.isArray(user.education) ? [...user.education] : [],
        githubUrl: user.githubUrl || '',
        linkedinUrl: user.linkedinUrl || '',
      });
    }
  }, [user]);

  const triggerNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4500);
  };

  const triggerError = (msg) => {
    setErrorNotice(msg);
    setTimeout(() => setErrorNotice(''), 5500);
  };

  // Preview object for live completion calculation while editing
  const previewUser = {
    ...user,
    ...(isEditingPersonal ? personalForm : {}),
    ...(isEditingProfessional ? professionalForm : {}),
  };

  const completion = calculateProfileCompletion(previewUser);

  // User initials fallback
  const userInitials =
    (user?.firstName?.[0] || 'E') + (user?.lastName?.[0] || 'M');

  // Photo upload and client-side canvas compression
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      triggerError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to maximum 360x360 square
        const canvas = document.createElement('canvas');
        const maxSize = 360;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setPersonalForm((prev) => ({ ...prev, profilePhoto: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPersonalForm((prev) => ({ ...prev, profilePhoto: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save Personal Info
  const handleSavePersonal = async (e) => {
    if (e) e.preventDefault();
    if (!personalForm.firstName.trim() || !personalForm.lastName.trim()) {
      triggerError('First name and last name are required.');
      return;
    }

    try {
      setSaving(true);
      setErrorNotice('');
      const updated = await api.updateProfile({
        firstName: personalForm.firstName.trim(),
        lastName: personalForm.lastName.trim(),
        profilePhoto: personalForm.profilePhoto,
        dateOfBirth: personalForm.dateOfBirth,
        gender: personalForm.gender,
        phone: personalForm.phone.trim(),
        personalEmail: personalForm.personalEmail.trim(),
        address: personalForm.address.trim(),
        city: personalForm.city.trim(),
        state: personalForm.state.trim(),
        country: personalForm.country.trim(),
      });

      triggerNotice('Personal information updated successfully!');
      setIsEditingPersonal(false);
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      triggerError(err.message || 'Failed to update personal information.');
    } finally {
      setSaving(false);
    }
  };

  // Save Professional Info
  const handleSaveProfessional = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setErrorNotice('');
      const payload = {
        bio: professionalForm.bio.trim(),
        skills: professionalForm.skills,
        expertise: professionalForm.expertise,
        workExperience: professionalForm.workExperience,
        education: professionalForm.education,
        githubUrl: professionalForm.githubUrl.trim(),
        linkedinUrl: professionalForm.linkedinUrl.trim(),
      };

      if (isAdmin && professionalForm.designation.trim()) {
        payload.designation = professionalForm.designation.trim();
      }

      const updated = await api.updateProfile(payload);
      triggerNotice('Professional information saved successfully!');
      setIsEditingProfessional(false);
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      triggerError(err.message || 'Failed to update professional information.');
    } finally {
      setSaving(false);
    }
  };

  // Skills tag helpers
  const handleAddSkill = () => {
    const val = skillInput.trim();
    if (!val) return;
    if (!professionalForm.skills.includes(val)) {
      setProfessionalForm((prev) => ({
        ...prev,
        skills: [...prev.skills, val],
      }));
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setProfessionalForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  // Areas of expertise tag helpers
  const handleAddExpertise = () => {
    const val = expertiseInput.trim();
    if (!val) return;
    if (!professionalForm.expertise.includes(val)) {
      setProfessionalForm((prev) => ({
        ...prev,
        expertise: [...prev.expertise, val],
      }));
    }
    setExpertiseInput('');
  };

  const handleRemoveExpertise = (expToRemove) => {
    setProfessionalForm((prev) => ({
      ...prev,
      expertise: prev.expertise.filter((e) => e !== expToRemove),
    }));
  };

  // Work experience helpers
  const handleAddExperienceItem = () => {
    if (!expDraft.title.trim() || !expDraft.company.trim()) {
      triggerError('Please provide at least a Job Title and Company.');
      return;
    }
    setProfessionalForm((prev) => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        {
          title: expDraft.title.trim(),
          company: expDraft.company.trim(),
          duration: expDraft.duration.trim(),
          description: expDraft.description.trim(),
        },
      ],
    }));
    setExpDraft({ title: '', company: '', duration: '', description: '' });
    setIsAddingExp(false);
  };

  const handleRemoveExperienceItem = (index) => {
    setProfessionalForm((prev) => ({
      ...prev,
      workExperience: prev.workExperience.filter((_, i) => i !== index),
    }));
  };

  // Education helpers
  const handleAddEducationItem = () => {
    if (!eduDraft.degree.trim() || !eduDraft.institution.trim()) {
      triggerError('Please provide at least Degree and School / Institution.');
      return;
    }
    setProfessionalForm((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          degree: eduDraft.degree.trim(),
          institution: eduDraft.institution.trim(),
          year: eduDraft.year.trim(),
        },
      ],
    }));
    setEduDraft({ degree: '', institution: '', year: '' });
    setIsAddingEdu(false);
  };

  const handleRemoveEducationItem = (index) => {
    setProfessionalForm((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      triggerError('Current password is required.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      triggerError('New password and confirm password do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      triggerError('New password must be at least 6 characters.');
      return;
    }

    try {
      setSaving(true);
      setErrorNotice('');
      await api.updateProfile({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      triggerNotice('Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      triggerError(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  // SVG ring radius calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * completion.percentage) / 100;

  return (
    <div className="employee-profile-experience animate-fade-in">
      {/* Alert Banners */}
      {notice && (
        <div className="alert-box alert-success animate-fade-in">
          <CheckCircleIcon size={16} />
          <span>{notice}</span>
        </div>
      )}
      {errorNotice && (
        <div className="alert-box alert-danger animate-fade-in">
          <AlertTriangleIcon size={16} />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* ========================================================
          1. HERO HEADER CARD (LinkedIn-Inspired Profile Banner)
          ======================================================== */}
      <div className="emp-hero-card">
        <div className="emp-hero-banner">
          <div className="banner-pattern" />
        </div>

        <div className="emp-hero-content">
          {/* Avatar with Camera Overlay */}
          <div className="emp-avatar-wrapper">
            {previewUser.profilePhoto ? (
              <img
                src={previewUser.profilePhoto}
                alt={`${previewUser.firstName} ${previewUser.lastName}`}
                className="emp-avatar-img"
              />
            ) : (
              <div className="emp-avatar-fallback">{userInitials}</div>
            )}

            <button
              type="button"
              className="avatar-camera-btn"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              title="Upload or change profile photo"
            >
              <CameraIcon size={15} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handlePhotoUpload}
            />
          </div>

          {/* User Basic Info & Socials */}
          <div className="emp-identity-row">
            <div className="emp-identity-text">
              <div className="emp-name-title">
                <h2>
                  {previewUser.firstName || 'Employee'} {previewUser.lastName || ''}
                </h2>
                <span className="emp-status-badge">
                  <CheckCircleIcon size={12} /> Active & Verified
                </span>
              </div>

              <p className="emp-designation-dept">
                <BriefcaseIcon size={14} className="text-muted" />
                <strong className="text-main">
                  {previewUser.designation || previewUser.positionTitle || 'Staff Member'}
                </strong>
                <span className="dot-separator">•</span>
                <span className="text-muted">{previewUser.department || 'Operations'}</span>
                {previewUser.employeeId && (
                  <>
                    <span className="dot-separator">•</span>
                    <span className="emp-id-chip">ID: {previewUser.employeeId}</span>
                  </>
                )}
              </p>

              {/* Social and External Links Pill */}
              <div className="emp-social-pills-row">
                {previewUser.linkedinUrl ? (
                  <a
                    href={previewUser.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-profile-pill linkedin"
                    title="View LinkedIn Profile"
                  >
                    <LinkedinIcon size={14} />
                    <span>LinkedIn</span>
                    <ExternalLinkIcon size={11} />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="social-profile-pill placeholder"
                    onClick={() => {
                      setIsEditingProfessional(true);
                      setActiveTab('profile');
                    }}
                    title="Add LinkedIn URL"
                  >
                    <LinkedinIcon size={14} />
                    <span>+ Add LinkedIn</span>
                  </button>
                )}

                {previewUser.githubUrl ? (
                  <a
                    href={previewUser.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-profile-pill github"
                    title="View GitHub Profile"
                  >
                    <GithubIcon size={14} />
                    <span>GitHub</span>
                    <ExternalLinkIcon size={11} />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="social-profile-pill placeholder"
                    onClick={() => {
                      setIsEditingProfessional(true);
                      setActiveTab('profile');
                    }}
                    title="Add GitHub URL"
                  >
                    <GithubIcon size={14} />
                    <span>+ Add GitHub</span>
                  </button>
                )}

                <span className="role-authority-chip">
                  <ShieldIcon size={12} /> Tier {user?.hierarchyLevel || (isAdmin ? 1 : 4)}
                </span>
              </div>
            </div>

            {/* Profile Completion Dial & Progress Indicator */}
            <div className="emp-completion-dial-container">
              <div className="dial-circle-wrap">
                <svg className="completion-ring-svg" width="96" height="96" viewBox="0 0 96 96">
                  <circle
                    className="ring-bg"
                    cx="48"
                    cy="48"
                    r={radius}
                    strokeWidth="7"
                  />
                  <circle
                    className={`ring-progress ${completion.badgeClass}`}
                    cx="48"
                    cy="48"
                    r={radius}
                    strokeWidth="7"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                  />
                </svg>
                <div className="dial-percentage-center">
                  <span className="percentage-number">{completion.percentage}%</span>
                  <span className="percentage-label">Score</span>
                </div>
              </div>

              <div className="dial-info-text">
                <div className="dial-header-line">
                  <strong className="dial-message">{completion.message}</strong>
                  <button
                    type="button"
                    className="checklist-toggle-btn"
                    onClick={() => setShowChecklist(!showChecklist)}
                  >
                    {showChecklist ? 'Hide Breakdown' : 'View Checklist'}
                  </button>
                </div>
                <div className="dial-progress-bar-wrap">
                  <div
                    className="dial-progress-bar-fill"
                    style={{ width: `${completion.percentage}%` }}
                  />
                </div>
                <p className="dial-subtext">
                  Completing your profile helps your organization understand your background, skills, and areas of expertise.
                </p>
              </div>
            </div>
          </div>

          {/* Expandable Completion Checklist Breakdown */}
          {showChecklist && (
            <div className="completion-checklist-drawer animate-fade-in">
              <div className="checklist-header">
                <div className="checklist-title">
                  <SparklesIcon size={15} className="text-primary" />
                  <strong>Profile Completion Checklist ({completion.completedCount} of {completion.totalCount} completed)</strong>
                </div>
                <span className="checklist-score-pill">{completion.percentage}% Total</span>
              </div>

              <div className="checklist-items-grid">
                {completion.items.map((item) => (
                  <div
                    key={item.id}
                    className={`checklist-item-pill ${item.completed ? 'is-complete' : 'is-pending'}`}
                    onClick={() => {
                      if (item.category === 'personal') setIsEditingPersonal(true);
                      if (item.category === 'professional') setIsEditingProfessional(true);
                    }}
                    title={item.completed ? 'Completed' : `Click to complete ${item.label} (+${item.weight}%)`}
                  >
                    <span className="check-indicator">
                      {item.completed ? <CheckIcon size={11} /> : '○'}
                    </span>
                    <span className="check-name">{item.label}</span>
                    <span className="check-weight">+{item.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Bar: Profile Overview vs Security */}
          <div className="emp-profile-nav-bar">
            <button
              type="button"
              className={`emp-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <UserIcon size={15} /> Personal & Professional Profile
            </button>
            <button
              type="button"
              className={`emp-nav-tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <LockIcon size={15} /> Security & Password
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. TAB: OVERVIEW (Personal & Professional Info Cards)
          ======================================================== */}
      {activeTab === 'overview' && (
        <div className="emp-sections-container">
          {/* ----------------------------------------------------
              SECTION 1: PERSONAL INFORMATION
              ---------------------------------------------------- */}
          <div className="emp-card-section">
            <div className="section-card-header">
              <div className="section-header-left">
                <div className="section-icon-badge">
                  <UserIcon size={18} className="text-primary" />
                </div>
                <div>
                  <h3>Personal Information</h3>
                  <p className="section-subtext">
                    Your personal contact identity, residential location, and personal details.
                  </p>
                </div>
              </div>

              {!isEditingPersonal ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditingPersonal(true)}
                >
                  <EditIcon size={13} /> Edit Personal Info
                </button>
              ) : (
                <div className="edit-actions-cluster">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditingPersonal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSavePersonal}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {/* VIEW MODE: PERSONAL INFO */}
            {!isEditingPersonal ? (
              <div className="emp-info-grid">
                <div className="emp-info-cell">
                  <span className="cell-label">First Name</span>
                  <strong className="cell-value">{user?.firstName || '—'}</strong>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">Last Name</span>
                  <strong className="cell-value">{user?.lastName || '—'}</strong>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">Date of Birth</span>
                  <span className="cell-value icon-aligned">
                    <CalendarIcon size={14} className="text-muted" />
                    {user?.dateOfBirth || <span className="text-placeholder">Not specified</span>}
                  </span>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">Gender</span>
                  <span className="cell-value">
                    {user?.gender || <span className="text-placeholder">Not specified</span>}
                  </span>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">Phone Number</span>
                  <span className="cell-value icon-aligned">
                    <PhoneIcon size={14} className="text-muted" />
                    {user?.phone ? (
                      <a href={`tel:${user.phone}`} className="link-text">{user.phone}</a>
                    ) : (
                      <span className="text-placeholder">No phone added</span>
                    )}
                  </span>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">Personal Email</span>
                  <span className="cell-value icon-aligned">
                    <MailIcon size={14} className="text-muted" />
                    {user?.personalEmail ? (
                      <a href={`mailto:${user.personalEmail}`} className="link-text">{user.personalEmail}</a>
                    ) : (
                      <span className="text-placeholder">No personal email added</span>
                    )}
                  </span>
                </div>

                <div className="emp-info-cell span-2">
                  <span className="cell-label">Current Address</span>
                  <span className="cell-value icon-aligned">
                    <MapPinIcon size={14} className="text-muted" />
                    {user?.address || <span className="text-placeholder">No street address specified</span>}
                  </span>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">City</span>
                  <span className="cell-value">{user?.city || <span className="text-placeholder">Not specified</span>}</span>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">State / Province</span>
                  <span className="cell-value">{user?.state || <span className="text-placeholder">Not specified</span>}</span>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">Country</span>
                  <span className="cell-value">{user?.country || <span className="text-placeholder">Not specified</span>}</span>
                </div>

                <div className="emp-info-cell">
                  <span className="cell-label">Primary Account Email</span>
                  <span className="cell-value icon-aligned">
                    <MailIcon size={14} className="text-primary" />
                    {user?.email}
                  </span>
                </div>
              </div>
            ) : (
              /* EDIT MODE: PERSONAL INFO FORM */
              <form onSubmit={handleSavePersonal} className="emp-edit-form animate-fade-in">
                {/* Photo uploader inside form */}
                <div className="form-photo-upload-row">
                  <div className="form-photo-preview">
                    {personalForm.profilePhoto ? (
                      <img src={personalForm.profilePhoto} alt="Preview" />
                    ) : (
                      <div className="photo-placeholder-box">
                        <CameraIcon size={24} className="text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="form-photo-actions">
                    <strong>Profile Picture</strong>
                    <p className="form-subtext">Upload a clear square headshot. Supports JPG, PNG, WEBP.</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      >
                        <CameraIcon size={12} /> Upload New Photo
                      </button>
                      {personalForm.profilePhoto && (
                        <button
                          type="button"
                          className="btn btn-danger-subtle btn-xs"
                          onClick={handleRemovePhoto}
                        >
                          <TrashIcon size={12} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={personalForm.firstName}
                      onChange={(e) => setPersonalForm({ ...personalForm, firstName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      value={personalForm.lastName}
                      onChange={(e) => setPersonalForm({ ...personalForm, lastName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="input-field"
                      value={personalForm.dateOfBirth}
                      onChange={(e) => setPersonalForm({ ...personalForm, dateOfBirth: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gender (Optional)</label>
                    <select
                      className="input-field"
                      value={personalForm.gender}
                      onChange={(e) => setPersonalForm({ ...personalForm, gender: e.target.value })}
                    >
                      <option value="">-- Prefer not to say --</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. +1 (555) 019-2834"
                      className="input-field"
                      value={personalForm.phone}
                      onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Personal Email</label>
                    <input
                      type="email"
                      placeholder="e.g. personal@gmail.com"
                      className="input-field"
                      value={personalForm.personalEmail}
                      onChange={(e) => setPersonalForm({ ...personalForm, personalEmail: e.target.value })}
                    />
                  </div>

                  <div className="form-group span-2">
                    <label className="form-label">Current Address</label>
                    <input
                      type="text"
                      placeholder="Street address, apartment or suite"
                      className="input-field"
                      value={personalForm.address}
                      onChange={(e) => setPersonalForm({ ...personalForm, address: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      placeholder="e.g. San Francisco"
                      className="input-field"
                      value={personalForm.city}
                      onChange={(e) => setPersonalForm({ ...personalForm, city: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">State / Province</label>
                    <input
                      type="text"
                      placeholder="e.g. California"
                      className="input-field"
                      value={personalForm.state}
                      onChange={(e) => setPersonalForm({ ...personalForm, state: e.target.value })}
                    />
                  </div>

                  <div className="form-group span-2">
                    <label className="form-label">Country</label>
                    <input
                      type="text"
                      placeholder="e.g. United States"
                      className="input-field"
                      value={personalForm.country}
                      onChange={(e) => setPersonalForm({ ...personalForm, country: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-actions-bottom">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsEditingPersonal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Personal Information'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ----------------------------------------------------
              SECTION 2: PROFESSIONAL INFORMATION
              ---------------------------------------------------- */}
          <div className="emp-card-section">
            <div className="section-card-header">
              <div className="section-header-left">
                <div className="section-icon-badge">
                  <BriefcaseIcon size={18} className="text-primary" />
                </div>
                <div>
                  <h3>Professional Information</h3>
                  <p className="section-subtext">
                    Your professional bio, technical skills, areas of expertise, work experience, education, and links.
                  </p>
                </div>
              </div>

              {!isEditingProfessional ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditingProfessional(true)}
                >
                  <EditIcon size={13} /> Edit Professional Info
                </button>
              ) : (
                <div className="edit-actions-cluster">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditingProfessional(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveProfessional}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {/* 1. Admin-Controlled Organization Fields Banner */}
            <div className="org-controlled-banner">
              <div className="org-banner-header">
                <span className="org-badge-lock">
                  <LockIcon size={12} /> Organization Managed
                </span>
                <small className="org-banner-hint">
                  Reporting relationship, department placement, and employee ID are governed by leadership.
                </small>
              </div>

              <div className="org-fields-summary-grid">
                <div className="org-field-item">
                  <span className="org-field-label">Position / Job Title</span>
                  <strong className="org-field-val">
                    {user?.designation || user?.positionTitle || 'Staff Member'}
                  </strong>
                </div>

                <div className="org-field-item">
                  <span className="org-field-label">Department</span>
                  <strong className="org-field-val">{user?.department || 'Operations'}</strong>
                </div>

                <div className="org-field-item">
                  <span className="org-field-label">Employee ID</span>
                  <strong className="org-field-val text-primary">{user?.employeeId || 'Assigned by Admin'}</strong>
                </div>

                <div className="org-field-item">
                  <span className="org-field-label">Company Taskflow</span>
                  <strong className="org-field-val">{user?.companyName || 'Taskflow'}</strong>
                </div>

                <div className="org-field-item">
                  <span className="org-field-label">Reporting Supervisor</span>
                  <strong className="org-field-val">
                    {user?.reportsTo
                      ? `${user.reportsTo.firstName} ${user.reportsTo.lastName} (${user.reportsTo.designation || 'Supervisor'})`
                      : 'Executive Leadership (No Direct Manager)'}
                  </strong>
                </div>

                <div className="org-field-item">
                  <span className="org-field-label">Hierarchy Tier</span>
                  <strong className="org-field-val">
                    Tier {user?.hierarchyLevel || (isAdmin ? 1 : 4)}
                  </strong>
                </div>
              </div>
            </div>

            {/* VIEW MODE: PROFESSIONAL INFO */}
            {!isEditingProfessional ? (
              <div className="emp-prof-view-stack">
                {/* 1. Professional Bio */}
                <div className="prof-block">
                  <h4 className="prof-block-title">About & Professional Bio</h4>
                  {user?.bio ? (
                    <p className="prof-bio-text">{user.bio}</p>
                  ) : (
                    <div className="prof-empty-prompt" onClick={() => setIsEditingProfessional(true)}>
                      <p>No professional bio added yet. Add a summary of your background, achievements, and impact.</p>
                      <button type="button" className="btn btn-secondary btn-xs">+ Add Bio</button>
                    </div>
                  )}
                </div>

                {/* 2. Technical Skills */}
                <div className="prof-block">
                  <h4 className="prof-block-title">Technical Skills</h4>
                  {Array.isArray(user?.skills) && user.skills.length > 0 ? (
                    <div className="tags-container">
                      {user.skills.map((skill, idx) => (
                        <span key={idx} className="skill-chip">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="prof-empty-prompt" onClick={() => setIsEditingProfessional(true)}>
                      <p>Highlight your core technologies and frameworks.</p>
                      <button type="button" className="btn btn-secondary btn-xs">+ Add Technical Skills</button>
                    </div>
                  )}
                </div>

                {/* 3. Areas of Expertise */}
                <div className="prof-block">
                  <h4 className="prof-block-title">Areas of Expertise & Domain Knowledge</h4>
                  {Array.isArray(user?.expertise) && user.expertise.length > 0 ? (
                    <div className="tags-container">
                      {user.expertise.map((exp, idx) => (
                        <span key={idx} className="expertise-chip">
                          {exp}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="prof-empty-prompt" onClick={() => setIsEditingProfessional(true)}>
                      <p>e.g. System Architecture, Cloud Security, Agile Delivery, UX Research.</p>
                      <button type="button" className="btn btn-secondary btn-xs">+ Add Expertise</button>
                    </div>
                  )}
                </div>

                {/* 4. Work Experience */}
                <div className="prof-block">
                  <h4 className="prof-block-title">Work Experience</h4>
                  {Array.isArray(user?.workExperience) && user.workExperience.length > 0 ? (
                    <div className="timeline-items-list">
                      {user.workExperience.map((exp, idx) => (
                        <div key={idx} className="timeline-card">
                          <div className="timeline-icon-box">
                            <BriefcaseIcon size={16} />
                          </div>
                          <div className="timeline-details">
                            <strong className="timeline-title">{exp.title}</strong>
                            <div className="timeline-meta">
                              <span className="timeline-company">{exp.company}</span>
                              {exp.duration && <span className="timeline-duration">• {exp.duration}</span>}
                            </div>
                            {exp.description && <p className="timeline-desc">{exp.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="prof-empty-prompt" onClick={() => setIsEditingProfessional(true)}>
                      <p>No previous work experience recorded yet.</p>
                      <button type="button" className="btn btn-secondary btn-xs">+ Add Work Experience</button>
                    </div>
                  )}
                </div>

                {/* 5. Education */}
                <div className="prof-block">
                  <h4 className="prof-block-title">Education & Degrees</h4>
                  {Array.isArray(user?.education) && user.education.length > 0 ? (
                    <div className="timeline-items-list">
                      {user.education.map((edu, idx) => (
                        <div key={idx} className="timeline-card">
                          <div className="timeline-icon-box education">
                            <GraduationCapIcon size={16} />
                          </div>
                          <div className="timeline-details">
                            <strong className="timeline-title">{edu.degree}</strong>
                            <div className="timeline-meta">
                              <span className="timeline-company">{edu.institution}</span>
                              {edu.year && <span className="timeline-duration">• Class of {edu.year}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="prof-empty-prompt" onClick={() => setIsEditingProfessional(true)}>
                      <p>No education history added yet.</p>
                      <button type="button" className="btn btn-secondary btn-xs">+ Add Education</button>
                    </div>
                  )}
                </div>

                {/* 6. LinkedIn & GitHub Links Display */}
                <div className="prof-block">
                  <h4 className="prof-block-title">Professional Profiles & Portfolios</h4>
                  <div className="external-links-grid">
                    <div className="link-card-box">
                      <div className="link-card-icon linkedin">
                        <LinkedinIcon size={20} />
                      </div>
                      <div className="link-card-body">
                        <strong>LinkedIn Profile</strong>
                        {user?.linkedinUrl ? (
                          <a
                            href={user.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-link-anchor"
                          >
                            <span>{user.linkedinUrl}</span>
                            <ExternalLinkIcon size={13} />
                          </a>
                        ) : (
                          <span className="text-placeholder">No LinkedIn profile linked yet</span>
                        )}
                      </div>
                    </div>

                    <div className="link-card-box">
                      <div className="link-card-icon github">
                        <GithubIcon size={20} />
                      </div>
                      <div className="link-card-body">
                        <strong>GitHub Profile</strong>
                        {user?.githubUrl ? (
                          <a
                            href={user.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="external-link-anchor"
                          >
                            <span>{user.githubUrl}</span>
                            <ExternalLinkIcon size={13} />
                          </a>
                        ) : (
                          <span className="text-placeholder">No GitHub profile linked yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* EDIT MODE: PROFESSIONAL INFO FORM */
              <form onSubmit={handleSaveProfessional} className="emp-edit-form animate-fade-in">
                {/* Admin Designation Edit Option if Admin */}
                {isAdmin && (
                  <div className="form-group">
                    <label className="form-label">Job Title / Designation (Admin Controlled)</label>
                    <input
                      type="text"
                      className="input-field"
                      value={professionalForm.designation}
                      onChange={(e) =>
                        setProfessionalForm({ ...professionalForm, designation: e.target.value })
                      }
                      placeholder="e.g. Lead Engineer, Chief Technology Officer"
                    />
                  </div>
                )}

                {/* 1. Bio */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Professional Bio / About Me</label>
                    <small className="form-counter">{professionalForm.bio.length} characters</small>
                  </div>
                  <textarea
                    rows={4}
                    className="input-field textarea-field"
                    placeholder="Write a concise overview of your background, experience, technical interests, and team contribution..."
                    value={professionalForm.bio}
                    onChange={(e) => setProfessionalForm({ ...professionalForm, bio: e.target.value })}
                  />
                </div>

                {/* 2. Technical Skills Tag Builder */}
                <div className="form-group">
                  <label className="form-label">Technical Skills</label>
                  <div className="tag-input-row">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Type a skill (e.g. React, Node.js, Python, AWS) and press Add"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                    />
                    <button type="button" className="btn btn-secondary" onClick={handleAddSkill}>
                      <PlusIcon size={13} /> Add
                    </button>
                  </div>
                  <div className="tags-container edit-mode">
                    {professionalForm.skills.map((skill, idx) => (
                      <span key={idx} className="skill-chip removable">
                        {skill}
                        <button type="button" onClick={() => handleRemoveSkill(skill)}>×</button>
                      </span>
                    ))}
                    {professionalForm.skills.length === 0 && (
                      <span className="tags-hint">No skills added yet. Type above to add.</span>
                    )}
                  </div>
                </div>

                {/* 3. Areas of Expertise Tag Builder */}
                <div className="form-group">
                  <label className="form-label">Areas of Expertise</label>
                  <div className="tag-input-row">
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Distributed Systems, Product Strategy, UI/UX"
                      value={expertiseInput}
                      onChange={(e) => setExpertiseInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExpertise();
                        }
                      }}
                    />
                    <button type="button" className="btn btn-secondary" onClick={handleAddExpertise}>
                      <PlusIcon size={13} /> Add
                    </button>
                  </div>
                  <div className="tags-container edit-mode">
                    {professionalForm.expertise.map((exp, idx) => (
                      <span key={idx} className="expertise-chip removable">
                        {exp}
                        <button type="button" onClick={() => handleRemoveExpertise(exp)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4. Work Experience Builder */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Work Experience</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => setIsAddingExp(true)}
                    >
                      <PlusIcon size={12} /> Add Experience Item
                    </button>
                  </div>

                  {/* List of existing experience */}
                  <div className="builder-items-list">
                    {professionalForm.workExperience.map((exp, idx) => (
                      <div key={idx} className="builder-item-row">
                        <div>
                          <strong>{exp.title}</strong> at <em>{exp.company}</em>
                          {exp.duration && <small className="text-muted"> ({exp.duration})</small>}
                          {exp.description && <p className="builder-item-desc">{exp.description}</p>}
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger-subtle btn-xs"
                          onClick={() => handleRemoveExperienceItem(idx)}
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Experience Modal/Drawer Form */}
                  {isAddingExp && (
                    <div className="inline-add-subcard animate-fade-in">
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-sublabel">Job Title *</label>
                          <input
                            type="text"
                            placeholder="e.g. Senior Frontend Engineer"
                            className="input-field"
                            value={expDraft.title}
                            onChange={(e) => setExpDraft({ ...expDraft, title: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-sublabel">Company / Organization *</label>
                          <input
                            type="text"
                            placeholder="e.g. Acme Innovations Inc."
                            className="input-field"
                            value={expDraft.company}
                            onChange={(e) => setExpDraft({ ...expDraft, company: e.target.value })}
                          />
                        </div>
                        <div className="form-group span-2">
                          <label className="form-sublabel">Duration / Period</label>
                          <input
                            type="text"
                            placeholder="e.g. Jan 2021 – Present (3 yrs)"
                            className="input-field"
                            value={expDraft.duration}
                            onChange={(e) => setExpDraft({ ...expDraft, duration: e.target.value })}
                          />
                        </div>
                        <div className="form-group span-2">
                          <label className="form-sublabel">Description of Achievements</label>
                          <textarea
                            rows={2}
                            placeholder="Summary of responsibilities and technical deliverables..."
                            className="input-field textarea-field"
                            value={expDraft.description}
                            onChange={(e) => setExpDraft({ ...expDraft, description: e.target.value })}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setIsAddingExp(false)}>
                          Cancel
                        </button>
                        <button type="button" className="btn btn-primary btn-xs" onClick={handleAddExperienceItem}>
                          Save Experience Item
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Education Builder */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Education & Degrees</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => setIsAddingEdu(true)}
                    >
                      <PlusIcon size={12} /> Add Education Item
                    </button>
                  </div>

                  <div className="builder-items-list">
                    {professionalForm.education.map((edu, idx) => (
                      <div key={idx} className="builder-item-row">
                        <div>
                          <strong>{edu.degree}</strong> — <em>{edu.institution}</em>
                          {edu.year && <small className="text-muted"> ({edu.year})</small>}
                        </div>
                        <button
                          type="button"
                          className="btn btn-danger-subtle btn-xs"
                          onClick={() => handleRemoveEducationItem(idx)}
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {isAddingEdu && (
                    <div className="inline-add-subcard animate-fade-in">
                      <div className="form-grid-2">
                        <div className="form-group">
                          <label className="form-sublabel">Degree / Certificate *</label>
                          <input
                            type="text"
                            placeholder="e.g. B.S. in Computer Science"
                            className="input-field"
                            value={eduDraft.degree}
                            onChange={(e) => setEduDraft({ ...eduDraft, degree: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-sublabel">School / University *</label>
                          <input
                            type="text"
                            placeholder="e.g. University of California, Berkeley"
                            className="input-field"
                            value={eduDraft.institution}
                            onChange={(e) => setEduDraft({ ...eduDraft, institution: e.target.value })}
                          />
                        </div>
                        <div className="form-group span-2">
                          <label className="form-sublabel">Graduation Year</label>
                          <input
                            type="text"
                            placeholder="e.g. 2022"
                            className="input-field"
                            value={eduDraft.year}
                            onChange={(e) => setEduDraft({ ...eduDraft, year: e.target.value })}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                        <button type="button" className="btn btn-secondary btn-xs" onClick={() => setIsAddingEdu(false)}>
                          Cancel
                        </button>
                        <button type="button" className="btn btn-primary btn-xs" onClick={handleAddEducationItem}>
                          Save Education Item
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. GitHub and LinkedIn URLs */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label icon-label">
                      <LinkedinIcon size={15} className="text-linkedin" /> LinkedIn Profile URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://linkedin.com/in/your-username"
                      className="input-field"
                      value={professionalForm.linkedinUrl}
                      onChange={(e) =>
                        setProfessionalForm({ ...professionalForm, linkedinUrl: e.target.value })
                      }
                    />
                    <small className="form-help-hint">Paste your public LinkedIn profile link.</small>
                  </div>

                  <div className="form-group">
                    <label className="form-label icon-label">
                      <GithubIcon size={15} /> GitHub Profile URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://github.com/your-username"
                      className="input-field"
                      value={professionalForm.githubUrl}
                      onChange={(e) =>
                        setProfessionalForm({ ...professionalForm, githubUrl: e.target.value })
                      }
                    />
                    <small className="form-help-hint">Paste your public GitHub repository or profile link.</small>
                  </div>
                </div>

                <div className="form-actions-bottom">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsEditingProfessional(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Professional Information'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          3. TAB: SECURITY & PASSWORD
          ======================================================== */}
      {activeTab === 'security' && (
        <div className="emp-card-section animate-fade-in">
          <div className="section-card-header">
            <div className="section-header-left">
              <div className="section-icon-badge">
                <LockIcon size={18} className="text-primary" />
              </div>
              <div>
                <h3>Account Security & Password</h3>
                <p className="section-subtext">
                  Update your account access password and view security recommendations.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="emp-edit-form" style={{ maxWidth: '580px' }}>
            <div className="form-group">
              <label className="form-label">Current Password *</label>
              <input
                type="password"
                required
                className="input-field"
                placeholder="Enter your current password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password * (at least 6 characters)</label>
              <input
                type="password"
                required
                minLength={6}
                className="input-field"
                placeholder="Enter new secure password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                className="input-field"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              />
            </div>

            <div className="security-notice-box">
              <ShieldIcon size={16} className="text-primary" />
              <div>
                <strong>Keep your TaskFlow credentials secure</strong>
                <p>Never share your password with anyone. Use a distinct combination of letters, numbers, and symbols.</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
