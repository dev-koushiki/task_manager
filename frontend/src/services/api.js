const getApiBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '0.0.0.0';

    if (!isLocalhost) {
      return `${window.location.origin}/api`;
    }
  }
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

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
      if (stored !== null) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return [];
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
      if (stored !== null) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return [];
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
          message: 'Admin Taskflow account created successfully! (Offline mode)',
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
      const inv = data.invitation || data;
      return { ...inv, invitation: inv };
    } catch (err) {
      // First check local storage fallback (for offline or recently created local invitations)
      const localInvites = localStorage.getItem('tm_invitations');
      if (localInvites) {
        try {
          const invites = JSON.parse(localInvites);
          const inv = invites.find((i) => i.inviteToken === inviteToken);
          if (inv) {
            if (inv.status === 'accepted') {
              throw new Error('This invitation has already been accepted. Please log in.');
            }
            if (inv.status === 'revoked') {
              throw new Error('This invitation was revoked or superseded by a newer link.');
            }
            if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
              throw new Error(`This invitation link expired on ${new Date(inv.expiresAt).toLocaleDateString()}. Please request your administrator to renew it.`);
            }
            return inv;
          }
        } catch (jsonErr) {
          if (jsonErr.message && !jsonErr.message.includes('JSON')) throw jsonErr;
        }
      }

      if (!isOfflineError(err)) {
        throw err;
      }

      throw new Error(
        'Unable to connect to the backend server. Please verify your internet connection or check with your taskflow administrator.'
      );
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
      // If server failed or offline, fall back to local storage invitation if present
      const localInvites = localStorage.getItem('tm_invitations');
      let invites = localInvites ? JSON.parse(localInvites) : [];
      const inv = invites.find((i) => i.inviteToken === payload.inviteToken);

      if (inv) {
        if (inv.status === 'accepted') {
          throw new Error('This invitation has already been used. Please log in.');
        }

        inv.status = 'accepted';
        localStorage.setItem('tm_invitations', JSON.stringify(invites));

        const nameParts = (inv.name || 'Employee').trim().split(' ');
        const newUser = {
          id: 'user_' + Date.now(),
          firstName: nameParts[0] || inv.name,
          lastName: nameParts.slice(1).join(' ') || 'Member',
          email: inv.email,
          companyName: inv.companyName || 'Taskflow',
          designation: `${inv.department} ${(inv.role || 'employee').replace(/_/g, ' ')}`,
          department: inv.department,
          role: inv.role || 'employee',
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
          message: 'Employee account activated successfully!',
          token: mockToken,
          user: newUser,
        };
      }

      if (!isOfflineError(err)) {
        throw err;
      }
      throw new Error('Invitation is invalid, expired, or already used.');
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
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const storedUser = localStorage.getItem('tm_user');
        const currentUser = storedUser ? JSON.parse(storedUser) : {};

        const newInvite = {
          _id: 'inv_id_' + Date.now(),
          name: inviteData.name,
          email: inviteData.email,
          department: inviteData.department,
          role: inviteData.role,
          companyName: currentUser.companyName || 'Company Taskflow',
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

  // POST /api/tasks/:id/review-comment - Post review comment sent to employee dashboard
  async addReviewComment(id, comment) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/tasks/${id}/review-comment`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ comment }),
      });
      return data;
    } catch (err) {
      const user = this.getUser();
      const commenterName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Reviewer';
      const newComment = {
        _id: `comment_${Date.now()}`,
        authorId: user?._id || user?.id,
        authorName: commenterName,
        authorRole: user?.role === 'admin' ? 'Administrator' : (user?.designation || 'Reviewer'),
        comment: comment.trim(),
        decision: 'comment',
        createdAt: new Date().toISOString(),
      };
      const local = localStorage.getItem('tm_tasks');
      let tasks = local ? JSON.parse(local) : [];
      let updatedTask = null;
      tasks = tasks.map((t) => {
        if (t._id === id || t.id === id) {
          const comments = Array.isArray(t.reviewComments) ? [...t.reviewComments, newComment] : [newComment];
          updatedTask = { ...t, reviewComments: comments, reviewFeedback: comment.trim() };
          return updatedTask;
        }
        return t;
      });
      localStorage.setItem('tm_tasks', JSON.stringify(tasks));
      return { message: 'Comment saved locally', task: updatedTask, comment: newComment };
    }
  },

  // GET /api/tasks/:id/reviews - Fetch review comments and history
  async getTaskReviews(id) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/tasks/${id}/reviews`, {
        headers: getHeaders(),
      });
      return data;
    } catch {
      const local = localStorage.getItem('tm_tasks');
      const tasks = local ? JSON.parse(local) : [];
      const found = tasks.find((t) => t._id === id || t.id === id);
      return {
        reviewComments: found?.reviewComments || [],
        reviews: [],
        reviewFeedback: found?.reviewFeedback || '',
      };
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
  async assignSupervisor(employeeId, supervisorId, relationshipType = 'direct') {
    const data = await safeFetchJson(`${API_BASE_URL}/admin/hierarchy/assign-supervisor`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ employeeId, supervisorId, relationshipType }),
    });
    return data;
  },

  // POST /api/admin/hierarchy/managers - Multiple managers with relationship types
  async updateEmployeeManagers(employeeId, relationships) {
    const data = await safeFetchJson(`${API_BASE_URL}/admin/hierarchy/managers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ employeeId, relationships }),
    });
    return data;
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
      if (data && typeof data === 'object') {
        localStorage.setItem('tm_organization', JSON.stringify(data));
        if (Array.isArray(data.departments)) {
          localStorage.setItem('tm_departments', JSON.stringify(data.departments));
        }
      }
      return data;
    } catch {
      const local = localStorage.getItem('tm_organization');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch {
          // fallback
        }
      }
      const user = this.getUser();
      const defaultOrg = {
        name: user?.companyName || 'Company Taskflow',
        departments: [],
        levels: [],
        positions: [],
        teams: [],
        relationshipTypes: [],
      };
      localStorage.setItem('tm_organization', JSON.stringify(defaultOrg));
      localStorage.setItem('tm_departments', JSON.stringify([]));
      return defaultOrg;
    }
  },

  // POST /api/organization/clear-hierarchy
  async clearHierarchy() {
    let orgData = null;
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/clear-hierarchy`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (data && data.organization) orgData = data.organization;
    } catch {
      // offline fallback
    }
    const org = orgData || (await this.getOrganization());
    org.levels = [];
    org.positions = [];
    localStorage.setItem('tm_organization', JSON.stringify(org));
    return org;
  },

  // POST /api/organization/clear-departments
  async clearDepartments() {
    try {
      await safeFetchJson(`${API_BASE_URL}/organization/clear-departments`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {
      // offline fallback
    }
    const org = await this.getOrganization();
    org.departments = [];
    localStorage.setItem('tm_departments', JSON.stringify([]));
    localStorage.setItem('tm_organization', JSON.stringify(org));
    return [];
  },

  // PUT /api/organization
  async updateOrganization(orgData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(orgData),
      });
      if (data.organization) {
        localStorage.setItem('tm_organization', JSON.stringify(data.organization));
        return data.organization;
      }
      return data;
    } catch (err) {
      if (isOfflineError(err)) {
        const org = await this.getOrganization();
        const updated = { ...org, ...orgData };
        localStorage.setItem('tm_organization', JSON.stringify(updated));
        return updated;
      }
      throw err;
    }
  },

  // POST /api/organization/departments
  async addOrgDepartment(name) {
    const trimmed = name ? name.trim() : '';
    if (!trimmed) {
      const org = await this.getOrganization();
      return org.departments || [];
    }
    let serverDepts = null;
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/departments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name: trimmed }),
      });
      if (Array.isArray(data.departments)) {
        serverDepts = data.departments;
      }
    } catch {
      // offline fallback
    }
    const org = await this.getOrganization();
    const depts = serverDepts !== null ? serverDepts : (Array.isArray(org.departments) ? org.departments : []);
    if (!depts.some((d) => d && d.trim().toLowerCase() === trimmed.toLowerCase())) {
      depts.push(trimmed);
    }
    org.departments = depts;
    localStorage.setItem('tm_departments', JSON.stringify(depts));
    localStorage.setItem('tm_organization', JSON.stringify(org));
    return depts;
  },

  // DELETE /api/organization/departments/:name
  async deleteOrgDepartment(name) {
    const trimmed = name ? name.trim() : '';
    let serverDepts = null;
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/departments/${encodeURIComponent(trimmed)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (Array.isArray(data.departments)) {
        serverDepts = data.departments;
      }
    } catch {
      // offline fallback
    }
    const org = await this.getOrganization();
    const target = trimmed.toLowerCase();
    const updated = serverDepts !== null
      ? serverDepts
      : (org.departments || []).filter((d) => d && d.trim().toLowerCase() !== target);
    org.departments = updated;
    localStorage.setItem('tm_departments', JSON.stringify(updated));
    localStorage.setItem('tm_organization', JSON.stringify(org));
    return updated;
  },

  // ======================== TEAMS ========================
  // GET /api/organization/teams
  async getTeams() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/teams`, {
        headers: getHeaders(),
      });
      return Array.isArray(data) ? data : [];
    } catch {
      const org = await this.getOrganization();
      return org?.teams || [];
    }
  },

  // POST /api/organization/teams
  async createTeam(teamData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/teams`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(teamData),
      });
      if (Array.isArray(data.teams)) {
        try {
          const org = JSON.parse(localStorage.getItem('tm_organization') || '{}');
          org.teams = data.teams;
          localStorage.setItem('tm_organization', JSON.stringify(org));
        } catch {}
      }
      return data;
    } catch (err) {
      if (isOfflineError(err)) {
        const org = await this.getOrganization();
        const newTeam = {
          id: 'team_' + Date.now(),
          ...teamData,
          department: teamData.department || (org.departments?.[0] || 'General'),
          memberIds: Array.isArray(teamData.memberIds) ? teamData.memberIds : [],
        };
        org.teams = org.teams || [];
        org.teams.push(newTeam);
        localStorage.setItem('tm_organization', JSON.stringify(org));
        return { message: 'Team created successfully (offline)', team: newTeam, teams: org.teams };
      }
      throw err;
    }
  },

  // PUT /api/organization/teams/:id
  async updateTeam(id, teamData) {
    const targetId = id.toString().trim();
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/teams/${encodeURIComponent(targetId)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(teamData),
      });
      if (Array.isArray(data.teams)) {
        try {
          const org = JSON.parse(localStorage.getItem('tm_organization') || '{}');
          org.teams = data.teams;
          localStorage.setItem('tm_organization', JSON.stringify(org));
        } catch {}
      }
      return data;
    } catch (err) {
      if (isOfflineError(err)) {
        const org = await this.getOrganization();
        org.teams = (org.teams || []).map((t) =>
          (t.id && t.id.toString() === targetId) || (t._id && t._id.toString() === targetId)
            ? { ...t, ...teamData }
            : t
        );
        localStorage.setItem('tm_organization', JSON.stringify(org));
        const updated = org.teams.find(
          (t) => (t.id && t.id.toString() === targetId) || (t._id && t._id.toString() === targetId)
        );
        return { message: 'Team updated successfully (offline)', team: updated, teams: org.teams };
      }
      throw err;
    }
  },

  // DELETE /api/organization/teams/:id
  async deleteTeam(id) {
    const targetId = id.toString().trim();
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/teams/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (Array.isArray(data.teams)) {
        try {
          const org = JSON.parse(localStorage.getItem('tm_organization') || '{}');
          org.teams = data.teams;
          localStorage.setItem('tm_organization', JSON.stringify(org));
        } catch {}
      }
      return data;
    } catch (err) {
      if (isOfflineError(err)) {
        const org = await this.getOrganization();
        org.teams = (org.teams || []).filter(
          (t) => (t.id && t.id.toString() !== targetId) && (!t._id || t._id.toString() !== targetId)
        );
        localStorage.setItem('tm_organization', JSON.stringify(org));
        return { message: 'Team removed successfully (offline)', teams: org.teams };
      }
      throw err;
    }
  },

  // GET /api/organization/relationship-types
  async getRelationshipTypes() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/relationship-types`, {
        headers: getHeaders(),
      });
      return Array.isArray(data) ? data : [];
    } catch {
      const org = await this.getOrganization();
      return org?.relationshipTypes || [];
    }
  },

  // POST /api/organization/relationship-types
  async addRelationshipType(relData) {
    let serverRelTypes = null;
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/relationship-types`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(relData),
      });
      if (Array.isArray(data.relationshipTypes)) {
        serverRelTypes = data.relationshipTypes;
      }
    } catch {
      // offline fallback
    }

    const org = await this.getOrganization();
    const key = (relData.id || relData.name.trim().toLowerCase().replace(/\s+/g, '_')).replace(/[^a-z0-9_]/g, '');
    let rels = serverRelTypes !== null ? serverRelTypes : (Array.isArray(org.relationshipTypes) ? org.relationshipTypes : []);
    if (!rels.some((r) => r.id === key)) {
      rels.push({
        id: key,
        name: relData.name.trim(),
        description: relData.description ? relData.description.trim() : '',
      });
    }
    org.relationshipTypes = rels;
    localStorage.setItem('tm_organization', JSON.stringify(org));
    return { message: 'Relationship type added', relationshipTypes: rels };
  },

  // DELETE /api/organization/relationship-types/:id
  async deleteRelationshipType(id) {
    const targetId = (id || '').toString().trim().toLowerCase();
    let serverRelTypes = null;
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/relationship-types/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (Array.isArray(data.relationshipTypes)) {
        serverRelTypes = data.relationshipTypes;
      }
    } catch {
      // offline fallback
    }

    const org = await this.getOrganization();
    const updated = serverRelTypes !== null
      ? serverRelTypes
      : (org.relationshipTypes || []).filter(
          (r) =>
            (r.id && r.id.toString().trim().toLowerCase() !== targetId) &&
            (!r._id || r._id.toString() !== targetId)
        );
    org.relationshipTypes = updated;
    localStorage.setItem('tm_organization', JSON.stringify(org));
    return { message: 'Relationship type deleted', relationshipTypes: updated };
  },

  // POST /api/organization/clear-relationship-types
  async clearRelationshipTypes() {
    try {
      await safeFetchJson(`${API_BASE_URL}/organization/clear-relationship-types`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {
      // offline fallback
    }
    const org = await this.getOrganization();
    org.relationshipTypes = [];
    localStorage.setItem('tm_organization', JSON.stringify(org));
    return { message: 'All relationship types cleared', relationshipTypes: [] };
  },

  // PUT /api/organization/levels
  async updateHierarchyLevels(levels) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/levels`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ levels }),
      });
      const updatedLevels = Array.isArray(data.levels) ? data.levels : levels;
      try {
        const org = JSON.parse(localStorage.getItem('tm_organization') || '{}');
        org.levels = updatedLevels;
        localStorage.setItem('tm_organization', JSON.stringify(org));
      } catch {}
      return updatedLevels;
    } catch (err) {
      if (isOfflineError(err)) {
        const org = await this.getOrganization();
        org.levels = levels;
        localStorage.setItem('tm_organization', JSON.stringify(org));
        return levels;
      }
      throw err;
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
      if (Array.isArray(data.positions)) {
        try {
          const org = JSON.parse(localStorage.getItem('tm_organization') || '{}');
          org.positions = data.positions;
          localStorage.setItem('tm_organization', JSON.stringify(org));
        } catch {}
      }
      return data.position;
    } catch (err) {
      if (isOfflineError(err)) {
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
      throw err;
    }
  },

  // PUT /api/organization/positions/:id
  async updatePosition(id, posData) {
    const targetId = id.toString().trim();
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/positions/${encodeURIComponent(targetId)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(posData),
      });
      if (Array.isArray(data.positions)) {
        try {
          const org = JSON.parse(localStorage.getItem('tm_organization') || '{}');
          org.positions = data.positions;
          localStorage.setItem('tm_organization', JSON.stringify(org));
        } catch {}
      }
      return data.position;
    } catch (err) {
      if (isOfflineError(err)) {
        const org = await this.getOrganization();
        org.positions = (org.positions || []).map((p) =>
          (p.id && p.id.toString() === targetId) || (p._id && p._id.toString() === targetId)
            ? { ...p, ...posData }
            : p
        );
        localStorage.setItem('tm_organization', JSON.stringify(org));
        return org.positions.find(
          (p) => (p.id && p.id.toString() === targetId) || (p._id && p._id.toString() === targetId)
        );
      }
      throw err;
    }
  },

  // DELETE /api/organization/positions/:id
  async deletePosition(id) {
    const targetId = id.toString().trim();
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/organization/positions/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const remaining = Array.isArray(data.positions) ? data.positions : [];
      try {
        const org = JSON.parse(localStorage.getItem('tm_organization') || '{}');
        org.positions = remaining;
        localStorage.setItem('tm_organization', JSON.stringify(org));
      } catch {}
      return remaining;
    } catch (err) {
      if (isOfflineError(err)) {
        const org = await this.getOrganization();
        org.positions = (org.positions || []).filter(
          (p) => (p.id && p.id.toString() !== targetId) && (!p._id || p._id.toString() !== targetId)
        );
        localStorage.setItem('tm_organization', JSON.stringify(org));
        return org.positions;
      }
      throw err;
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
      if (Array.isArray(org.departments)) {
        localStorage.setItem('tm_departments', JSON.stringify(org.departments));
      }
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

  // Fetch current user details from backend or local
  async getMe() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/auth/me`, {
        headers: getHeaders(),
      });
      if (data && data.user) {
        localStorage.setItem('tm_user', JSON.stringify(data.user));
        return data.user;
      }
      return this.getUser();
    } catch {
      return this.getUser();
    }
  },

  // Update profile details and/or password
  async updateProfile(profileData) {
    let updatedUser = null;
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/auth/profile`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(profileData),
      });
      if (data && data.user) {
        updatedUser = data.user;
      }
    } catch (err) {
      if (!isOfflineError(err)) {
        throw err;
      }
    }

    const current = this.getUser() || {};
    const merged = updatedUser || {
      ...current,
      ...profileData,
    };

    localStorage.setItem('tm_user', JSON.stringify(merged));

    // Update in tm_admin_employees cache if present
    const localEmps = localStorage.getItem('tm_admin_employees');
    if (localEmps) {
      try {
        const emps = JSON.parse(localEmps);
        const updated = emps.map((e) =>
          e.email === merged.email || e._id === merged._id || e.id === merged.id
            ? { ...e, ...merged }
            : e
        );
        localStorage.setItem('tm_admin_employees', JSON.stringify(updated));
      } catch {}
    }

    return merged;
  },

  // ----------------------------------------------------
  // INVITATIONS MANAGEMENT (Resend & Revoke)
  // ----------------------------------------------------
  async resendInvitation(invitationId) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const local = localStorage.getItem('tm_invitations');
      let invites = local ? JSON.parse(local) : [];
      const idx = invites.findIndex((i) => (i._id || i.id) === invitationId);
      if (idx !== -1) {
        const rawToken = 'tok_' + Math.random().toString(36).substring(2, 15);
        invites[idx].status = 'pending';
        invites[idx].expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        invites[idx].inviteToken = rawToken;
        localStorage.setItem('tm_invitations', JSON.stringify(invites));
        return {
          message: 'Invitation resent successfully.',
          invitation: invites[idx],
          inviteToken: rawToken,
        };
      }
      throw new Error('Invitation not found.');
    }
  },

  async revokeInvitation(invitationId) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/invitations/${invitationId}/revoke`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const local = localStorage.getItem('tm_invitations');
      let invites = local ? JSON.parse(local) : [];
      const idx = invites.findIndex((i) => (i._id || i.id) === invitationId);
      if (idx !== -1) {
        invites[idx].status = 'revoked';
        localStorage.setItem('tm_invitations', JSON.stringify(invites));
        return { message: 'Invitation revoked successfully.', invitation: invites[idx] };
      }
      throw new Error('Invitation not found.');
    }
  },

  // ----------------------------------------------------
  // CALENDAR & MEETINGS MANAGEMENT
  // ----------------------------------------------------
  async getMeetings(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.month) params.append('month', filters.month);
    if (filters.projectId) params.append('projectId', filters.projectId);
    if (filters.status) params.append('status', filters.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings${qs}`, {
        headers: getHeaders(),
      });
      return data || [];
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const local = localStorage.getItem('tm_meetings');
      let meetings = local ? JSON.parse(local) : [];
      if (filters.date) {
        meetings = meetings.filter((m) => m.date === filters.date);
      }
      if (filters.month) {
        meetings = meetings.filter((m) => m.date && m.date.startsWith(filters.month));
      }
      if (filters.status) {
        meetings = meetings.filter((m) => m.status === filters.status);
      }
      return meetings;
    }
  },

  async getMeetingById(id) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings/${id}`, {
        headers: getHeaders(),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const local = localStorage.getItem('tm_meetings');
      const list = local ? JSON.parse(local) : [];
      const found = list.find((m) => (m._id || m.id) === id);
      if (!found) throw new Error('Meeting not found.');
      return found;
    }
  },

  async createMeeting(meetingData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(meetingData),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const currentUser = this.getUser() || {};
      const newMeeting = {
        _id: 'mtg_' + Date.now(),
        id: 'mtg_' + Date.now(),
        title: meetingData.title,
        agenda: meetingData.agenda || '',
        date: meetingData.date,
        startTime: meetingData.startTime,
        endTime: meetingData.endTime,
        location: meetingData.location || '',
        meetingLink: meetingData.meetingLink || '',
        projectId: meetingData.projectId || null,
        projectName: meetingData.projectName || '',
        organizer: currentUser._id || currentUser.id || 'usr_organizer',
        organizerName: `${currentUser.firstName || 'Organizer'} ${currentUser.lastName || ''}`.trim(),
        participants: Array.isArray(meetingData.participants) ? meetingData.participants : [],
        status: 'scheduled',
        minutes: { notes: '', decisions: [], actionItems: [] },
        createdAt: new Date().toISOString(),
      };

      const local = localStorage.getItem('tm_meetings');
      const meetings = local ? JSON.parse(local) : [];
      meetings.unshift(newMeeting);
      localStorage.setItem('tm_meetings', JSON.stringify(meetings));

      return {
        message: 'Meeting scheduled successfully.',
        meeting: newMeeting,
        conflicts: [],
        hasConflict: false,
      };
    }
  },

  async updateMeeting(id, meetingData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(meetingData),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const local = localStorage.getItem('tm_meetings');
      let meetings = local ? JSON.parse(local) : [];
      const idx = meetings.findIndex((m) => (m._id || m.id) === id);
      if (idx !== -1) {
        meetings[idx] = { ...meetings[idx], ...meetingData };
        localStorage.setItem('tm_meetings', JSON.stringify(meetings));
        return { message: 'Meeting updated successfully.', meeting: meetings[idx], conflicts: [] };
      }
      throw new Error('Meeting not found.');
    }
  },

  async cancelMeeting(id, reason = '') {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings/${id}/cancel`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const local = localStorage.getItem('tm_meetings');
      let meetings = local ? JSON.parse(local) : [];
      const idx = meetings.findIndex((m) => (m._id || m.id) === id);
      if (idx !== -1) {
        meetings[idx].status = 'cancelled';
        meetings[idx].cancellationReason = reason;
        localStorage.setItem('tm_meetings', JSON.stringify(meetings));
        return { message: 'Meeting cancelled successfully.', meeting: meetings[idx] };
      }
      throw new Error('Meeting not found.');
    }
  },

  async respondMeeting(id, status) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings/${id}/respond`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ status }),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const currentUser = this.getUser() || {};
      const currentUserId = (currentUser._id || currentUser.id || '').toString();
      const local = localStorage.getItem('tm_meetings');
      let meetings = local ? JSON.parse(local) : [];
      const idx = meetings.findIndex((m) => (m._id || m.id) === id);
      if (idx !== -1) {
        const p = meetings[idx].participants.find((pt) => (pt.userId || pt.id || '').toString() === currentUserId);
        if (p) {
          p.status = status;
          p.respondedAt = new Date().toISOString();
        }
        localStorage.setItem('tm_meetings', JSON.stringify(meetings));
        return { message: `Invitation response recorded as ${status}.`, meeting: meetings[idx] };
      }
      throw new Error('Meeting not found.');
    }
  },

  async saveMeetingMinutes(id, minutesData) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings/${id}/minutes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(minutesData),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const currentUser = this.getUser() || {};
      const local = localStorage.getItem('tm_meetings');
      let meetings = local ? JSON.parse(local) : [];
      const idx = meetings.findIndex((m) => (m._id || m.id) === id);
      if (idx !== -1) {
        meetings[idx].status = 'completed';
        meetings[idx].minutes = {
          notes: minutesData.notes || '',
          decisions: Array.isArray(minutesData.decisions) ? minutesData.decisions : [],
          actionItems: Array.isArray(minutesData.actionItems)
            ? minutesData.actionItems.map((ai, index) => ({
                _id: 'act_' + Date.now() + '_' + index,
                description: ai.description,
                assigneeId: ai.assigneeId || null,
                assigneeName: ai.assigneeName || '',
                dueDate: ai.dueDate || meetings[idx].date,
                convertedToTaskId: ai.convertedToTaskId || null,
                status: ai.status || 'pending',
              }))
            : [],
          recordedBy: currentUser._id || currentUser.id,
          recordedByName: `${currentUser.firstName || 'User'} ${currentUser.lastName || ''}`.trim(),
          recordedAt: new Date().toISOString(),
        };
        localStorage.setItem('tm_meetings', JSON.stringify(meetings));
        return { message: 'Meeting minutes recorded successfully.', meeting: meetings[idx] };
      }
      throw new Error('Meeting not found.');
    }
  },

  async convertMeetingActionItem(meetingId, actionItemId) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings/${meetingId}/action-items/${actionItemId}/convert`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      const local = localStorage.getItem('tm_meetings');
      let meetings = local ? JSON.parse(local) : [];
      const mIdx = meetings.findIndex((m) => (m._id || m.id) === meetingId);
      if (mIdx === -1) throw new Error('Meeting not found.');

      const meeting = meetings[mIdx];
      const actionItems = meeting.minutes?.actionItems || [];
      const item = actionItems.find((ai) => (ai._id || ai.id) === actionItemId);
      if (!item) throw new Error('Action item not found.');

      const currentUser = this.getUser() || {};
      const newTask = {
        _id: 'task_' + Date.now(),
        id: 'task_' + Date.now(),
        title: item.description,
        description: `Follow-up action item from meeting: "${meeting.title}" (Date: ${meeting.date})`,
        organizationId: meeting.organizationId || 'org_default',
        projectId: meeting.projectId || null,
        assignedTo: item.assigneeId || currentUser._id,
        assignedToName: item.assigneeName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`,
        assignedBy: currentUser._id,
        assignedByName: `${currentUser.firstName || 'Admin'} ${currentUser.lastName || ''}`,
        deadline: item.dueDate || meeting.date,
        dueDate: item.dueDate || meeting.date,
        status: 'not-started',
        priority: 'medium',
        progress: 0,
        createdAt: new Date().toISOString(),
      };

      const tasksLocal = localStorage.getItem('tm_tasks');
      const tasks = tasksLocal ? JSON.parse(tasksLocal) : [];
      tasks.unshift(newTask);
      localStorage.setItem('tm_tasks', JSON.stringify(tasks));

      item.status = 'converted';
      item.convertedToTaskId = newTask._id;
      localStorage.setItem('tm_meetings', JSON.stringify(meetings));

      return {
        message: 'Action item converted into task successfully.',
        task: newTask,
        meeting,
      };
    }
  },

  async checkMeetingConflicts({ date, startTime, endTime, participantIds = [], excludeMeetingId = null }) {
    const params = new URLSearchParams({
      date,
      startTime,
      endTime,
      participantIds: Array.isArray(participantIds) ? participantIds.join(',') : participantIds,
    });
    if (excludeMeetingId) params.append('excludeMeetingId', excludeMeetingId);

    try {
      const data = await safeFetchJson(`${API_BASE_URL}/meetings/conflicts?${params.toString()}`, {
        headers: getHeaders(),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;

      // Offline conflict checking
      const local = localStorage.getItem('tm_meetings');
      const meetings = local ? JSON.parse(local) : [];
      const ids = Array.isArray(participantIds) ? participantIds : (participantIds ? participantIds.split(',') : []);

      const conflicts = [];
      for (const m of meetings) {
        if (m.date === date && m.status === 'scheduled') {
          if (excludeMeetingId && (m._id || m.id) === excludeMeetingId) continue;
          if (m.startTime < endTime && m.endTime > startTime) {
            for (const p of m.participants || []) {
              if (ids.includes((p.userId || p.id || '').toString())) {
                conflicts.push({
                  userId: p.userId || p.id,
                  name: p.name,
                  meetingId: m._id || m.id,
                  meetingTitle: m.title,
                  startTime: m.startTime,
                  endTime: m.endTime,
                });
              }
            }
          }
        }
      }
      return { hasConflict: conflicts.length > 0, conflicts };
    }
  },

  // ----------------------------------------------------
  // NOTIFICATIONS
  // ----------------------------------------------------
  async getNotifications() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/notifications`, {
        headers: getHeaders(),
      });
      return data || { notifications: [], unreadCount: 0 };
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const local = localStorage.getItem('tm_notifications');
      const notifications = local ? JSON.parse(local) : [];
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, unreadCount };
    }
  },

  async markNotificationRead(id) {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const local = localStorage.getItem('tm_notifications');
      let list = local ? JSON.parse(local) : [];
      const n = list.find((item) => (item._id || item.id) === id);
      if (n) n.read = true;
      localStorage.setItem('tm_notifications', JSON.stringify(list));
      return n;
    }
  },

  async markAllNotificationsRead() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      return data;
    } catch (err) {
      if (!isOfflineError(err)) throw err;
      const local = localStorage.getItem('tm_notifications');
      let list = local ? JSON.parse(local) : [];
      list.forEach((n) => (n.read = true));
      localStorage.setItem('tm_notifications', JSON.stringify(list));
      return { message: 'All notifications marked as read.' };
    }
  },

  // ----------------------------------------------------
  // ORGANIZATIONAL TREE
  // ----------------------------------------------------
  async getOrgTree() {
    return safeFetchJson(`${API_BASE_URL}/organization/tree`, {
      headers: getHeaders(),
    });
  },

  async addTreeNode(nodeData) {
    return safeFetchJson(`${API_BASE_URL}/organization/tree/nodes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(nodeData),
    });
  },

  async updateTreeNode(nodeId, nodeData) {
    return safeFetchJson(`${API_BASE_URL}/organization/tree/nodes/${nodeId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(nodeData),
    });
  },

  async deleteTreeNode(nodeId) {
    return safeFetchJson(`${API_BASE_URL}/organization/tree/nodes/${nodeId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async assignEmployeeToNode(nodeId, { userId, employeeCode }) {
    return safeFetchJson(`${API_BASE_URL}/organization/tree/nodes/${nodeId}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, employeeCode }),
    });
  },

  async unassignEmployeeFromNode(nodeId) {
    return safeFetchJson(`${API_BASE_URL}/organization/tree/nodes/${nodeId}/unassign`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async moveTreeNode(nodeId, newParentId) {
    return safeFetchJson(`${API_BASE_URL}/organization/tree/move`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ nodeId, newParentId }),
    });
  },

  async mergeTreeNodes(sourceNodeId, targetNodeId) {
    return safeFetchJson(`${API_BASE_URL}/organization/tree/merge`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ sourceNodeId, targetNodeId }),
    });
  },

  async syncOrgTree() {
    return safeFetchJson(`${API_BASE_URL}/organization/tree/sync`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async updateEmployeeId(userId, employeeId) {
    return safeFetchJson(`${API_BASE_URL}/organization/employees/${userId}/employee-id`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ employeeId }),
    });
  },

  // ----------------------------------------------------
  // AUTHORIZED ASSIGNEES & MILESTONES
  // ----------------------------------------------------
  async getAuthorizedAssignees() {
    return safeFetchJson(`${API_BASE_URL}/tasks/authorized-assignees`, {
      headers: getHeaders(),
    });
  },

  async completeMilestone(taskId, milestoneId) {
    return safeFetchJson(`${API_BASE_URL}/tasks/${taskId}/milestones/${milestoneId}/complete`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
  },

  async addMilestone(taskId, title) {
    return safeFetchJson(`${API_BASE_URL}/tasks/${taskId}/milestones`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title }),
    });
  },

  // ----------------------------------------------------
  // GOOGLE INTEGRATION & OAUTH
  // ----------------------------------------------------
  async getGoogleAuthUrl() {
    return safeFetchJson(`${API_BASE_URL}/meetings/google/auth-url`, {
      headers: getHeaders(),
    });
  },

  async connectGoogleCallback(code, redirectUri, simulated = false) {
    return safeFetchJson(`${API_BASE_URL}/meetings/google/callback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code, redirectUri, simulated }),
    });
  },

  async getGoogleStatus() {
    return safeFetchJson(`${API_BASE_URL}/meetings/google/status`, {
      headers: getHeaders(),
    });
  },

  async disconnectGoogle() {
    return safeFetchJson(`${API_BASE_URL}/meetings/google/disconnect`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async syncMeetingWithGoogle(meetingId) {
    return safeFetchJson(`${API_BASE_URL}/meetings/${meetingId}/sync-google`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  // ----------------------------------------------------
  // CONNECT BUILT-IN VIDEO MEETINGS & WEBRTC ROOMS
  // ----------------------------------------------------
  async createConnectRoom(title = 'Instant Connect Meeting', agenda = '') {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title, agenda }),
    });
  },

  async getConnectRoom(roomCode) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}`, {
      headers: getHeaders(),
    });
  },

  async joinConnectRoom(roomCode) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/join`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async leaveConnectRoom(roomCode) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/leave`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async endConnectRoom(roomCode) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/end`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },

  async sendConnectSignal(roomCode, targetUserId, signal, type) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/signal`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ targetUserId, signal, type }),
    });
  },

  async getConnectSignals(roomCode) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/signals`, {
      headers: getHeaders(),
    });
  },

  async sendConnectChat(roomCode, text) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
  },

  async getConnectChat(roomCode) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/chat`, {
      headers: getHeaders(),
    });
  },

  async sendConnectHostAction(roomCode, action, value) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/host-action`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action, value }),
    });
  },

  async getMeetingHistory() {
    return safeFetchJson(`${API_BASE_URL}/meetings/history/records`, {
      headers: getHeaders(),
    });
  },

  async getLivekitToken(roomCode) {
    return safeFetchJson(`${API_BASE_URL}/meetings/rooms/${encodeURIComponent(roomCode)}/livekit-token`, {
      method: 'POST',
      headers: getHeaders(),
    });
  },
};
