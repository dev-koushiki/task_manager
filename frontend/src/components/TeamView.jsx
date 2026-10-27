import { useState, useEffect } from 'react';
import { PlusIcon, MailIcon, BuildingIcon } from './Icons';
import { api } from '../services/api';

export const TeamView = ({ companyName }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmp, setNewEmp] = useState({
    name: '',
    email: '',
    department: 'Engineering',
    position: '',
    role: 'employee',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const fetchEmployees = async () => {
      try {
        const data = await api.getEmployees();
        if (!ignore) {
          setEmployees(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchEmployees();
    return () => {
      ignore = true;
    };
  }, []);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setError('');

    if (!newEmp.name.trim() || !newEmp.email.trim() || !newEmp.position.trim()) {
      setError('Please fill in Name, Email, and Position.');
      return;
    }

    try {
      const added = await api.createEmployee(newEmp);
      setEmployees((prev) => [...prev, added]);
      setNewEmp({
        name: '',
        email: '',
        department: 'Engineering',
        position: '',
        role: 'employee',
      });
      setShowAddForm(false);
    } catch (err) {
      setError(err.message || 'Failed to add team member');
    }
  };

  return (
    <div className="team-container animate-fade-in">
      <div className="team-header">
        <div>
          <h2>{companyName || 'Company'} Team Directory</h2>
          <p className="section-desc">Manage your department personnel, roles, and designations.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <PlusIcon size={18} />
          <span>{showAddForm ? 'Cancel' : 'Add Team Member'}</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddEmployee} className="add-emp-card animate-slide-up">
          <h3>Add New Team Member</h3>
          {error && <div className="alert-box alert-error">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Rachel Adams"
                value={newEmp.name}
                onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                placeholder="rachel@company.com"
                value={newEmp.email}
                onChange={(e) => setNewEmp({ ...newEmp, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Department</label>
              <select
                value={newEmp.department}
                onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
              >
                <option value="Engineering">Engineering</option>
                <option value="Product">Product</option>
                <option value="Design">Design</option>
                <option value="Marketing">Marketing</option>
                <option value="Sales">Sales</option>
                <option value="Operations">Operations</option>
              </select>
            </div>

            <div className="form-group">
              <label>Position / Title *</label>
              <input
                type="text"
                placeholder="e.g. Senior Backend Engineer"
                value={newEmp.position}
                onChange={(e) => setNewEmp({ ...newEmp, position: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                value={newEmp.role}
                onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value })}
              >
                <option value="head">Department Head</option>
                <option value="manager">Manager</option>
                <option value="employee">Team Member</option>
              </select>
            </div>
          </div>

          <div className="form-actions-right">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Member
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading team directory...</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="empty-state">
          <p>No team members found yet. Click "Add Team Member" to grow your company directory!</p>
        </div>
      ) : (
        <div className="team-grid">
          {employees.map((emp) => (
            <div key={emp._id} className="team-card">
              <div className="team-avatar">
                {emp.name
                  ? emp.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'EM'}
              </div>
              <div className="team-info">
                <h4>{emp.name}</h4>
                <p className="team-pos">{emp.position}</p>
                <span className={`role-badge role-${emp.role}`}>{emp.role}</span>
              </div>
              <div className="team-meta">
                <span>
                  <BuildingIcon size={14} /> {emp.department}
                </span>
                <span>
                  <MailIcon size={14} /> {emp.email}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
