import { useState, useEffect } from 'react';
import {
  ShieldIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  GitBranchIcon,
  LayersIcon,
  BuildingIcon,
  SparklesIcon,
} from './Icons';
import { api } from '../services/api';

export const OrganizationStructureBuilder = ({ employees = [], onHierarchyUpdated }) => {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('matrix'); // 'matrix' | 'levels' | 'departments' | 'tree'
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  // Position Modal State
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [posForm, setPosForm] = useState({
    title: '',
    level: 4,
    department: 'General',
    permissions: {
      canCreateProjects: false,
      canAssignTasks: false,
      canApproveWork: false,
      canViewExecutiveSummary: false,
      canViewTeamTasks: false,
      canViewAllTasks: false,
      canManageStructure: false,
    },
  });

  // Department State
  const [newDeptInput, setNewDeptInput] = useState('');

  // Levels State
  const [levelsDraft, setLevelsDraft] = useState([]);

  // Load Org Data
  useEffect(() => {
    let active = true;
    api.getOrganization()
      .then((data) => {
        if (active && data) {
          setOrg(data);
          setLevelsDraft(data.levels || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load organization structure:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const showSuccess = (msg) => {
    setNotice(msg);
    setErrorNotice('');
    setTimeout(() => setNotice(''), 3500);
  };

  const showError = (msg) => {
    setErrorNotice(msg);
    setNotice('');
    setTimeout(() => setErrorNotice(''), 4500);
  };

  // Open Modal for New Position
  const handleOpenNewPosition = () => {
    setEditingPos(null);
    setPosForm({
      title: '',
      level: org?.levels?.[org.levels.length - 1]?.level || 4,
      department: org?.departments?.[0] || 'General',
      permissions: {
        canCreateProjects: false,
        canAssignTasks: false,
        canApproveWork: false,
        canViewExecutiveSummary: false,
        canViewTeamTasks: false,
        canViewAllTasks: false,
        canManageStructure: false,
      },
    });
    setIsPosModalOpen(true);
  };

  // Open Modal to Edit Position
  const handleOpenEditPosition = (pos) => {
    setEditingPos(pos);
    setPosForm({
      title: pos.title,
      level: pos.level || 4,
      department: pos.department || 'General',
      permissions: {
        canCreateProjects: Boolean(pos.permissions?.canCreateProjects),
        canAssignTasks: Boolean(pos.permissions?.canAssignTasks),
        canApproveWork: Boolean(pos.permissions?.canApproveWork),
        canViewExecutiveSummary: Boolean(pos.permissions?.canViewExecutiveSummary),
        canViewTeamTasks: Boolean(pos.permissions?.canViewTeamTasks),
        canViewAllTasks: Boolean(pos.permissions?.canViewAllTasks),
        canManageStructure: Boolean(pos.permissions?.canManageStructure),
      },
    });
    setIsPosModalOpen(true);
  };

  // Save Position (Create or Edit)
  const handleSavePosition = async (e) => {
    e.preventDefault();
    if (!posForm.title.trim()) {
      showError('Please enter a position title');
      return;
    }

    try {
      if (editingPos) {
        await api.updatePosition(editingPos.id, posForm);
        showSuccess(`Position "${posForm.title}" updated successfully.`);
      } else {
        await api.createPosition(posForm);
        showSuccess(`Custom position "${posForm.title}" added to hierarchy.`);
      }
      setIsPosModalOpen(false);
      const updatedOrg = await api.getOrganization();
      setOrg(updatedOrg);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to save position');
    }
  };

  // Delete Position
  const handleDeletePosition = async (posId, posTitle) => {
    if (!window.confirm(`Are you sure you want to delete position "${posTitle}"?`)) return;
    try {
      await api.deletePosition(posId);
      showSuccess(`Position "${posTitle}" removed.`);
      const updatedOrg = await api.getOrganization();
      setOrg(updatedOrg);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to delete position');
    }
  };

  // Apply Industry Template
  const handleApplyTemplate = async (templateType) => {
    const label =
      templateType === 'tech_startup'
        ? 'Tech Startup (CTO → Lead → Senior → Associate)'
        : templateType === 'academic'
        ? 'Academic Institution (Dean → Chair → Professor → Assistant)'
        : 'Corporate Enterprise (CEO → VP → Manager → Associate)';

    if (!window.confirm(`Apply template: ${label}? This will configure standard hierarchy levels, positions, and permissions for this organization model.`)) {
      return;
    }

    try {
      const updated = await api.applyOrganizationTemplate(templateType);
      setOrg(updated);
      setLevelsDraft(updated.levels || []);
      showSuccess(`Applied "${label}" template successfully!`);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to apply template');
    }
  };

  // Add Department
  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!newDeptInput.trim()) return;
    try {
      const depts = await api.addOrgDepartment(newDeptInput.trim());
      setOrg((prev) => ({ ...prev, departments: depts }));
      setNewDeptInput('');
      showSuccess(`Department "${newDeptInput.trim()}" created.`);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to add department');
    }
  };

  // Delete Department
  const handleDeleteDepartment = async (deptName) => {
    if (!window.confirm(`Are you sure you want to delete department "${deptName}"?`)) return;
    try {
      const depts = await api.deleteOrgDepartment(deptName);
      setOrg((prev) => ({ ...prev, departments: depts }));
      showSuccess(`Department "${deptName}" removed.`);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to remove department');
    }
  };

  // Save Hierarchy Levels
  const handleSaveLevels = async () => {
    try {
      const updatedLevels = await api.updateHierarchyLevels(levelsDraft);
      setOrg((prev) => ({ ...prev, levels: updatedLevels }));
      showSuccess('Custom hierarchy levels saved successfully.');
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to save hierarchy levels');
    }
  };

  // Add Hierarchy Level
  const handleAddLevel = () => {
    const nextLevelNum = (levelsDraft.length > 0 ? Math.max(...levelsDraft.map((l) => l.level)) : 0) + 1;
    setLevelsDraft([
      ...levelsDraft,
      {
        level: nextLevelNum,
        name: `Level ${nextLevelNum} Tier`,
        description: 'Custom organizational responsibility tier',
      },
    ]);
  };

  // Dynamic Supervisor Assignment in Tree
  const handleAssignSupervisor = async (employeeId, supervisorId) => {
    try {
      await api.assignSupervisor(employeeId, supervisorId || null);
      showSuccess('Reporting relationship updated successfully.');
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to update supervisor');
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading Organization Structure & Permissions...</p>
      </div>
    );
  }

  const levels = org?.levels || [];
  const positions = org?.positions || [];
  const departments = org?.departments || [];

  return (
    <div className="org-builder-container animate-fade-in">
      {/* Top Banner */}
      <div className="org-builder-header-card">
        <div className="header-left-col">
          <div className="header-icon-badge">
            <ShieldIcon size={24} className="text-accent" />
          </div>
          <div>
            <h2>Organization Structure & Custom Permissions Builder</h2>
            <p className="section-desc">
              Tailor this workspace for your organization: configure custom hierarchy levels, define bespoke positions
              (e.g., CEO, Dean, Partner, Scrum Master), and assign granular permissions without rigid hardcoded titles.
            </p>
          </div>
        </div>

        {/* 1-Click Templates */}
        <div className="template-pills-row">
          <span className="template-label">
            <SparklesIcon size={14} /> Templates:
          </span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => handleApplyTemplate('corporate')}
          >
            Corporate
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => handleApplyTemplate('tech_startup')}
          >
            Tech Startup
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => handleApplyTemplate('academic')}
          >
            Academic
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div className="alert-box alert-success animate-fade-in" style={{ marginBottom: '16px' }}>
          <CheckCircleIcon size={16} />
          <span>{notice}</span>
        </div>
      )}
      {errorNotice && (
        <div className="alert-box alert-danger animate-fade-in" style={{ marginBottom: '16px' }}>
          <AlertTriangleIcon size={16} />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="org-subtabs-nav">
        <button
          type="button"
          className={`org-subtab-btn ${activeSubTab === 'matrix' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('matrix')}
        >
          <ShieldIcon size={16} />
          <span>Positions & Permissions Matrix ({positions.length})</span>
        </button>
        <button
          type="button"
          className={`org-subtab-btn ${activeSubTab === 'levels' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('levels')}
        >
          <LayersIcon size={16} />
          <span>Hierarchy Levels ({levels.length})</span>
        </button>
        <button
          type="button"
          className={`org-subtab-btn ${activeSubTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('departments')}
        >
          <BuildingIcon size={16} />
          <span>Departments ({departments.length})</span>
        </button>
        <button
          type="button"
          className={`org-subtab-btn ${activeSubTab === 'tree' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tree')}
        >
          <GitBranchIcon size={16} />
          <span>Reporting Tree & Assignments</span>
        </button>
      </div>

      {/* TAB 1: Positions & Permissions Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Positions & Permission Governance</h3>
              <p className="pane-desc">
                Define the roles and capabilities of your workforce. Each position dictates who can assign tasks, view overall progress, conduct quality reviews, and govern the system.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenNewPosition}
            >
              <PlusIcon size={16} />
              <span>Add Custom Position</span>
            </button>
          </div>

          <div className="positions-grid">
            {levels.map((lvl) => {
              const lvlPositions = positions.filter((p) => Number(p.level) === Number(lvl.level));
              return (
                <div key={lvl.level} className="level-group-box">
                  <div className="level-group-header">
                    <span className="level-tag">LEVEL {lvl.level}</span>
                    <span className="level-name">{lvl.name}</span>
                    <span className="level-count">{lvlPositions.length} Position(s)</span>
                  </div>

                  {lvlPositions.length === 0 ? (
                    <div className="empty-level-hint">
                      <span>No positions defined under this hierarchy level yet.</span>
                    </div>
                  ) : (
                    <div className="positions-cards-list">
                      {lvlPositions.map((pos) => (
                        <div key={pos.id} className="position-card">
                          <div className="position-card-top">
                            <div>
                              <h4 className="position-title">{pos.title}</h4>
                              <span className="position-dept-tag">
                                <BuildingIcon size={12} /> {pos.department || 'General'}
                              </span>
                            </div>
                            <div className="position-card-actions">
                              <button
                                type="button"
                                className="icon-action-btn"
                                title="Edit Position & Permissions"
                                onClick={() => handleOpenEditPosition(pos)}
                              >
                                <EditIcon size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-action-btn text-danger"
                                title="Delete Position"
                                onClick={() => handleDeletePosition(pos.id, pos.title)}
                              >
                                <TrashIcon size={15} />
                              </button>
                            </div>
                          </div>

                          {/* Permissions Badges */}
                          <div className="permissions-badge-list">
                            {pos.permissions?.canCreateProjects && (
                              <span className="perm-pill perm-active">
                                <CheckIcon size={12} /> Create Projects
                              </span>
                            )}
                            {pos.permissions?.canAssignTasks && (
                              <span className="perm-pill perm-active">
                                <CheckIcon size={12} /> Assign Tasks
                              </span>
                            )}
                            {pos.permissions?.canApproveWork && (
                              <span className="perm-pill perm-active">
                                <CheckIcon size={12} /> Review & Approve
                              </span>
                            )}
                            {pos.permissions?.canViewExecutiveSummary && (
                              <span className="perm-pill perm-active">
                                <CheckIcon size={12} /> Executive Summary
                              </span>
                            )}
                            {pos.permissions?.canViewTeamTasks && (
                              <span className="perm-pill perm-active">
                                <CheckIcon size={12} /> Team Deliverables
                              </span>
                            )}
                            {pos.permissions?.canManageStructure && (
                              <span className="perm-pill perm-active">
                                <CheckIcon size={12} /> Org Governance
                              </span>
                            )}
                            {!Object.values(pos.permissions || {}).some(Boolean) && (
                              <span className="perm-pill perm-contributor">
                                Individual Contributor (My Work Only)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Hierarchy Levels Designer */}
      {activeSubTab === 'levels' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Hierarchy Levels Architecture</h3>
              <p className="pane-desc">
                Customize the reporting ladder for your organization (e.g., Level 1 = Executive, Level 2 = Director, Level 3 = Team Lead, Level 4 = Staff). Subordinates in lower levels report upwards to supervisors in higher levels.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleAddLevel}>
                <PlusIcon size={16} /> Add Hierarchy Tier
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveLevels}>
                <CheckIcon size={16} /> Save Levels
              </button>
            </div>
          </div>

          <div className="levels-builder-list">
            {levelsDraft.map((lvl, index) => (
              <div key={lvl.level} className="level-edit-row">
                <div className="level-rank-badge">
                  <span>Level {lvl.level}</span>
                </div>
                <div className="level-fields-col">
                  <input
                    type="text"
                    className="input-field"
                    value={lvl.name}
                    placeholder="Tier Name (e.g., Executive / C-Suite)"
                    onChange={(e) => {
                      const updated = [...levelsDraft];
                      updated[index].name = e.target.value;
                      setLevelsDraft(updated);
                    }}
                  />
                  <input
                    type="text"
                    className="input-field input-desc"
                    value={lvl.description}
                    placeholder="Description of responsibilities"
                    onChange={(e) => {
                      const updated = [...levelsDraft];
                      updated[index].description = e.target.value;
                      setLevelsDraft(updated);
                    }}
                  />
                </div>
                {levelsDraft.length > 2 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary text-danger"
                    title="Remove Level"
                    onClick={() => {
                      setLevelsDraft(levelsDraft.filter((_, idx) => idx !== index));
                    }}
                  >
                    <TrashIcon size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Department Manager */}
      {activeSubTab === 'departments' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Department & Business Unit Management</h3>
              <p className="pane-desc">
                Create and manage functional departments for your company or institution. Employees and positions will belong to these units.
              </p>
            </div>
          </div>

          {/* Add Department Input */}
          <form onSubmit={handleAddDepartment} className="add-dept-form">
            <input
              type="text"
              className="input-field"
              placeholder="Enter new department name (e.g., Artificial Intelligence, Clinical Research, Legal)"
              value={newDeptInput}
              onChange={(e) => setNewDeptInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <PlusIcon size={16} /> Add Department
            </button>
          </form>

          {/* Departments Grid */}
          <div className="departments-grid">
            {departments.map((dept) => {
              const deptEmpCount = employees.filter((e) => e.department === dept).length;
              return (
                <div key={dept} className="department-badge-card">
                  <div className="dept-icon-wrapper">
                    <BuildingIcon size={20} className="text-accent" />
                  </div>
                  <div className="dept-info">
                    <h4>{dept}</h4>
                    <span>{deptEmpCount} Active Member(s)</span>
                  </div>
                  <button
                    type="button"
                    className="icon-action-btn text-danger"
                    title="Remove Department"
                    onClick={() => handleDeleteDepartment(dept)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Visual Reporting Tree & Dynamic Supervisor Assignment */}
      {activeSubTab === 'tree' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Dynamic Reporting Lines & Supervisor Assignment</h3>
              <p className="pane-desc">
                Assign who reports to whom across your custom hierarchy levels. Subordinates report to their designated supervisor, providing clear review pathways and milestone tracking.
              </p>
            </div>
          </div>

          <div className="hierarchy-tree-view">
            {levels.map((lvl) => {
              // Match employees by their hierarchyLevel or role mapping
              const levelEmployees = employees.filter((e) => {
                const empLvl = e.hierarchyLevel || (e.role === 'admin' ? 1 : e.role === 'director' ? 2 : e.role === 'manager' ? 3 : 4);
                return Number(empLvl) === Number(lvl.level);
              });

              // Eligible supervisors: employees at higher or equal levels
              const higherLevelSupervisors = employees.filter((e) => {
                const sLvl = e.hierarchyLevel || (e.role === 'admin' ? 1 : e.role === 'director' ? 2 : e.role === 'manager' ? 3 : 4);
                return Number(sLvl) < Number(lvl.level);
              });

              return (
                <div key={lvl.level} className="hierarchy-level-section">
                  <div className="level-badge-header">
                    <span className="level-rank">Level {lvl.level} · {lvl.name}</span>
                    <p>{lvl.description || 'Organizational Tier'}</p>
                  </div>

                  {levelEmployees.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '12px 0' }}>
                      No members assigned to Level {lvl.level} currently.
                    </p>
                  ) : (
                    <div className="hierarchy-grid">
                      {levelEmployees.map((emp) => {
                        const currentSupId = emp.reportsTo?._id || emp.reportsTo?.id || emp.reportsTo || '';
                        return (
                          <div key={emp._id || emp.id} className="hierarchy-card">
                            <div className="card-top-row">
                              <div className="avatar-circle-sm bg-purple">
                                {emp.firstName ? emp.firstName[0] : 'U'}
                              </div>
                              <span className="role-tag-sm">
                                {emp.positionTitle || emp.designation || 'Specialist'}
                              </span>
                            </div>

                            <div className="card-identity-col">
                              <h4>{emp.firstName} {emp.lastName}</h4>
                              <span className="emp-email">{emp.email}</span>
                              <span className="dept-tag">
                                <BuildingIcon size={12} /> {emp.department}
                              </span>
                            </div>

                            {/* Supervisor Assignment Dropdown */}
                            {lvl.level > 1 && (
                              <div className="supervisor-assign-box">
                                <label>Reports Directly To:</label>
                                <select
                                  className="supervisor-select"
                                  value={currentSupId}
                                  onChange={(e) => handleAssignSupervisor(emp._id || emp.id, e.target.value)}
                                >
                                  <option value="">-- No Direct Supervisor --</option>
                                  {(higherLevelSupervisors.length > 0 ? higherLevelSupervisors : employees).map((s) => (
                                    <option key={s._id || s.id} value={s._id || s.id}>
                                      {s.firstName} {s.lastName} ({s.positionTitle || s.designation || s.role})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Custom Position */}
      {isPosModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPosModalOpen(false)}>
          <div
            className="modal-card animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px' }}
          >
            <div className="modal-header">
              <div>
                <span className="project-badge-tag">POSITION & PERMISSIONS BUILDER</span>
                <h3 style={{ fontSize: '18px', marginTop: '4px' }}>
                  {editingPos ? `Edit Position: ${editingPos.title}` : 'Create Custom Position'}
                </h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsPosModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSavePosition} className="modal-body-form">
              <div className="form-group">
                <label className="form-label">Position Title *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Chief Executive Officer, Creative Director, Lead Architect"
                  value={posForm.title}
                  onChange={(e) => setPosForm({ ...posForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Hierarchy Level Tier *</label>
                  <select
                    className="input-field"
                    value={posForm.level}
                    onChange={(e) => setPosForm({ ...posForm, level: Number(e.target.value) })}
                  >
                    {levels.map((lvl) => (
                      <option key={lvl.level} value={lvl.level}>
                        Level {lvl.level}: {lvl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Department</label>
                  <select
                    className="input-field"
                    value={posForm.department}
                    onChange={(e) => setPosForm({ ...posForm, department: e.target.value })}
                  >
                    <option value="General">General / All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="permissions-config-box">
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                  Custom Role Permissions Matrix
                </label>
                <p className="section-desc" style={{ fontSize: '12px', marginBottom: '12px' }}>
                  Select the granular capabilities members with this position will possess in the workspace.
                </p>

                <div className="perm-checkbox-list">
                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canCreateProjects}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canCreateProjects: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Create Projects & Strategic Milestones</strong>
                      <span>Allows creating high-level projects, target outcomes, and deadlines.</span>
                    </div>
                  </label>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canAssignTasks}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canAssignTasks: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Assign & Delegate Tasks</strong>
                      <span>Can break down milestones into subtasks and assign them to team members.</span>
                    </div>
                  </label>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canApproveWork}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canApproveWork: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Conduct Quality Reviews & Approve Work</strong>
                      <span>Review submitted deliverables from subordinates; approve or request revisions.</span>
                    </div>
                  </label>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canViewExecutiveSummary}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canViewExecutiveSummary: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Executive Summary & Completion KPIs</strong>
                      <span>View aggregated project completion percentages without micro-task clutter.</span>
                    </div>
                  </label>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canViewTeamTasks}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canViewTeamTasks: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>View Department & Team Deliverables</strong>
                      <span>Inspect tasks and blocker alerts for subordinates in their department.</span>
                    </div>
                  </label>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canManageStructure}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canManageStructure: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Govern Organization Structure & Permissions</strong>
                      <span>Allows creating custom positions, hierarchy tiers, and managing permissions.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsPosModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPos ? 'Save Position Changes' : 'Create Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
