import { useState, useEffect } from 'react';
import { GitBranchIcon, CheckIcon } from './Icons';
import { api } from '../services/api';

export const OrganizationHierarchyView = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    api.getHierarchy()
      .then((data) => {
        if (active) {
          setEmployees(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load organizational hierarchy:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSupervisorChange = async (employeeId, supervisorId) => {
    try {
      setUpdatingId(employeeId);
      await api.assignSupervisor(employeeId, supervisorId || null);
      setNotice('Reporting relationship updated successfully.');
      setTimeout(() => setNotice(''), 3000);
      const data = await api.getHierarchy();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      alert(err.message || 'Failed to update supervisor.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Group by hierarchical levels
  const heads = employees.filter((e) => e.role === 'admin');
  const directors = employees.filter((e) => e.role === 'director');
  const managers = employees.filter((e) => e.role === 'manager');
  const juniors = employees.filter((e) => !['admin', 'director', 'manager'].includes(e.role));

  // Eligible supervisors for any subordinate
  const eligibleSupervisors = employees.filter((e) => ['admin', 'director', 'manager'].includes(e.role));

  return (
    <div className="hierarchy-container animate-fade-in">
      <div className="hierarchy-header-card">
        <div className="header-icon-badge">
          <GitBranchIcon size={24} className="text-accent" />
        </div>
        <div>
          <h2>Organizational Hierarchy & Reporting Structure</h2>
          <p className="section-desc">
            Define dynamic reporting lines across all office levels. Every employee reports to an
            assigned supervisor, ensuring transparent accountability and aggregated milestone
            tracking.
          </p>
        </div>
      </div>

      {notice && (
        <div className="alert-box alert-success" style={{ marginBottom: '16px' }}>
          <CheckIcon size={16} />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Mapping organizational structure...</p>
        </div>
      ) : (
        <div className="hierarchy-tree-view">
          {/* Level 1: Head of Office */}
          <div className="hierarchy-level-section">
            <div className="level-badge-header">
              <span className="level-rank">Level 1 · Executive Leadership</span>
              <h3>Head of Office / Administrator</h3>
              <p>Overall monitoring · Milestone KPIs · Strategic outcome oversight</p>
            </div>

            <div className="hierarchy-grid">
              {heads.map((h) => (
                <div key={h._id || h.id} className="hierarchy-card level-admin">
                  <div className="card-top-row">
                    <div className="avatar-circle-sm bg-purple">
                      {h.firstName ? h.firstName[0] : 'A'}
                    </div>
                    <span className="role-tag-sm role-tag-admin">HEAD OF OFFICE</span>
                  </div>
                  <div className="hierarchy-person-info">
                    <strong>{h.firstName} {h.lastName}</strong>
                    <span>{h.designation || 'Executive Administrator'}</span>
                    <small>{h.department || 'Executive Office'}</small>
                  </div>
                  <div className="reporting-status-pill">
                    <span>👑 Top Level Authority</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hierarchy-connector-line"></div>

          {/* Level 2: Project Directors */}
          <div className="hierarchy-level-section">
            <div className="level-badge-header">
              <span className="level-rank">Level 2 · Project Direction</span>
              <h3>Project Directors</h3>
              <p>Project progress · Team performance · Risk mitigation & deadlines</p>
            </div>

            <div className="hierarchy-grid">
              {directors.length === 0 ? (
                <div className="empty-level-box">
                  <p>No Project Directors assigned yet. Invite or promote members in the Admin Panel.</p>
                </div>
              ) : (
                directors.map((d) => (
                  <div key={d._id || d.id} className="hierarchy-card level-director">
                    <div className="card-top-row">
                      <div className="avatar-circle-sm bg-blue">
                        {d.firstName ? d.firstName[0] : 'D'}
                      </div>
                      <span className="role-tag-sm role-tag-director">PROJECT DIRECTOR</span>
                    </div>
                    <div className="hierarchy-person-info">
                      <strong>{d.firstName} {d.lastName}</strong>
                      <span>{d.designation || 'Project Director'}</span>
                      <small>{d.department}</small>
                    </div>

                    <div className="supervisor-assign-box">
                      <label>Reports Directly To:</label>
                      <select
                        value={d.reportsTo?._id || d.reportsTo || ''}
                        onChange={(e) => handleSupervisorChange(d._id || d.id, e.target.value)}
                        disabled={updatingId === (d._id || d.id)}
                      >
                        <option value="">Select Supervisor (Head of Office)</option>
                        {heads.map((h) => (
                          <option key={h._id || h.id} value={h._id || h.id}>
                            {h.firstName} {h.lastName} (Head of Office)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="hierarchy-connector-line"></div>

          {/* Level 3: Managers / Team Leaders */}
          <div className="hierarchy-level-section">
            <div className="level-badge-header">
              <span className="level-rank">Level 3 · Team Leadership</span>
              <h3>Managers / Team Leaders</h3>
              <p>Assigns work · Subtask allocation · Quality inspection & approvals</p>
            </div>

            <div className="hierarchy-grid">
              {managers.length === 0 ? (
                <div className="empty-level-box">
                  <p>No Managers assigned yet. Invite team managers in the Admin Panel.</p>
                </div>
              ) : (
                managers.map((m) => (
                  <div key={m._id || m.id} className="hierarchy-card level-manager">
                    <div className="card-top-row">
                      <div className="avatar-circle-sm bg-emerald">
                        {m.firstName ? m.firstName[0] : 'M'}
                      </div>
                      <span className="role-tag-sm role-tag-manager">MANAGER</span>
                    </div>
                    <div className="hierarchy-person-info">
                      <strong>{m.firstName} {m.lastName}</strong>
                      <span>{m.designation || 'Team Lead'}</span>
                      <small>{m.department}</small>
                    </div>

                    <div className="supervisor-assign-box">
                      <label>Reports Directly To:</label>
                      <select
                        value={m.reportsTo?._id || m.reportsTo || ''}
                        onChange={(e) => handleSupervisorChange(m._id || m.id, e.target.value)}
                        disabled={updatingId === (m._id || m.id)}
                      >
                        <option value="">Select Supervisor (Director/Admin)</option>
                        {eligibleSupervisors
                          .filter((s) => (s._id || s.id) !== (m._id || m.id))
                          .map((s) => (
                            <option key={s._id || s.id} value={s._id || s.id}>
                              {s.firstName} {s.lastName} ({s.role.toUpperCase()})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="hierarchy-connector-line"></div>

          {/* Level 4: Junior / Employees */}
          <div className="hierarchy-level-section">
            <div className="level-badge-header">
              <span className="level-rank">Level 4 · Execution & Delivery</span>
              <h3>Junior / Employees</h3>
              <p>Executes assigned work · Updates progress % · Submits for review</p>
            </div>

            <div className="hierarchy-grid">
              {juniors.length === 0 ? (
                <div className="empty-level-box">
                  <p>No junior team members added yet.</p>
                </div>
              ) : (
                juniors.map((j) => (
                  <div key={j._id || j.id} className="hierarchy-card level-employee">
                    <div className="card-top-row">
                      <div className="avatar-circle-sm">
                        {j.firstName ? j.firstName[0] : 'E'}
                      </div>
                      <span className="role-tag-sm role-tag-employee">EMPLOYEE</span>
                    </div>
                    <div className="hierarchy-person-info">
                      <strong>{j.firstName} {j.lastName}</strong>
                      <span>{j.designation || 'Specialist'}</span>
                      <small>{j.department}</small>
                    </div>

                    <div className="supervisor-assign-box">
                      <label>Reports Directly To:</label>
                      <select
                        value={j.reportsTo?._id || j.reportsTo || ''}
                        onChange={(e) => handleSupervisorChange(j._id || j.id, e.target.value)}
                        disabled={updatingId === (j._id || j.id)}
                      >
                        <option value="">Select Supervisor (Manager/Director)</option>
                        {eligibleSupervisors
                          .filter((s) => (s._id || s.id) !== (j._id || j.id))
                          .map((s) => (
                            <option key={s._id || s.id} value={s._id || s.id}>
                              {s.firstName} {s.lastName} ({s.role.toUpperCase()})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
