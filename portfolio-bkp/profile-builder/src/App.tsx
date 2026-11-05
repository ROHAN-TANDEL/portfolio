import { useState } from 'react';
import './App.css';

import resumeData from './data/resume.json';

import Navbar, { ROLES, type Role } from './components/Navbar';
import Hero from './components/Hero';
import Metrics from './components/Metrics';
import OpenToWork from './components/OpenToWork';
import Skills from './components/Skills';
import Services from './components/Services';
import Experience from './components/Experience';
import CaseStudies from './components/CaseStudies';
import GitHubRepos from './components/GitHubRepos';
import Education from './components/Education';
import Availability from './components/Availability';
import DraftWrapper from './components/DraftWrapper';

function App() {
  const [role, setRole] = useState<Role>(ROLES.GUEST);
  const {
    profile, skills, experience, education,
    availability, githubUsername,
    metrics, openToWork, services, caseStudies,
  } = resumeData as any;

  const isEditor = role === ROLES.EDITOR;
  const isAdmin  = role === ROLES.ADMIN;

  return (
    <div className="app">
      <Navbar role={role} onRoleChange={setRole} />

      {(isEditor || isAdmin) && (
        <div className="editor-bar">
          <span>{isAdmin ? '⚡ Admin mode' : '✏️ Editor mode'} — unpublished sections are visible below.</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Publishing controls · Phase 2
          </span>
        </div>
      )}

      <main className="main">
        <Hero profile={profile} />

        {/* 1 — Impact metrics */}
        <DraftWrapper section={metrics} role={role}>
          <Metrics metrics={metrics} />
        </DraftWrapper>

        {/* 2 — Open to work + Hire Me CTA */}
        <DraftWrapper section={openToWork} role={role}>
          <OpenToWork openToWork={openToWork} />
        </DraftWrapper>

        <Skills skills={skills} />

        {/* 3 — Services (what I offer) */}
        <DraftWrapper section={services} role={role}>
          <Services services={services} />
        </DraftWrapper>

        <Experience experience={experience} />

        {/* 4 — Case studies */}
        <DraftWrapper section={caseStudies} role={role}>
          <CaseStudies caseStudies={caseStudies} />
        </DraftWrapper>

        <GitHubRepos username={githubUsername} />
        <Education education={education} />
        <Availability availability={availability} role={role} />
      </main>
    </div>
  );
}

export default App;
