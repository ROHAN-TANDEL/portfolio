const OpenToWork = ({ openToWork }: any) => {
  const { active, status, types, hireMeEmail, hireMeSubject } = openToWork;
  const mailto = `mailto:${hireMeEmail}?subject=${encodeURIComponent(hireMeSubject)}`;

  return (
    <div className={`otw-bar ${active ? 'otw-active' : 'otw-inactive'}`}>
      <div className="otw-left">
        <span className={`otw-dot ${active ? 'pulse' : ''}`} />
        <span className="otw-status">{status}</span>
        <div className="otw-types">
          {types.map((t: string) => (
            <span className="otw-type" key={t}>{t}</span>
          ))}
        </div>
      </div>
      {active && (
        <a className="btn btn-hire" href={mailto}>
          💬 Hire Me
        </a>
      )}
    </div>
  );
};

export default OpenToWork;
