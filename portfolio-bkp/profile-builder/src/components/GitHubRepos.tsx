import { useEffect, useState } from 'react';

const LANG_COLORS: any = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  PHP: '#4f5d95',
  Go: '#00add8',
  Python: '#3572a5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Vue: '#41b883',
};

const GitHubRepos = ({ username }: any) => {
  const [repos, setRepos] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reposRes, userRes] = await Promise.all([
          fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=6&type=public`),
          fetch(`https://api.github.com/users/${username}`),
        ]);
        if (!reposRes.ok) throw new Error('GitHub API error');
        const reposData = await reposRes.json();
        const userData = await userRes.json();
        setRepos(reposData.filter((r: any) => !r.fork));
        setUser(userData);
      } catch (e: any) {
        setError('Could not load GitHub data. API rate limit or network issue.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username]);

  if (loading) return (
    <div className="section">
      <div className="section-title">
        <GithubIcon /> GitHub Repositories
      </div>
      <div className="status-msg">Loading repositories...</div>
    </div>
  );

  if (error) return (
    <div className="section">
      <div className="section-title"><GithubIcon /> GitHub Repositories</div>
      <div className="status-msg">{error}</div>
    </div>
  );

  return (
    <div className="section">
      <div className="section-title">
        <GithubIcon /> GitHub Repositories
      </div>

      {user && (
        <div className="github-header">
          <a href={user.html_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={user.avatar_url} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{user.name || user.login}</span>
          </a>
          <div className="github-stats">
            <span className="github-stat"><strong>{user.public_repos}</strong> repos</span>
            <span className="github-stat"><strong>{user.followers}</strong> followers</span>
            <span className="github-stat"><strong>{user.following}</strong> following</span>
          </div>
        </div>
      )}

      {repos.length === 0
        ? <div className="status-msg">No public repositories found.</div>
        : (
          <div className="repos-grid">
            {repos.map((repo: any) => (
              <a className="repo-card" key={repo.id} href={repo.html_url} target="_blank" rel="noreferrer">
                <div className="repo-name">{repo.name}</div>
                <div className="repo-desc">{repo.description || 'No description provided.'}</div>
                <div className="repo-meta">
                  {repo.language && (
                    <span className="repo-lang">
                      <span className="lang-dot" style={{ background: LANG_COLORS[repo.language] || '#8b949e' }} />
                      {repo.language}
                    </span>
                  )}
                  <span className="repo-stars">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                    {repo.stargazers_count}
                  </span>
                  {repo.forks_count > 0 && (
                    <span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 2 }}>
                        <circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/>
                        <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v3"/>
                      </svg>
                      {repo.forks_count}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )
      }

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <a href={`https://github.com/${username}?tab=repositories`} target="_blank" rel="noreferrer"
          style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          View all repositories →
        </a>
      </div>
    </div>
  );
};

const GithubIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

export default GitHubRepos;
