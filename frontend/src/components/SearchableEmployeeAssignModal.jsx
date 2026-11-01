import { useState, useEffect, useMemo } from 'react';
import { SearchIcon, CheckIcon, UserIcon, UsersIcon } from './Icons';
import { api } from '../services/api';

export const SearchableEmployeeAssignModal = ({
  isOpen,
  onClose,
  onConfirm,
  initialSelectedIds = [],
  title = 'Assign to Employee',
  subtitle = 'Select one or multiple employees, interns, or team members to assign.',
}) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds.map((id) => String(id))));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setSelectedIds(new Set(initialSelectedIds.map((id) => String(id))));

    api.getEmployees()
      .then((emps) => {
        if (active && Array.isArray(emps)) {
          setEmployees(emps);
        }
      })
      .catch((err) => {
        console.error('Failed to load employees for assignment:', err);
        setError('Failed to load employee list.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, initialSelectedIds]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchTerm.toLowerCase().trim();
      const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const designation = (emp.designation || '').toLowerCase();
      const team = (emp.team || '').toLowerCase();
      const role = (emp.role || '').toLowerCase();

      const matchesSearch =
        !q ||
        name.includes(q) ||
        email.includes(q) ||
        designation.includes(q) ||
        team.includes(q) ||
        role.includes(q);

      if (!matchesSearch) return false;

      if (roleFilter === 'all') return true;
      if (roleFilter === 'intern') return role.includes('intern') || designation.includes('intern');
      if (roleFilter === 'employee') return role === 'employee' && !designation.toLowerCase().includes('intern');
      if (roleFilter === 'admin') return role === 'admin';
      return true;
    });
  }, [employees, searchTerm, roleFilter]);

  const toggleSelect = (id) => {
    const strId = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(strId)) {
        next.delete(strId);
      } else {
        next.add(strId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set(selectedIds);
    filteredEmployees.forEach((emp) => all.add(String(emp._id || emp.id)));
    setSelectedIds(all);
  };

  const deselectAll = () => {
    const next = new Set(selectedIds);
    filteredEmployees.forEach((emp) => next.delete(String(emp._id || emp.id)));
    setSelectedIds(next);
  };

  const selectedList = useMemo(() => {
    return employees.filter((emp) => selectedIds.has(String(emp._id || emp.id)));
  }, [employees, selectedIds]);

  const handleConfirm = async () => {
    try {
      setSaving(true);
      setError('');
      const idsArray = Array.from(selectedIds);
      await onConfirm(idsArray, selectedList);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save assignments.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wa-assign-modal-overlay" onClick={onClose}>
      <div
        className="wa-assign-modal-box animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '680px', width: '100%' }}
      >
        {/* Header */}
        <div className="wa-assign-modal-header">
          <div className="wa-assign-header-title">
            <UsersIcon size={20} className="text-primary" />
            <div>
              <h3>{title}</h3>
              <p>{subtitle}</p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="wa-assign-modal-body">
          {error && <div className="alert-box alert-error" style={{ marginBottom: '12px' }}>{error}</div>}

          {/* Search bar & filter pills */}
          <div className="wa-assign-search-row">
            <div className="wa-assign-search-input-wrap">
              <SearchIcon size={16} className="wa-assign-search-icon" />
              <input
                type="text"
                placeholder="Search by intern, employee, team, designation, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="wa-assign-search-field"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="wa-assign-clear-btn"
                  onClick={() => setSearchTerm('')}
                >
                  &times;
                </button>
              )}
            </div>

            <div className="wa-assign-filter-pills">
              <button
                type="button"
                className={`wa-filter-pill ${roleFilter === 'all' ? 'active' : ''}`}
                onClick={() => setRoleFilter('all')}
              >
                All ({employees.length})
              </button>
              <button
                type="button"
                className={`wa-filter-pill ${roleFilter === 'employee' ? 'active' : ''}`}
                onClick={() => setRoleFilter('employee')}
              >
                Employees
              </button>
              <button
                type="button"
                className={`wa-filter-pill ${roleFilter === 'intern' ? 'active' : ''}`}
                onClick={() => setRoleFilter('intern')}
              >
                Interns
              </button>
              <button
                type="button"
                className={`wa-filter-pill ${roleFilter === 'admin' ? 'active' : ''}`}
                onClick={() => setRoleFilter('admin')}
              >
                Admins
              </button>
            </div>
          </div>

          {/* Selected Employees Preview Chips Bar */}
          <div className="wa-assign-selected-preview">
            <div className="wa-preview-header">
              <span className="wa-preview-title">
                Selected Employees ({selectedList.length}):
              </span>
              <div className="wa-preview-actions">
                <button
                  type="button"
                  className="btn-link-xs"
                  onClick={selectAll}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn-link-xs"
                  onClick={deselectAll}
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {selectedList.length === 0 ? (
              <span className="wa-preview-empty">No employees selected yet. Choose from table below.</span>
            ) : (
              <div className="wa-preview-chips-wrap">
                {selectedList.map((emp) => {
                  const empId = String(emp._id || emp.id);
                  const isIntern =
                    (emp.role || '').toLowerCase().includes('intern') ||
                    (emp.designation || '').toLowerCase().includes('intern');
                  return (
                    <div key={empId} className="wa-preview-chip">
                      <span className="wa-chip-name">
                        {emp.firstName} {emp.lastName}
                      </span>
                      {isIntern && <span className="wa-chip-intern-tag">Intern</span>}
                      <button
                        type="button"
                        className="wa-chip-remove-btn"
                        onClick={() => toggleSelect(empId)}
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Searchable Employee Table */}
          <div className="wa-assign-table-container">
            {loading ? (
              <div className="wa-assign-loading">Loading organization directory...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="wa-assign-empty">No employees found matching &quot;{searchTerm}&quot;</div>
            ) : (
              <table className="wa-assign-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredEmployees.length > 0 &&
                          filteredEmployees.every((e) => selectedIds.has(String(e._id || e.id)))
                        }
                        onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
                      />
                    </th>
                    <th>Employee Name & Email</th>
                    <th>Role & Designation</th>
                    <th>Team / Domain</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const empId = String(emp._id || emp.id);
                    const isSelected = selectedIds.has(empId);
                    const initials =
                      `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase() || 'U';
                    const isIntern =
                      (emp.role || '').toLowerCase().includes('intern') ||
                      (emp.designation || '').toLowerCase().includes('intern');

                    return (
                      <tr
                        key={empId}
                        className={`wa-assign-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleSelect(empId)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(empId)}
                          />
                        </td>
                        <td>
                          <div className="wa-assign-name-cell">
                            <div className="wa-avatar-circle-xs">{initials}</div>
                            <div>
                              <strong>
                                {emp.firstName} {emp.lastName}
                              </strong>
                              <span className="wa-assign-email">{emp.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="wa-assign-role-wrap">
                            <span
                              className={`wa-badge-role ${
                                emp.role === 'admin'
                                  ? 'badge-admin-tag'
                                  : isIntern
                                  ? 'badge-intern-tag'
                                  : 'badge-emp-tag'
                              }`}
                            >
                              {isIntern ? 'Intern' : emp.role?.toUpperCase() || 'EMPLOYEE'}
                            </span>
                            <span className="wa-assign-designation">
                              {emp.designation || 'Team Member'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="wa-badge-dept">
                            {emp.team || emp.department || 'General'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="wa-assign-modal-footer">
          <div className="wa-footer-count">
            <strong>{selectedList.length}</strong> employee(s) selected
          </div>
          <div className="wa-footer-buttons">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={saving}
            >
              {saving ? 'Saving Assignments...' : 'Save & Assign to Employee'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
