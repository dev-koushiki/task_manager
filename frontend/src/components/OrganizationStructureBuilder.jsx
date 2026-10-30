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
  const [expandedPerms, setExpandedPerms] = useState({});

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

  // Hierarchy Modal & Creation State
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false);
  const [hierarchyLevelsDraft, setHierarchyLevelsDraft] = useState([]);
  const [newLevelRank, setNewLevelRank] = useState(1);
  const [newLevelName, setNewLevelName] = useState('');
  const [newLevelDesc, setNewLevelDesc] = useState('');
  const [savingHierarchy, setSavingHierarchy] = useState(false);

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
  const handleOpenNewPosition = (defaultLevel) => {
    setEditingPos(null);
    const chosenLevel = defaultLevel || org?.levels?.[0]?.level || 4;
    setPosForm({
      title: '',
      level: chosenLevel,
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

  // Quick preset applicator for the role creation modal
  const applyRolePreset = (preset) => {
    if (preset === 'admin') {
      setPosForm((prev) => ({
        ...prev,
        permissions: {
          canCreateTasks: true,
          canAssignTasks: true,
          canEditTasks: true,
          canApproveTasks: true,
          canDeleteTasks: true,
          canViewTasks: true,
          canManageEmployees: true,
          canCreateProjects: true,
          canEditProjects: true,
          canDeleteProjects: true,
          canViewProjects: true,
          canManageStructure: true,
          canViewExecutiveSummary: true,
          canApproveWork: true,
          canViewTeamTasks: true,
          canViewAllTasks: true,
        },
        accessScopes: {
          taskScope: 'company',
          projectScope: 'company',
          employeeScope: 'company',
          reportScope: 'company',
        },
      }));
    } else if (preset === 'manager') {
      setPosForm((prev) => ({
        ...prev,
        permissions: {
          canCreateTasks: true,
          canAssignTasks: true,
          canEditTasks: true,
          canApproveTasks: true,
          canDeleteTasks: false,
          canViewTasks: true,
          canManageEmployees: true,
          canCreateProjects: true,
          canEditProjects: true,
          canDeleteProjects: false,
          canViewProjects: true,
          canManageStructure: false,
          canViewExecutiveSummary: true,
          canApproveWork: true,
          canViewTeamTasks: true,
          canViewAllTasks: false,
        },
        accessScopes: {
          taskScope: 'department',
          projectScope: 'project',
          employeeScope: 'department',
          reportScope: 'department',
        },
      }));
    } else if (preset === 'contributor') {
      setPosForm((prev) => ({
        ...prev,
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
      }));
    }
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

  // Hierarchy Level Handlers
  const handleOpenHierarchyModal = () => {
    const current = Array.isArray(org?.levels) ? [...org.levels] : [];
    setHierarchyLevelsDraft(current);
    const nextRank = current.length > 0 ? Math.max(...current.map((l) => Number(l.level) || 0)) + 1 : 1;
    setNewLevelRank(nextRank);
    setNewLevelName('');
    setNewLevelDesc('');
    setIsHierarchyModalOpen(true);
  };

  const handleAddDraftLevel = (e) => {
    e.preventDefault();
    if (!newLevelName.trim()) {
      showError('Please provide a hierarchy level name.');
      return;
    }
    const rank = Number(newLevelRank) || (hierarchyLevelsDraft.length + 1);
    const updated = [
      ...hierarchyLevelsDraft,
      {
        level: rank,
        name: newLevelName.trim(),
        description: newLevelDesc.trim(),
      },
    ].sort((a, b) => Number(a.level) - Number(b.level));
    setHierarchyLevelsDraft(updated);
    setNewLevelRank(rank + 1);
    setNewLevelName('');
    setNewLevelDesc('');
  };

  const handleDeleteDraftLevel = (idx) => {
    setHierarchyLevelsDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearAllLevels = () => {
    if (window.confirm('Clear all hierarchy levels? This will remove organizational tiers until new ones are created.')) {
      setHierarchyLevelsDraft([]);
    }
  };

  const handleApplyLevelTemplate = (type) => {
    if (type === 'standard') {
      setHierarchyLevelsDraft([
        { level: 1, name: 'Executive Leadership', description: 'C-Suite, heads of office, and company executives' },
        { level: 2, name: 'Department Directors', description: 'Heads of business units and project directors' },
        { level: 3, name: 'Managers & Leads', description: 'Team leads and operational managers overseeing tasks' },
        { level: 4, name: 'Specialists & Contributors', description: 'Core practitioners and individual contributors' },
      ]);
    } else if (type === 'flat') {
      setHierarchyLevelsDraft([
        { level: 1, name: 'Company Leadership', description: 'Founders and executive directors' },
        { level: 2, name: 'Squad Leads', description: 'Project leads coordinating deliverables' },
        { level: 3, name: 'Core Team Members', description: 'Individual contributors and specialists' },
      ]);
    }
  };

  const handleSaveHierarchyLevels = async () => {
    setSavingHierarchy(true);
    try {
      const updatedLevels = await api.updateHierarchyLevels(hierarchyLevelsDraft);
      setOrg((prev) => ({ ...prev, levels: updatedLevels }));
      setLevelsDraft(updatedLevels);
      setIsHierarchyModalOpen(false);
      showSuccess('Organizational hierarchy levels saved successfully.');
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to save hierarchy levels');
    } finally {
      setSavingHierarchy(false);
    }
  };

  // Clear all hierarchy levels and roles (clean slate)
  const handleClearAllHierarchy = async () => {
    if (
      !window.confirm(
        'Delete all hierarchy levels and roles? This will clean your organization database so you can start fresh or configure your own custom tiers.'
      )
    ) {
      return;
    }

    try {
      await api.clearHierarchy();
      setOrg((prev) => ({ ...prev, levels: [], positions: [] }));
      setLevelsDraft([]);
      setHierarchyLevelsDraft([]);
      showSuccess('All hierarchy levels and roles removed. Database is now clean.');
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to clear hierarchy');
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

  // Clear All Departments
  const handleClearAllDepartments = async () => {
    if (!window.confirm('Delete all departments? This will remove all department units so you can define your own.')) return;
    try {
      await api.clearDepartments();
      setOrg((prev) => ({ ...prev, departments: [] }));
      showSuccess('All departments cleared successfully.');
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to clear departments');
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

  const handleDeleteRelationshipType = async (relId, relName) => {
    if (!window.confirm(`Are you sure you want to delete relationship type "${relName}"?`)) return;
    try {
      const res = await api.deleteRelationshipType(relId);
      setOrg((prev) => ({ ...prev, relationshipTypes: res.relationshipTypes || [] }));
      showSuccess(`Relationship type "${relName}" removed.`);
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to remove relationship type');
    }
  };

  const handleClearAllRelationshipTypes = async () => {
    if (!window.confirm('Delete all reporting relationship types? You can configure your own custom types.')) return;
    try {
      await api.clearRelationshipTypes();
      setOrg((prev) => ({ ...prev, relationshipTypes: [] }));
      showSuccess('All reporting relationship types cleared.');
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      showError(err.message || 'Failed to clear relationship types');
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

  // Helper to get human-friendly scope summary
  const getScopeBadge = (accessScopes) => {
    const s = accessScopes || {};
    const task = s.taskScope || 'own';
    const proj = s.projectScope || 'project';
    const emp = s.employeeScope || 'own';

    if (task === 'company' && proj === 'company' && emp === 'company') {
      return { label: 'Company-Wide Access', icon: '🌐', className: 'scope-company' };
    }
    if (task === 'department' || emp === 'department') {
      return { label: 'Department Access', icon: '🏢', className: 'scope-dept' };
    }
    if (task === 'team' || emp === 'team') {
      return { label: 'Team Access', icon: '👥', className: 'scope-team' };
    }
    if (task === 'own' && emp === 'own') {
      return { label: 'Personal Access Only', icon: '👤', className: 'scope-own' };
    }
    return { label: 'Project Scoped Access', icon: '📁', className: 'scope-project' };
  };

  // Helper to extract clean capability chips
  const getKeyCapabilities = (permissions) => {
    const p = permissions || {};
    const caps = [];
    const isAdmin = p.canManageStructure && p.canCreateProjects && p.canDeleteTasks && p.canManageEmployees;
    if (isAdmin) {
      return [{ key: 'admin', label: 'Full Administrator', color: 'perm-admin' }];
    }
    if (p.canApproveTasks || p.canApproveWork) {
      caps.push({ key: 'approve', label: 'Approve Work' });
    }
    if (p.canCreateProjects || p.canEditProjects) {
      caps.push({ key: 'projects', label: 'Manage Projects' });
    }
    if (p.canCreateTasks || p.canAssignTasks) {
      caps.push({ key: 'tasks', label: 'Create & Assign' });
    } else if (p.canEditTasks) {
      caps.push({ key: 'edit', label: 'Edit Tasks' });
    }
    if (p.canManageEmployees) {
      caps.push({ key: 'employees', label: 'Manage Team' });
    }
    if (p.canViewExecutiveSummary) {
      caps.push({ key: 'exec', label: 'Executive Reports' });
    }
    if (caps.length === 0) {
      caps.push({ key: 'contributor', label: 'Standard Contributor', color: 'perm-contributor' });
    }
    return caps;
  };

  const renderPositionCard = (pos) => {
    const p = pos.permissions || {};
    const scopeInfo = getScopeBadge(pos.accessScopes);
    const keyCaps = getKeyCapabilities(p);
    const isExpanded = Boolean(expandedPerms[pos.id]);

    return (
      <div key={pos.id} className="position-card">
        {/* Card Top */}
        <div className="position-card-top">
          <div className="pos-title-block">
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

        {/* Scope Pill Badge */}
        <div className="scope-badge-container">
          <span className={`role-scope-pill ${scopeInfo.className}`}>
            <span>{scopeInfo.icon}</span>
            <span>{scopeInfo.label}</span>
          </span>
        </div>

        {/* Key Capabilities */}
        <div className="capabilities-summary-row">
          {keyCaps.map((c) => (
            <span key={c.key} className={`cap-chip ${c.color || 'cap-active'}`}>
              <CheckIcon size={11} /> {c.label}
            </span>
          ))}
        </div>

        {/* Expandable Scopes & Permissions Details */}
        <div className="card-footer-toggle">
          <button
            type="button"
            className="toggle-details-btn"
            onClick={() => setExpandedPerms((prev) => ({ ...prev, [pos.id]: !prev[pos.id] }))}
          >
            {isExpanded ? 'Hide Details ▲' : 'View Full Permissions ▼'}
          </button>
        </div>

        {isExpanded && (
          <div className="expanded-card-details animate-fade-in">
            <div className="expanded-scope-grid">
              <div><small>Tasks:</small> <strong>{(pos.accessScopes?.taskScope || 'own').toUpperCase()}</strong></div>
              <div><small>Projects:</small> <strong>{(pos.accessScopes?.projectScope || 'project').toUpperCase()}</strong></div>
              <div><small>Employees:</small> <strong>{(pos.accessScopes?.employeeScope || 'own').toUpperCase()}</strong></div>
              <div><small>Reports:</small> <strong>{(pos.accessScopes?.reportScope || 'own').toUpperCase()}</strong></div>
            </div>
            <div className="expanded-perm-list">
              {p.canCreateTasks && <span className="sub-perm-pill">Create Tasks</span>}
              {p.canAssignTasks && <span className="sub-perm-pill">Assign Tasks</span>}
              {p.canEditTasks && <span className="sub-perm-pill">Edit Tasks</span>}
              {(p.canApproveTasks || p.canApproveWork) && <span className="sub-perm-pill">Approve Work</span>}
              {p.canDeleteTasks && <span className="sub-perm-pill">Delete Tasks</span>}
              {p.canManageEmployees && <span className="sub-perm-pill">Manage Employees</span>}
              {p.canCreateProjects && <span className="sub-perm-pill">Create Projects</span>}
              {p.canEditProjects && <span className="sub-perm-pill">Edit Projects</span>}
              {p.canDeleteProjects && <span className="sub-perm-pill">Delete Projects</span>}
              {p.canManageStructure && <span className="sub-perm-pill">Govern Structure</span>}
              {p.canViewExecutiveSummary && <span className="sub-perm-pill">Executive Summary</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="org-builder-container animate-fade-in">
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
          <span>Roles & Permissions ({positions.length})</span>
        </button>
        <button
          type="button"
          className={`org-subtab-btn ${activeSubTab === 'levels' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('levels')}
        >
          <GitBranchIcon size={16} />
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
          className={`org-subtab-btn ${activeSubTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('teams')}
        >
          <UsersIcon size={16} />
          <span>Teams ({teams.length})</span>
        </button>
        <button
          type="button"
          className={`org-subtab-btn ${activeSubTab === 'relationships' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('relationships')}
        >
          <LayersIcon size={16} />
          <span>Reporting Types ({relationshipTypes.length})</span>
        </button>
      </div>

      {/* TAB 1: Positions & Permissions Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Company Roles & Access Control</h3>
              <p className="pane-desc">
                Roles are organized by authority tiers. Each role defines the actions and data scope members have in Taskflow.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {(levels.length > 0 || positions.length > 0) && (
                <button
                  type="button"
                  className="btn btn-secondary text-danger"
                  onClick={handleClearAllHierarchy}
                  title="Remove all hierarchy tiers and roles to start completely fresh"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <TrashIcon size={15} />
                  <span>Clear All Hierarchy</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleOpenHierarchyModal}
              >
                <GitBranchIcon size={16} />
                <span>{levels.length > 0 ? 'Manage Hierarchy' : 'Create Hierarchy'}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenNewPosition()}
              >
                <PlusIcon size={16} />
                <span>Add Custom Role</span>
              </button>
            </div>
          </div>

          {/* Dynamic Hierarchy / Roles Rendering */}
          {levels && levels.length > 0 ? (
            <div className="positions-grid">
              {levels.map((lvl) => {
                const lvlPositions = positions.filter((p) => Number(p.level) === Number(lvl.level));
                return (
                  <div key={lvl.level} className="level-group-box">
                    <div className="level-group-header">
                      <div className="level-header-left">
                        <span className="level-tag">Tier {lvl.level}</span>
                        <span className="level-name">{lvl.name}</span>
                        {lvl.description && <span className="level-desc-inline">• {lvl.description}</span>}
                      </div>
                      <div className="level-header-right">
                        <span className="level-count">{lvlPositions.length} Role(s)</span>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-secondary"
                          title={`Add role directly into Tier ${lvl.level}`}
                          onClick={() => handleOpenNewPosition(lvl.level)}
                        >
                          <PlusIcon size={12} /> Add Role
                        </button>
                      </div>
                    </div>

                    {lvlPositions.length === 0 ? (
                      <div className="empty-level-hint">
                        <span>No custom roles defined in Tier {lvl.level} yet. Click &ldquo;Add Role&rdquo; to create one.</span>
                      </div>
                    ) : (
                      <div className="positions-cards-list">
                        {lvlPositions.map(renderPositionCard)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-hierarchy-view">
              <div className="hierarchy-callout-card">
                <div className="hierarchy-callout-left">
                  <div className="hierarchy-callout-icon">
                    <GitBranchIcon size={24} />
                  </div>
                  <div>
                    <h4>No Organizational Hierarchy Created</h4>
                    <p>Build custom hierarchy levels to structure your company into tiers, manage authority levels, and organize roles.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleOpenHierarchyModal}
                >
                  <PlusIcon size={14} />
                  <span>Create Hierarchy</span>
                </button>
              </div>

              {positions.length === 0 ? (
                <div className="empty-level-box" style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <p>No custom job roles defined yet. Click &ldquo;Add Custom Role&rdquo; to define your first role.</p>
                </div>
              ) : (
                <div className="positions-cards-list">
                  {positions.map(renderPositionCard)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Hierarchy Levels Manager */}
      {activeSubTab === 'levels' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Hierarchy Tiers & Ranking</h3>
              <p className="pane-desc">
                Authority tiers define reporting chains, project review boundaries, and job role classifications.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {levels.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary text-danger"
                  onClick={handleClearAllHierarchy}
                  title="Remove all hierarchy tiers and roles to start completely fresh"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <TrashIcon size={15} />
                  <span>Clear All Hierarchy</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenHierarchyModal}
              >
                <GitBranchIcon size={16} />
                <span>{levels.length > 0 ? 'Manage Hierarchy Tiers' : 'Create Hierarchy'}</span>
              </button>
            </div>
          </div>

          {levels.length === 0 ? (
            <div className="hierarchy-callout-card">
              <div className="hierarchy-callout-left">
                <div className="hierarchy-callout-icon">
                  <GitBranchIcon size={24} />
                </div>
                <div>
                  <h4>No Hierarchy Tiers Configured</h4>
                  <p>Create an organizational hierarchy to establish authority tiers and reporting lines.</p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleOpenHierarchyModal}
              >
                <PlusIcon size={14} />
                <span>Create Hierarchy</span>
              </button>
            </div>
          ) : (
            <div className="positions-grid">
              {levels.map((lvl) => {
                const count = positions.filter((p) => Number(p.level) === Number(lvl.level)).length;
                return (
                  <div key={lvl.level} className="level-group-box">
                    <div className="level-group-header">
                      <div className="level-header-left">
                        <span className="level-tag">Tier {lvl.level}</span>
                        <span className="level-name" style={{ fontWeight: 700 }}>{lvl.name}</span>
                      </div>
                      <div className="level-header-right">
                        <span className="level-count">{count} Associated Role(s)</span>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline-secondary"
                          onClick={() => {
                            setActiveSubTab('matrix');
                          }}
                        >
                          View Roles
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      {lvl.description || 'No description configured.'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Departments */}
      {activeSubTab === 'departments' && (
        <div className="tab-pane animate-fade-in">
          <div className="pane-header-actions">
            <div>
              <h3>Department & Functional Unit Management</h3>
              <p className="pane-desc">
                Create and manage functional departments for your company. Employees and teams will belong to these units.
              </p>
            </div>
            {departments.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary text-danger"
                onClick={handleClearAllDepartments}
                title="Remove all departments to start completely fresh"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <TrashIcon size={15} />
                <span>Clear All Departments</span>
              </button>
            )}
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
            {departments.length === 0 ? (
              <div className="empty-level-box" style={{ gridColumn: '1 / -1', padding: '36px 20px', textAlign: 'center' }}>
                <p>No departments configured yet. Add a new department using the form above.</p>
              </div>
            ) : (
              departments.map((dept) => {
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
              })
            )}
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
            {relationshipTypes.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary text-danger"
                onClick={handleClearAllRelationshipTypes}
                title="Remove all reporting relationship types to start completely fresh"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <TrashIcon size={15} />
                <span>Clear All Reporting Types</span>
              </button>
            )}
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
            {relationshipTypes.length === 0 ? (
              <div className="empty-level-box" style={{ gridColumn: '1 / -1', padding: '36px 20px', textAlign: 'center' }}>
                <p>No relationship types configured yet. Add a relationship type above.</p>
              </div>
            ) : (
              relationshipTypes.map((rel) => {
                const relIdentifier = rel.id || rel._id || rel.name;
                return (
                  <div key={relIdentifier} className="relationship-type-card" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                      <div className="rel-type-icon">
                        <GitBranchIcon size={20} className="text-accent" />
                      </div>
                      <div className="rel-type-body">
                        <h4>{rel.name}</h4>
                        <p>{rel.description}</p>
                        <span className="rel-id-badge">ID: {rel.id || rel._id || rel.name}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-action-btn text-danger"
                      title="Remove Relationship Type"
                      onClick={() => handleDeleteRelationshipType(relIdentifier, rel.name)}
                      style={{ marginTop: '2px', marginLeft: '8px' }}
                    >
                      <TrashIcon size={15} />
                    </button>
                  </div>
                );
              })
            )}
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
                <span className="project-badge-tag">ROLE & ACCESS PERMISSIONS</span>
                <h3 style={{ fontSize: '18px', marginTop: '4px' }}>
                  {editingPos ? `Edit Role: ${editingPos.title}` : 'Create New Job Role'}
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

            {/* Quick Presets Bar */}
            <div className="role-quick-presets">
              <span className="preset-title">⚡ Apply Preset:</span>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                title="Grant full administrative permissions with company-wide access"
                onClick={() => applyRolePreset('admin')}
              >
                Full Admin
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                title="Grant task approval, assignment, and department-level scopes"
                onClick={() => applyRolePreset('manager')}
              >
                Manager / Approver
              </button>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                title="Grant standard task execution with personal scope"
                onClick={() => applyRolePreset('contributor')}
              >
                Team Contributor
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
                    {levels && levels.length > 0 ? (
                      levels.map((lvl) => (
                        <option key={lvl.level} value={lvl.level}>
                          Level {lvl.level}: {lvl.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value={1}>Level 1: Executive Leadership / C-Suite</option>
                        <option value={2}>Level 2: Director / Department Head</option>
                        <option value={3}>Level 3: Manager / Team Lead</option>
                        <option value={4}>Level 4: Specialist / Individual Contributor</option>
                      </>
                    )}
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
      {/* MODAL: Create & Manage Hierarchy Levels */}
      {isHierarchyModalOpen && (
        <div className="modal-overlay" onClick={() => setIsHierarchyModalOpen(false)}>
          <div
            className="modal-card modal-lg animate-scale-up"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <GitBranchIcon size={20} className="text-accent" />
                <h3>Organizational Hierarchy Builder</h3>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsHierarchyModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Define your organization&rsquo;s hierarchy levels. Rank 1 represents the highest executive authority. Job roles, permissions, and reporting chains reference these tiers.
              </p>

              {/* Add New Level Form */}
              <form onSubmit={handleAddDraftLevel} className="hierarchy-add-box">
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Add Hierarchy Level
                </span>
                <div className="hierarchy-add-row">
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                      Rank (1, 2...)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input-field"
                      value={newLevelRank}
                      onChange={(e) => setNewLevelRank(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                      Level Name *
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Executive Leadership"
                      value={newLevelName}
                      onChange={(e) => setNewLevelName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Strategic oversight"
                      value={newLevelDesc}
                      onChange={(e) => setNewLevelDesc(e.target.value)}
                    />
                  </div>
                  <div style={{ alignSelf: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ height: '38px', whiteSpace: 'nowrap' }}>
                      <PlusIcon size={14} /> Add
                    </button>
                  </div>
                </div>
              </form>

              {/* Levels List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                    Configured Hierarchy Levels ({hierarchyLevelsDraft.length})
                  </span>
                  {hierarchyLevelsDraft.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-danger"
                      onClick={handleClearAllLevels}
                    >
                      Clear All Levels
                    </button>
                  )}
                </div>

                {hierarchyLevelsDraft.length === 0 ? (
                  <div className="empty-level-hint">
                    No hierarchy levels defined. Add a level above or load a starter template below.
                  </div>
                ) : (
                  <div className="hierarchy-items-list">
                    {hierarchyLevelsDraft.map((lvl, idx) => (
                      <div key={idx} className="hierarchy-item-row">
                        <div className="hierarchy-item-meta">
                          <span className="hierarchy-rank-badge">Tier {lvl.level}</span>
                          <div className="hierarchy-item-details">
                            <strong>{lvl.name}</strong>
                            {lvl.description && <small>{lvl.description}</small>}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="icon-action-btn text-danger"
                          title="Delete Level"
                          onClick={() => handleDeleteDraftLevel(idx)}
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Starter Templates */}
              <div className="hierarchy-template-bar">
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Load Starter Hierarchy:
                </span>
                <div className="hierarchy-template-pills">
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary"
                    onClick={() => handleApplyLevelTemplate('standard')}
                  >
                    4-Tier Corporate
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary"
                    onClick={() => handleApplyLevelTemplate('flat')}
                  >
                    3-Tier Flat
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsHierarchyModalOpen(false)}
                disabled={savingHierarchy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveHierarchyLevels}
                disabled={savingHierarchy}
              >
                {savingHierarchy ? 'Saving Hierarchy...' : 'Save Hierarchy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
