import { useState } from 'react';

// Role definitions
export const ROLES = {
  GUEST: 'guest',
  RECRUITER: 'recruiter',
  EDITOR: 'editor',
  ADMIN: 'admin',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

const ROLE_META: Record<Role, { label: string; emoji: string; cssClass: string; desc: string }> = {
  guest:     { label: 'Guest',     emoji: '👁',  cssClass: 'guest',     desc: 'Public view — limited details' },
  recruiter: { label: 'Recruiter', emoji: '🎯',  cssClass: 'recruiter', desc: 'Full profile including availability' },
  editor:    { label: 'Editor',    emoji: '✏️',  cssClass: 'editor',    desc: 'Can edit and publish changes' },
  admin:     { label: 'Admin',     emoji: '⚡',  cssClass: 'admin',     desc: 'Full access including drafts' },
};

// Passwords — kept here to avoid prop drilling; real app would use auth
const PASSWORDS: Record<string, Role> = {
  'rohan@recruiter': ROLES.RECRUITER,
  'rohan@editor':    ROLES.EDITOR,
  'rohan@admin':     ROLES.ADMIN,
};

const ROLE_OPTIONS = [
  { role: ROLES.RECRUITER, label: 'Recruiter / Hirer' },
  { role: ROLES.EDITOR,    label: 'Editor' },
  { role: ROLES.ADMIN,     label: 'Admin' },
];

interface NavbarProps {
  role: Role;
  onRoleChange: (r: Role) => void;
}

const Navbar = ({ role, onRoleChange }: NavbarProps) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>(ROLES.RECRUITER);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const meta = ROLE_META[role];
  const isGuest = role === ROLES.GUEST;

  const openModal = () => {
    setSelectedRole(ROLES.RECRUITER);
    setPassword('');
    setError('');
    setShowModal(true);
  };

  const handleLogin = () => {
    const matched = PASSWORDS[password];
    if (!matched) {
      setError('Incorrect password.');
      return;
    }
    if (matched !== selectedRole) {
      setError(`That password is for the ${ROLE_META[matched].label} role.`);
      return;
    }
    onRoleChange(matched);
    setShowModal(false);
    setPassword('');
    setError('');
  };

  const handleSignOut = () => onRoleChange(ROLES.GUEST);

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">{'{ RT }'}</span>
        <div className="navbar-right">
          <a className="btn btn-study" href="/study/" target="_blank" rel="noreferrer">
            📚 Study
          </a>
          <span className={`role-badge ${meta.cssClass}`}>
            {meta.emoji} {meta.label}
          </span>
          {isGuest
            ? <button className="btn btn-accent" onClick={openModal}>Sign In</button>
            : <button className="btn btn-outline" onClick={handleSignOut}>Sign out</button>
          }
        </div>
      </nav>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sign In</h3>
            <p>Select your role and enter the password.</p>

            {/* Role selector */}
            <div className="role-selector">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.role}
                  className={`role-option ${selectedRole === opt.role ? 'selected' : ''}`}
                  onClick={() => { setSelectedRole(opt.role); setError(''); }}
                >
                  <span className="role-option-emoji">{ROLE_META[opt.role].emoji}</span>
                  <span className="role-option-label">{opt.label}</span>
                  <span className="role-option-desc">{ROLE_META[opt.role].desc}</span>
                </button>
              ))}
            </div>

            <input
              className="modal-input"
              type="password"
              placeholder={`Password for ${ROLE_META[selectedRole].label}`}
              value={password}
              autoFocus
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {error && <div className="modal-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={handleLogin}>Sign In</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
