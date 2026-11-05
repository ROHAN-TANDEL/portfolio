const Services = ({ services }: any) => (
  <div className="section">
    <div className="section-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      What I Can Do For You
    </div>
    <div className="services-grid">
      {services.items.map((s: any) => (
        <div className="service-card" key={s.title}>
          <span className="service-icon">{s.icon}</span>
          <div className="service-title">{s.title}</div>
          <div className="service-desc">{s.desc}</div>
        </div>
      ))}
    </div>
  </div>
);

export default Services;
