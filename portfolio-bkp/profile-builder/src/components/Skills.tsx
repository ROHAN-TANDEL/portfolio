const Skills = ({ skills }: any) => (
  <div className="section">
    <div className="section-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      </svg>
      Technical Stack
    </div>
    <div className="card">
      <div className="skills-grid">
        {skills.map((group: any) => (
          <div className="skill-group" key={group.category}>
            <div className="skill-group-name">{group.category}</div>
            <div className="skill-tags">
              {group.items.map((item: string) => (
                <span className="skill-tag" key={item}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Skills;
