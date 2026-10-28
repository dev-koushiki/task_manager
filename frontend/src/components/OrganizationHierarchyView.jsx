import { useState, useEffect } from 'react';
import {
  GitBranchIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  AlertTriangleIcon,
  UsersIcon,
  BriefcaseIcon,
  BuildingIcon,
  XCircleIcon,
  CheckCircleIcon,
} from './Icons';
import { api } from '../services/api';

export const OrganizationHierarchyView = ({ user, onHierarchyUpdated }) => {
  const [employees, setEmployees] = useState([]);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');

  // Modal State for managing multiple managers with relationship types
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [managerDraft, setManagerDraft] = useState([]);
  const [newMgrId, setNewMgrId] = useState('');
  const [newRelType, setNewRelType] = useState('direct');
  const [modalError, setModalError] = useState('');
  const [savingManagers, setSavingManagers] = useState(false);

  const canManageHierarchy =
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
      setOrg(orgData || null);
    } catch (err) {
      console.error('Failed to load organizational hierarchy:', err);
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

  // Quick 1-click single Direct supervisor change
  const handleSupervisorChange = async (employeeId, supervisorId) => {
    try {
      setUpdatingId(employeeId);
      await api.assignSupervisor(employeeId, supervisorId || null, 'direct');
      showSuccess('Direct supervisor updated successfully.');
      await loadData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to update supervisor.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Manage Managers Modal
  const handleOpenManagerModal = (emp) => {
    setSelectedEmployee(emp);
    const existing = Array.isArray(emp.reportingRelationships) && emp.reportingRelationships.length > 0
      ? emp.reportingRelationships.map((r) => ({
          managerId: r.managerId?._id || r.managerId || r.id,
          managerName: r.managerId?.firstName
            ? `${r.managerId.firstName} ${r.managerId.lastName}`
            : (employees.find((e) => (e._id || e.id) === (r.managerId?._id || r.managerId))
                ? `${employees.find((e) => (e._id || e.id) === (r.managerId?._id || r.managerId)).firstName} ${employees.find((e) => (e._id || e.id) === (r.managerId?._id || r.managerId)).lastName}`
                : 'Manager'),
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
    setNewRelType('direct');
    setModalError('');
    setIsManagerModalOpen(true);
  };

  // Client-side quick check for cycle prevention
  const wouldCreateCycle = (empId, targetMgrId) => {
    if (empId === targetMgrId) return true;

    // Check if empId is an ancestor of targetMgrId
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

  const handleAddManagerToDraft = () => {
    if (!newMgrId) {
      setModalError('Please select a manager from the list.');
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
      setModalError('Circular reporting detected! This person directly or indirectly reports to this employee.');
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
      showSuccess(`Reporting relationships updated for ${selectedEmployee.firstName}!`);
      setIsManagerModalOpen(false);
      await loadData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      setModalError(err.message || 'Failed to save managers.');
    } finally {
      setSavingManagers(false);
    }
  };

  // Helper for relationship badge styling
  const getRelBadgeClass = (type) => {
    switch (type) {
      case 'direct':
        return 'badge-rel-direct';
      case 'project':
        return 'badge-rel-project';
      case 'functional':
        return 'badge-rel-functional';
      default:
        return 'badge-rel-default';
    }
  };

  const getRelLabel = (type) => {
    switch (type) {
      case 'direct':
        return 'Direct Manager';
      case 'project':
        return 'Project Manager';
      case 'functional':
        return 'Functional Manager';
      default:
        return 'Manager';
    }
  };

  // Filtered employees
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

  // Group by Levels dynamically based on organization settings
  const orgLevels = org?.levels && org.levels.length > 0
    ? [...org.levels].sort((a, b) => a.level - b.level)
    : [
        { level: 1, name: 'Executive Leadership', description: 'Overall governance & strategic oversight' },
        { level: 2, name: 'Project Directors & Heads', description: 'Milestone delivery & departmental direction' },
        { level: 3, name: 'Managers & Team Leads', description: 'Operational delegation & review approval' },
        { level: 4, name: 'Specialists & Contributors', description: 'Execution and deliverable submissions' },
      ];

  const departmentsList = org?.departments || [
    'Executive Leadership',
    'Project Management Office',
    'Engineering & Technology',
    'Product & Design',
    'Operations & Quality',
    'Marketing & Sales',
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
              <h2>Dynamic Organizational Hierarchy & Reporting Lines</h2>
              <p className="section-desc">
                Configure who reports to whom with multi-manager relationships (Direct, Project,
                Functional). Enforces strict multi-company isolation, RBAC permissions, and circular
                dependency prevention.
              </p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="hierarchy-filter-bar">
            <input
              type="text"
              placeholder="Search by employee name, role, or team..."
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
              {departmentsList.map((d) => (
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
          <p>Mapping organizational structure and reporting relationships...</p>
        </div>
      ) : (
        <div className="hierarchy-tree-view">
          {orgLevels.map((lvl, index) => {
            const members = filteredEmployees.filter(
              (e) => (e.hierarchyLevel || (e.role === 'admin' ? 1 : e.role === 'director' ? 2 : e.role === 'manager' ? 3 : 4)) === lvl.level
            );

            return (
              <div key={lvl.level} className="hierarchy-level-wrapper">
                <div className="hierarchy-level-section">
                  <div className="level-badge-header">
                    <span className="level-rank">Level {lvl.level}</span>
                    <h3>{lvl.name}</h3>
                    <p>{lvl.description || 'Organizational functional layer'}</p>
                  </div>

                  <div className="hierarchy-grid">
                    {members.length === 0 ? (
                      <div className="empty-level-box">
                        <p>No employees currently assigned to {lvl.name}.</p>
                      </div>
                    ) : (
                      members.map((emp) => {
                        const managers = Array.isArray(emp.reportingRelationships) && emp.reportingRelationships.length > 0
                          ? emp.reportingRelationships
                          : emp.reportsTo
                          ? [{ managerId: emp.reportsTo, relationshipType: 'direct' }]
                          : [];

                        return (
                          <div
                            key={emp._id || emp.id}
                            className={`hierarchy-card level-${emp.role || 'employee'}`}
                          >
                            <div className="card-top-row">
                              <div className="avatar-circle-sm">
                                {emp.firstName ? emp.firstName[0].toUpperCase() : 'U'}
                              </div>
                              <span className={`role-tag-sm role-tag-${emp.role || 'employee'}`}>
                                {(emp.role || 'specialist').toUpperCase()}
                              </span>
                            </div>

                            <div className="hierarchy-person-info">
                              <strong>
                                {emp.firstName} {emp.lastName}
                              </strong>
                              <span>{emp.positionTitle || emp.designation || 'Team Member'}</span>
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

                            {/* Multiple Reporting Managers Display */}
                            <div className="reporting-relationships-block">
                              <div className="rel-header-row">
                                <span className="rel-title">Reports To:</span>
                                <span className="rel-count-badge">
                                  {managers.length} {managers.length === 1 ? 'manager' : 'managers'}
                                </span>
                              </div>

                              {managers.length === 0 ? (
                                <div className="no-managers-text">
                                  {emp.role === 'admin'
                                    ? '👑 Head of Office (Top Level)'
                                    : '⚠️ No managers assigned yet'}
                                </div>
                              ) : (
                                <div className="rel-pill-list">
                                  {managers.map((rel, rIdx) => {
                                    const mgrObj = rel.managerId;
                                    const mgrName = mgrObj?.firstName
                                      ? `${mgrObj.firstName} ${mgrObj.lastName}`
                                      : 'Supervisor';
                                    return (
                                      <div key={rIdx} className="rel-pill-item">
                                        <span className={`rel-type-pill ${getRelBadgeClass(rel.relationshipType)}`}>
                                          {getRelLabel(rel.relationshipType)}
                                        </span>
                                        <span className="rel-mgr-name">{mgrName}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Manage Managers Action Button */}
                              {canManageHierarchy && emp.role !== 'admin' && (
                                <div className="card-actions-row" style={{ marginTop: '10px' }}>
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary btn-xs w-100"
                                    onClick={() => handleOpenManagerModal(emp)}
                                  >
                                    <EditIcon size={13} />
                                    <span>Manage Reporting Lines</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {index < orgLevels.length - 1 && (
                  <div className="hierarchy-connector-line"></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Manage Multiple Managers with Relationship Types */}
      {isManagerModalOpen && selectedEmployee && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsManagerModalOpen(false)}>
          <div
            className="modal-card modal-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <GitBranchIcon size={20} className="text-accent" />
                <h3>
                  Reporting Lines for {selectedEmployee.firstName} {selectedEmployee.lastName}
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
                Assign direct, project, or functional managers to this employee. All reporting
                relationships are verified to prevent circular dependencies.
              </p>

              {modalError && (
                <div className="alert-box alert-danger" style={{ marginBottom: '14px' }}>
                  <AlertTriangleIcon size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Current Assigned Managers Table */}
              <div className="manager-draft-section">
                <h4 className="section-label">Assigned Managers ({managerDraft.length}):</h4>
                {managerDraft.length === 0 ? (
                  <p className="empty-hint">No managers assigned. Use the form below to add one.</p>
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

              {/* Add New Manager Form */}
              <div className="add-manager-form-card" style={{ marginTop: '20px' }}>
                <h4 className="section-label">Add a Manager:</h4>
                <div className="add-mgr-grid">
                  <div className="form-group">
                    <label>Select Supervisor:</label>
                    <select
                      value={newMgrId}
                      onChange={(e) => {
                        setNewMgrId(e.target.value);
                        setModalError('');
                      }}
                      className="form-control"
                    >
                      <option value="">-- Choose Eligible Manager --</option>
                      {employees
                        .filter(
                          (e) =>
                            (e._id || e.id) !== (selectedEmployee._id || selectedEmployee.id)
                        )
                        .map((e) => (
                          <option key={e._id || e.id} value={e._id || e.id}>
                            {e.firstName} {e.lastName} ({e.designation || e.role}) · {e.department}
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
                      <option value="direct">Direct Manager (Core line supervisor)</option>
                      <option value="project">Project Manager (Deliverables & projects)</option>
                      <option value="functional">Functional Manager (Discipline/Chapter lead)</option>
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
                  <span>Add Manager to List</span>
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
