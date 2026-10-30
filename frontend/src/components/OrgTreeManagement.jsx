import { useState, useEffect } from 'react';
import {
  UsersIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  GitBranchIcon,
  SearchIcon,
  BuildingIcon,
  SparklesIcon,
  UserIcon,
} from './Icons';
import { api } from '../services/api';

export const OrgTreeManagement = ({ onHierarchyUpdated }) => {
  const [treeNodes, setTreeNodes] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileFilter, setProfileFilter] = useState('all'); // 'all' | 'unassigned' | 'assigned'
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  // Modals state
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [targetParentId, setTargetParentId] = useState(null);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeDept, setNewNodeDept] = useState('General');

  const [isEditNodeModalOpen, setIsEditNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editParentId, setEditParentId] = useState('');

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignNodeId, setAssignNodeId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [employeeCodeInput, setEmployeeCodeInput] = useState('');

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  // In-app Confirmation Modals
  const [nodeToDelete, setNodeToDelete] = useState(null);
  const [nodeToUnassign, setNodeToUnassign] = useState(null);

  // Admin Employee ID Generator Modal
  const [isManageIdModalOpen, setIsManageIdModalOpen] = useState(false);
  const [targetEmployeeForId, setTargetEmployeeForId] = useState(null);
  const [customEmployeeIdInput, setCustomEmployeeIdInput] = useState('');
  const [isSavingId, setIsSavingId] = useState(false);

  // Drag and drop state
  const [draggedEmployee, setDraggedEmployee] = useState(null);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOverNodeId, setDragOverNodeId] = useState(null);

  // Load tree and active profiles
  const loadTreeData = async () => {
    try {
      setLoading(true);
      setErrorNotice('');
      const data = await api.getOrgTree();
      if (data) {
        setTreeNodes(data.treeNodes || []);
        setActiveEmployees(data.activeEmployees || []);
      }
    } catch (err) {
      console.error('Failed to load org tree:', err);
      setErrorNotice(err.message || 'Failed to load organizational tree.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTreeData();
  }, []);

  const triggerNotice = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const triggerError = (msg) => {
    setErrorNotice(msg);
    setTimeout(() => setErrorNotice(''), 5000);
  };

  // Helper to calculate next sequential Employee ID
  const generateNextEmployeeId = (prefix = 'EMP') => {
    const allIds = [
      ...activeEmployees.map((e) => e.employeeId || ''),
      ...treeNodes.map((n) => n.employeeCode || ''),
    ].filter(Boolean);

    let maxNum = 0;
    allIds.forEach((id) => {
      const match = id.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  };

  // Node operations
  const handleOpenAddNode = (parentId = null) => {
    setTargetParentId(parentId);
    setNewNodeTitle('');
    setNewNodeDept('General');
    setIsAddNodeModalOpen(true);
  };

  const handleCreateNode = async (e) => {
    e.preventDefault();
    if (!newNodeTitle.trim()) return;
    try {
      await api.addTreeNode({
        title: newNodeTitle.trim(),
        parentId: targetParentId,
        department: newNodeDept.trim(),
      });
      setIsAddNodeModalOpen(false);
      triggerNotice(`Position "${newNodeTitle}" added to organizational tree.`);
      await loadTreeData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to add node.');
    }
  };

  const handleOpenEditNode = (node) => {
    setEditingNode(node);
    setEditTitle(node.title || '');
    setEditDept(node.department || 'General');
    setEditParentId(node.parentId || '');
    setIsEditNodeModalOpen(true);
  };

  const handleUpdateNode = async (e) => {
    e.preventDefault();
    if (!editingNode || !editTitle.trim()) return;
    try {
      await api.updateTreeNode(editingNode.id, {
        title: editTitle.trim(),
        department: editDept.trim(),
        parentId: editParentId || null,
      });
      setIsEditNodeModalOpen(false);
      triggerNotice(`Position "${editTitle}" updated.`);
      await loadTreeData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to update node.');
    }
  };

  const handleConfirmDeleteNode = async () => {
    if (!nodeToDelete) return;
    try {
      await api.deleteTreeNode(nodeToDelete.id);
      triggerNotice(`Position "${nodeToDelete.title}" deleted.`);
      setNodeToDelete(null);
      await loadTreeData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to delete node.');
    }
  };

  // Employee assignment
  const handleOpenAssignModal = (nodeId) => {
    setAssignNodeId(nodeId);
    setSelectedUserId('');
    // Auto-suggest next employee code
    setEmployeeCodeInput(generateNextEmployeeId('EMP'));
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    if (!assignNodeId || !selectedUserId) return;
    try {
      const res = await api.assignEmployeeToNode(assignNodeId, {
        userId: selectedUserId,
        employeeCode: employeeCodeInput.trim(),
      });
      setIsAssignModalOpen(false);
      triggerNotice(res.message || 'Employee successfully mapped to tree node.');
      await loadTreeData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to assign employee to node.');
    }
  };

  const handleConfirmUnassign = async () => {
    if (!nodeToUnassign) return;
    try {
      await api.unassignEmployeeFromNode(nodeToUnassign.nodeId);
      triggerNotice(`Employee unassigned from position.`);
      setNodeToUnassign(null);
      await loadTreeData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to unassign employee.');
    }
  };

  // Admin ID Management
  const handleOpenManageIdModal = (emp) => {
    setTargetEmployeeForId(emp);
    if (emp.employeeId) {
      setCustomEmployeeIdInput(emp.employeeId);
    } else {
      setCustomEmployeeIdInput(generateNextEmployeeId('EMP'));
    }
    setIsManageIdModalOpen(true);
  };

  const handleSaveEmployeeId = async (e) => {
    e.preventDefault();
    if (!targetEmployeeForId || !customEmployeeIdInput.trim()) return;
    try {
      setIsSavingId(true);
      const res = await api.updateEmployeeId(targetEmployeeForId._id, customEmployeeIdInput.trim());
      setIsManageIdModalOpen(false);
      triggerNotice(res.message || `Employee ID set to ${customEmployeeIdInput.trim()}`);
      await loadTreeData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to update employee ID.');
    } finally {
      setIsSavingId(false);
    }
  };

  // Drag and drop handlers
  const handleDragStartEmployee = (e, emp) => {
    setDraggedEmployee(emp);
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'employee', userId: emp._id }));
  };

  const handleDragStartNode = (e, nodeId) => {
    setDraggedNodeId(nodeId);
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'node', nodeId }));
  };

  const handleDragOverNode = (e, nodeId) => {
    e.preventDefault();
    if (dragOverNodeId !== nodeId) {
      setDragOverNodeId(nodeId);
    }
  };

  const handleDragLeaveNode = () => {
    setDragOverNodeId(null);
  };

  const handleDropOnNode = async (e, targetNodeId) => {
    e.preventDefault();
    setDragOverNodeId(null);

    try {
      const rawData = e.dataTransfer.getData('text/plain');
      let data = {};
      try {
        data = JSON.parse(rawData);
      } catch {
        data = {};
      }

      // Case 1: Dropped an employee onto a node
      if (data.type === 'employee' || draggedEmployee) {
        const emp = draggedEmployee || activeEmployees.find((u) => u._id === data.userId);
        if (!emp) return;
        const code = emp.employeeId || generateNextEmployeeId('EMP');
        await api.assignEmployeeToNode(targetNodeId, {
          userId: emp._id,
          employeeCode: code,
        });
        triggerNotice(`Assigned ${emp.firstName} ${emp.lastName} (${code}) to position.`);
        setDraggedEmployee(null);
        await loadTreeData();
        if (onHierarchyUpdated) onHierarchyUpdated();
        return;
      }

      // Case 2: Dropped a node onto another node (move parent)
      if (data.type === 'node' || draggedNodeId) {
        const sourceNodeId = draggedNodeId || data.nodeId;
        if (!sourceNodeId || sourceNodeId === targetNodeId) return;
        await api.moveTreeNode(sourceNodeId, targetNodeId);
        triggerNotice('Position moved successfully in organizational hierarchy.');
        setDraggedNodeId(null);
        await loadTreeData();
        if (onHierarchyUpdated) onHierarchyUpdated();
        return;
      }
    } catch (err) {
      triggerError(err.message || 'Drag-and-drop action failed.');
      setDraggedEmployee(null);
      setDraggedNodeId(null);
    }
  };

  // Merge nodes
  const handleMergeNodes = async (e) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    try {
      await api.mergeTreeNodes(mergeSourceId, mergeTargetId);
      setIsMergeModalOpen(false);
      triggerNotice('Positions merged successfully.');
      await loadTreeData();
      if (onHierarchyUpdated) onHierarchyUpdated();
    } catch (err) {
      triggerError(err.message || 'Failed to merge positions.');
    }
  };

  // Filtered active profiles
  const filteredProfiles = activeEmployees.filter((emp) => {
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      fullName.includes(query) ||
      (emp.email && emp.email.toLowerCase().includes(query)) ||
      (emp.department && emp.department.toLowerCase().includes(query)) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(query));

    if (!matchesSearch) return false;
    if (profileFilter === 'unassigned') return !emp.isAssigned;
    if (profileFilter === 'assigned') return emp.isAssigned;
    return true;
  });

  // Recursive tree building for rendering
  const buildTreeHierarchy = (parentId = null) => {
    return treeNodes
      .filter((n) => {
        if (!parentId) {
          return !n.parentId || !treeNodes.some((p) => p.id === n.parentId);
        }
        return n.parentId === parentId;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((node) => ({
        ...node,
        children: buildTreeHierarchy(node.id),
      }));
  };

  const treeHierarchy = buildTreeHierarchy(null);

  // Render a node recursively
  const renderTreeNode = (node, depth = 0) => {
    const hasEmployee = Boolean(node.employee);
    const emp = node.employee;
    const isRoot = node.id === 'node_root' || (!node.parentId && depth === 0 && node.employeeCode === 'EMP-001');
    const isDropTarget = dragOverNodeId === node.id;

    return (
      <div key={node.id} className="org-tree-branch">
        <div
          className={`org-tree-node-card ${isRoot ? 'node-root' : ''} ${hasEmployee ? 'node-occupied' : 'node-vacant'} ${isDropTarget ? 'node-drop-highlight' : ''}`}
          draggable={!isRoot}
          onDragStart={(e) => {
            // Prevent dragging if mousedown originated on a button or interactive child
            if (e.target.closest('button') || e.target.closest('.node-card-actions') || e.target.closest('.node-vacant-placeholder')) {
              e.preventDefault();
              return false;
            }
            handleDragStartNode(e, node.id);
          }}
          onDragOver={(e) => handleDragOverNode(e, node.id)}
          onDragLeave={handleDragLeaveNode}
          onDrop={(e) => handleDropOnNode(e, node.id)}
        >
          <div className="node-card-header">
            <div className="node-title-wrap">
              <span className="node-badge-level">{isRoot ? '👑 MAIN ADMIN' : `LEVEL ${depth + 1}`}</span>
              <strong className="node-title">{node.title}</strong>
            </div>
            <span className="node-dept-pill">
              <BuildingIcon size={11} /> {node.department || 'General'}
            </span>
          </div>

          <div className="node-card-body">
            {hasEmployee ? (
              <div className="node-employee-info">
                <div className="node-avatar-circle">
                  {emp.firstName ? emp.firstName[0].toUpperCase() : 'U'}
                </div>
                <div className="node-employee-details">
                  <div className="node-emp-name-row">
                    <strong>{emp.firstName} {emp.lastName}</strong>
                    {node.employeeCode && (
                      <span className="node-empid-pill" title="Employee ID">{node.employeeCode}</span>
                    )}
                  </div>
                  <small className="node-emp-email">{emp.email}</small>
                  <span className="node-emp-role">{emp.designation || emp.role}</span>
                </div>
              </div>
            ) : (
              <div
                className="node-vacant-placeholder"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenAssignModal(node.id);
                }}
                title="Click to assign or drag an active employee here"
              >
                <UserIcon size={18} className="vacant-icon" />
                <div className="vacant-text">
                  <span>Vacant Position</span>
                  <small>Drop profile or click to assign</small>
                </div>
              </div>
            )}
          </div>

          <div
            className="node-card-actions"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="node-action-btn btn-add-child"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAddNode(node.id);
              }}
              title="Add subordinate role under this position"
            >
              <PlusIcon size={12} /> Add Child
            </button>

            {hasEmployee ? (
              !isRoot && (
                <button
                  type="button"
                  className="node-action-btn btn-unassign"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNodeToUnassign({ nodeId: node.id, name: `${emp.firstName} ${emp.lastName}` });
                  }}
                  title="Unassign employee from this position"
                >
                  Unassign
                </button>
              )
            ) : (
              <button
                type="button"
                className="node-action-btn btn-assign"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenAssignModal(node.id);
                }}
                title="Map an activated employee to this position"
              >
                Assign
              </button>
            )}

            <button
              type="button"
              className="node-action-btn"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEditNode(node);
              }}
              title="Edit position title or department"
            >
              <EditIcon size={12} />
            </button>

            {!isRoot && (
              <button
                type="button"
                className="node-action-btn btn-delete"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setNodeToDelete(node);
                }}
                title="Delete position"
              >
                <TrashIcon size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Children Branches */}
        {node.children && node.children.length > 0 && (
          <div className="org-tree-children">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="org-tree-management-container animate-fade-in">
      {/* Alert Notices */}
      {notice && (
        <div className="notice-banner success-banner animate-fade-in">
          <CheckCircleIcon size={16} /> <span>{notice}</span>
        </div>
      )}
      {errorNotice && (
        <div className="notice-banner error-banner animate-fade-in">
          <AlertTriangleIcon size={16} /> <span>{errorNotice}</span>
        </div>
      )}

      {/* Header bar with controls */}
      <div className="org-tree-top-controls">
        <div className="controls-left">
          <div className="header-icon-badge">
            <GitBranchIcon size={22} className="text-primary" />
          </div>
          <div>
            <h3>Dynamic Organizational Tree & Node Hierarchy</h3>
            <p className="controls-subtext">
              Customizable parent-child hierarchy. Manage positions, assign activated employees, generate official Employee IDs, and configure dynamic reporting relationships.
            </p>
          </div>
        </div>

        <div className="controls-right-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsMergeModalOpen(true)}
            disabled={treeNodes.length < 2}
          >
            Merge Nodes
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleOpenAddNode(null)}
          >
            <PlusIcon size={14} /> Add Position Node
          </button>
        </div>
      </div>

      {/* Main Split Layout: Visual Tree (Left) + Active Profiles (Right) */}
      <div className="org-tree-layout-split">
        {/* Left Side: Tree Visualizer */}
        <div className="org-tree-canvas-panel">
          <div className="canvas-header-bar">
            <h4>
              Visual Organization Hierarchy{' '}
              <span className="count-pill">{treeNodes.length} Nodes</span>
            </h4>
            <span className="canvas-hint">Drag nodes to reorganize · Drop employees to assign · Click buttons to manage</span>
          </div>

          {loading ? (
            <div className="tree-loading-state">
              <div className="spinner"></div>
              <p>Loading organization tree...</p>
            </div>
          ) : treeHierarchy.length === 0 ? (
            <div className="tree-empty-state">
              <GitBranchIcon size={44} className="text-muted" />
              <h4>No organization tree nodes yet</h4>
              <p>Initialize or create your first position node above.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleOpenAddNode(null)}
              >
                Create Root Position
              </button>
            </div>
          ) : (
            <div className="org-tree-render-root">
              {treeHierarchy.map((rootNode) => renderTreeNode(rootNode, 0))}
            </div>
          )}
        </div>

        {/* Right Side: Active Profiles Sidebar */}
        <div className="org-active-profiles-panel">
          <div className="profiles-header-bar">
            <div>
              <h4>Active Profiles</h4>
              <small className="profiles-subtext">Activated employees available for tree assignment & ID generation</small>
            </div>
            <span className="count-pill">{activeEmployees.length} Total</span>
          </div>

          {/* Search & Filter */}
          <div className="profiles-search-bar">
            <SearchIcon size={14} className="search-icon-muted" />
            <input
              type="text"
              placeholder="Search active employees by name, email, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="profiles-filter-tabs">
            <button
              type="button"
              className={`filter-tab-btn ${profileFilter === 'all' ? 'active' : ''}`}
              onClick={() => setProfileFilter('all')}
            >
              All ({activeEmployees.length})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${profileFilter === 'unassigned' ? 'active' : ''}`}
              onClick={() => setProfileFilter('unassigned')}
            >
              Unassigned ({activeEmployees.filter((e) => !e.isAssigned).length})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${profileFilter === 'assigned' ? 'active' : ''}`}
              onClick={() => setProfileFilter('assigned')}
            >
              Assigned ({activeEmployees.filter((e) => e.isAssigned).length})
            </button>
          </div>

          {/* Profiles Cards List */}
          <div className="profiles-list-scroll">
            {filteredProfiles.length === 0 ? (
              <div className="empty-profiles-state">
                <p>No active employee profiles found.</p>
              </div>
            ) : (
              filteredProfiles.map((emp) => {
                const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                const initials = emp.firstName ? emp.firstName[0].toUpperCase() : 'U';

                return (
                  <div
                    key={emp._id}
                    className={`active-profile-card ${emp.isAssigned ? 'card-assigned' : 'card-unassigned'}`}
                    draggable={true}
                    onDragStart={(e) => handleDragStartEmployee(e, emp)}
                  >
                    <div className="profile-card-top">
                      <div className="profile-avatar">{initials}</div>
                      <div className="profile-meta">
                        <strong className="profile-name">{fullName}</strong>
                        <span className="profile-email">{emp.email}</span>
                      </div>
                      {emp.employeeId ? (
                        <span className="profile-empid-pill" title="Official Employee ID">{emp.employeeId}</span>
                      ) : (
                        <span className="profile-no-id-pill" title="No Employee ID assigned yet">No ID</span>
                      )}
                    </div>

                    <div className="profile-card-bottom">
                      <div className="profile-dept-role">
                        <span>{emp.department || 'General'}</span>
                        <small>{emp.designation || emp.role}</small>
                      </div>

                      <div className="profile-actions-row">
                        {emp.isAssigned ? (
                          <span className="assigned-status-badge assigned" title={`Mapped to: ${emp.assignedNodeTitle}`}>
                            ✓ {emp.assignedNodeTitle || 'Assigned'}
                          </span>
                        ) : (
                          <span className="assigned-status-badge unassigned">
                            Ready to Map
                          </span>
                        )}

                        <button
                          type="button"
                          className="profile-id-manage-btn"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenManageIdModal(emp);
                          }}
                          title="Generate or edit official employee ID"
                        >
                          <SparklesIcon size={11} /> {emp.employeeId ? 'Edit ID' : 'Gen ID'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* 1. Add Node Modal */}
      {isAddNodeModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsAddNodeModalOpen(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Position Node</h3>
              <button type="button" className="close-btn" onClick={() => setIsAddNodeModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateNode} className="modal-form">
              <div className="form-group">
                <label>Position / Node Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lead Frontend Engineer, QA Specialist"
                  value={newNodeTitle}
                  onChange={(e) => setNewNodeTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  placeholder="e.g. Engineering, Product, Operations"
                  value={newNodeDept}
                  onChange={(e) => setNewNodeDept(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Reporting Supervisor (Parent Node)</label>
                <select
                  value={targetParentId || ''}
                  onChange={(e) => setTargetParentId(e.target.value || null)}
                >
                  <option value="">(Select Parent Node - Root level if none)</option>
                  {treeNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.department}) {n.employee ? `— ${n.employee.firstName} ${n.employee.lastName}` : '— Vacant'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddNodeModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Position
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Node Modal */}
      {isEditNodeModalOpen && editingNode && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsEditNodeModalOpen(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Position Node</h3>
              <button type="button" className="close-btn" onClick={() => setIsEditNodeModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleUpdateNode} className="modal-form">
              <div className="form-group">
                <label>Position Title *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                />
              </div>
              {editingNode.parentId !== null && (
                <div className="form-group">
                  <label>Parent Node (Reporting Line)</label>
                  <select
                    value={editParentId}
                    onChange={(e) => setEditParentId(e.target.value)}
                  >
                    {treeNodes
                      .filter((n) => n.id !== editingNode.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title} ({n.department})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditNodeModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Assign Employee Modal (With Auto-Generate ID) */}
      {isAssignModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsAssignModalOpen(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign Activated Employee to Position</h3>
              <button type="button" className="close-btn" onClick={() => setIsAssignModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveAssignment} className="modal-form">
              <div className="form-group">
                <label>Select Activated Employee *</label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => {
                    const uId = e.target.value;
                    setSelectedUserId(uId);
                    const u = activeEmployees.find((emp) => emp._id === uId);
                    if (u && u.employeeId) {
                      setEmployeeCodeInput(u.employeeId);
                    } else {
                      setEmployeeCodeInput(generateNextEmployeeId('EMP'));
                    }
                  }}
                >
                  <option value="">-- Choose Employee --</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName} ({emp.email}) {emp.employeeId ? `[${emp.employeeId}]` : ''} {emp.isAssigned ? `[Assigned to: ${emp.assignedNodeTitle}]` : '[Unassigned]'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Official Employee ID / Code *</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs auto-gen-btn"
                    onClick={() => setEmployeeCodeInput(generateNextEmployeeId('EMP'))}
                    title="Generate next sequential employee code"
                  >
                    <SparklesIcon size={12} /> Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-001, EMP-002"
                  value={employeeCodeInput}
                  onChange={(e) => setEmployeeCodeInput(e.target.value)}
                />
                <small className="form-help-hint">
                  Admin-generated unique ID. Saved with employee profile and reporting tree.
                </small>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Merge Nodes Modal */}
      {isMergeModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsMergeModalOpen(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Merge Organizational Positions</h3>
              <button type="button" className="close-btn" onClick={() => setIsMergeModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleMergeNodes} className="modal-form">
              <p className="modal-info-note">
                Merging transfers all subordinates and assignments from the source position into the target position, then removes the source node.
              </p>
              <div className="form-group">
                <label>Source Position to Merge (will be removed) *</label>
                <select
                  required
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                >
                  <option value="">-- Select Source Position --</option>
                  {treeNodes.filter((n) => n.parentId !== null).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Target Position to Keep *</label>
                <select
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                >
                  <option value="">-- Select Target Position --</option>
                  {treeNodes.filter((n) => n.id !== mergeSourceId).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsMergeModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Merge Positions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Admin Employee ID Generator & Customizer Modal */}
      {isManageIdModalOpen && targetEmployeeForId && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsManageIdModalOpen(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate / Edit Employee ID</h3>
              <button type="button" className="close-btn" onClick={() => setIsManageIdModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSaveEmployeeId} className="modal-form">
              <div className="emp-id-preview-box">
                <div className="emp-preview-avatar">
                  {targetEmployeeForId.firstName ? targetEmployeeForId.firstName[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <strong>{targetEmployeeForId.firstName} {targetEmployeeForId.lastName}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{targetEmployeeForId.email}</div>
                  <div style={{ fontSize: '11px', color: 'var(--primary-color)', marginTop: '2px' }}>
                    {targetEmployeeForId.department} · {targetEmployeeForId.designation || targetEmployeeForId.role}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Official Employee ID *</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs auto-gen-btn"
                      onClick={() => setCustomEmployeeIdInput(generateNextEmployeeId('EMP'))}
                      title="Generate sequential EMP-xxx ID"
                    >
                      <SparklesIcon size={12} /> Auto-EMP
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs auto-gen-btn"
                      onClick={() => setCustomEmployeeIdInput(generateNextEmployeeId('ENG'))}
                      title="Generate sequential ENG-xxx ID"
                    >
                      ENG
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-001, EMP-002, ENG-003"
                  value={customEmployeeIdInput}
                  onChange={(e) => setCustomEmployeeIdInput(e.target.value)}
                />
                <small className="form-help-hint">
                  Admin-managed unique ID. This ID will appear across the organizational tree, tasks, and reports.
                </small>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsManageIdModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSavingId}>
                  {isSavingId ? 'Saving...' : 'Save Employee ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Delete Node Confirmation Modal */}
      {nodeToDelete && (
        <div className="modal-overlay animate-fade-in" onClick={() => setNodeToDelete(null)}>
          <div className="modal-card animate-scale-up" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                <TrashIcon size={18} /> Delete Position Node
              </h3>
              <button type="button" className="close-btn" onClick={() => setNodeToDelete(null)}>×</button>
            </div>
            <div className="modal-form">
              <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to delete position <strong>"{nodeToDelete.title}"</strong> ({nodeToDelete.department})?
              </p>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', color: '#ef4444' }}>
                Any subordinate positions reporting directly to this node will automatically be re-linked to its supervisor.
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setNodeToDelete(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={handleConfirmDeleteNode}>
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Unassign Employee Confirmation Modal */}
      {nodeToUnassign && (
        <div className="modal-overlay animate-fade-in" onClick={() => setNodeToUnassign(null)}>
          <div className="modal-card animate-scale-up" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UsersIcon size={18} /> Unassign Employee
              </h3>
              <button type="button" className="close-btn" onClick={() => setNodeToUnassign(null)}>×</button>
            </div>
            <div className="modal-form">
              <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to unassign <strong>{nodeToUnassign.name}</strong> from this position?
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                The position will become vacant and available for another active employee.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setNodeToUnassign(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleConfirmUnassign}>
                  Confirm Unassign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
