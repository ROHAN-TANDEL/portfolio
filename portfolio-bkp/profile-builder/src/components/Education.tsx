const Education = ({ education }: any) => (
  <div className="section">
    <div className="section-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
      Education
    </div>
    {education.map((edu: any) => (
      <div className="card" key={edu.institution}>
        <div className="edu-header">
          <div>
            <div className="edu-degree">{edu.degree}</div>
            <div className="edu-institution">{edu.institution}</div>
          </div>
          <span className="exp-date-range">{edu.from} – {edu.to}</span>
        </div>
      </div>
    ))}
  </div>
);

export default Education;
