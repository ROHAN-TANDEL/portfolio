const CaseStudies = ({ caseStudies }: any) => (
  <div className="section">
    <div className="section-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
      Case Studies
    </div>
    <div className="cs-list">
      {caseStudies.items.map((cs: any) => (
        <div className="cs-card" key={cs.title}>
          <div className="cs-header">
            <span className="cs-tag">{cs.tag}</span>
            <div className="cs-title">{cs.title}</div>
          </div>
          <div className="cs-body">
            <div className="cs-block">
              <div className="cs-block-label">🔴 Problem</div>
              <p>{cs.problem}</p>
            </div>
            <div className="cs-block">
              <div className="cs-block-label">🔧 Solution</div>
              <p>{cs.solution}</p>
            </div>
            <div className="cs-block">
              <div className="cs-block-label">✅ Outcome</div>
              <p>{cs.outcome}</p>
            </div>
          </div>
          <div className="cs-stack">
            {cs.stack.map((t: string) => (
              <span className="role-tech-tag" key={t}>{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default CaseStudies;
