import { type Role, ROLES } from './Navbar';

// Wraps any section that has a `published` flag in resume.json.
// - published: true  → everyone sees it
// - published: false → only editor + admin see it, with a draft banner
const DraftWrapper = ({ section, role, children }: { section: any; role: Role; children: any }) => {
  const canSeeDrafts = role === ROLES.EDITOR || role === ROLES.ADMIN;

  if (!section.published && !canSeeDrafts) return null;

  return (
    <div className={!section.published ? 'draft-section' : ''}>
      {!section.published && (
        <div className="draft-banner">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
          Unpublished draft — only visible to Editor &amp; Admin
        </div>
      )}
      {children}
    </div>
  );
};

export default DraftWrapper;
