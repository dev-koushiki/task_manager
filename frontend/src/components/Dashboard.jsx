import { useState, useEffect } from 'react';
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  LogOutIcon,
  BuildingIcon,
  BriefcaseIcon,
  CalendarIcon,
  SparklesIcon,
  UsersIcon,
  LayersIcon,
} from './Icons';
import { TaskModal } from './TaskModal';
import { AdminEmployeePanel } from './AdminEmployeePanel';
import { ThemeToggle } from './ThemeToggle';
import { api } from '../services/api';

export const Dashboard = ({ user, onLogout, theme, onToggleTheme, onTestAcceptInvite }) => {
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'team' | 'profile'
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'

  // Task modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    let ignore = false;
    const fetchTasks = async () => {
      try {
        const data = await api.getTasks();
        if (!ignore) {
          setTasks(data);
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchTasks();
    return () => {
      ignore = true;
    };
  }, []);

  const refreshTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateOrUpdateTask = async (taskData) => {
    try {
      if (editingTask) {
        await api.updateTask(editingTask._id, taskData);
      } else {
        await api.createTask(taskData);
      }
      setIsModalOpen(false);
      setEditingTask(null);
      refreshTasks();
    } catch (err) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(id);
      refreshTasks();
    } catch (err) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    try {
      await api.updateTask(task._id, { status: newStatus });
      refreshTasks();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.assignedTo && t.assignedTo.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  // Calculate metrics
  const totalTasks = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const urgentCount = tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;

  const userInitials =
    user && user.firstName && user.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : 'U';

  const columns = [
    { id: 'todo', title: 'To Do', color: 'badge-todo' },
    { id: 'in_progress', title: 'In Progress', color: 'badge-progress' },
    { id: 'review', title: 'Review', color: 'badge-review' },
    { id: 'completed', title: 'Completed', color: 'badge-completed' },
  ];

  return (
    <div className="dashboard-container">
      {/* Top Navbar */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-badge">
            <SparklesIcon size={20} className="text-accent" />
            <span className="logo-title">TaskFlow</span>
          </div>

          <nav className="nav-tabs">
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              <LayersIcon size={16} />
              <span>Tasks & Projects</span>
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              <UsersIcon size={16} />
              <span>{user?.role === 'admin' ? 'Admin Panel / Employees' : 'Team Directory'}</span>
            </button>
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <BriefcaseIcon size={16} />
              <span>My Profile</span>
            </button>
          </nav>
        </div>

        {/* User profile capsule & Logout */}
        <div className="header-right">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          <div className="user-profile-capsule">
            <div className="avatar-circle">{userInitials}</div>
            <div className="user-meta">
              <span className="user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <div className="user-subtags">
                <span className="subtag-pill">
                  <BuildingIcon size={12} /> {user?.companyName}
                </span>
                <span className="subtag-pill role-subtag">
                  🛡️ {user?.role ? user.role.toUpperCase() : 'ADMIN'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm logout-btn"
            onClick={onLogout}
            title="Log out"
          >
            <LogOutIcon size={16} />
            <span className="hide-on-mobile">Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {activeTab === 'team' && (
          <AdminEmployeePanel
            companyName={user?.companyName}
            onTestAcceptInvite={onTestAcceptInvite}
          />
        )}

        {activeTab === 'profile' && (
          <div className="profile-container animate-fade-in">
            <div className="profile-card">
              <div className="profile-header-banner">
                <div className="profile-avatar-lg">{userInitials}</div>
              </div>
              <div className="profile-body">
                <h2>
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="profile-mail">{user?.email}</p>

                <div className="profile-info-grid">
                  <div className="info-box">
                    <span className="info-label">Company</span>
                    <span className="info-val">
                      <BuildingIcon size={16} /> {user?.companyName}
                    </span>
                  </div>
                  <div className="info-box">
                    <span className="info-label">Designation</span>
                    <span className="info-val">
                      <BriefcaseIcon size={16} /> {user?.designation}
                    </span>
                  </div>
                  <div className="info-box">
                    <span className="info-label">Assigned Workspace</span>
                    <span className="info-val">Enterprise Task Board</span>
                  </div>
                  <div className="info-box">
                    <span className="info-label">Account Status</span>
                    <span className="status-badge-active">● Active Member</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <>
            {/* KPI Metric Summary Bar */}
            <div className="metrics-grid">
              <div className="metric-card animate-scale-up">
                <div className="metric-info">
                  <span className="metric-title">Total Tasks</span>
                  <span className="metric-number">{totalTasks}</span>
                </div>
                <div className="metric-badge bg-blue-subtle">All Active</div>
              </div>

              <div className="metric-card animate-scale-up delay-1">
                <div className="metric-info">
                  <span className="metric-title">In Progress</span>
                  <span className="metric-number text-accent">{inProgressCount}</span>
                </div>
                <div className="metric-badge bg-purple-subtle">Working</div>
              </div>

              <div className="metric-card animate-scale-up delay-2">
                <div className="metric-info">
                  <span className="metric-title">Completed</span>
                  <span className="metric-number text-success">{completedCount}</span>
                </div>
                <div className="metric-badge bg-emerald-subtle">Done</div>
              </div>

              <div className="metric-card animate-scale-up delay-3">
                <div className="metric-info">
                  <span className="metric-title">Urgent / High</span>
                  <span className="metric-number text-danger">{urgentCount}</span>
                </div>
                <div className="metric-badge bg-red-subtle">Priority</div>
              </div>
            </div>

            {/* Filter and Control Bar */}
            <div className="control-bar">
              <div className="search-input-wrapper">
                <SearchIcon size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search tasks by title, description, assignee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filter-controls">
                <div className="select-wrapper">
                  <label htmlFor="pFilter">Priority:</label>
                  <select
                    id="pFilter"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="view-toggle">
                  <button
                    type="button"
                    className={`toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                    onClick={() => setViewMode('kanban')}
                    title="Kanban Board View"
                  >
                    Kanban
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List Table View"
                  >
                    List
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingTask(null);
                    setIsModalOpen(true);
                  }}
                >
                  <PlusIcon size={18} />
                  <span>New Task</span>
                </button>
              </div>
            </div>

            {/* Loading indicator */}
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading your tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="empty-state animate-fade-in">
                <SparklesIcon size={40} className="empty-icon text-accent" />
                <h3>No tasks found</h3>
                <p>
                  {searchQuery || priorityFilter !== 'all'
                    ? 'Try clearing your search or priority filter.'
                    : 'Start organizing your workflow by creating your first task!'}
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingTask(null);
                    setIsModalOpen(true);
                  }}
                >
                  <PlusIcon size={18} />
                  <span>Create First Task</span>
                </button>
              </div>
            ) : viewMode === 'kanban' ? (
              /* Kanban View */
              <div className="kanban-board">
                {columns.map((col) => {
                  const colTasks = filteredTasks.filter((t) => t.status === col.id);
                  return (
                    <div key={col.id} className="kanban-column">
                      <div className="column-header">
                        <div className="col-title-wrap">
                          <span className={`col-indicator ${col.color}`}></span>
                          <h4>{col.title}</h4>
                        </div>
                        <span className="col-count">{colTasks.length}</span>
                      </div>

                      <div className="column-body">
                        {colTasks.map((task) => (
                          <div key={task._id} className="task-card animate-slide-up">
                            <div className="task-card-top">
                              <span className={`priority-tag priority-${task.priority}`}>
                                {task.priority}
                              </span>
                              <div className="task-actions">
                                <button
                                  type="button"
                                  className="action-icon-btn"
                                  onClick={() => {
                                    setEditingTask(task);
                                    setIsModalOpen(true);
                                  }}
                                  title="Edit Task"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  className="action-icon-btn danger"
                                  onClick={() => handleDeleteTask(task._id)}
                                  title="Delete Task"
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </div>
                            </div>

                            <h4 className="task-title">{task.title}</h4>
                            {task.description && (
                              <p className="task-desc">{task.description}</p>
                            )}

                            <div className="task-footer">
                              {task.dueDate && (
                                <span className="task-meta">
                                  <CalendarIcon size={13} /> {task.dueDate}
                                </span>
                              )}
                              {task.assignedTo && (
                                <span className="task-meta assignee">
                                  👤 {task.assignedTo}
                                </span>
                              )}
                            </div>

                            {/* Move status select */}
                            <div className="status-quick-change">
                              <label>Status:</label>
                              <select
                                value={task.status}
                                onChange={(e) => handleStatusChange(task, e.target.value)}
                              >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="review">Review</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List Table View */
              <div className="table-wrapper animate-fade-in">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th>Title & Description</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Due Date</th>
                      <th>Assigned To</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr key={task._id}>
                        <td>
                          <strong>{task.title}</strong>
                          {task.description && (
                            <p className="table-desc">{task.description}</p>
                          )}
                        </td>
                        <td>
                          <select
                            className="table-status-select"
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td>
                          <span className={`priority-tag priority-${task.priority}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td>{task.dueDate || '—'}</td>
                        <td>{task.assignedTo || 'Unassigned'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setEditingTask(task);
                              setIsModalOpen(true);
                            }}
                            style={{ marginRight: '6px' }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteTask(task._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* Task Creation / Edit Modal */}
      {isModalOpen && (
        <TaskModal
          key={editingTask ? editingTask._id : 'new_task'}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
          }}
          onSave={handleCreateOrUpdateTask}
          editingTask={editingTask}
        />
      )}
    </div>
  );
};
