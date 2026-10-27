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
} from './Icons';
import { api } from '../services/api';
import { emailService } from '../services/emailService';
import { EmailConfigModal } from './EmailConfigModal';

export const AdminEmployeePanel = ({ companyName, onTestAcceptInvite }) => {
  // Department & Role lists
  const [departments, setDepartments] = useState(() => api.getDepartments());
  const [roles, setRoles] = useState(() => api.getRoles());

  // EmailJS configuration modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isEmailConfigured, setIsEmailConfigured] = useState(() => emailService.isConfigured());

  // Adding new department state
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptInput, setNewDeptInput] = useState('');

  // Adding new role state
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: 'Engineering',
    role: 'employee',
  });

  const [employees, setEmployees] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastGeneratedInvite, setLastGeneratedInvite] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null); // { sent: boolean, message: string }
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const data = await api.getAdminEmployees();
        if (!ignore) {
          setEmployees(data.employees || []);
          setPendingInvites(data.pendingInvitations || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  const refreshData = async () => {
    try {
      const data = await api.getAdminEmployees();
      setEmployees(data.employees || []);
      setPendingInvites(data.pendingInvitations || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Add custom department
  const handleAddDepartment = (e) => {
    e.preventDefault();
    if (!newDeptInput.trim()) return;
    const updated = api.addDepartment(newDeptInput.trim());
    setDepartments(updated);
    setFormData((prev) => ({ ...prev, department: newDeptInput.trim() }));
    setNewDeptInput('');
    setIsAddingDept(false);
    setSuccessMsg(`Department "${newDeptInput.trim()}" added successfully!`);
  };

  // Delete custom department
  const handleDeleteDepartment = (deptName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete department "${deptName}"?`)) return;
    const updated = api.deleteDepartment(deptName);
    setDepartments(updated);
    if (formData.department === deptName) {
      setFormData((prev) => ({ ...prev, department: updated[0] || 'General' }));
    }
  };

  // Add custom role
  const handleAddRole = (e) => {
    e.preventDefault();
    if (!newRoleTitle.trim()) return;
    const updated = api.addRole({
      title: newRoleTitle.trim(),
      description: newRoleDesc.trim() || 'Custom workspace role',
    });
    setRoles(updated);
    const newId = newRoleTitle.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    setFormData((prev) => ({ ...prev, role: newId }));
    setNewRoleTitle('');
    setNewRoleDesc('');
    setIsAddingRole(false);
    setSuccessMsg(`Role "${newRoleTitle.trim()}" added successfully!`);
  };

  // Delete custom role
  const handleDeleteRole = (roleId, roleTitle, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete custom role "${roleTitle}"?`)) return;
    const updated = api.deleteRole(roleId);
    setRoles(updated);
    if (formData.role === roleId) {
      setFormData((prev) => ({ ...prev, role: 'employee' }));
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setEmailStatus(null);
    setCopiedLink(false);

    if (!formData.name.trim() || !formData.email.trim()) {
      setError('Please provide employee full name and official email.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.inviteEmployee({
        name: formData.name.trim(),
        email: formData.email.trim(),
        department: formData.department,
        role: formData.role,
      });

      const inviteToken = res.inviteToken;
      const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${inviteToken}`;

      setLastGeneratedInvite({
        token: inviteToken,
        url: inviteUrl,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        department: formData.department,
      });

      // Send real email via EmailJS if configured
      if (emailService.isConfigured()) {
        const mailRes = await emailService.sendInviteEmail({
          toName: formData.name.trim(),
          toEmail: formData.email.trim(),
          inviteLink: inviteUrl,
          companyName: companyName || 'Company Workspace',
          department: formData.department,
          role: formData.role,
        });

        if (mailRes.success) {
          setEmailStatus({
            sent: true,
            message: `Invitation email sent successfully to ${formData.email}!`,
          });
        } else {
          setEmailStatus({
            sent: false,
            message: `Email sending error: ${mailRes.message}`,
          });
        }
      } else {
        setEmailStatus({
          sent: false,
          notConfigured: true,
          message:
            'EmailJS is not configured yet. Configure your Service ID, Template ID & Public Key to deliver emails automatically.',
        });
      }

      setSuccessMsg(`Secure invitation generated for ${formData.name}!`);
      setFormData({
        name: '',
        email: '',
        department: departments[0] || 'Engineering',
        role: 'employee',
      });
      refreshData();
    } catch (err) {
      setError(err.message || 'Failed to generate invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (!lastGeneratedInvite) return;
    try {
      setSubmitting(true);
      const mailRes = await emailService.sendInviteEmail({
        toName: lastGeneratedInvite.name,
        toEmail: lastGeneratedInvite.email,
        inviteLink: lastGeneratedInvite.url,
        companyName: companyName || 'Company Workspace',
        department: lastGeneratedInvite.department,
        role: lastGeneratedInvite.role,
      });

      if (mailRes.success) {
        setEmailStatus({
          sent: true,
          message: `Invitation email sent successfully to ${lastGeneratedInvite.email}!`,
        });
      } else {
        setEmailStatus({
          sent: false,
          message: `Email sending error: ${mailRes.message}`,
        });
      }
    } catch (err) {
      setEmailStatus({
        sent: false,
        message: `Email sending error: ${err.message}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleToggleStatus = async (employeeId) => {
    try {
      await api.toggleEmployeeStatus(employeeId);
      refreshData();
    } catch (err) {
      alert(err.message || 'Failed to update employee status');
    }
  };

  return (
    <div className="admin-employee-panel animate-fade-in">
      {/* Top Banner explaining the Admin Invitation Flow */}
      <div className="admin-flow-explainer">
        <div className="explainer-header">
          <SparklesIcon size={18} className="text-accent" />
          <strong>Admin Workspace Control & Employee Invitation System</strong>
        </div>
        <p>
          As an administrator, you control who joins your workspace. You can invite team members,
          deliver invitation links via EmailJS, define custom departments, and create custom roles anytime.
        </p>
      </div>

      {/* Example Admin Dashboard: Add New Employee Form */}
      <div className="add-employee-card animate-slide-up">
        <div className="card-header-row">
          <div>
            <h3 className="card-title">Add New Employee</h3>
            <span className="card-subtitle">Admin Panel / Employees</span>
          </div>

          <div className="header-actions-right">
            {/* EmailJS Configuration Button */}
            <button
              type="button"
              className={`btn-emailjs-config ${isEmailConfigured ? 'configured' : 'unconfigured'}`}
              onClick={() => setIsEmailModalOpen(true)}
              title="Configure EmailJS Service"
            >
              <MailIcon size={16} />
              <span>{isEmailConfigured ? 'EmailJS Active ✓' : '⚙️ Configure EmailJS'}</span>
            </button>

            <div className="admin-panel-badge">
              <UsersIcon size={18} />
            </div>
          </div>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}
        {successMsg && <div className="alert-box alert-success">{successMsg}</div>}

        <form onSubmit={handleInviteSubmit} className="admin-employee-form">
          {/* Employee Full Name */}
          <div className="form-group">
            <label htmlFor="empFullName">Employee Full Name</label>
            <input
              id="empFullName"
              type="text"
              placeholder="Enter full name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Official Email Address */}
          <div className="form-group">
            <label htmlFor="empEmail">Official Email Address</label>
            <input
              id="empEmail"
              type="email"
              placeholder="employee@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          {/* Department with + Add New Department option */}
          <div className="form-group">
            <div className="label-with-action">
              <label htmlFor="empDept">Department</label>
              <button
                type="button"
                className="btn-link-action"
                onClick={() => setIsAddingDept((prev) => !prev)}
              >
                <PlusIcon size={14} />
                <span>{isAddingDept ? 'Close' : '+ Add Department'}</span>
              </button>
            </div>

            {/* Inline Add Department Input */}
            {isAddingDept && (
              <div className="inline-add-box animate-scale-up">
                <input
                  type="text"
                  placeholder="e.g. Quality Assurance, Cloud Ops, Legal"
                  value={newDeptInput}
                  onChange={(e) => setNewDeptInput(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleAddDepartment}
                >
                  Save Department
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddingDept(false)}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="select-with-delete">
              <select
                id="empDept"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Allow deleting non-default departments */}
              {departments.length > 1 &&
                !['Engineering', 'Product', 'Design'].includes(formData.department) && (
                  <button
                    type="button"
                    className="btn-trash-dept"
                    title={`Delete "${formData.department}" department`}
                    onClick={(e) => handleDeleteDepartment(formData.department, e)}
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
            </div>
          </div>

          {/* Employee Role with + Add Custom Role option */}
          <div className="form-group">
            <div className="label-with-action">
              <label>Employee Role</label>
              <button
                type="button"
                className="btn-link-action"
                onClick={() => setIsAddingRole((prev) => !prev)}
              >
                <PlusIcon size={14} />
                <span>{isAddingRole ? 'Close' : '+ Add Custom Role'}</span>
              </button>
            </div>

            {/* Inline Add Role Input */}
            {isAddingRole && (
              <div className="inline-add-role-box animate-scale-up">
                <div className="role-inputs-grid">
                  <input
                    type="text"
                    placeholder="Role Title (e.g. Team Lead, Intern, Technical Director)"
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Short Description (e.g. Leads daily standup and code reviews)"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                  />
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddRole}
                  >
                    Save Role
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsAddingRole(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="role-radio-group">
              {roles.map((r) => {
                const isSelected = formData.role === r.id;
                const isCore = r.id === 'employee' || r.id === 'manager';

                return (
                  <label
                    key={r.id}
                    className={`radio-label ${isSelected ? 'active-radio' : ''}`}
                  >
                    <input
                      type="radio"
                      name="empRole"
                      value={r.id}
                      checked={isSelected}
                      onChange={() => setFormData({ ...formData, role: r.id })}
                    />
                    <span className="radio-text">
                      <div className="radio-title-row">
                        <strong>{r.title}</strong>
                        {!isCore && (
                          <button
                            type="button"
                            className="btn-trash-role"
                            title={`Delete role ${r.title}`}
                            onClick={(e) => handleDeleteRole(r.id, r.title, e)}
                          >
                            <TrashIcon size={12} />
                          </button>
                        )}
                      </div>
                      <small>{r.description}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Security Note */}
          <div className="security-note-box">
            <LockIcon size={16} className="security-icon" />
            <span>The employee creates their own password. The admin never sees or sets it.</span>
          </div>

          {/* Action button */}
          <button
            type="submit"
            className="btn btn-primary btn-block glow-effect"
            disabled={submitting}
          >
            {submitting ? 'Generating & Sending Invitation...' : 'Send Secure Invitation'}
          </button>
        </form>

        {/* Modal / Generated Invitation details */}
        {lastGeneratedInvite && (
          <div className="invitation-result-box animate-scale-up">
            <div className="result-header">
              <div className="result-badge-success">
                <CheckIcon size={16} />
                <span>Single-Use Invitation Generated</span>
              </div>
              <span className="expiry-pill">⏳ Expires in 24 Hours</span>
            </div>

            {/* Email delivery notification */}
            {emailStatus && (
              <div
                className={`email-delivery-banner ${
                  emailStatus.sent
                    ? 'delivery-success'
                    : emailStatus.notConfigured
                    ? 'delivery-warning'
                    : 'delivery-error'
                }`}
              >
                <div className="delivery-status-text">
                  <span>{emailStatus.message}</span>
                </div>

                <div className="delivery-actions-row">
                  {!emailStatus.sent && (
                    <button
                      type="button"
                      className="btn-configure-prompt"
                      onClick={() => setIsEmailModalOpen(true)}
                    >
                      ⚙️ Fix EmailJS Keys →
                    </button>
                  )}

                  {!emailStatus.sent && emailService.isConfigured() && (
                    <button
                      type="button"
                      className="btn-resend-prompt"
                      onClick={handleResendEmail}
                      disabled={submitting}
                    >
                      {submitting ? 'Retrying...' : '✉️ Resend Email Now'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="result-desc">
              Share this single-use link with <strong>{lastGeneratedInvite.name}</strong> (
              {lastGeneratedInvite.email}). They will use it to securely create their password and
              activate their account.
            </p>

            <div className="invite-link-wrapper">
              <input
                type="text"
                readOnly
                value={lastGeneratedInvite.url}
                className="invite-url-input"
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopyLink(lastGeneratedInvite.url)}
              >
                {copiedLink ? 'Copied! ✓' : 'Copy Link'}
              </button>
            </div>

            <div className="test-acceptance-row">
              <span className="test-hint">Employee Onboarding Link:</span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onTestAcceptInvite(lastGeneratedInvite.token)}
              >
                Accept Employee →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Directory Section: Pending Invitations & Active Members */}
      <div className="directory-sections">
        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <div className="pending-invites-card">
            <h4>
              Pending Invitations <span className="count-tag">{pendingInvites.length}</span>
            </h4>
            <div className="invites-list">
              {pendingInvites.map((inv) => {
                const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${inv.inviteToken}`;
                return (
                  <div key={inv._id || inv.id} className="invite-item">
                    <div className="invite-meta">
                      <div className="avatar-circle-sm">
                        {inv.name ? inv.name[0].toUpperCase() : 'E'}
                      </div>
                      <div>
                        <strong>{inv.name}</strong>
                        <div className="sub-meta">
                          <span>{inv.email}</span> • <span>{inv.department}</span> •{' '}
                          <span className="role-tag-sm">{inv.role.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="invite-actions">
                      <span className="status-pill status-pending">Pending Invite</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopyLink(inviteUrl)}
                      >
                        Copy Link
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onTestAcceptInvite(inv.inviteToken)}
                      >
                        Accept Employee
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active & Registered Team Members */}
        <div className="active-members-card">
          <div className="members-header">
            <h4>
              {companyName || 'Workspace'} Team Members{' '}
              <span className="count-tag">{employees.length}</span>
            </h4>
            <span className="security-subtext">Backend validates role permissions on every request</span>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading team directory...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="empty-state">
              <p>No employees registered yet. Use the form above to send an invitation.</p>
            </div>
          ) : (
            <div className="members-table-wrap">
              <table className="members-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Official Email</th>
                    <th>Department</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const fullName =
                      emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Team Member';
                    const initials = fullName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    const isSelfAdmin = emp.role === 'admin';

                    return (
                      <tr key={emp._id || emp.id}>
                        <td>
                          <div className="member-name-cell">
                            <div className="avatar-circle-sm">{initials}</div>
                            <div>
                              <strong>{fullName}</strong>
                              <small>{emp.designation || emp.department}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mail-text">
                            <MailIcon size={14} /> {emp.email}
                          </span>
                        </td>
                        <td>
                          <span className="dept-tag">
                            <BuildingIcon size={13} /> {emp.department || 'General'}
                          </span>
                        </td>
                        <td>
                          <span className="role-badge role-badge-custom">
                            {emp.role ? emp.role.replace(/_/g, ' ') : 'employee'}
                          </span>
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
                          {!isSelfAdmin && (
                            <button
                              type="button"
                              className={`btn btn-sm ${
                                emp.status === 'disabled' ? 'btn-secondary' : 'btn-outline-danger'
                              }`}
                              onClick={() => handleToggleStatus(emp._id || emp.id)}
                            >
                              {emp.status === 'disabled' ? 'Activate' : 'Disable'}
                            </button>
                          )}
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

      {/* EmailJS Configuration Modal */}
      <EmailConfigModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onConfigSaved={() => setIsEmailConfigured(emailService.isConfigured())}
      />
    </div>
  );
};
