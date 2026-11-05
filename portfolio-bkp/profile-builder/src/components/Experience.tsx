const Experience = ({ experience }: any) => (
  <div className="section">
    <div className="section-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
      Professional Experience
    </div>

    {experience.map((exp: any) => (
      <div className="card" key={exp.company}>
        <div className="exp-company-header">
          <div>
            <div className="exp-company-name">{exp.company}</div>
            <div className="exp-company-type">{exp.companyType}</div>
          </div>
          <span className="exp-date-range">{exp.from} – {exp.to}</span>
        </div>
        <div className="exp-company-desc">{exp.companyDesc}</div>

        {exp.roles.map((role: any) => (
          <div className="role-block" key={role.title + role.from}>
            <div className="role-header">
              <span className="role-title">{role.title}</span>
              <span className="role-date">{role.from} → {role.to}</span>
            </div>

            <div className="role-tech">
              {role.techStack.map((t: string) => (
                <span className="role-tech-tag" key={t}>{t}</span>
              ))}
            </div>

            <ul className="role-responsibilities">
              {role.responsibilities.map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ))}
  </div>
);

export default Experience;
