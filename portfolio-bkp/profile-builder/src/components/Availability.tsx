import { type Role, ROLES } from './Navbar';

// What each role can see
// guest     → masked asterisks only
// recruiter → published data only
// editor    → published + draft badge
// admin     → everything, no filter

const MASKED = '••••••••';

const roleBadge = (role: Role) => {
  if (role === ROLES.ADMIN)     return { label: 'Admin View',     color: '#f78166', bg: '#2a1a1a' };
  if (role === ROLES.EDITOR)    return { label: 'Editor View',    color: '#d2a679', bg: '#2a2010' };
  if (role === ROLES.RECRUITER) return { label: 'Recruiter View', color: '#58a6ff', bg: '#0d2137' };
  return null;
};

const AvailItem = ({ label, value, masked }: { label: string; value: string; masked?: boolean }) => (
  <div className="avail-item">
    <div className="avail-label">{label}</div>
    <div className={`avail-value ${masked ? 'avail-masked' : ''}`}>
      {masked ? MASKED : value}
    </div>
  </div>
);

const Availability = ({ availability, role }: { availability: any; role: Role }) => {
  const isGuest     = role === ROLES.GUEST;
  const isRecruiter = role === ROLES.RECRUITER;
  const isEditor    = role === ROLES.EDITOR;
  const isAdmin     = role === ROLES.ADMIN;

  // Recruiter only sees published data
  const canSeeData   = isRecruiter || isEditor || isAdmin;
  const showDraftTag = (isEditor || isAdmin) && !availability.published;
  const badge        = roleBadge(role);

  return (
    <div className="section">
      <div className="section-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        Availability &amp; Compensation

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {showDraftTag && (
            <span style={{ fontSize: '0.65rem', background: '#2a2010', color: '#d2a679', border: '1px solid #d2a679', borderRadius: '4px', padding: '2px 8px' }}>
              DRAFT — not published
            </span>
          )}
          {badge && (
            <span style={{ fontSize: '0.65rem', background: badge.bg, color: badge.color, border: `1px solid ${badge.color}`, borderRadius: '4px', padding: '2px 8px' }}>
              {badge.label}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        {isGuest && (
          <div className="avail-guest-notice">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Sign in as Recruiter or above to view availability details.
          </div>
        )}
        <div className="avail-grid">
          <AvailItem label="Notice Period"       value={availability.noticePeriod}  masked={!canSeeData} />
          <AvailItem label="Current Salary"      value={availability.currentSalary} masked={!canSeeData} />
          <AvailItem label="Expected Salary"     value={availability.expectedSalary} masked={!canSeeData} />
          <AvailItem
            label="Preferred Locations"
            value={availability.preferredLocations.join(' · ')}
            masked={!canSeeData}
          />
        </div>

        {/* Recruiter only sees published — show notice if unpublished */}
        {isRecruiter && !availability.published && (
          <div className="avail-unpublished-notice">
            This section has unpublished changes. You are viewing the last published version.
          </div>
        )}
      </div>
    </div>
  );
};

export default Availability;
