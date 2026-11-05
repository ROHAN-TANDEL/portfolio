import React from 'react';

export default function Contact({ contact, identity }) {
  // Extract clean display strings from URLs
  const linkedinHandle = identity.linkedin.replace(/^https?:\/\/(www\.)?/, '');
  const githubHandle = identity.github.replace(/^https?:\/\/(www\.)?/, '');

  return (
    <section id="contact" className="py-[100px] sm:py-[125px] border-t border-[var(--border)]">
      <div className="uppercase tracking-[2px] text-[13px] font-semibold text-[var(--muted)] mb-7">
        05 / Get in touch
      </div>

      <h2 className="font-manrope text-[clamp(36px,5.5vw,60px)] tracking-[-2px] leading-[1.2] font-semibold text-[var(--text)] max-w-[700px] mb-6">
        {contact.title}
      </h2>

      <p className="text-[var(--muted)] text-[15px] sm:text-[16px] leading-[1.85] max-w-[600px] mb-10">
        {contact.description}
      </p>

      {/* Explicit Contact Channels (Clickable and fully visible for print / reading) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 pt-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[1.5px] text-[var(--muted)] font-semibold font-mono">
            Direct Email
          </span>
          <a
            href={`mailto:${identity.email}`}
            className="text-[15px] sm:text-[16px] text-[var(--text)] hover:text-[var(--accent)] transition-colors font-medium underline underline-offset-4 decoration-[var(--border)] hover:decoration-[var(--accent)] break-all"
          >
            {identity.email}
          </a>
        </div>

        {/* LinkedIn */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[1.5px] text-[var(--muted)] font-semibold font-mono">
            LinkedIn
          </span>
          <a
            href={identity.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] sm:text-[16px] text-[var(--text)] hover:text-[var(--accent)] transition-colors font-medium underline underline-offset-4 decoration-[var(--border)] hover:decoration-[var(--accent)] break-all"
          >
            {linkedinHandle}
          </a>
        </div>

        {/* GitHub */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[1.5px] text-[var(--muted)] font-semibold font-mono">
            GitHub
          </span>
          <a
            href={identity.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] sm:text-[16px] text-[var(--text)] hover:text-[var(--accent)] transition-colors font-medium underline underline-offset-4 decoration-[var(--border)] hover:decoration-[var(--accent)] break-all"
          >
            {githubHandle}
          </a>
        </div>
      </div>
    </section>
  );
}
