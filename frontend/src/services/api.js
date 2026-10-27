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
  'Engineering',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Operations',
  'Human Resources',
  'Finance',
];

const DEFAULT_ROLES = [
  { id: 'employee', title: 'Employee', description: 'Standard task board and workspace access' },
  { id: 'manager', title: 'Manager', description: 'Team coordination & project management' },
];

export const api = {
  // Department Management
  getDepartments() {
    try {
      const stored = localStorage.getItem('tm_departments');
      if (stored) {
        return JSON.parse(stored);
      }
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
      if (stored) {
        return JSON.parse(stored);
      }
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
      : 'Custom workspace role';

    const current = this.getRoles();
    if (!current.some((r) => r.id === id)) {
      const updated = [...current, { id, title, description }];
      localStorage.setItem('tm_roles', JSON.stringify(updated));
      return updated;
    }
    return current;
  },

  deleteRole(roleId) {
    // Keep employee and manager as core defaults
    if (roleId === 'employee' || roleId === 'manager') return this.getRoles();
    const current = this.getRoles();
    const updated = current.filter((r) => r.id !== roleId);
    localStorage.setItem('tm_roles', JSON.stringify(updated));
    return updated;
  },

  // Auth: Register (Admin Workspace Registration)
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
          department: 'Leadership',
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
          lastName: nameParts.slice(1).join(' ') || 'Employee',
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
          message: 'Employee account created successfully! (Offline mode)',
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
        console.warn('Backend offline: generating invitation locally.');
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

  // Admin: Get all employees & pending invitations (GET /api/admin/employees)
  async getAdminEmployees() {
    try {
      const data = await safeFetchJson(`${API_BASE_URL}/admin/employees`, {
        headers: getHeaders(),
      });
      return data;
    } catch {
      console.warn('Fetching admin employees locally');
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

  // Admin: Update Employee (PATCH /api/admin/employees/:id)
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

  // Admin: Toggle Employee Account Status (POST /api/admin/employees/:id/disable)
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

  // Tasks: Fetch tasks
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
          const parsed = JSON.parse(local);
          const cleaned = Array.isArray(parsed)
            ? parsed.filter((t) => !['task_1', 'task_2', 'task_3', 'task_4'].includes(t._id))
            : [];
          if (cleaned.length !== (parsed ? parsed.length : 0)) {
            localStorage.setItem('tm_tasks', JSON.stringify(cleaned));
          }
          return cleaned;
        } catch {
          localStorage.removeItem('tm_tasks');
          return [];
        }
      }
      return [];
    }
  },

  // Tasks: Create task
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
        createdAt: new Date().toISOString(),
      };
      tasks.unshift(newTask);
      localStorage.setItem('tm_tasks', JSON.stringify(tasks));
      return newTask;
    }
  },

  // Tasks: Update task
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
      tasks = tasks.map((t) => (t._id === id ? { ...t, ...updateData } : t));
      localStorage.setItem('tm_tasks', JSON.stringify(tasks));
      return tasks.find((t) => t._id === id);
    }
  },

  // Tasks: Delete task
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
        const tasks = JSON.parse(local).filter((t) => t._id !== id);
        localStorage.setItem('tm_tasks', JSON.stringify(tasks));
      }
      return true;
    }
  },
};
