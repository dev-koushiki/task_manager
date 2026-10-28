import { useState, useEffect } from 'react';
import {
  GitBranchIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  BuildingIcon,
  UsersIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  SearchIcon,
  BriefcaseIcon,
} from './Icons';
import { api } from '../services/api';

export const OrganizationHierarchyView = ({ user, onHierarchyUpdated }) => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Filters & View Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'directory'

  // Modal for Multiple Managers
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [managerDraft, setManagerDraft] = useState([]);
  const [newMgrId, setNewMgrId] = useState('');
  const [newRelType, setNewRelType] = useState('project');
  const [modalError, setModalError] = useState('');
  const [savingManagers, setSavingManagers] = useState(false);

  const canManageReporting =
    user?.role === 'admin' ||
    user?.permissions?.canManageStructure ||
    user?.permissions?.canManageEmployees;

  const loadData = async () => {
    try {
      const [hierarchyData, orgData] = await Promise.all([
        api.getHierarchy(),
        api.getOrganization(),
      ]);
      setEmployees(Array.isArray(hierarchyData) ? hierarchyData : []);
      if (orgData?.departments) {
        setDepartments(orgData.departments);
      }
    } catch (err) {
      console.error('Failed to load employee reporting lines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showSuccess = (msg) => {
    setNotice(msg);
    setErrorMessage('');
    setTimeout(() => setNotice(''), 3500);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setNotice('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  // Simple 1-Click "Reports To" Dropdown Handler
  const handleSimpleReportsToChange = async (employeeId, supervisorId) => {
    try {
      setUpdatingId(employeeId);
      await api.assignSupervisor(employeeId, supervisorId || null, 'direct');
      showSuccess('Reporting relationship updated successfully.');
      await loadData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to update manager.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Client-Side Circular Reporting Check
  const wouldCreateCycle = (empId, targetMgrId) => {
    if (empId === targetMgrId) return true;

    const visited = new Set();
    const queue = [targetMgrId];

    while (queue.length > 0) {
      const currId = queue.shift();
      if (currId === empId) return true;
      if (visited.has(currId)) continue;
      visited.add(currId);

      const currUser = employees.find((e) => (e._id || e.id) === currId);
      if (currUser) {
        if (Array.isArray(currUser.reportingRelationships)) {
          for (const rel of currUser.reportingRelationships) {
            const mId = rel.managerId?._id || rel.managerId;
            if (mId && !visited.has(mId.toString())) {
              queue.push(mId.toString());
            }
          }
        } else if (currUser.reportsTo) {
          const mId = currUser.reportsTo._id || currUser.reportsTo;
          if (mId && !visited.has(mId.toString())) {
            queue.push(mId.toString());
          }
        }
      }
    }

    return false;
  };

  // Open Multi-Manager Modal
  const handleOpenManagerModal = (emp) => {
    setSelectedEmployee(emp);
    const existing =
      Array.isArray(emp.reportingRelationships) && emp.reportingRelationships.length > 0
        ? emp.reportingRelationships.map((r) => ({
            managerId: r.managerId?._id || r.managerId || r.id,
            managerName: r.managerId?.firstName
              ? `${r.managerId.firstName} ${r.managerId.lastName}`
              : 'Manager',
            relationshipType: r.relationshipType || 'direct',
          }))
        : emp.reportsTo
        ? [
            {
              managerId: emp.reportsTo._id || emp.reportsTo,
              managerName: emp.reportsTo.firstName
                ? `${emp.reportsTo.firstName} ${emp.reportsTo.lastName}`
                : 'Manager',
              relationshipType: 'direct',
            },
          ]
        : [];

    setManagerDraft(existing);
    setNewMgrId('');
    setNewRelType('project');
    setModalError('');
    setIsManagerModalOpen(true);
  };

  const handleAddManagerToDraft = () => {
    if (!newMgrId) {
      setModalError('Please select a manager to add.');
      return;
    }

    const empId = selectedEmployee._id || selectedEmployee.id;

    if (empId === newMgrId) {
      setModalError('An employee cannot report to themselves.');
      return;
    }

    if (managerDraft.some((m) => m.managerId === newMgrId)) {
      setModalError('This manager is already assigned to this employee.');
      return;
    }

    if (wouldCreateCycle(empId, newMgrId)) {
      setModalError(
        'Circular reporting loop detected! This person directly or indirectly reports to this employee.'
      );
      return;
    }

    const targetUser = employees.find((e) => (e._id || e.id) === newMgrId);
    const mgrName = targetUser
      ? `${targetUser.firstName} ${targetUser.lastName}`
      : 'Manager';

    setManagerDraft([
      ...managerDraft,
      {
        managerId: newMgrId,
        managerName: mgrName,
        relationshipType: newRelType,
      },
    ]);
    setNewMgrId('');
    setModalError('');
  };

  const handleRemoveManagerFromDraft = (index) => {
    const updated = [...managerDraft];
    updated.splice(index, 1);
    setManagerDraft(updated);
  };

  const handleRelTypeChangeInDraft = (index, newType) => {
    const updated = [...managerDraft];
    updated[index].relationshipType = newType;
    setManagerDraft(updated);
  };

  const handleSaveManagers = async () => {
    try {
      setSavingManagers(true);
      setModalError('');
      const empId = selectedEmployee._id || selectedEmployee.id;

      const payload = managerDraft.map((m) => ({
        managerId: m.managerId,
        relationshipType: m.relationshipType,
      }));

      await api.updateEmployeeManagers(empId, payload);
      showSuccess(
        `Reporting relationships updated for ${selectedEmployee.firstName} ${selectedEmployee.lastName}!`
      );
      setIsManagerModalOpen(false);
      await loadData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      setModalError(err.message || 'Failed to save managers.');
    } finally {
      setSavingManagers(false);
    }
  };

  // Helper for Relationship Type Labels
  const getRelBadge = (type) => {
    switch (type) {
      case 'direct':
        return { label: 'Direct Manager', cls: 'badge-rel-direct' };
      case 'project':
        return { label: 'Project Manager', cls: 'badge-rel-project' };
      case 'functional':
        return { label: 'Functional Manager', cls: 'badge-rel-functional' };
      default:
        return { label: 'Manager', cls: 'badge-rel-default' };
    }
  };

  // Filter Employees
  const filteredEmployees = employees.filter((e) => {
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      fullName.includes(query) ||
      (e.email && e.email.toLowerCase().includes(query)) ||
      (e.designation && e.designation.toLowerCase().includes(query)) ||
      (e.positionTitle && e.positionTitle.toLowerCase().includes(query)) ||
      (e.team && e.team.toLowerCase().includes(query));

    const matchesDept = deptFilter === 'all' || e.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  // Automatically Build Hierarchy from "Reports To"
  // 1. Top Leaders (Report to no one or Admin/CEO)
  const leaders = filteredEmployees.filter((e) => {
    const hasManagers =
      (Array.isArray(e.reportingRelationships) && e.reportingRelationships.length > 0) ||
      e.reportsTo;
    return !hasManagers || e.role === 'admin';
  });

  // 2. Managers (Have people reporting to them)
  const managersWithReports = filteredEmployees.filter((e) => {
    const isLeader = leaders.some((l) => (l._id || l.id) === (e._id || e.id));
    if (isLeader) return false;

    // Check if anyone reports to this employee
    const empId = (e._id || e.id).toString();
    return employees.some((other) => {
      if (other.reportsTo?._id?.toString() === empId || other.reportsTo?.toString() === empId) {
        return true;
      }
      if (Array.isArray(other.reportingRelationships)) {
        return other.reportingRelationships.some(
          (r) => (r.managerId?._id || r.managerId)?.toString() === empId
        );
      }
      return false;
    });
  });

  // 3. Team Members (Report to a manager, don't manage others)
  const teamMembers = filteredEmployees.filter((e) => {
    const isLeader = leaders.some((l) => (l._id || l.id) === (e._id || e.id));
    const isManager = managersWithReports.some((m) => (m._id || m.id) === (e._id || e.id));
    return !isLeader && !isManager;
  });

  // Group sections naturally: Leadership, Managers, Team Members
  const naturalGroups = [
    {
      key: 'leadership',
      title: 'Company Leadership & Executives',
      description: 'Heads of office, directors, and executives overseeing company strategy and milestones.',
      members: leaders,
    },
    {
      key: 'managers',
      title: 'Team Managers & Supervisors',
      description: 'Supervisors responsible for assigning tasks, coordinating teams, and approving work.',
      members: managersWithReports,
    },
    {
      key: 'members',
      title: 'Team Members & Specialists',
      description: 'Specialists and contributors executing deliverables and reporting to team managers.',
      members: teamMembers,
    },
  ];

  return (
    <div className="hierarchy-container animate-fade-in">
      {/* Header Banner */}
      <div className="hierarchy-header-card">
        <div className="header-icon-badge">
          <GitBranchIcon size={28} className="text-accent" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="header-row-between">
            <div>
              <h2>Employee Reporting System & Organizational Structure</h2>
              <p className="section-desc">
                Simply select who each employee reports to using the dropdown. The system automatically
                builds the organizational hierarchy, connects teams, and enforces task delegation and
                approval access.
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="btn-group" style={{ display: 'inline-flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('tree')}
              >
                Organizational Hierarchy
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'directory' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setViewMode('directory')}
              >
                Department Directory
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="hierarchy-filter-bar">
            <input
              type="text"
              placeholder="Search by employee name, job title, or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control form-control-sm"
              style={{ maxWidth: '320px' }}
            />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="form-control form-control-sm"
              style={{ maxWidth: '240px' }}
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {notice && (
        <div className="alert-box alert-success" style={{ marginBottom: '16px' }}>
          <CheckCircleIcon size={18} />
          <span>{notice}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert-box alert-danger" style={{ marginBottom: '16px' }}>
          <AlertTriangleIcon size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading employee reporting connections...</p>
        </div>
      ) : (
        <div className="hierarchy-tree-view">
          {viewMode === 'tree' ? (
            naturalGroups.map((grp, gIdx) => (
              <div key={grp.key} className="hierarchy-level-wrapper">
                <div className="hierarchy-level-section">
                  <div className="level-badge-header">
                    <h3>{grp.title}</h3>
                    <p>{grp.description}</p>
                  </div>

                  <div className="hierarchy-grid">
                    {grp.members.length === 0 ? (
                      <div className="empty-level-box">
                        <p>No employees in this group.</p>
                      </div>
                    ) : (
                      grp.members.map((emp) => {
                        const empId = emp._id || emp.id;
                        const managers =
                          Array.isArray(emp.reportingRelationships) &&
                          emp.reportingRelationships.length > 0
                            ? emp.reportingRelationships
                            : emp.reportsTo
                            ? [{ managerId: emp.reportsTo, relationshipType: 'direct' }]
                            : [];

                        const directManagerId =
                          emp.reportsTo?._id ||
                          emp.reportsTo ||
                          managers.find((m) => m.relationshipType === 'direct')?.managerId?._id ||
                          '';

                        // Eligible supervisors (excluding self and anything that would create a cycle)
                        const eligibleManagers = employees.filter(
                          (m) => (m._id || m.id) !== empId && !wouldCreateCycle(empId, m._id || m.id)
                        );

                        return (
                          <div key={empId} className="hierarchy-card">
                            <div className="card-top-row">
                              <div className="avatar-circle-sm">
                                {emp.firstName ? emp.firstName[0].toUpperCase() : 'U'}
                              </div>
                              <span className="role-tag-sm">
                                {emp.role === 'admin'
                                  ? 'EXECUTIVE LEAD'
                                  : (emp.role || 'EMPLOYEE').toUpperCase()}
                              </span>
                            </div>

                            <div className="hierarchy-person-info">
                              <strong>
                                {emp.firstName} {emp.lastName}
                              </strong>
                              <span className="job-title-text">
                                {emp.positionTitle || emp.designation || 'Specialist'}
                              </span>
                              <div className="hierarchy-tags-line">
                                <span className="tag-dept">
                                  <BuildingIcon size={11} /> {emp.department || 'General'}
                                </span>
                                {emp.team && (
                                  <span className="tag-team">
                                    <UsersIcon size={11} /> {emp.team}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Simple "Reports To" Dropdown */}
                            {emp.role !== 'admin' && canManageReporting ? (
                              <div className="supervisor-assign-box" style={{ marginTop: '12px' }}>
                                <label style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Reports Directly To:
                                </label>
                                <select
                                  value={directManagerId}
                                  onChange={(e) => handleSimpleReportsToChange(empId, e.target.value)}
                                  disabled={updatingId === empId}
                                  className="form-control form-control-sm"
                                  style={{ marginTop: '4px' }}
                                >
                                  <option value="">-- No Direct Manager Assigned --</option>
                                  {eligibleManagers.map((m) => (
                                    <option key={m._id || m.id} value={m._id || m.id}>
                                      {m.firstName} {m.lastName} ({m.positionTitle || m.designation || m.role}) · {m.department}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            {/* Additional Reporting Managers List */}
                            <div className="reporting-relationships-block" style={{ marginTop: '10px' }}>
                              <div className="rel-header-row">
                                <span className="rel-title">Reporting Lines:</span>
                                <span className="rel-count-badge">
                                  {managers.length} {managers.length === 1 ? 'manager' : 'managers'}
                                </span>
                              </div>

                              {managers.length === 0 ? (
                                <div className="no-managers-text">
                                  {emp.role === 'admin'
                                    ? '👑 Top Authority (Reports to none)'
                                    : '⚠️ Reports to nobody yet'}
                                </div>
                              ) : (
                                <div className="rel-pill-list">
                                  {managers.map((rel, rIdx) => {
                                    const mgrObj = rel.managerId;
                                    const mgrName = mgrObj?.firstName
                                      ? `${mgrObj.firstName} ${mgrObj.lastName}`
                                      : 'Manager';
                                    const badge = getRelBadge(rel.relationshipType);

                                    return (
                                      <div key={rIdx} className="rel-pill-item">
                                        <span className={`rel-type-pill ${badge.cls}`}>
                                          {badge.label}
                                        </span>
                                        <span className="rel-mgr-name">{mgrName}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Multi-Manager Management Button */}
                              {canManageReporting && emp.role !== 'admin' && (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-xs w-100"
                                  style={{ marginTop: '8px' }}
                                  onClick={() => handleOpenManagerModal(emp)}
                                >
                                  <PlusIcon size={13} />
                                  <span>Manage Multiple Managers</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {gIdx < naturalGroups.length - 1 && (
                  <div className="hierarchy-connector-line"></div>
                )}
              </div>
            ))
          ) : (
            /* Directory View by Department */
            <div className="department-directory-view">
              {departments.map((dept) => {
                const deptMembers = filteredEmployees.filter((e) => e.department === dept);
                if (deptMembers.length === 0) return null;

                return (
                  <div key={dept} className="dept-directory-card" style={{ marginBottom: '24px' }}>
                    <div className="dept-directory-header">
                      <h3>
                        <BuildingIcon size={20} className="text-accent" /> {dept}
                      </h3>
                      <span className="count-tag">{deptMembers.length} Members</span>
                    </div>

                    <div className="hierarchy-grid" style={{ marginTop: '14px' }}>
                      {deptMembers.map((emp) => {
                        const empId = emp._id || emp.id;
                        const managers =
                          Array.isArray(emp.reportingRelationships) &&
                          emp.reportingRelationships.length > 0
                            ? emp.reportingRelationships
                            : emp.reportsTo
                            ? [{ managerId: emp.reportsTo, relationshipType: 'direct' }]
                            : [];

                        return (
                          <div key={empId} className="hierarchy-card">
                            <div className="card-top-row">
                              <div className="avatar-circle-sm">
                                {emp.firstName ? emp.firstName[0].toUpperCase() : 'U'}
                              </div>
                              <span className="role-tag-sm">
                                {emp.positionTitle || emp.designation || 'Specialist'}
                              </span>
                            </div>

                            <div className="hierarchy-person-info">
                              <strong>
                                {emp.firstName} {emp.lastName}
                              </strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {emp.email}
                              </span>
                              {emp.team && (
                                <span className="tag-team" style={{ marginTop: '4px' }}>
                                  <UsersIcon size={11} /> {emp.team}
                                </span>
                              )}
                            </div>

                            <div style={{ marginTop: '10px', fontSize: '12px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                                Reports To:{' '}
                              </span>
                              {managers.length === 0 ? (
                                <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                              ) : (
                                managers.map((m, mIdx) => (
                                  <span key={mIdx} style={{ display: 'block', marginTop: '2px' }}>
                                    • {m.managerId?.firstName ? `${m.managerId.firstName} ${m.managerId.lastName}` : 'Manager'} ({m.relationshipType})
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Multiple Reporting Managers with Relationship Types */}
      {isManagerModalOpen && selectedEmployee && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsManagerModalOpen(false)}>
          <div
            className="modal-card modal-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '620px' }}
          >
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <GitBranchIcon size={20} className="text-accent" />
                <h3>
                  Reporting Managers for {selectedEmployee.firstName} {selectedEmployee.lastName}
                </h3>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setIsManagerModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-subtitle">
                Support multiple managers (Direct Manager, Project Manager, or Functional Manager).
                The system prevents circular reporting loops and guarantees multi-company isolation.
              </p>

              {modalError && (
                <div className="alert-box alert-danger" style={{ marginBottom: '14px' }}>
                  <AlertTriangleIcon size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Current Assigned Managers List */}
              <div className="manager-draft-section">
                <h4 className="section-label">Current Managers ({managerDraft.length}):</h4>
                {managerDraft.length === 0 ? (
                  <p className="empty-hint">No managers assigned yet.</p>
                ) : (
                  <div className="manager-draft-list">
                    {managerDraft.map((item, idx) => (
                      <div key={idx} className="manager-draft-row">
                        <div className="mgr-info">
                          <strong>{item.managerName}</strong>
                        </div>
                        <div className="mgr-rel-select">
                          <select
                            value={item.relationshipType}
                            onChange={(e) => handleRelTypeChangeInDraft(idx, e.target.value)}
                            className="form-control form-control-sm"
                          >
                            <option value="direct">Direct Manager</option>
                            <option value="project">Project Manager</option>
                            <option value="functional">Functional Manager</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-xs"
                          onClick={() => handleRemoveManagerFromDraft(idx)}
                          title="Remove manager"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Manager Form */}
              <div className="add-manager-form-card" style={{ marginTop: '18px' }}>
                <h4 className="section-label">Add a Manager:</h4>
                <div className="add-mgr-grid">
                  <div className="form-group">
                    <label>Select Manager:</label>
                    <select
                      value={newMgrId}
                      onChange={(e) => {
                        setNewMgrId(e.target.value);
                        setModalError('');
                      }}
                      className="form-control"
                    >
                      <option value="">-- Choose Colleague / Supervisor --</option>
                      {employees
                        .filter(
                          (e) =>
                            (e._id || e.id) !== (selectedEmployee._id || selectedEmployee.id)
                        )
                        .map((e) => (
                          <option key={e._id || e.id} value={e._id || e.id}>
                            {e.firstName} {e.lastName} ({e.positionTitle || e.designation || e.role}) · {e.department}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Relationship Type:</label>
                    <select
                      value={newRelType}
                      onChange={(e) => setNewRelType(e.target.value)}
                      className="form-control"
                    >
                      <option value="direct">Direct Manager (Line supervisor)</option>
                      <option value="project">Project Manager (Milestones & tasks)</option>
                      <option value="functional">Functional Manager (Domain mentor)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddManagerToDraft}
                  style={{ marginTop: '10px' }}
                >
                  <PlusIcon size={15} />
                  <span>Add to List</span>
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIsManagerModalOpen(false)}
                disabled={savingManagers}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveManagers}
                disabled={savingManagers}
              >
                {savingManagers ? 'Saving...' : 'Save Reporting Relationships'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
