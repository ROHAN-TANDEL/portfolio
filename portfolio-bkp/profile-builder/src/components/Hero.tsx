const icons: any = {
  email: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  phone: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.5 2 2 0 0 1 3 1.32h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  location: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  linkedin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>
    </svg>
  ),
  github: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>
    </svg>
  ),
};

const Hero = ({ profile }: any) => {
  const { name, title, subtitle, bio, highlights, contact } = profile;
  const initials = name.split(' ').map((n: string) => n[0]).join('');

  return (
    <div className="hero">
      <div className="hero-avatar">{initials}</div>
      <div className="hero-content">
        <div className="hero-name">{name}</div>
        <div className="hero-title">{title}</div>
        <div className="hero-subtitle">{subtitle}</div>
        <p className="hero-bio">{bio}</p>
        <ul className="hero-highlights">
          {highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
        </ul>
        <div className="hero-contacts">
          <a className="contact-chip" href={`mailto:${contact.email}`}>
            {icons.email} {contact.email}
          </a>
          <span className="contact-chip">{icons.phone} {contact.phone1}</span>
          <span className="contact-chip">{icons.location} {contact.location}</span>
          <a className="contact-chip" href={contact.linkedin} target="_blank" rel="noreferrer">
            {icons.linkedin} LinkedIn
          </a>
          <a className="contact-chip" href={contact.github} target="_blank" rel="noreferrer">
            {icons.github} GitHub
          </a>
        </div>
      </div>
    </div>
  );
};

export default Hero;
