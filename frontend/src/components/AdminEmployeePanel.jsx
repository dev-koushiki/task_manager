import { useState, useEffect } from 'react';
import {
  LockIcon,
  MailIcon,
  BuildingIcon,
  CheckIcon,
  SparklesIcon,
  UsersIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  ShieldIcon,
  GitBranchIcon,
  AlertTriangleIcon,
  UserIcon,
  BriefcaseIcon,
  SearchIcon,
} from './Icons';
import { api } from '../services/api';
import { emailService } from '../services/emailService';
import { EmailConfigModal } from './EmailConfigModal';

export const AdminEmployeePanel = ({ companyName, onTestAcceptInvite }) => {
  const [org, setOrg] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [positions, setPositions] = useState([]);

  // EmailJS configuration modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isEmailConfigured, setIsEmailConfigured] = useState(() => emailService.isConfigured());

  // Cached invitation tokens to ensure instant copy/accept access even after refresh
  const [knownTokens, setKnownTokens] = useState(() => {
    try {
      const stored = localStorage.getItem('tm_known_tokens');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const rememberToken = (id, token, email) => {
    if (!token) return;
    setKnownTokens((prev) => {
      const next = { ...prev };
      if (id) next[id] = token;
      if (email) next[email.toLowerCase()] = token;
      try {
        localStorage.setItem('tm_known_tokens', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: 'Engineering & Technology',
    team: '',
    positionId: '',
    role: 'employee',
    reportsTo: '',
    hierarchyLevel: 4,
    permissions: {},
    accessScopes: {
      taskScope: 'own',
      projectScope: 'project',
      employeeScope: 'own',
      reportScope: 'own',
    },
  });

  const [employees, setEmployees] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [allInvitations, setAllInvitations] = useState([]);
  const [inviteFilter, setInviteFilter] = useState('all'); // 'all' | 'pending' | 'expired' | 'revoked'
  const [inviteActionMsg, setInviteActionMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastGeneratedInvite, setLastGeneratedInvite] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Edit Employee Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editForm, setEditForm] = useState({
    department: '',
    team: '',
    positionTitle: '',
    role: 'employee',
    reportsTo: '',
    hierarchyLevel: 4,
    permissions: {},
    accessScopes: {
      taskScope: 'own',
      projectScope: 'project',
      employeeScope: 'own',
      reportScope: 'own',
    },
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const loadData = async () => {
    try {
      const [adminData, orgData] = await Promise.all([
        api.getAdminEmployees(),
        api.getOrganization(),
      ]);

      setEmployees(adminData?.employees || []);
      setPendingInvites(adminData?.pendingInvitations || []);
      setAllInvitations(adminData?.allInvitations || adminData?.pendingInvitations || []);

      if (orgData) {
        setOrg(orgData);
        setDepartments(orgData.departments || []);
        setTeams(orgData.teams || []);
        setPositions(orgData.positions || []);

        if (orgData.departments && orgData.departments.length > 0) {
          setFormData((prev) => ({
            ...prev,
            department: orgData.departments[0],
          }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = async () => {
    try {
      const [adminData, orgData] = await Promise.all([
        api.getAdminEmployees(),
        api.getOrganization(),
      ]);
      setEmployees(adminData?.employees || []);
      setPendingInvites(adminData?.pendingInvitations || []);
      setAllInvitations(adminData?.allInvitations || adminData?.pendingInvitations || []);
      if (orgData) {
        setOrg(orgData);
        setDepartments(orgData.departments || []);
        setTeams(orgData.teams || []);
        setPositions(orgData.positions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Position select change handler
  const handlePositionSelect = (posId) => {
    const selected = positions.find((p) => p.id === posId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        positionId: selected.id,
        role: selected.level <= 2 ? 'director' : selected.level === 3 ? 'manager' : 'employee',
        hierarchyLevel: selected.level,
        department: selected.department && selected.department !== 'General' ? selected.department : prev.department,
        permissions: { ...selected.permissions },
        accessScopes: { ...selected.accessScopes },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        positionId: '',
      }));
    }
  };

  // Submit invitation
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setEmailStatus(null);
    setCopiedLink(false);

    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Please provide employee full name and email.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedPos = positions.find((p) => p.id === formData.positionId);
      const positionTitle = selectedPos ? selectedPos.title : `${formData.department} Specialist`;

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        department: formData.department,
        team: formData.team,
        role: formData.role,
        positionTitle,
        reportsTo: formData.reportsTo || null,
        hierarchyLevel: formData.role === 'director' ? 2 : formData.role === 'manager' ? 3 : 4,
        permissions: formData.permissions,
        accessScopes: formData.accessScopes,
      };

      const result = await api.inviteEmployee(payload);

      const rawToken = result.inviteToken;
      const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${rawToken}`;
      setLastGeneratedInvite({
        ...result.invitation,
        token: rawToken,
        url: inviteUrl,
      });

      // Cache token so it remains accessible in the UI table
      rememberToken(result.invitation?.id || result.invitation?._id, rawToken, formData.email.trim());

      // Send email if configured
      if (emailService.isConfigured()) {
        try {
          const emailRes = await emailService.sendInvitation({
            toEmail: formData.email.trim(),
            toName: formData.name.trim(),
            companyName: companyName || 'Our Workspace',
            department: formData.department,
            role: positionTitle,
            inviteLink: inviteUrl,
          });

          if (emailRes && emailRes.success) {
            setEmailStatus({
              sent: true,
              message: `Invitation email delivered directly to ${formData.email} via EmailJS!`,
            });
          } else {
            setEmailStatus({
              sent: false,
              message: `Email sending notice: ${emailRes?.message || 'Email delivery failed'}. Use the link or Mail App below.`,
              mailtoUrl: emailService.getMailtoLink({
                toEmail: formData.email.trim(),
                toName: formData.name.trim(),
                companyName: companyName || 'Our Workspace',
                department: formData.department,
                role: positionTitle,
                inviteLink: inviteUrl,
              }),
            });
          }
        } catch (emailErr) {
          setEmailStatus({
            sent: false,
            message: `Email sending failed: ${emailErr.message}`,
            mailtoUrl: emailService.getMailtoLink({
              toEmail: formData.email.trim(),
              toName: formData.name.trim(),
              companyName: companyName || 'Our Workspace',
              department: formData.department,
              role: positionTitle,
              inviteLink: inviteUrl,
            }),
          });
        }
      } else {
        setEmailStatus({
          sent: false,
          notConfigured: true,
          message: 'EmailJS credentials not yet configured. Copy the invitation link below or open your Mail App.',
          mailtoUrl: emailService.getMailtoLink({
            toEmail: formData.email.trim(),
            toName: formData.name.trim(),
            companyName: companyName || 'Our Workspace',
            department: formData.department,
            role: positionTitle,
            inviteLink: inviteUrl,
          }),
        });
      }

      setSuccessMsg(`Secure invitation generated for ${formData.name}! Valid for 7 days.`);
      setFormData((prev) => ({ ...prev, name: '', email: '' }));
      refreshData();
    } catch (err) {
      setError(err.message || 'Failed to create employee invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  const handleResendInvite = async (inv) => {
    try {
      setInviteActionMsg('');
      const invId = inv._id || inv.id;
      const res = await api.resendInvitation(invId);
      const rawToken = res.inviteToken;
      const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${rawToken}`;

      // Cache token so it remains accessible in the UI table
      rememberToken(invId, rawToken, inv.email);

      let actionMsg = '';
      if (emailService.isConfigured()) {
        try {
          const emailRes = await emailService.sendInvitation({
            toEmail: inv.email,
            toName: inv.name,
            companyName: companyName || 'Our Workspace',
            department: inv.department,
            role: inv.positionTitle || `${inv.department} Specialist`,
            inviteLink: inviteUrl,
          });
          if (emailRes && emailRes.success) {
            actionMsg = `Invitation renewed for 7 days & emailed to ${inv.email}! Fresh link copied.`;
          } else {
            actionMsg = `Invitation renewed for 7 days! (Email note: ${emailRes?.message || 'Check EmailJS'}). Fresh link copied.`;
          }
        } catch (e) {
          actionMsg = `Invitation renewed for 7 days! Fresh link copied to clipboard.`;
        }
      } else {
        actionMsg = `Invitation renewed for 7 days! Fresh link copied to clipboard.`;
      }

      handleCopyLink(inviteUrl);
      setInviteActionMsg(actionMsg);
      refreshData();
    } catch (err) {
      alert(err.message || 'Failed to resend invitation');
    }
  };

  const handleRevokeInvite = async (inv) => {
    if (!window.confirm(`Are you sure you want to revoke the invitation for ${inv.email}?`)) return;
    try {
      const invId = inv._id || inv.id;
      await api.revokeInvitation(invId);
      setInviteActionMsg(`Invitation for ${inv.email} has been revoked.`);
      refreshData();
    } catch (err) {
      alert(err.message || 'Failed to revoke invitation');
    }
  };

  // Toggle active/disabled
  const handleToggleStatus = async (employeeId) => {
    try {
      await api.toggleEmployeeStatus(employeeId);
      refreshData();
    } catch (err) {
      alert(err.message || 'Failed to toggle account status');
    }
  };

  // Open Edit Employee Modal
  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    const p = emp.permissions || {};
    const s = emp.accessScopes || {};

    const directRel = Array.isArray(emp.reportingRelationships)
      ? emp.reportingRelationships.find((r) => r.relationshipType === 'direct')
      : null;
    const currentReportsTo = directRel?.managerId?._id || directRel?.managerId || emp.reportsTo?._id || emp.reportsTo || '';

    setEditForm({
      department: emp.department || 'General',
      team: emp.team || '',
      positionTitle: emp.positionTitle || emp.designation || 'Specialist',
      role: emp.role || 'employee',
      reportsTo: currentReportsTo,
      hierarchyLevel: emp.hierarchyLevel || 4,
      permissions: {
        canCreateTasks: Boolean(p.canCreateTasks || p.canAssignTasks),
        canAssignTasks: Boolean(p.canAssignTasks),
        canEditTasks: Boolean(p.canEditTasks),
        canApproveTasks: Boolean(p.canApproveTasks || p.canApproveWork),
        canDeleteTasks: Boolean(p.canDeleteTasks),
        canViewTasks: p.canViewTasks !== undefined ? Boolean(p.canViewTasks) : true,
        canManageEmployees: Boolean(p.canManageEmployees),
        canCreateProjects: Boolean(p.canCreateProjects),
        canEditProjects: Boolean(p.canEditProjects),
        canDeleteProjects: Boolean(p.canDeleteProjects),
        canViewProjects: p.canViewProjects !== undefined ? Boolean(p.canViewProjects) : true,
        canManageStructure: Boolean(p.canManageStructure),
        canViewExecutiveSummary: Boolean(p.canViewExecutiveSummary),
      },
      accessScopes: {
        taskScope: s.taskScope || 'own',
        projectScope: s.projectScope || 'project',
        employeeScope: s.employeeScope || 'own',
        reportScope: s.reportScope || 'own',
      },
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setSavingEdit(true);
    setEditError('');

    try {
      await api.updateEmployee(editingEmployee._id || editingEmployee.id, {
        department: editForm.department,
        team: editForm.team,
        positionTitle: editForm.positionTitle,
        designation: editForm.positionTitle,
        role: editForm.role,
        reportsTo: editForm.reportsTo || null,
        hierarchyLevel: editForm.role === 'director' ? 2 : editForm.role === 'manager' ? 3 : 4,
        permissions: editForm.permissions,
        accessScopes: editForm.accessScopes,
      });

      setIsEditModalOpen(false);
      refreshData();
    } catch (err) {
      setEditError(err.message || 'Failed to update employee');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();
    const pos = (emp.positionTitle || emp.role || '').toLowerCase();
    const team = (emp.team || '').toLowerCase();
    return fullName.includes(q) || email.includes(q) || dept.includes(q) || pos.includes(q) || team.includes(q);
  });

  return (
    <div className="admin-employee-panel animate-fade-in">
      {/* Top Banner */}
      <div className="panel-header-card">
        <div className="panel-header-left">
          <div className="header-icon-badge">
            <UsersIcon size={24} />
          </div>
          <div>
            <h2>Workforce Administration, Invitations & Access Control</h2>
            <p className="section-desc">
              Invite employees into {companyName || 'your company'}, assign custom job roles,
              departments, and teams, and configure granular RBAC action permissions and scopes.
            </p>
          </div>
        </div>
        <div className="panel-header-right">
          <div className="panel-stat-pill">
            <span>Active Members:</span>
            <strong>{employees.length}</strong>
          </div>
          <div className="panel-stat-pill">
            <span>Pending Invites:</span>
            <strong>{pendingInvites.length}</strong>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEmailModalOpen(true)}
            title="Configure EmailJS service credentials for automatic invitation delivery"
          >
            <MailIcon size={14} />
            <span>Email Service: {isEmailConfigured ? 'Active ✓' : 'Setup Required'}</span>
          </button>
        </div>
      </div>

      {/* Employee Invite Card */}
      <div className="employee-invite-card">
        <div className="invite-card-header">
          <div className="invite-card-title-group">
            <div className="invite-header-badge">
              <SparklesIcon size={22} />
            </div>
            <div>
              <h3>Generate Employee Invitation</h3>
              <p>Issue single-use onboarding invitations with configured role, department, and direct reporting lines.</p>
            </div>
          </div>
          <div className="invite-header-pills">
            <span className="secure-badge">
              <LockIcon size={12} /> Secure Single-Use Token
            </span>
            <span className="expiry-badge">
              ⏳ 24h Expiry
            </span>
          </div>
        </div>

        {error && (
          <div className="alert-box alert-danger">
            <AlertTriangleIcon size={16} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="alert-box alert-success">
            <CheckIcon size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleInviteSubmit} className="admin-employee-form">
          {/* Section 1: Employee Information */}
          <div className="form-section-header">
            <span className="section-num">1</span>
            <span>Employee Details</span>
          </div>

          <div className="form-grid-2">
            <div className="form-field-group">
              <label className="field-label">
                <span>Employee Full Name <span className="required-star">*</span></span>
              </label>
              <div className="input-icon-wrapper">
                <span className="field-leading-icon">
                  <UserIcon size={16} />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="modern-form-input"
                />
              </div>
            </div>

            <div className="form-field-group">
              <label className="field-label">
                <span>Official Email Address <span className="required-star">*</span></span>
              </label>
              <div className="input-icon-wrapper">
                <span className="field-leading-icon">
                  <MailIcon size={16} />
                </span>
                <input
                  type="email"
                  placeholder="alex.morgan@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="modern-form-input"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Department & Placement */}
          <div className="form-section-header">
            <span className="section-num">2</span>
            <span>Department & Team Placement</span>
          </div>

          <div className="form-grid-2">
            <div className="form-field-group">
              <label className="field-label">
                <span>Department <span className="required-star">*</span></span>
              </label>
              <div className="input-icon-wrapper">
                <span className="field-leading-icon">
                  <BuildingIcon size={16} />
                </span>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="modern-form-select"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-field-group">
              <label className="field-label">
                <span>Team / Squad <span className="optional-tag">Optional</span></span>
              </label>
              <div className="input-icon-wrapper">
                <span className="field-leading-icon">
                  <UsersIcon size={16} />
                </span>
                <select
                  value={formData.team}
                  onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                  className="modern-form-select"
                >
                  <option value="">-- No specific team --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Role & Hierarchy Placement */}
          <div className="form-section-header">
            <span className="section-num">3</span>
            <span>Role Tier & Reporting Structure</span>
          </div>

          <div className="form-grid-3">
            <div className="form-field-group">
              <label className="field-label">
                <span>Job Role (Template) <span className="optional-tag">Optional</span></span>
              </label>
              <div className="input-icon-wrapper">
                <span className="field-leading-icon">
                  <BriefcaseIcon size={16} />
                </span>
                <select
                  value={formData.positionId}
                  onChange={(e) => handlePositionSelect(e.target.value)}
                  className="modern-form-select"
                >
                  <option value="">-- Standard Role (Select Below) --</option>
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title} ({pos.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>
              <span className="field-hint-text">Auto-configures recommended permissions & scopes</span>
            </div>

            <div className="form-field-group">
              <label className="field-label">
                <span>System Role Tier <span className="required-star">*</span></span>
              </label>
              <div className="input-icon-wrapper">
                <span className="field-leading-icon">
                  <ShieldIcon size={16} />
                </span>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="modern-form-select"
                >
                  <option value="employee">Specialist / Contributor</option>
                  <option value="manager">Manager / Team Lead</option>
                  <option value="director">Project Director / Executive</option>
                </select>
              </div>
              <span className="field-hint-text">Governs baseline workspace authorization tier</span>
            </div>

            <div className="form-field-group">
              <label className="field-label">
                <span>Reports To (Supervisor)</span>
              </label>
              <div className="input-icon-wrapper">
                <span className="field-leading-icon">
                  <GitBranchIcon size={16} />
                </span>
                <select
                  value={formData.reportsTo}
                  onChange={(e) => setFormData({ ...formData, reportsTo: e.target.value })}
                  className="modern-form-select"
                >
                  <option value="">-- Reports to Head of Office / CEO --</option>
                  {employees.map((emp) => {
                    const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
                    const pos = emp.positionTitle || emp.role;
                    return (
                      <option key={emp._id || emp.id} value={emp._id || emp.id}>
                        {empName} — {pos} ({emp.department || 'General'})
                      </option>
                    );
                  })}
                </select>
              </div>
              <span className="field-hint-text">Builds organizational reporting and approval flow</span>
            </div>
          </div>

          {/* Security Notice */}
          <div className="form-security-banner">
            <div className="security-banner-icon">
              <LockIcon size={18} />
            </div>
            <div className="security-banner-text">
              <strong>Self-Service Password Creation:</strong>
              The employee sets their own secure password upon accepting the invitation. Administrators never see, manage, or store plaintext passwords.
            </div>
          </div>

          {/* Action Footer */}
          <div className="form-actions-bar">
            <div className="form-actions-left">
              <span>⚡ Single-use invitation link expires automatically in 24 hours</span>
            </div>
            <div className="form-actions-right">
              {(formData.name || formData.email) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setFormData((prev) => ({ ...prev, name: '', email: '' }))}
                  disabled={submitting}
                >
                  Clear Fields
                </button>
              )}
              <button
                type="submit"
                className="btn-submit-invite glow-effect"
                disabled={submitting}
              >
                <SparklesIcon size={16} />
                <span>{submitting ? 'Generating Invitation...' : 'Generate & Send Invitation'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Generated Invitation Details */}
        {lastGeneratedInvite && (
          <div className="invitation-result-box animate-scale-up" style={{ marginTop: '16px' }}>
            <div className="result-header">
              <div className="result-badge-success">
                <CheckIcon size={16} />
                <span>Single-Use Invitation Generated Successfully</span>
              </div>
              <span className="expiry-pill">⏳ Expires in 7 Days</span>
            </div>

            {emailStatus && (
              <div
                className={`email-delivery-banner ${
                  emailStatus.sent
                    ? 'delivery-success'
                    : emailStatus.notConfigured
                    ? 'delivery-warning'
                    : 'delivery-error'
                }`}
                style={{ margin: '10px 0', padding: '10px', borderRadius: '6px' }}
              >
                <span>{emailStatus.message}</span>
              </div>
            )}

            <p className="result-desc">
              Share this link with <strong>{lastGeneratedInvite.name}</strong> (
              {lastGeneratedInvite.email}). They will set their password and activate their account.
            </p>

            <div className="invite-link-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                readOnly
                value={lastGeneratedInvite.url}
                className="invite-url-input form-control"
                style={{ flex: '1 1 250px' }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopyLink(lastGeneratedInvite.url)}
              >
                {copiedLink ? 'Copied! ✓' : 'Copy Link'}
              </button>
              {emailStatus?.mailtoUrl && (
                <a
                  href={emailStatus.mailtoUrl}
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <MailIcon size={14} />
                  <span>Email in Mail App</span>
                </a>
              )}
            </div>

            <div className="test-acceptance-row" style={{ marginTop: '10px' }}>
              <span className="test-hint">Test Onboarding Link:</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onTestAcceptInvite(lastGeneratedInvite.token)}
              >
                Accept & Activate Account →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Directory & Invitations Section */}
      <div className="directory-sections">
        {/* Department-Based Invitations Manager */}
        <div className="pending-invites-card">
          <div className="invites-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0 }}>
                Department Invitations <span className="count-tag">{allInvitations.length || pendingInvites.length}</span>
              </h4>
            </div>

            <div className="invite-filter-pills" style={{ display: 'flex', gap: '6px' }}>
              {['all', 'pending', 'expired', 'revoked'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`btn btn-xs ${inviteFilter === filter ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ textTransform: 'capitalize' }}
                  onClick={() => setInviteFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {inviteActionMsg && (
            <div className="alert-box alert-success animate-fade-in" style={{ margin: '8px 0 14px' }}>
              <CheckIcon size={14} />
              <span>{inviteActionMsg}</span>
            </div>
          )}

          {allInvitations.length === 0 && pendingInvites.length === 0 ? (
            <div className="empty-sub-state" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>No invitations sent yet. Use the form above to invite employees by department.</p>
            </div>
          ) : (
            <div className="invites-list">
              {(allInvitations.length > 0 ? allInvitations : pendingInvites)
                .filter((inv) => inviteFilter === 'all' || inv.status === inviteFilter)
                .map((inv) => {
                  const currentToken =
                    inv.inviteToken ||
                    knownTokens[inv._id] ||
                    knownTokens[inv.id] ||
                    (inv.email && knownTokens[inv.email.toLowerCase()]) ||
                    (lastGeneratedInvite && lastGeneratedInvite.email === inv.email ? lastGeneratedInvite.token : null);
                  const inviteUrl = currentToken ? `${window.location.origin}${window.location.pathname}?invite=${currentToken}` : '';

                  const isExpired = inv.status === 'expired' || (inv.expiresAt && new Date(inv.expiresAt) < new Date() && inv.status === 'pending');
                  const currentStatus = isExpired ? 'expired' : inv.status;

                  return (
                    <div key={inv._id || inv.id} className="invite-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '8px', background: 'var(--bg-card)' }}>
                      <div className="invite-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar-circle-sm">
                          {inv.name ? inv.name[0].toUpperCase() : 'E'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong>{inv.name}</strong>
                            <span className="dept-tag-badge" style={{ fontSize: '11px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                              <BuildingIcon size={11} style={{ marginRight: '3px' }} />
                              {inv.department}
                            </span>
                            <span className={`status-pill status-${currentStatus}`} style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: currentStatus === 'pending' ? '#fef3c7' : currentStatus === 'expired' ? '#fee2e2' : currentStatus === 'revoked' ? '#e2e8f0' : '#d1fae5',
                              color: currentStatus === 'pending' ? '#92400e' : currentStatus === 'expired' ? '#991b1b' : currentStatus === 'revoked' ? '#475569' : '#065f46'
                            }}>
                              {currentStatus}
                            </span>
                          </div>
                          <div className="sub-meta" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                            <span>{inv.email}</span> • <span>{inv.positionTitle || inv.role}</span>
                            {inv.expiresAt && currentStatus === 'pending' && (
                              <span> • Valid until {new Date(inv.expiresAt).toLocaleDateString()}</span>
                            )}
                            {inv.expiresAt && currentStatus === 'expired' && (
                              <span style={{ color: '#ef4444', fontWeight: 600 }}> • Expired on {new Date(inv.expiresAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="invite-actions" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {currentStatus === 'pending' && (
                          <>
                            {inviteUrl && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleCopyLink(inviteUrl)}
                                title="Copy invitation link"
                              >
                                {copiedLink ? 'Copied!' : 'Copy Link'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleResendInvite(inv)}
                              title="Resend invitation email & renew token"
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-xs"
                              onClick={() => handleRevokeInvite(inv)}
                              title="Revoke this invitation"
                            >
                              Revoke
                            </button>
                            {currentToken && (
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={() => onTestAcceptInvite(currentToken)}
                                title="Accept invite in current browser"
                              >
                                Accept
                              </button>
                            )}
                          </>
                        )}

                        {(currentStatus === 'expired' || currentStatus === 'revoked') && (
                          <button
                            type="button"
                            className="btn btn-primary btn-xs"
                            onClick={() => handleResendInvite(inv)}
                          >
                            Re-invite Employee
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Active Members Table */}
        <div className="active-members-card">
          <div className="members-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h4>
                Active Employees in {companyName || 'Company'}{' '}
                <span className="count-tag">{employees.length}</span>
              </h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="table-search-wrapper">
                <SearchIcon size={14} className="table-search-icon" />
                <input
                  type="text"
                  placeholder="Search by name, role, department..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="table-search-input"
                />
              </div>
              <span className="security-subtext">Multi-Company Scoped</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading directory...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="empty-state">
              <p>No employees registered yet.</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="empty-state">
              <p>No employees match &ldquo;{employeeSearch}&rdquo;.</p>
            </div>
          ) : (
            <div className="members-table-wrap">
              <table className="members-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department & Team</th>
                    <th>Job Role</th>
                    <th>Reports To</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Team Member';
                      const initials = emp.firstName ? emp.firstName[0].toUpperCase() : 'U';
                      const isSelfAdmin = emp.role === 'admin';
                      const managers = Array.isArray(emp.reportingRelationships) ? emp.reportingRelationships : [];

                      return (
                        <tr key={emp._id || emp.id}>
                          <td>
                            <div className="member-name-cell">
                              <div className="avatar-circle-sm">{initials}</div>
                              <div>
                                <strong>{fullName}</strong>
                                <small>{emp.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>
                              <span className="dept-tag">
                                <BuildingIcon size={12} /> {emp.department || 'General'}
                              </span>
                              {emp.team && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Team: {emp.team}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div>
                              <span className={`role-badge role-tag-${emp.role || 'employee'}`}>
                                {emp.positionTitle || emp.role}
                              </span>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {emp.role === 'admin'
                                  ? 'Executive Leadership'
                                  : emp.role === 'director'
                                  ? 'Director / Executive'
                                  : emp.role === 'manager'
                                  ? 'Manager / Team Lead'
                                  : 'Specialist'}
                              </div>
                            </div>
                          </td>
                          <td>
                            {managers.length === 0 ? (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {emp.role === 'admin' ? '👑 Head of Office / CEO' : 'Reports to Head of Office'}
                              </span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {managers.map((m, mIdx) => {
                                  const mObj = m.managerId;
                                  const mName = mObj?.firstName ? `${mObj.firstName} ${mObj.lastName}` : 'Manager';
                                  return (
                                    <span key={mIdx} style={{ fontSize: '11px' }}>
                                      • <strong>{mName}</strong>{' '}
                                      <span style={{ color: 'var(--text-muted)' }}>({m.relationshipType})</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                emp.status === 'disabled' ? 'status-disabled' : 'status-active'
                              }`}
                            >
                              {emp.status === 'disabled' ? '● Disabled' : '● Active'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => handleOpenEdit(emp)}
                                title="Edit Role, Permissions & Scopes"
                              >
                                <EditIcon size={13} /> Edit RBAC
                              </button>

                              {!isSelfAdmin && (
                                <button
                                  type="button"
                                  className={`btn btn-xs ${
                                    emp.status === 'disabled' ? 'btn-secondary' : 'btn-outline-danger'
                                  }`}
                                  onClick={() => handleToggleStatus(emp._id || emp.id)}
                                >
                                  {emp.status === 'disabled' ? 'Activate' : 'Disable'}
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
        </div>

      {/* Edit Employee & RBAC Permissions Modal */}
      {isEditModalOpen && editingEmployee && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div
            className="modal-card modal-lg animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <ShieldIcon size={20} className="text-accent" />
                <h3>
                  Edit Permissions & Scopes: {editingEmployee.firstName} {editingEmployee.lastName}
                </h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsEditModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-body-form">
              {editError && (
                <div className="alert-box alert-danger" style={{ marginBottom: '14px' }}>
                  <AlertTriangleIcon size={16} />
                  <span>{editError}</span>
                </div>
              )}

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Position / Job Title</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.positionTitle}
                    onChange={(e) => setEditForm({ ...editForm, positionTitle: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role Tier</label>
                  <select
                    className="form-control"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="employee">Specialist / Contributor</option>
                    <option value="manager">Manager / Team Lead</option>
                    <option value="director">Project Director / Executive</option>
                    {editingEmployee.role === 'admin' && <option value="admin">Administrator / CEO</option>}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-control"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Team / Squad</label>
                  <select
                    className="form-control"
                    value={editForm.team}
                    onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
                  >
                    <option value="">-- None --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '8px' }}>
                <label className="form-label">Reports To (Direct Manager)</label>
                <select
                  className="form-control"
                  value={editForm.reportsTo}
                  onChange={(e) => setEditForm({ ...editForm, reportsTo: e.target.value })}
                  disabled={editingEmployee.role === 'admin'}
                >
                  <option value="">-- No Direct Manager (Reports to Head of Office / CEO) --</option>
                  {employees
                    .filter((e) => (e._id || e.id) !== (editingEmployee._id || editingEmployee.id))
                    .map((mgr) => {
                      const mgrName = `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim() || mgr.email;
                      return (
                        <option key={mgr._id || mgr.id} value={mgr._id || mgr.id}>
                          {mgrName} — {mgr.positionTitle || mgr.role} ({mgr.department || 'General'})
                        </option>
                      );
                    })}
                </select>
                <small style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  Direct reporting connection. Circular reporting dependencies are prevented automatically.
                </small>
              </div>

              {/* Access Scopes */}
              <div
                style={{
                  background: 'var(--bg-card-subtle)',
                  padding: '12px',
                  borderRadius: '6px',
                  margin: '12px 0',
                  border: '1px solid var(--border-color)',
                }}
              >
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Scope-Based Access Control
                </label>
                <div className="form-row-2">
                  <div className="form-group">
                    <label style={{ fontSize: '12px' }}>Task Access Scope:</label>
                    <select
                      className="form-control form-control-sm"
                      value={editForm.accessScopes.taskScope}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          accessScopes: { ...editForm.accessScopes, taskScope: e.target.value },
                        })
                      }
                    >
                      <option value="company">Company-wide</option>
                      <option value="department">Department-only</option>
                      <option value="team">Team-only</option>
                      <option value="project">Project-only</option>
                      <option value="own">Own & Subordinates Only</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px' }}>Project Access Scope:</label>
                    <select
                      className="form-control form-control-sm"
                      value={editForm.accessScopes.projectScope}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          accessScopes: { ...editForm.accessScopes, projectScope: e.target.value },
                        })
                      }
                    >
                      <option value="company">Company-wide</option>
                      <option value="department">Department-only</option>
                      <option value="team">Team-only</option>
                      <option value="project">Assigned Projects Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Granular RBAC Permissions */}
              <div style={{ border: '1px solid var(--border-color)', padding: '12px', borderRadius: '6px' }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Action Permissions (RBAC)
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.permissions.canCreateTasks}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permissions: { ...editForm.permissions, canCreateTasks: e.target.checked },
                        })
                      }
                    />
                    <span>Can Create Tasks</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.permissions.canAssignTasks}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permissions: { ...editForm.permissions, canAssignTasks: e.target.checked },
                        })
                      }
                    />
                    <span>Can Assign Tasks</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.permissions.canEditTasks}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permissions: { ...editForm.permissions, canEditTasks: e.target.checked },
                        })
                      }
                    />
                    <span>Can Edit Tasks</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.permissions.canApproveTasks}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permissions: { ...editForm.permissions, canApproveTasks: e.target.checked },
                        })
                      }
                    />
                    <span>Can Approve Tasks</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.permissions.canDeleteTasks}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permissions: { ...editForm.permissions, canDeleteTasks: e.target.checked },
                        })
                      }
                    />
                    <span>Can Delete Tasks</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.permissions.canManageEmployees}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permissions: { ...editForm.permissions, canManageEmployees: e.target.checked },
                        })
                      }
                    />
                    <span>Can Manage Employees</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.permissions.canCreateProjects}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permissions: { ...editForm.permissions, canCreateProjects: e.target.checked },
                        })
                      }
                    />
                    <span>Can Create Projects</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.permissions.canManageStructure}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          permissions: { ...editForm.permissions, canManageStructure: e.target.checked },
                        })
                      }
                    />
                    <span>Can Manage Structure</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '18px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EmailJS Configuration Modal */}
      <EmailConfigModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onConfigSaved={() => setIsEmailConfigured(emailService.isConfigured())}
      />
    </div>
  );
};
