const API_BASE_URL = 'http://localhost:5000/api';

// Helper to get auth header
const getHeaders = () => {
  const token = localStorage.getItem('tm_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Safe JSON fetch wrapper that detects offline / non-JSON responses cleanly
const safeFetchJson = async (url, options = {}) => {
  let response;
  try {
    response = await fetch(url, options);
  } catch (netErr) {
    throw new Error('OFFLINE_NETWORK_ERROR', { cause: netErr });
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('OFFLINE_NON_JSON_RESPONSE');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
};

const isOfflineError = (err) => {
  if (!err) return false;
  const msg = err.message || '';
  return (
    msg === 'OFFLINE_NETWORK_ERROR' ||
    msg === 'OFFLINE_NON_JSON_RESPONSE' ||
    msg.includes('Unexpected token') ||
    msg.includes('is not valid JSON') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed')
  );
};

const DEFAULT_DEPARTMENTS = [
  'Leadership & Administration',
  'Project Management Office',
  'Software Engineering',
  'Product Design & UI/UX',
  'Quality Assurance & Testing',
  'Operations & Infrastructure',
  'Finance & Human Resources',
];

const DEFAULT_ROLES = [
  { id: 'director', title: 'Project Director', description: 'Oversees project progress, breaks down tasks, and reports to Head of Office' },
  { id: 'manager', title: 'Manager / Team Leader', description: 'Assigns tasks to subordinates, tracks team progress, and approves work' },
  { id: 'employee', title: 'Junior / Employee', description: 'Executes assigned tasks, updates progress percentage, and submits work' },
];

// Helper: Calculate progress and overdue metrics from tasks
export const calculateProjectMetrics = (tasks = [], projectDeadline = '') => {
  const totalTasks = tasks.length;
  if (totalTasks === 0) {
    return {
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      progressPercentage: 0,
      calculatedStatus: 'not-started',
    };
  }

  const today = new Date().toISOString().split('T')[0];
  let totalWeight = 0;
  let weightedProgressSum = 0;
  let completedCount = 0;
  let overdueCount = 0;

  for (const t of tasks) {
    const weight = Number(t.weight) || 1;
    totalWeight += weight;

    // A task is only 100% complete if status is 'completed'
    const prog = t.status === 'completed' ? 100 : Number(t.progress) || 0;
    weightedProgressSum += weight * prog;

    if (t.status === 'completed') {
      completedCount++;
    }

    const taskDeadline = t.deadline || t.dueDate;
    if (taskDeadline && taskDeadline < today && t.status !== 'completed') {
      overdueCount++;
    }
  }

  const progressPercentage = totalWeight > 0 ? Math.round(weightedProgressSum / totalWeight) : 0;

  let calculatedStatus = 'on-track';
  if (completedCount === totalTasks) {
    calculatedStatus = 'completed';
  } else if (overdueCount > 0 || (projectDeadline && projectDeadline < today && progressPercentage < 100)) {
    calculatedStatus = 'delayed';
  } else if (progressPercentage === 0) {
    calculatedStatus = 'not-started';
  }

  return {
    totalTasks,
    completedTasks: completedCount,
    overdueTasks: overdueCount,
    progressPercentage,
    calculatedStatus,
  };
};

export const api = {
  // Department Management
  getDepartments() {
    try {
      const stored = localStorage.getItem('tm_departments');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    localStorage.setItem('tm_departments', JSON.stringify(DEFAULT_DEPARTMENTS));
    return DEFAULT_DEPARTMENTS;
  },

  addDepartment(name) {
    const trimmed = name.trim();
    if (!trimmed) return this.getDepartments();
    const current = this.getDepartments();
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      localStorage.setItem('tm_departments', JSON.stringify(updated));
      return updated;
    }
    return current;
  },

  deleteDepartment(name) {
    const current = this.getDepartments();
    const updated = current.filter((d) => d !== name);
    localStorage.setItem('tm_departments', JSON.stringify(updated));
    return updated;
  },

  // Role Management
  getRoles() {
    try {
      const stored = localStorage.getItem('tm_roles');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    localStorage.setItem('tm_roles', JSON.stringify(DEFAULT_ROLES));
    return DEFAULT_ROLES;
  },

  addRole(roleData) {
    const title = typeof roleData === 'string' ? roleData.trim() : roleData.title.trim();
    if (!title) return this.getRoles();
    const id = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const description = typeof roleData === 'object' && roleData.description
      ? roleData.description
      : 'Custom reporting role';

    const current = this.getRoles();
    if (!current.some((r) => r.id === id)) {
      const updated = [...current, { id, title, description }];
      localStorage.setItem('tm_roles', JSON.stringify(updated));
      return updated;
    }
    return current;
  },

  deleteRole(roleId) {
    if (['director', 'manager', 'employee'].includes(roleId)) return this.getRoles();
    const current = this.getRoles();
    const updated = current.filter((r) => r.id !== roleId);
    localStorage.setItem('tm_roles', JSON.stringify(updated));
    return updated;
  },

  // Auth: Register (Initial Workspace Admin Registration)
  async register(data) {
    try {
      const result = await safeFetchJson(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (result.token) {
        localStorage.setItem('tm_token', result.token);
        localStorage.setItem('tm_user', JSON.stringify(result.user));
      }
      return result;
    } catch (err) {
      if (isOfflineError(err)) {
        console.warn('Backend not reachable, simulating registration in local storage.');
        const mockUser = {
          id: 'user_' + Date.now(),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          companyName: data.companyName,
          designation: data.designation,
          role: 'admin',
          status: 'active',
          department: 'Leadership & Administration',
        };
        const mockToken = 'mock_jwt_token_' + Date.now();
        localStorage.setItem('tm_token', mockToken);
        localStorage.setItem('tm_user', JSON.stringify(mockUser));
        localStorage.setItem(`pwd_${data.email}`, data.password);
        return {
          message: 'Admin workspace account created successfully! (Offline mode)',
          token: mockToken,
          user: mockUser,
        };
      }
      throw err;
    }
  },

  // Auth: Login
  async login(credentials) {
    try {
      const result = await safeFetchJson(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (result.requireMfa) {
        return result;
      }

      if (result.token) {
        localStorage.setItem('tm_token', result.token);
        localStorage.setItem('tm_user', JSON.stringify(result.user));
      }
      return result;
    } catch (err) {
      if (isOfflineError(err)) {
        console.warn('Backend not reachable, checking local storage for login.');
        const storedUser = localStorage.getItem('tm_user');
        const storedPwd = localStorage.getItem(`pwd_${credentials.email}`);

        if (storedUser) {
          const userObj = JSON.parse(storedUser);
          if (userObj.email.toLowerCase() === credentials.email.toLowerCase()) {
            if (userObj.status === 'disabled') {
              throw new Error('This account has been disabled by the administrator.', { cause: err });
            }
            if (storedPwd && storedPwd !== credentials.password) {
              throw new Error('Invalid email or password.', { cause: err });
            }
            if (userObj.mfaEnabled) {
              return {
                requireMfa: true,
                email: userObj.email,
                message: 'Multi-factor authentication required.',
              };
            }
            const mockToken = 'mock_jwt_token_' + Date.now();
            localStorage.setItem('tm_token', mockToken);
            return {
              message: 'Login successful! (Offline mode)',
              token: mockToken,
              user: userObj,
            };
          }
        }
        throw new Error('User not found. Please register first.', { cause: err });
      }
      throw err;
    }
  },

  // Auth: Verify MFA
  async verifyMfa(email, code) {
    try {
      const result = await safeFetchJson(`${API_BASE_URL}/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (result.token) {
        localStorage.setItem('tm_token', result.token);
        localStorage.setItem('tm_user', JSON.stringify(result.user));
      }
      return result;
    } catch (err) {
      if (isOfflineError(err)) {
        if (!/^\d{6}$/.test(code)) {
          throw new Error('Verification code must be exactly 6 digits.', { cause: err });
        }
        const storedUser = localStorage.getItem('tm_user');
        const userObj = storedUser ? JSON.parse(storedUser) : { email, role: 'employee' };
        const mockToken = 'mock_jwt_token_' + Date.now();
        localStorage.setItem('tm_token', mockToken);
        return {
          message: 'MFA verified successfully! (Offline mode)',
          token: mockToken,
          user: userObj,
        };
      }
      throw err;
    }
  },

  // Auth: Get invite details
  async getInviteDetails(inviteToken) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/auth/invite-details/${inviteToken}`);
      return data;
    } catch (err) {
      const localInvites = localStorage.getItem('tm_invitations');
      if (localInvites) {
        const invites = JSON.parse(localInvites);
        const inv = invites.find((i) => i.inviteToken === inviteToken && i.status === 'pending');
        if (inv) {
          if (new Date(inv.expiresAt) < new Date()) {
            throw new Error('This invitation link has expired. Please contact your administrator.', { cause: err });
          }
          return inv;
        }
      }
      throw new Error('This invitation link is invalid or has expired.', { cause: err });
    }
  },

  // Auth: Accept invitation & set password
  async acceptInvite(payload) {
    try {
      const result = await safeFetchJson(`${API_BASE_URL}/auth/register/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (result.token) {
        localStorage.setItem('tm_token', result.token);
        localStorage.setItem('tm_user', JSON.stringify(result.user));
      }
      return result;
    } catch (err) {
      if (isOfflineError(err)) {
        const localInvites = localStorage.getItem('tm_invitations');
        let invites = localInvites ? JSON.parse(localInvites) : [];
        const inv = invites.find((i) => i.inviteToken === payload.inviteToken);
        if (!inv || inv.status !== 'pending') {
          throw new Error('Invitation is invalid or already used.', { cause: err });
        }

        inv.status = 'accepted';
        localStorage.setItem('tm_invitations', JSON.stringify(invites));

        const nameParts = inv.name.trim().split(' ');
        const newUser = {
          id: 'user_' + Date.now(),
          firstName: nameParts[0] || inv.name,
          lastName: nameParts.slice(1).join(' ') || 'Member',
          email: inv.email,
          companyName: inv.companyName || 'Workspace',
          designation: `${inv.department} ${inv.role.replace(/_/g, ' ')}`,
          department: inv.department,
          role: inv.role,
          status: 'active',
          mfaEnabled: Boolean(payload.mfaEnabled),
        };

        const mockToken = 'mock_jwt_token_' + Date.now();
        localStorage.setItem('tm_token', mockToken);
        localStorage.setItem('tm_user', JSON.stringify(newUser));
        localStorage.setItem(`pwd_${inv.email}`, payload.password);

        const localEmps = localStorage.getItem('tm_admin_employees');
        const emps = localEmps ? JSON.parse(localEmps) : [];
        emps.push(newUser);
        localStorage.setItem('tm_admin_employees', JSON.stringify(emps));

        return {
          message: 'Employee account activated successfully! (Offline mode)',
          token: mockToken,
          user: newUser,
        };
      }
      throw err;
    }
  },

  // Admin: Invite Employee (POST /api/admin/employees/invite)
  async inviteEmployee(inviteData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/employees/invite`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(inviteData),
      });
      return data;
    } catch (err) {
      if (isOfflineError(err)) {
        const rawToken = 'inv_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const storedUser = localStorage.getItem('tm_user');
        const currentUser = storedUser ? JSON.parse(storedUser) : {};

        const newInvite = {
          _id: 'inv_id_' + Date.now(),
          name: inviteData.name,
          email: inviteData.email,
          department: inviteData.department,
          role: inviteData.role,
          companyName: currentUser.companyName || 'Company Workspace',
          inviteToken: rawToken,
          status: 'pending',
          expiresAt,
          createdAt: new Date().toISOString(),
        };

        const localInvites = localStorage.getItem('tm_invitations');
        const invites = localInvites ? JSON.parse(localInvites) : [];
        invites.unshift(newInvite);
        localStorage.setItem('tm_invitations', JSON.stringify(invites));

        return {
          message: 'Secure invitation generated successfully.',
          invitation: newInvite,
          inviteToken: rawToken,
        };
      }
      throw err;
    }
  },

  // Admin: Get all employees & pending invitations
  async getAdminEmployees() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/employees`, {
        headers: getHeaders(),
      });
      return data;
    } catch {
      const localEmps = localStorage.getItem('tm_admin_employees');
      const localInvites = localStorage.getItem('tm_invitations');

      const currentUser = api.getUser();
      let employees = localEmps ? JSON.parse(localEmps) : [];
      if (currentUser && !employees.find((e) => e.email === currentUser.email)) {
        employees.unshift(currentUser);
      }

      const pendingInvitations = localInvites
        ? JSON.parse(localInvites).filter((i) => i.status === 'pending')
        : [];

      return {
        employees,
        pendingInvitations,
      };
    }
  },

  // Admin: Update Employee
  async updateEmployee(id, updateData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/employees/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
      });
      return data.employee;
    } catch {
      const localEmps = localStorage.getItem('tm_admin_employees');
      let employees = localEmps ? JSON.parse(localEmps) : [];
      employees = employees.map((e) => (e._id === id || e.id === id ? { ...e, ...updateData } : e));
      localStorage.setItem('tm_admin_employees', JSON.stringify(employees));
      return employees.find((e) => e._id === id || e.id === id);
    }
  },

  // Admin: Toggle Employee Account Status
  async toggleEmployeeStatus(id) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/employees/${id}/disable`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return data;
    } catch {
      const localEmps = localStorage.getItem('tm_admin_employees');
      let employees = localEmps ? JSON.parse(localEmps) : [];
      let updatedStatus = 'active';
      employees = employees.map((e) => {
        if (e._id === id || e.id === id) {
          updatedStatus = e.status === 'active' ? 'disabled' : 'active';
          return { ...e, status: updatedStatus };
        }
        return e;
      });
      localStorage.setItem('tm_admin_employees', JSON.stringify(employees));
      return { status: updatedStatus };
    }
  },

  // ==========================================
  // HIERARCHICAL PROJECT MANAGEMENT APIS
  // ==========================================

  // GET /api/projects
  async getProjects() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/projects`, {
        headers: getHeaders(),
      });
      return Array.isArray(data) ? data : [];
    } catch {
      const local = localStorage.getItem('tm_projects');
      const projects = local ? JSON.parse(local) : [];
      const allTasks = await this.getTasks();

      // Recalculate metrics locally
      return projects.map((p) => {
        const projectTasks = allTasks.filter((t) => t.projectId === p._id || t.projectId === p.id);
        const metrics = calculateProjectMetrics(projectTasks, p.deadline);
        return {
          ...p,
          metrics,
        };
      });
    }
  },

  // POST /api/projects - Admin creates project
  async createProject(projectData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(projectData),
      });
      return data.project;
    } catch {
      const local = localStorage.getItem('tm_projects');
      const projects = local ? JSON.parse(local) : [];
      const newProject = {
        _id: 'proj_' + Date.now(),
        ...projectData,
        status: 'not-started',
        createdAt: new Date().toISOString(),
        metrics: {
          totalTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          progressPercentage: 0,
          calculatedStatus: 'not-started',
        },
      };
      projects.unshift(newProject);
      localStorage.setItem('tm_projects', JSON.stringify(projects));
      return newProject;
    }
  },

  // GET /api/projects/:id
  async getProjectDetails(id) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/projects/${id}`, {
        headers: getHeaders(),
      });
      return data;
    } catch {
      const projects = await this.getProjects();
      const project = projects.find((p) => p._id === id || p.id === id);
      const allTasks = await this.getTasks();
      const tasks = allTasks.filter((t) => t.projectId === id);
      return { project, tasks };
    }
  },

  // PUT /api/projects/:id
  async updateProject(id, updateData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/projects/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
      });
      return data.project;
    } catch {
      const local = localStorage.getItem('tm_projects');
      let projects = local ? JSON.parse(local) : [];
      projects = projects.map((p) => (p._id === id || p.id === id ? { ...p, ...updateData } : p));
      localStorage.setItem('tm_projects', JSON.stringify(projects));
      return projects.find((p) => p._id === id || p.id === id);
    }
  },

  // DELETE /api/projects/:id
  async deleteProject(id) {
    try {
      await safeFetchJson(`${API_BASE_URL}/projects/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return true;
    } catch {
      const local = localStorage.getItem('tm_projects');
      if (local) {
        const projects = JSON.parse(local).filter((p) => p._id !== id && p.id !== id);
        localStorage.setItem('tm_projects', JSON.stringify(projects));
      }
      return true;
    }
  },

  // ==========================================
  // HIERARCHICAL TASK MANAGEMENT APIS
  // ==========================================

  // GET /api/tasks
  async getTasks() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/tasks`, {
        headers: getHeaders(),
      });
      return Array.isArray(data) ? data : [];
    } catch {
      const local = localStorage.getItem('tm_tasks');
      if (local) {
        try {
          return JSON.parse(local);
        } catch {
          return [];
        }
      }
      return [];
    }
  },

  // POST /api/tasks - Create task or subtask
  async createTask(taskData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(taskData),
      });
      return data.task;
    } catch {
      const local = localStorage.getItem('tm_tasks');
      const tasks = local ? JSON.parse(local) : [];
      const newTask = {
        _id: 'task_' + Date.now(),
        ...taskData,
        progress: taskData.status === 'completed' ? 100 : Number(taskData.progress) || 0,
        weight: Number(taskData.weight) || 1,
        status: taskData.status || 'not-started',
        createdAt: new Date().toISOString(),
      };
      tasks.unshift(newTask);
      localStorage.setItem('tm_tasks', JSON.stringify(tasks));
      return newTask;
    }
  },

  // PATCH /api/tasks/:id/progress - Employee progress update
  async updateTaskProgress(id, progressData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/tasks/${id}/progress`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(progressData),
      });
      return data.task;
    } catch {
      const local = localStorage.getItem('tm_tasks');
      let tasks = local ? JSON.parse(local) : [];
      tasks = tasks.map((t) => {
        if (t._id === id || t.id === id) {
          const updated = { ...t, ...progressData };
          if (updated.progress === 100 && updated.status === 'in-progress') {
            updated.status = 'submitted';
          }
          return updated;
        }
        return t;
      });
      localStorage.setItem('tm_tasks', JSON.stringify(tasks));
      return tasks.find((t) => t._id === id || t.id === id);
    }
  },

  // POST /api/tasks/:id/submit - Employee submit for review
  async submitTaskForReview(id, submissionNotes = '') {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/tasks/${id}/submit`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ submissionNotes }),
      });
      return data.task;
    } catch {
      return this.updateTask(id, {
        status: 'submitted',
        progress: 100,
        submissionNotes,
      });
    }
  },

  // POST /api/tasks/:id/review - Supervisor approves or requests changes
  async reviewTask(id, decision, feedback = '') {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/tasks/${id}/review`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ decision, feedback }),
      });
      return data.task;
    } catch {
      const isApproved = decision === 'approved';
      return this.updateTask(id, {
        status: isApproved ? 'completed' : 'in-progress',
        progress: isApproved ? 100 : 75,
        reviewFeedback: feedback || (isApproved ? 'Approved by supervisor' : 'Changes requested'),
        reviewedAt: new Date().toISOString(),
      });
    }
  },

  // PUT /api/tasks/:id - General update
  async updateTask(id, updateData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updateData),
      });
      return data.task;
    } catch {
      const local = localStorage.getItem('tm_tasks');
      let tasks = local ? JSON.parse(local) : [];
      tasks = tasks.map((t) => (t._id === id || t.id === id ? { ...t, ...updateData } : t));
      localStorage.setItem('tm_tasks', JSON.stringify(tasks));
      return tasks.find((t) => t._id === id || t.id === id);
    }
  },

  // DELETE /api/tasks/:id
  async deleteTask(id) {
    try {
      await safeFetchJson(`${API_BASE_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return true;
    } catch {
      const local = localStorage.getItem('tm_tasks');
      if (local) {
        const tasks = JSON.parse(local).filter((t) => t._id !== id && t.id !== id && t.parentTaskId !== id);
        localStorage.setItem('tm_tasks', JSON.stringify(tasks));
      }
      return true;
    }
  },

  // ==========================================
  // HEAD OF OFFICE & HIERARCHY APIS
  // ==========================================

  // GET /api/admin/summary
  async getAdminSummary() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/summary`, {
        headers: getHeaders(),
      });
      return data;
    } catch {
      const projects = await this.getProjects();
      const allTasks = await this.getTasks();

      let totalProgressSum = 0;
      let onTrackCount = 0;
      let delayedCount = 0;
      let completedProjectsCount = 0;

      const projectSummaries = projects.map((p) => {
        const pTasks = allTasks.filter((t) => t.projectId === p._id || t.projectId === p.id);
        const metrics = calculateProjectMetrics(pTasks, p.deadline);
        totalProgressSum += metrics.progressPercentage;

        if (metrics.calculatedStatus === 'completed') completedProjectsCount++;
        else if (metrics.calculatedStatus === 'delayed') delayedCount++;
        else onTrackCount++;

        return {
          id: p._id || p.id,
          name: p.name,
          targetOutcome: p.targetOutcome || 'Achieve project objectives',
          directorName: p.directorName || 'Assigned Director',
          deadline: p.deadline,
          status: metrics.calculatedStatus,
          progressPercentage: metrics.progressPercentage,
          completedTasks: metrics.completedTasks,
          totalTasks: metrics.totalTasks,
          overdueTasks: metrics.overdueTasks,
        };
      });

      const averageProgress = projects.length > 0 ? Math.round(totalProgressSum / projects.length) : 0;

      return {
        totalProjects: projects.length,
        averageProgress,
        onTrackProjects: onTrackCount,
        delayedProjects: delayedCount,
        completedProjects: completedProjectsCount,
        projectSummaries,
      };
    }
  },

  // GET /api/admin/hierarchy
  async getHierarchy() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/hierarchy`, {
        headers: getHeaders(),
      });
      return Array.isArray(data) ? data : [];
    } catch {
      const adminData = await this.getAdminEmployees();
      return adminData.employees || [];
    }
  },

  // PATCH /api/admin/hierarchy/assign-supervisor
  async assignSupervisor(employeeId, supervisorId) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/hierarchy/assign-supervisor`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ employeeId, supervisorId }),
      });
      return data;
    } catch {
      return this.updateEmployee(employeeId, { reportsTo: supervisorId || null });
    }
  },

  // GET /api/admin/directors
  async getEligibleDirectors() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/directors`, {
        headers: getHeaders(),
      });
      return Array.isArray(data) ? data : [];
    } catch {
      const adminData = await this.getAdminEmployees();
      return (adminData.employees || []).filter((e) =>
        ['admin', 'director', 'manager'].includes(e.role) || (e.hierarchyLevel && e.hierarchyLevel <= 2)
      );
    }
  },

  // ==========================================
  // DYNAMIC ORGANIZATION & PERMISSION APIS
  // ==========================================

  // GET /api/organization
  async getOrganization() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization`, {
        headers: getHeaders(),
      });
      if (data) {
        localStorage.setItem('tm_organization', JSON.stringify(data));
      }
      return data;
    } catch {
      const local = localStorage.getItem('tm_organization');
      if (local) {
        try {
          return JSON.parse(local);
        } catch {
          // fallback
        }
      }
      const user = this.getUser();
      const defaultOrg = {
        name: user?.companyName || 'Company Workspace',
        departments: [
          'Executive Leadership',
          'Project Management Office',
          'Engineering & Technology',
          'Product & Design',
          'Operations & Quality',
          'Human Resources & Finance',
        ],
        levels: [
          { level: 1, name: 'Executive / Leadership', description: 'Strategic oversight and organization-wide KPIs' },
          { level: 2, name: 'Department Heads / Directors', description: 'Project milestone planning and departmental governance' },
          { level: 3, name: 'Managers & Team Leads', description: 'Task delegation, blocker resolution, and quality approval' },
          { level: 4, name: 'Specialists & Contributors', description: 'Operational task execution and deliverable submissions' },
        ],
        positions: [
          {
            id: 'pos_1',
            title: 'Chief Executive / Head of Office',
            level: 1,
            department: 'Executive Leadership',
            permissions: {
              canCreateProjects: true,
              canAssignTasks: true,
              canApproveWork: true,
              canViewExecutiveSummary: true,
              canViewTeamTasks: true,
              canViewAllTasks: true,
              canManageStructure: true,
            },
          },
          {
            id: 'pos_2',
            title: 'Project Director',
            level: 2,
            department: 'Project Management Office',
            permissions: {
              canCreateProjects: true,
              canAssignTasks: true,
              canApproveWork: true,
              canViewExecutiveSummary: true,
              canViewTeamTasks: true,
              canViewAllTasks: false,
              canManageStructure: false,
            },
          },
          {
            id: 'pos_3',
            title: 'Team Leader / Manager',
            level: 3,
            department: 'Engineering & Technology',
            permissions: {
              canCreateProjects: false,
              canAssignTasks: true,
              canApproveWork: true,
              canViewExecutiveSummary: false,
              canViewTeamTasks: true,
              canViewAllTasks: false,
              canManageStructure: false,
            },
          },
          {
            id: 'pos_4',
            title: 'Specialist / Employee',
            level: 4,
            department: 'Engineering & Technology',
            permissions: {
              canCreateProjects: false,
              canAssignTasks: false,
              canApproveWork: false,
              canViewExecutiveSummary: false,
              canViewTeamTasks: false,
              canViewAllTasks: false,
              canManageStructure: false,
            },
          },
        ],
      };
      localStorage.setItem('tm_organization', JSON.stringify(defaultOrg));
      return defaultOrg;
    }
  },

  // PUT /api/organization
  async updateOrganization(orgData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(orgData),
      });
      return data.organization;
    } catch {
      const org = await this.getOrganization();
      const updated = { ...org, ...orgData };
      localStorage.setItem('tm_organization', JSON.stringify(updated));
      return updated;
    }
  },

  // POST /api/organization/departments
  async addOrgDepartment(name) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/departments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name }),
      });
      if (Array.isArray(data.departments)) {
        localStorage.setItem('tm_departments', JSON.stringify(data.departments));
      }
      return data.departments;
    } catch {
      const org = await this.getOrganization();
      const depts = org.departments || [];
      if (!depts.includes(name)) {
        depts.push(name);
        org.departments = depts;
        localStorage.setItem('tm_organization', JSON.stringify(org));
        localStorage.setItem('tm_departments', JSON.stringify(depts));
      }
      return depts;
    }
  },

  // DELETE /api/organization/departments/:name
  async deleteOrgDepartment(name) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/departments/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (Array.isArray(data.departments)) {
        localStorage.setItem('tm_departments', JSON.stringify(data.departments));
      }
      return data.departments;
    } catch {
      const org = await this.getOrganization();
      org.departments = (org.departments || []).filter((d) => d !== name);
      localStorage.setItem('tm_organization', JSON.stringify(org));
      localStorage.setItem('tm_departments', JSON.stringify(org.departments));
      return org.departments;
    }
  },

  // PUT /api/organization/levels
  async updateHierarchyLevels(levels) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/levels`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ levels }),
      });
      return data.levels;
    } catch {
      const org = await this.getOrganization();
      org.levels = levels;
      localStorage.setItem('tm_organization', JSON.stringify(org));
      return levels;
    }
  },

  // POST /api/organization/positions
  async createPosition(posData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/positions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(posData),
      });
      return data.position;
    } catch {
      const org = await this.getOrganization();
      const newPos = {
        id: 'pos_' + Date.now(),
        ...posData,
        level: Number(posData.level) || 4,
        permissions: posData.permissions || {},
      };
      org.positions = org.positions || [];
      org.positions.push(newPos);
      localStorage.setItem('tm_organization', JSON.stringify(org));
      return newPos;
    }
  },

  // PUT /api/organization/positions/:id
  async updatePosition(id, posData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/positions/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(posData),
      });
      return data.position;
    } catch {
      const org = await this.getOrganization();
      org.positions = (org.positions || []).map((p) => (p.id === id ? { ...p, ...posData } : p));
      localStorage.setItem('tm_organization', JSON.stringify(org));
      return org.positions.find((p) => p.id === id);
    }
  },

  // DELETE /api/organization/positions/:id
  async deletePosition(id) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/positions/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return data.positions;
    } catch {
      const org = await this.getOrganization();
      org.positions = (org.positions || []).filter((p) => p.id !== id);
      localStorage.setItem('tm_organization', JSON.stringify(org));
      return org.positions;
    }
  },

  // POST /api/organization/apply-template
  async applyOrganizationTemplate(templateType) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/apply-template`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ templateType }),
      });
      if (data.organization) {
        localStorage.setItem('tm_organization', JSON.stringify(data.organization));
      }
      return data.organization;
    } catch {
      let org = await this.getOrganization();
      if (templateType === 'tech_startup') {
        org.levels = [
          { level: 1, name: 'Founders & Executive', description: 'Strategic direction and company vision' },
          { level: 2, name: 'Engineering & Product Leads', description: 'Architecture, sprint milestones, and roadmaps' },
          { level: 3, name: 'Senior Engineers & Designers', description: 'Feature development and code/design reviews' },
          { level: 4, name: 'Associates & Interns', description: 'Sprint tickets and component execution' },
        ];
        org.departments = ['Product & Engineering', 'UI/UX Design', 'Growth & Marketing', 'Customer Success', 'Operations'];
        org.positions = [
          {
            id: 'pos_startup_1',
            title: 'Chief Technology Officer / Co-Founder',
            level: 1,
            department: 'Product & Engineering',
            permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: true, canManageStructure: true },
          },
          {
            id: 'pos_startup_2',
            title: 'Engineering Lead / Architect',
            level: 2,
            department: 'Product & Engineering',
            permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
          },
          {
            id: 'pos_startup_3',
            title: 'Senior Full-Stack Engineer',
            level: 3,
            department: 'Product & Engineering',
            permissions: { canCreateProjects: false, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: false, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
          },
          {
            id: 'pos_startup_4',
            title: 'Software Developer',
            level: 4,
            department: 'Product & Engineering',
            permissions: { canCreateProjects: false, canAssignTasks: false, canApproveWork: false, canViewExecutiveSummary: false, canViewTeamTasks: false, canViewAllTasks: false, canManageStructure: false },
          },
        ];
      } else if (templateType === 'academic') {
        org.levels = [
          { level: 1, name: 'Chancellor & Deans', description: 'Institution governance and institutional milestones' },
          { level: 2, name: 'Department Chairs', description: 'Curriculum oversight and department programs' },
          { level: 3, name: 'Principal Investigators / Professors', description: 'Research labs and course coordination' },
          { level: 4, name: 'Lecturers & Research Assistants', description: 'Course instruction and lab deliverables' },
        ];
        org.departments = ['Computer Science', 'Biological Sciences', 'Dean of Students', 'Research Administration', 'Finance & Grants'];
        org.positions = [
          {
            id: 'pos_acad_1',
            title: 'Dean of Faculty',
            level: 1,
            department: 'Dean of Students',
            permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: true, canManageStructure: true },
          },
          {
            id: 'pos_acad_2',
            title: 'Department Chair',
            level: 2,
            department: 'Computer Science',
            permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
          },
          {
            id: 'pos_acad_3',
            title: 'Principal Investigator / Professor',
            level: 3,
            department: 'Computer Science',
            permissions: { canCreateProjects: false, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: false, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
          },
          {
            id: 'pos_acad_4',
            title: 'Research Assistant',
            level: 4,
            department: 'Computer Science',
            permissions: { canCreateProjects: false, canAssignTasks: false, canApproveWork: false, canViewExecutiveSummary: false, canViewTeamTasks: false, canViewAllTasks: false, canManageStructure: false },
          },
        ];
      } else {
        org.levels = [
          { level: 1, name: 'Executive / C-Suite', description: 'Strategic direction and enterprise KPIs' },
          { level: 2, name: 'Vice Presidents & Directors', description: 'Business unit governance and major projects' },
          { level: 3, name: 'Managers & Team Leaders', description: 'Operational execution and quality review' },
          { level: 4, name: 'Specialists & Associates', description: 'Task fulfillment and delivery' },
        ];
        org.departments = ['Executive Leadership', 'Project Management Office', 'Information Technology', 'Sales & Marketing', 'Human Resources', 'Finance'];
        org.positions = [
          {
            id: 'pos_corp_1',
            title: 'Chief Executive Officer / General Manager',
            level: 1,
            department: 'Executive Leadership',
            permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: true, canManageStructure: true },
          },
          {
            id: 'pos_corp_2',
            title: 'Director of Operations',
            level: 2,
            department: 'Project Management Office',
            permissions: { canCreateProjects: true, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: true, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
          },
          {
            id: 'pos_corp_3',
            title: 'Operations Team Lead',
            level: 3,
            department: 'Operations',
            permissions: { canCreateProjects: false, canAssignTasks: true, canApproveWork: true, canViewExecutiveSummary: false, canViewTeamTasks: true, canViewAllTasks: false, canManageStructure: false },
          },
          {
            id: 'pos_corp_4',
            title: 'Operations Associate',
            level: 4,
            department: 'Operations',
            permissions: { canCreateProjects: false, canAssignTasks: false, canApproveWork: false, canViewExecutiveSummary: false, canViewTeamTasks: false, canViewAllTasks: false, canManageStructure: false },
          },
        ];
      }
      localStorage.setItem('tm_organization', JSON.stringify(org));
      return org;
    }
  },

  // Logout
  logout() {
    localStorage.removeItem('tm_token');
    localStorage.removeItem('tm_user');
  },

  // Get current logged in user from localStorage
  getUser() {
    try {
      const stored = localStorage.getItem('tm_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
};
