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
  UsersIcon,
  BriefcaseIcon,
} from './Icons';
import { api } from '../services/api';

export const OrganizationStructureBuilder = ({ employees = [], onHierarchyUpdated }) => {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('matrix'); // 'matrix' | 'levels' | 'departments' | 'teams' | 'relationships' | 'tree'
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
      canCreateTasks: false,
      canAssignTasks: false,
      canEditTasks: false,
      canApproveTasks: false,
      canDeleteTasks: false,
      canViewTasks: true,
      canManageEmployees: false,
      canCreateProjects: false,
      canEditProjects: false,
      canDeleteProjects: false,
      canViewProjects: true,
      canManageStructure: false,
      canViewExecutiveSummary: false,
      canApproveWork: false,
      canViewTeamTasks: false,
      canViewAllTasks: false,
    },
    accessScopes: {
      taskScope: 'own',
      projectScope: 'project',
      employeeScope: 'own',
      reportScope: 'own',
    },
  });

  // Department State
  const [newDeptInput, setNewDeptInput] = useState('');

  // Team Modal State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({
    name: '',
    department: 'General',
    description: '',
    leadId: '',
    memberIds: [],
  });

  // Levels State
  const [levelsDraft, setLevelsDraft] = useState([]);

  // Relationship Types State
  const [newRelName, setNewRelName] = useState('');
  const [newRelDesc, setNewRelDesc] = useState('');

  // Load Org Data
  const loadOrgData = async () => {
    try {
      const data = await api.getOrganization();
      if (data) {
        setOrg(data);
        setLevelsDraft(data.levels || []);
      }
    } catch (err) {
      console.error('Failed to load organization structure:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgData();
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
        canCreateTasks: false,
        canAssignTasks: false,
        canEditTasks: false,
        canApproveTasks: false,
        canDeleteTasks: false,
        canViewTasks: true,
        canManageEmployees: false,
        canCreateProjects: false,
        canEditProjects: false,
        canDeleteProjects: false,
        canViewProjects: true,
        canManageStructure: false,
        canViewExecutiveSummary: false,
        canApproveWork: false,
        canViewTeamTasks: false,
        canViewAllTasks: false,
      },
      accessScopes: {
        taskScope: 'own',
        projectScope: 'project',
        employeeScope: 'own',
        reportScope: 'own',
      },
    });
    setIsPosModalOpen(true);
  };

  // Open Modal for Edit Position
  const handleOpenEditPosition = (pos) => {
    setEditingPos(pos);
    const existingPerms = pos.permissions || {};
    setPosForm({
      title: pos.title,
      level: pos.level || 4,
      department: pos.department || 'General',
      permissions: {
        canCreateTasks: Boolean(existingPerms.canCreateTasks || existingPerms.canAssignTasks),
        canAssignTasks: Boolean(existingPerms.canAssignTasks),
        canEditTasks: Boolean(existingPerms.canEditTasks),
        canApproveTasks: Boolean(existingPerms.canApproveTasks || existingPerms.canApproveWork),
        canDeleteTasks: Boolean(existingPerms.canDeleteTasks),
        canViewTasks: existingPerms.canViewTasks !== undefined ? Boolean(existingPerms.canViewTasks) : true,
        canManageEmployees: Boolean(existingPerms.canManageEmployees),
        canCreateProjects: Boolean(existingPerms.canCreateProjects),
        canEditProjects: Boolean(existingPerms.canEditProjects),
        canDeleteProjects: Boolean(existingPerms.canDeleteProjects),
        canViewProjects: existingPerms.canViewProjects !== undefined ? Boolean(existingPerms.canViewProjects) : true,
        canManageStructure: Boolean(existingPerms.canManageStructure),
        canViewExecutiveSummary: Boolean(existingPerms.canViewExecutiveSummary),
        canApproveWork: Boolean(existingPerms.canApproveTasks || existingPerms.canApproveWork),
        canViewTeamTasks: Boolean(existingPerms.canViewTeamTasks),
        canViewAllTasks: Boolean(existingPerms.canViewAllTasks),
      },
      accessScopes: {
        taskScope: pos.accessScopes?.taskScope || 'own',
        projectScope: pos.accessScopes?.projectScope || 'project',
        employeeScope: pos.accessScopes?.employeeScope || 'own',
        reportScope: pos.accessScopes?.reportScope || 'own',
      },
    });
    setIsPosModalOpen(true);
  };

  // Save Position (Create or Edit)
  const handleSavePosition = async (e) => {
    e.preventDefault();
    if (!posForm.title.trim()) return;

    try {
      if (editingPos) {
        const updated = await api.updatePosition(editingPos.id, posForm);
        setOrg((prev) => ({
          ...prev,
          positions: (prev.positions || []).map((p) => (p.id === editingPos.id ? updated : p)),
        }));
        showSuccess(`Job role / position "${posForm.title}" updated successfully.`);
      } else {
        const created = await api.createPosition(posForm);
        setOrg((prev) => ({
          ...prev,
          positions: [...(prev.positions || []), created],
        }));
        showSuccess(`Custom job role / position "${posForm.title}" created successfully.`);
      }
      setIsPosModalOpen(false);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to save position');
    }
  };

  // Delete Position
  const handleDeletePosition = async (posId, title) => {
    if (!window.confirm(`Are you sure you want to delete position "${title}"?`)) return;
    try {
      const remaining = await api.deletePosition(posId);
      setOrg((prev) => ({ ...prev, positions: remaining }));
      showSuccess(`Position "${title}" removed successfully.`);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to delete position');
    }
  };

  // Apply Industry Template
  const handleApplyTemplate = async (templateKey) => {
    if (
      !window.confirm(
        'Applying a template will configure standardized job roles, departments, and teams. Proceed?'
      )
    ) {
      return;
    }
    try {
      const updatedOrg = await api.applyOrganizationTemplate(templateKey);
      setOrg(updatedOrg);
      setLevelsDraft(updatedOrg.levels || []);
      showSuccess(`Template "${templateKey.replace('_', ' ').toUpperCase()}" applied successfully.`);
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
      showSuccess(`Department "${newDeptInput.trim()}" added successfully.`);
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

  // ======================== TEAMS HANDLERS ========================
  const handleOpenNewTeam = () => {
    setEditingTeam(null);
    setTeamForm({
      name: '',
      department: org?.departments?.[0] || 'General',
      description: '',
      leadId: '',
      memberIds: [],
    });
    setIsTeamModalOpen(true);
  };

  const handleOpenEditTeam = (team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      department: team.department || (org?.departments?.[0] || 'General'),
      description: team.description || '',
      leadId: team.leadId?._id || team.leadId || '',
      memberIds: Array.isArray(team.memberIds)
        ? team.memberIds.map((m) => (m._id ? m._id : m))
        : [],
    });
    setIsTeamModalOpen(true);
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.name.trim()) return;

    try {
      const leadUser = employees.find((emp) => (emp._id || emp.id) === teamForm.leadId);
      const leadName = leadUser ? `${leadUser.firstName} ${leadUser.lastName}` : '';

      const payload = {
        ...teamForm,
        leadName,
      };

      if (editingTeam) {
        const res = await api.updateTeam(editingTeam.id, payload);
        setOrg((prev) => ({ ...prev, teams: res.teams || [] }));
        showSuccess(`Team "${teamForm.name}" updated successfully.`);
      } else {
        const res = await api.createTeam(payload);
        setOrg((prev) => ({ ...prev, teams: res.teams || [] }));
        showSuccess(`Team "${teamForm.name}" created successfully.`);
      }
      setIsTeamModalOpen(false);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to save team');
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"?`)) return;
    try {
      const res = await api.deleteTeam(teamId);
      setOrg((prev) => ({ ...prev, teams: res.teams || [] }));
      showSuccess(`Team "${teamName}" deleted successfully.`);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to delete team');
    }
  };

  // ======================== RELATIONSHIP TYPES ========================
  const handleAddRelationshipType = async (e) => {
    e.preventDefault();
    if (!newRelName.trim()) return;
    try {
      const res = await api.addRelationshipType({
        name: newRelName.trim(),
        description: newRelDesc.trim(),
      });
      setOrg((prev) => ({ ...prev, relationshipTypes: res.relationshipTypes || [] }));
      setNewRelName('');
      setNewRelDesc('');
      showSuccess(`Relationship type "${newRelName.trim()}" added.`);
    } catch (err) {
      showError(err.message || 'Failed to add relationship type');
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading Organization Structure, Roles & RBAC Matrix...</p>
      </div>
    );
  }

  const levels = org?.levels || [];
  const positions = org?.positions || [];
  const departments = org?.departments || [];
  const teams = org?.teams || [];
  const relationshipTypes = org?.relationshipTypes || [];

  return (
    <div className="org-builder-container animate-fade-in">
      {/* Top Banner */}
      <div className="org-builder-header-card">
        <div className="header-left-col">
          <div className="header-icon-badge">
            <ShieldIcon size={24} className="text-accent" />
          </div>
          <div>
            <h2>Dynamic Organization Structure, Job Roles & RBAC Governance</h2>
            <p className="section-desc">
              Allow each company to configure custom job roles, departments, teams, and reporting connections
              without changing code. Granular permissions and access scopes are strictly enforced on the backend.
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
          <span>Job Roles & RBAC Matrix ({positions.length})</span>
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
          className={`org-subtab-btn ${activeSubTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('teams')}
        >
          <UsersIcon size={16} />
          <span>Teams & Squads ({teams.length})</span>
        </button>
        <button
          type="button"
          className={`org-subtab-btn ${activeSubTab === 'relationships' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('relationships')}
        >
          <GitBranchIcon size={16} />
          <span>Relationship Types ({relationshipTypes.length})</span>
        </button>
      </div>

      {/* TAB 1: Positions & Permissions Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Configurable Job Roles, Permissions & Scopes</h3>
              <p className="pane-desc">
                Define custom job roles. Configure action permissions (create, assign, edit, approve,
                delete, view tasks or manage employees) and scope-based access (company, department,
                team, project, own).
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenNewPosition}
            >
              <PlusIcon size={16} />
              <span>Add Custom Job Role</span>
            </button>
          </div>

          <div className="positions-grid">
            {[
              {
                key: 'leadership',
                title: 'Executive & Department Leadership',
                desc: 'Senior leaders authorized to direct projects, approve initiatives, and govern departments',
                filter: (p) => Number(p.level) <= 2,
              },
              {
                key: 'management',
                title: 'Management & Team Leads',
                desc: 'Managers and squad leads responsible for assigning subtasks, monitoring progress, and reviewing work',
                filter: (p) => Number(p.level) === 3,
              },
              {
                key: 'specialists',
                title: 'Specialists & Core Contributors',
                desc: 'Individual contributors and specialists executing assigned deliverables',
                filter: (p) => Number(p.level) >= 4,
              },
            ].map((cat) => {
              const catPositions = positions.filter(cat.filter);
              return (
                <div key={cat.key} className="level-group-box">
                  <div className="level-group-header">
                    <span className="level-name" style={{ fontWeight: 700 }}>{cat.title}</span>
                    <span className="level-count">{catPositions.length} Role(s)</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>
                    {cat.desc}
                  </p>

                  {catPositions.length === 0 ? (
                    <div className="empty-level-hint">
                      <span>No custom job roles defined in this category yet.</span>
                    </div>
                  ) : (
                    <div className="positions-cards-list">
                      {catPositions.map((pos) => {
                        const p = pos.permissions || {};
                        const s = pos.accessScopes || {};
                        return (
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
                                  title="Edit Role & Permissions"
                                  onClick={() => handleOpenEditPosition(pos)}
                                >
                                  <EditIcon size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-action-btn text-danger"
                                  title="Delete Role"
                                  onClick={() => handleDeletePosition(pos.id, pos.title)}
                                >
                                  <TrashIcon size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Scopes Summary */}
                            <div className="scopes-summary-row">
                              <span className="scope-pill">
                                Task Scope: <strong>{(s.taskScope || 'own').toUpperCase()}</strong>
                              </span>
                              <span className="scope-pill">
                                Project Scope: <strong>{(s.projectScope || 'project').toUpperCase()}</strong>
                              </span>
                              <span className="scope-pill">
                                Employee Scope: <strong>{(s.employeeScope || 'own').toUpperCase()}</strong>
                              </span>
                            </div>

                            {/* Permissions Badges */}
                            <div className="permissions-badge-list">
                              {p.canCreateTasks && <span className="perm-pill perm-active"><CheckIcon size={12} /> Create Tasks</span>}
                              {p.canAssignTasks && <span className="perm-pill perm-active"><CheckIcon size={12} /> Assign Tasks</span>}
                              {p.canEditTasks && <span className="perm-pill perm-active"><CheckIcon size={12} /> Edit Tasks</span>}
                              {(p.canApproveTasks || p.canApproveWork) && <span className="perm-pill perm-active"><CheckIcon size={12} /> Approve Tasks</span>}
                              {p.canDeleteTasks && <span className="perm-pill perm-active"><CheckIcon size={12} /> Delete Tasks</span>}
                              {p.canManageEmployees && <span className="perm-pill perm-active"><CheckIcon size={12} /> Manage Employees</span>}
                              {p.canCreateProjects && <span className="perm-pill perm-active"><CheckIcon size={12} /> Create Projects</span>}
                              {p.canManageStructure && <span className="perm-pill perm-active"><CheckIcon size={12} /> Structure Governance</span>}
                              {p.canViewExecutiveSummary && <span className="perm-pill perm-active"><CheckIcon size={12} /> Executive Summary</span>}
                              {!Object.values(p).some(Boolean) && (
                                <span className="perm-pill perm-contributor">
                                  Standard Contributor (View & Execute Own Tasks)
                                </span>
                              )}
                            </div>
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

      {/* TAB 2: Departments */}
      {activeSubTab === 'departments' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Department & Functional Unit Management</h3>
              <p className="pane-desc">
                Create and manage functional departments for your company. Employees and teams will belong to these units.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddDepartment} className="add-dept-form">
            <input
              type="text"
              className="input-field"
              placeholder="Enter department name (e.g., Engineering, Marketing, Finance, Operations)"
              value={newDeptInput}
              onChange={(e) => setNewDeptInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <PlusIcon size={16} /> Add Department
            </button>
          </form>

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
                    <span>{deptEmpCount} Member(s)</span>
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

      {/* TAB 4: Teams & Squads */}
      {activeSubTab === 'teams' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Teams, Squads & Working Groups</h3>
              <p className="pane-desc">
                Create dynamic teams inside departments, designate team leads, assign members, and
                enforce team-scoped task isolation.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleOpenNewTeam}>
              <PlusIcon size={16} /> Create Team / Squad
            </button>
          </div>

          <div className="teams-grid">
            {teams.length === 0 ? (
              <div className="empty-level-box w-100">
                <p>No teams created yet. Click "Create Team / Squad" to get started.</p>
              </div>
            ) : (
              teams.map((t) => {
                const memberCount = Array.isArray(t.memberIds) ? t.memberIds.length : 0;
                return (
                  <div key={t.id} className="team-card">
                    <div className="team-card-header">
                      <div>
                        <h4>{t.name}</h4>
                        <span className="team-dept-pill">
                          <BuildingIcon size={11} /> {t.department}
                        </span>
                      </div>
                      <div className="team-card-actions">
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Edit Team"
                          onClick={() => handleOpenEditTeam(t)}
                        >
                          <EditIcon size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-action-btn text-danger"
                          title="Delete Team"
                          onClick={() => handleDeleteTeam(t.id, t.name)}
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    </div>

                    <p className="team-desc">{t.description || 'No description provided.'}</p>

                    <div className="team-meta-row">
                      <div className="meta-item">
                        <span className="meta-label">Team Lead:</span>
                        <span className="meta-val">{t.leadName || 'Unassigned'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Members:</span>
                        <span className="meta-val">{memberCount} member(s)</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Relationship Types */}
      {activeSubTab === 'relationships' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Reporting Relationship Types</h3>
              <p className="pane-desc">
                Configure the types of managerial relationships employees can have (e.g., Direct Manager, Project Manager, Functional Manager).
              </p>
            </div>
          </div>

          <form onSubmit={handleAddRelationshipType} className="add-dept-form">
            <input
              type="text"
              className="input-field"
              placeholder="Relationship Type Name (e.g. Chapter Lead, Clinical Supervisor)"
              value={newRelName}
              onChange={(e) => setNewRelName(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Description of oversight scope"
              value={newRelDesc}
              onChange={(e) => setNewRelDesc(e.target.value)}
              style={{ flex: 1.5 }}
            />
            <button type="submit" className="btn btn-primary">
              <PlusIcon size={16} /> Add Relationship Type
            </button>
          </form>

          <div className="relationship-types-grid">
            {relationshipTypes.map((rel) => (
              <div key={rel.id} className="relationship-type-card">
                <div className="rel-type-icon">
                  <GitBranchIcon size={20} className="text-accent" />
                </div>
                <div className="rel-type-body">
                  <h4>{rel.name}</h4>
                  <p>{rel.description}</p>
                  <span className="rel-id-badge">ID: {rel.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Custom Position & RBAC Matrix */}
      {isPosModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPosModalOpen(false)}>
          <div
            className="modal-card modal-lg animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div>
                <span className="project-badge-tag">JOB ROLE & RBAC CONFIGURATOR</span>
                <h3 style={{ fontSize: '18px', marginTop: '4px' }}>
                  {editingPos ? `Edit Job Role: ${editingPos.title}` : 'Create Custom Job Role'}
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
                <label className="form-label">Job Role Title *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Senior Tech Lead, Project Director, QA Specialist"
                  value={posForm.title}
                  onChange={(e) => setPosForm({ ...posForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Role Responsibility Tier *</label>
                  <select
                    className="input-field"
                    value={posForm.level}
                    onChange={(e) => setPosForm({ ...posForm, level: Number(e.target.value) })}
                  >
                    <option value={1}>Executive Leadership / C-Suite</option>
                    <option value={2}>Director / Department Head</option>
                    <option value={3}>Manager / Team Lead</option>
                    <option value={4}>Specialist / Individual Contributor</option>
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

              {/* Scope-based Access Control Configuration */}
              <div className="scopes-config-box" style={{ background: 'var(--bg-card-subtle)', padding: '14px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Scope-Based Access Control
                </label>
                <p className="section-desc" style={{ fontSize: '12px', marginBottom: '12px' }}>
                  Defines the boundary of tasks and resources employees holding this job role can access.
                </p>

                <div className="form-row-2">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Task Access Scope:</label>
                    <select
                      className="input-field form-control-sm"
                      value={posForm.accessScopes.taskScope}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          accessScopes: { ...posForm.accessScopes, taskScope: e.target.value },
                        })
                      }
                    >
                      <option value="company">🏢 Company-wide (All Tasks)</option>
                      <option value="department">🏛️ Department-only (Same Department)</option>
                      <option value="team">👥 Team-only (Same Squad/Team)</option>
                      <option value="project">📁 Project-only (Assigned Projects)</option>
                      <option value="own">💼 Own & Subordinates Only</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Project Access Scope:</label>
                    <select
                      className="input-field form-control-sm"
                      value={posForm.accessScopes.projectScope}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          accessScopes: { ...posForm.accessScopes, projectScope: e.target.value },
                        })
                      }
                    >
                      <option value="company">🏢 Company-wide (All Projects)</option>
                      <option value="department">🏛️ Department-only</option>
                      <option value="team">👥 Team-only</option>
                      <option value="project">📁 Assigned Projects</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2" style={{ marginTop: '8px' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Employee Access Scope:</label>
                    <select
                      className="input-field form-control-sm"
                      value={posForm.accessScopes.employeeScope}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          accessScopes: { ...posForm.accessScopes, employeeScope: e.target.value },
                        })
                      }
                    >
                      <option value="company">🏢 Company-wide</option>
                      <option value="department">🏛️ Department-only</option>
                      <option value="team">👥 Team-only</option>
                      <option value="own">💼 Own subordinates only</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>Report / KPI Scope:</label>
                    <select
                      className="input-field form-control-sm"
                      value={posForm.accessScopes.reportScope}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          accessScopes: { ...posForm.accessScopes, reportScope: e.target.value },
                        })
                      }
                    >
                      <option value="company">🏢 Company-wide</option>
                      <option value="department">🏛️ Department-only</option>
                      <option value="team">👥 Team-only</option>
                      <option value="own">💼 Own only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Granular RBAC Permissions */}
              <div className="permissions-config-box">
                <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 600 }}>
                  Configurable Role-Based Action Permissions (RBAC)
                </label>
                <p className="section-desc" style={{ fontSize: '12px', marginBottom: '12px' }}>
                  Granular control over task actions, employee management, and organizational governance.
                </p>

                <div className="perm-checkbox-list">
                  {/* Task Permissions */}
                  <div className="perm-group-header">Task & Deliverable Permissions</div>
                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canCreateTasks}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canCreateTasks: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Create Tasks</strong>
                      <span>Allows creating new tasks and subtasks.</span>
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
                      <strong>Assign Tasks</strong>
                      <span>Allows assigning deliverables to subordinates or team members.</span>
                    </div>
                  </label>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canEditTasks}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canEditTasks: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Edit Tasks</strong>
                      <span>Allows editing task descriptions, priorities, deadlines, and parameters.</span>
                    </div>
                  </label>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canApproveTasks}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: {
                            ...posForm.permissions,
                            canApproveTasks: e.target.checked,
                            canApproveWork: e.target.checked,
                          },
                        })
                      }
                    />
                    <div>
                      <strong>Approve Tasks (Quality Review)</strong>
                      <span>Allows reviewing deliverables submitted by subordinates; approve or request revisions.</span>
                    </div>
                  </label>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canDeleteTasks}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canDeleteTasks: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Delete Tasks</strong>
                      <span>Allows deleting tasks and their associated subtasks.</span>
                    </div>
                  </label>

                  {/* Employee & Structure Permissions */}
                  <div className="perm-group-header" style={{ marginTop: '10px' }}>
                    Employee Management & Governance
                  </div>

                  <label className="perm-checkbox-row">
                    <input
                      type="checkbox"
                      checked={posForm.permissions.canManageEmployees}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          permissions: { ...posForm.permissions, canManageEmployees: e.target.checked },
                        })
                      }
                    />
                    <div>
                      <strong>Manage Employees</strong>
                      <span>Can invite employees, update roles, assign departments/teams, and disable accounts.</span>
                    </div>
                  </label>

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
                      <strong>Create Projects & Milestone Containers</strong>
                      <span>Allows creating high-level projects, target outcomes, and deadlines.</span>
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
                      <strong>View Executive Summary & KPIs</strong>
                      <span>View high-level milestone progress and completion metrics across projects.</span>
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
                      <strong>Govern Organization Structure & RBAC</strong>
                      <span>Allows managing custom job roles, teams, and departments.</span>
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
                  {editingPos ? 'Save Role Changes' : 'Create Custom Job Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Team */}
      {isTeamModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTeamModalOpen(false)}>
          <div
            className="modal-card modal-md animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px' }}
          >
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <UsersIcon size={20} className="text-accent" />
                <h3>{editingTeam ? `Edit Team: ${editingTeam.name}` : 'Create New Team / Squad'}</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsTeamModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="modal-body-form">
              <div className="form-group">
                <label className="form-label">Team / Squad Name *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Core Backend Squad, UI/UX Chapter, Growth Ops"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className="input-field"
                    value={teamForm.department}
                    onChange={(e) => setTeamForm({ ...teamForm, department: e.target.value })}
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Team Lead</label>
                  <select
                    className="input-field"
                    value={teamForm.leadId}
                    onChange={(e) => setTeamForm({ ...teamForm, leadId: e.target.value })}
                  >
                    <option value="">-- Choose Team Lead --</option>
                    {employees.map((emp) => (
                      <option key={emp._id || emp.id} value={emp._id || emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.designation || emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Team Description</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="Describe the operational focus of this team..."
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Team Members (Assign Employees)</label>
                <div
                  style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    padding: '8px',
                    borderRadius: '6px',
                  }}
                >
                  {employees.map((emp) => {
                    const empId = emp._id || emp.id;
                    const isChecked = teamForm.memberIds.includes(empId);
                    return (
                      <label
                        key={empId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 0',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTeamForm({
                                ...teamForm,
                                memberIds: [...teamForm.memberIds, empId],
                              });
                            } else {
                              setTeamForm({
                                ...teamForm,
                                memberIds: teamForm.memberIds.filter((id) => id !== empId),
                              });
                            }
                          }}
                        />
                        <span>
                          {emp.firstName} {emp.lastName} ({emp.designation || emp.role}) ·{' '}
                          <small style={{ color: 'var(--text-muted)' }}>{emp.department}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsTeamModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTeam ? 'Save Team Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
