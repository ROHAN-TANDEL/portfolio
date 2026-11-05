import React from 'react';

export default function Footer({ identity }) {
  return (
    <footer className="border-t border-[var(--border)] py-[25px]">
      <div className="container-custom flex flex-col sm:flex-row justify-between gap-3 text-[var(--muted)] text-[11px]">
        <span>{identity.name}</span>
        <span>© {new Date().getFullYear()} — All rights reserved.</span>
      </div>
    </footer>
  );
}
