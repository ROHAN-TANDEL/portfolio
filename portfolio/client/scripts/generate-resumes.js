import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { portfolio } from '../src/data/portfolioData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.resolve(rootDir, 'public');
const templatesDir = path.resolve(rootDir, 'resume-templates');

if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

// Find Chrome binary
function getChromePath() {
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const chromePath = getChromePath();
if (!chromePath) {
  console.error('Error: Google Chrome / Chromium executable not found.');
  process.exit(1);
}

// Configuration for each tailored resume
const RESUME_CONFIGS = [
  {
    id: 'fullstack-node',
    roleTitle: 'Senior Full-Stack Engineer (Node.js & Modern Web)',
    pdfFilename: 'Rohan_Tandel_Resume_FullStack_NodeJS.pdf',
    accentColor: '#0284c7', // Sky Blue across all resumes
    techPillBg: '#f0f9ff',
    techPillColor: '#0369a1',
    techPillBorder: '0.5pt solid #bae6fd',
    summary:
      'Senior Full-Stack Engineer with 8+ years of experience engineering scalable, backend-heavy distributed platforms and rich data-driven web applications using Node.js, TypeScript, Angular, and React. Architected metadata-driven table frameworks cutting frontend-backend integration effort by ~70%, engineered transactional outbox auto-submission pipelines, implemented OIDC identity provider services with RS256 token signing, and delivered resilient multi-tenant SaaS platforms. Adept at bridging distributed backend microservices with modular frontend architectures.',
    skills: [
      {
        title: 'Full-Stack & Backend',
        items: 'Node.js · Express · TypeScript · RESTful APIs · Modular Monoliths'
      },
      {
        title: 'Frontend Engineering',
        items: 'Angular · React · Next.js · Modern JavaScript · Dynamic UI Generation'
      },
      {
        title: 'Data & Distributed Systems',
        items: 'PostgreSQL · Redis · MongoDB · SQS / DLQ · Transactional Outbox'
      },
      {
        title: 'Architecture & Security',
        items: 'Multi-Tenancy · OpenID Connect / OAuth2 · RBAC · Metadata-Driven Systems'
      },
      {
        title: 'Cloud & Delivery',
        items: 'AWS (ECS, Lambda, SQS, CloudFront) · Docker · CI/CD Pipelines'
      },
      {
        title: 'AI Integration & Workflows',
        items: 'LLM Orchestration · Prompt Design · Structured Outputs · Tool Calling'
      }
    ],
    fintuaRole: 'Lead Reliability & Engineering · Sr. Full-Stack / Backend Engineer',
    fintuaPills: [
      'TypeScript',
      'Node.js',
      'Angular',
      'AWS (Lambda, SQS, ECS)',
      'Redis',
      'PostgreSQL',
      'OpenID Connect',
      'Docker'
    ],
    techMahindraRole: 'Senior Full-Stack Software Engineer',
    techMahindraPills: [
      'JavaScript',
      'Node.js',
      'PHP / Laravel',
      'MySQL',
      'REST APIs',
      'Web Dashboards'
    ],
    scriptbeesRole: 'Software Developer (Full-Stack)',
    scriptbeesPills: [
      'JavaScript',
      'Node.js',
      'Express',
      'MongoDB',
      'Salesforce API',
      'JWT'
    ]
  },
  {
    id: 'backend-node',
    roleTitle: 'Senior Backend Engineer (Node.js & Distributed Systems)',
    pdfFilename: 'Rohan_Tandel_Resume_Backend_NodeJS.pdf',
    accentColor: '#0284c7', // Sky Blue across all resumes
    techPillBg: '#f0f9ff',
    techPillColor: '#0369a1',
    techPillBorder: '0.5pt solid #bae6fd',
    summary:
      'Senior Backend Engineer with 8+ years of experience architecting resilient distributed systems, asynchronous event-driven pipelines, and high-concurrency cloud backends using Node.js, TypeScript, and AWS. Architected transactional outbox auto-submission engines with randomized jitter, decoupled ingestion pipelines via AWS SQS with DLQ recovery, engineered OpenID Connect identity services with RS256 token signing, and tuned high-volume PostgreSQL/Redis data layers. Proven reliability lead driving deterministic state machines and robust multi-tenant architectures.',
    skills: [
      {
        title: 'Backend Architecture',
        items: 'Node.js · Express · TypeScript · Microservices · REST API Design'
      },
      {
        title: 'Distributed Systems & Queues',
        items: 'AWS SQS · DLQ Recovery · Transactional Outbox · Redis Caching & Pub/Sub'
      },
      {
        title: 'Data Engineering & Storage',
        items: 'PostgreSQL · Query Optimization · Index Tuning · MongoDB · Data Modeling'
      },
      {
        title: 'Security & Identity',
        items: 'OpenID Connect (OIDC) · OAuth2 · JWKS · RS256 Signing · RBAC · Multi-Tenancy'
      },
      {
        title: 'Cloud Infrastructure',
        items: 'AWS (ECS / Fargate, Lambda, SNS, API Gateway, CloudFront) · Docker · CI/CD'
      },
      {
        title: 'AI Integration & Workflows',
        items: 'LLM Orchestration · Prompt Design · Structured Outputs · Tool Calling · Guardrails'
      }
    ],
    fintuaRole: 'Lead Reliability & Engineering · Sr. Backend & Integration Engineer',
    fintuaPills: [
      'Node.js',
      'TypeScript',
      'AWS (Lambda, SQS, ECS)',
      'Transactional Outbox',
      'PostgreSQL',
      'Redis',
      'OpenID Connect',
      'Docker'
    ],
    techMahindraRole: 'Senior Software Engineer (Backend Systems)',
    techMahindraPills: [
      'Node.js',
      'PHP / Laravel',
      'MySQL',
      'Offline Sync',
      'REST APIs',
      'Distributed Data'
    ],
    scriptbeesRole: 'Software Developer (Backend & Integrations)',
    scriptbeesPills: [
      'Node.js',
      'Express',
      'MongoDB',
      'Salesforce API',
      'JWT',
      'REST APIs'
    ]
  },
  {
    id: 'fullstack-php-laravel',
    roleTitle: 'Senior Full-Stack Engineer (PHP & Laravel / Modern Web)',
    pdfFilename: 'Rohan_Tandel_Resume_FullStack_PHP_Laravel.pdf',
    accentColor: '#0284c7', // Sky Blue
    techPillBg: '#f0f9ff',
    techPillColor: '#0369a1',
    techPillBorder: '0.5pt solid #bae6fd',
    summary:
      'Senior Full-Stack Engineer with 8+ years of experience architecting enterprise web applications and scalable backend systems using PHP 8+, Laravel, MySQL, Node.js, and modern TypeScript frameworks (Angular, React). Track record building modular monoliths, offline-first data synchronization engines, multi-tenant SaaS platforms, and enterprise integrations. Adept at tuning complex relational database schemas, designing resilient RESTful APIs, and pairing robust PHP/Laravel backends with responsive frontends and complementary Node.js microservices.',
    skills: [
      {
        title: 'PHP & Laravel Architecture',
        items: 'PHP 8+ · Laravel (Eloquent, Queues, Jobs) · Modular Monoliths · REST APIs'
      },
      {
        title: 'Relational Databases & SQL',
        items: 'MySQL · PostgreSQL · Query Optimization · Index Tuning · Complex Schemas'
      },
      {
        title: 'Full-Stack & Web',
        items: 'Node.js · Express · TypeScript · Angular · React · Next.js · Dynamic UI'
      },
      {
        title: 'Distributed Systems & Caching',
        items: 'Redis Caching · SQS / Queues · Transactional Outbox · Scheduled Workers'
      },
      {
        title: 'Architecture & Security',
        items: 'Multi-Tenancy · OpenID Connect / OAuth2 · RBAC · Data Synchronization'
      },
      {
        title: 'Cloud & Delivery',
        items: 'AWS (ECS, Lambda, SQS, CloudFront) · Docker · CI/CD Pipelines'
      }
    ],
    fintuaRole: 'Lead Reliability & Engineering · Sr. Full-Stack / Backend Engineer',
    fintuaPills: [
      'PHP & Laravel Patterns',
      'Node.js',
      'TypeScript',
      'PostgreSQL',
      'Redis',
      'AWS (SQS, Lambda)',
      'OpenID Connect',
      'Docker'
    ],
    techMahindraRole: 'Senior Software Engineer (PHP, Laravel & Full-Stack)',
    techMahindraPills: [
      'PHP 8',
      'Laravel',
      'MySQL',
      'Offline Sync',
      'REST APIs',
      'JavaScript / Node.js'
    ],
    scriptbeesRole: 'Software Developer (Full-Stack)',
    scriptbeesPills: [
      'JavaScript',
      'Node.js',
      'Express',
      'MongoDB',
      'Salesforce API',
      'JWT'
    ]
  }
];

function generateHTML(config) {
  const { identity, personalProjects, experience } = portfolio;
  const fintua = experience[0];
  const techMahindra = experience[1];
  const scriptbees = experience[2];

  const nexora = personalProjects.find((p) => p.name === 'Nexora') || personalProjects[0];
  const relay = personalProjects.find((p) => p.name === 'Relay') || personalProjects[1];

  const cleanUrl = (url) => url.replace(/^https?:\/\//, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${identity.name} — ${config.roleTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --accent: ${config.accentColor};
    }

    @page {
      size: A4 portrait;
      margin: 11mm 13mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1a1a1a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 9.5pt;
      -webkit-font-smoothing: antialiased;
    }

    a {
      color: #1a1a1a;
      text-decoration: none;
    }

    /* Header */
    .header {
      border-bottom: 1.5pt solid #1a1a1a;
      padding-bottom: 8pt;
      margin-bottom: 10pt;
    }

    .name-title {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4pt;
    }

    h1 {
      font-family: 'Manrope', sans-serif;
      font-size: 20pt;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #0f172a;
    }

    .title {
      font-family: 'Manrope', sans-serif;
      font-size: 10.5pt;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: -0.01em;
    }

    .contact-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10pt;
      font-size: 8.5pt;
      color: #4b5563;
      margin-top: 2pt;
    }

    .contact-item {
      display: inline-flex;
      align-items: center;
      gap: 3pt;
    }

    .contact-item a {
      color: #374151;
      border-bottom: 1px dotted #9ca3af;
    }

    /* Sections */
    .section {
      margin-bottom: 10pt;
    }

    .section-title {
      font-family: 'Manrope', sans-serif;
      font-size: 9.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0f172a;
      border-bottom: 0.75pt solid #e5e7eb;
      padding-bottom: 2pt;
      margin-bottom: 6pt;
    }

    /* Summary */
    .summary-text {
      font-size: 9pt;
      color: #374151;
      line-height: 1.5;
    }

    /* Capabilities Matrix */
    .skills-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5pt 10pt;
      margin-bottom: 2pt;
    }

    .skill-category {
      font-size: 8.5pt;
    }

    .skill-category-title {
      font-weight: 700;
      font-family: 'Manrope', sans-serif;
      color: #111827;
      font-size: 8.5pt;
      margin-bottom: 1pt;
    }

    .skill-list {
      color: #4b5563;
      line-height: 1.35;
    }

    /* Experience Items */
    .job {
      margin-bottom: 9pt;
      page-break-inside: avoid;
    }

    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1pt;
    }

    .job-role {
      font-family: 'Manrope', sans-serif;
      font-weight: 700;
      font-size: 10pt;
      color: #0f172a;
    }

    .job-period {
      font-size: 8pt;
      font-family: 'DM Sans', sans-serif;
      color: #6b7280;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .job-company {
      font-size: 8.5pt;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 3pt;
    }

    .job-summary {
      font-size: 8.8pt;
      color: #374151;
      margin-bottom: 4pt;
      line-height: 1.45;
    }

    .contributions {
      list-style-type: none;
      padding-left: 0;
    }

    .contributions li {
      position: relative;
      padding-left: 10pt;
      font-size: 8.5pt;
      color: #374151;
      line-height: 1.42;
      margin-bottom: 3pt;
    }

    .contributions li::before {
      content: "•";
      position: absolute;
      left: 1pt;
      color: var(--accent);
      font-size: 10pt;
      line-height: 1;
      top: 0;
    }

    .contributions strong {
      color: #111827;
      font-weight: 600;
    }

    .tech-pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 3pt;
      margin-top: 3pt;
    }

    .tech-pill {
      font-size: 7.5pt;
      background: ${config.techPillBg};
      color: ${config.techPillColor};
      padding: 1pt 4pt;
      border-radius: 2pt;
      font-weight: 500;
      border: ${config.techPillBorder};
    }

    /* Independent Platforms (Horizontal Full-Width) */
    .project-item {
      margin-bottom: 8pt;
      page-break-inside: avoid;
    }

    .project-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 1pt;
    }

    .project-role {
      font-family: 'Manrope', sans-serif;
      font-weight: 700;
      font-size: 9.8pt;
      color: #0f172a;
    }

    .project-role a {
      color: #0f172a;
      text-decoration: none;
    }

    .project-role a:hover {
      color: var(--accent);
    }

    .project-status {
      font-size: 8pt;
      font-family: 'DM Sans', sans-serif;
      color: #6b7280;
      font-weight: 500;
      white-space: nowrap;
    }

    .project-meta-row {
      font-size: 8.3pt;
      color: #4b5563;
      margin-bottom: 3pt;
    }

    .project-meta-row a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
      border-bottom: 0.75pt dotted var(--accent);
    }

    .project-desc {
      font-size: 8.5pt;
      color: #374151;
      line-height: 1.42;
      margin-bottom: 3pt;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="name-title">
      <h1>${identity.name}</h1>
      <span class="title">${config.roleTitle}</span>
    </div>
    <div class="contact-row">
      <span class="contact-item"><strong>Phone:</strong> <a href="tel:${identity.phone.replace(/\\s+/g, '')}">${identity.phone}</a></span>
      <span class="contact-item"><strong>Email:</strong> <a href="mailto:${identity.email}">${identity.email}</a></span>
      <span class="contact-item"><strong>Portfolio:</strong> <a href="${identity.portfolioUrl}" target="_blank">${cleanUrl(identity.portfolioUrl)}</a></span>
      <span class="contact-item"><strong>LinkedIn:</strong> <a href="${identity.linkedin}" target="_blank">${cleanUrl(identity.linkedin)}</a></span>
      <span class="contact-item"><strong>GitHub:</strong> <a href="${identity.github}" target="_blank">${cleanUrl(identity.github)}</a></span>
      <span class="contact-item"><strong>Location:</strong> ${identity.location}</span>
    </div>
  </header>

  <!-- Executive Summary -->
  <section class="section">
    <div class="section-title">Professional Summary</div>
    <p class="summary-text">${config.summary}</p>
  </section>

  <!-- Capabilities (The 6-Category Matrix) -->
  <section class="section">
    <div class="section-title">Core Capabilities & Technical Expertise</div>
    <div class="skills-grid">
      ${config.skills
        .map(
          (cat) => `
      <div class="skill-category">
        <div class="skill-category-title">${cat.title}</div>
        <div class="skill-list">${cat.items}</div>
      </div>`
        )
        .join('')}
    </div>
  </section>

  <!-- Professional Experience -->
  <section class="section">
    <div class="section-title">Professional Experience</div>

    <!-- Fintua -->
    <article class="job">
      <div class="job-header">
        <span class="job-role">${config.fintuaRole}</span>
        <span class="job-period">${fintua.period}</span>
      </div>
      <div class="job-company">${fintua.company} (${fintua.location})</div>
      <p class="job-summary">${fintua.summary}</p>
      <ul class="contributions">
        ${fintua.contributions
          .map(
            (c) => `
        <li>
          <strong>${c.title}:</strong> ${c.description}
        </li>`
          )
          .join('')}
      </ul>
      <div class="tech-pill-row">
        ${config.fintuaPills.map((pill) => `<span class="tech-pill">${pill}</span>`).join('')}
      </div>
    </article>

    <!-- Tech Mahindra -->
    <article class="job">
      <div class="job-header">
        <span class="job-role">${config.techMahindraRole}</span>
        <span class="job-period">${techMahindra.period}</span>
      </div>
      <div class="job-company">${techMahindra.company}</div>
      <p class="job-summary">${techMahindra.summary}</p>
      <ul class="contributions">
        ${techMahindra.contributions
          .map(
            (c) => `
        <li>
          <strong>${c.title}:</strong> ${c.description}
        </li>`
          )
          .join('')}
      </ul>
      <div class="tech-pill-row">
        ${config.techMahindraPills.map((pill) => `<span class="tech-pill">${pill}</span>`).join('')}
      </div>
    </article>

    <!-- Scriptbees -->
    <article class="job">
      <div class="job-header">
        <span class="job-role">${config.scriptbeesRole}</span>
        <span class="job-period">${scriptbees.period}</span>
      </div>
      <div class="job-company">${scriptbees.company}</div>
      <p class="job-summary">${scriptbees.summary}</p>
      <ul class="contributions">
        ${scriptbees.contributions
          .map(
            (c) => `
        <li>
          <strong>${c.title}:</strong> ${c.description}
        </li>`
          )
          .join('')}
      </ul>
      <div class="tech-pill-row">
        ${config.scriptbeesPills.map((pill) => `<span class="tech-pill">${pill}</span>`).join('')}
      </div>
    </article>
  </section>

  <!-- Independent Platforms (Data Driven & Fully Horizontal) -->
  <section class="section">
    <div class="section-title">Independent Platforms & Architecture Initiatives</div>
    
    <article class="project-item">
      <div class="project-header">
        <span class="project-role"><a href="${nexora.link}" target="_blank">${nexora.name} — ${nexora.subtitle} ↗</a></span>
        <span class="project-status">${nexora.category} · ${nexora.state}</span>
      </div>
      <div class="project-meta-row">
        Live Platform: <a href="${nexora.link}" target="_blank">${cleanUrl(nexora.link)}</a>
      </div>
      <p class="project-desc">${nexora.description}</p>
      <div class="tech-pill-row">
        ${nexora.technologies.map((t) => `<span class="tech-pill">${t}</span>`).join('')}
      </div>
    </article>

    <article class="project-item">
      <div class="project-header">
        <span class="project-role"><a href="${relay.link}" target="_blank">${relay.name} (${relay.formerName}) — ${relay.subtitle} ↗</a></span>
        <span class="project-status">${relay.category} · ${relay.state}</span>
      </div>
      <div class="project-meta-row">
        Live Platform: <a href="${relay.link}" target="_blank">${cleanUrl(relay.link)}</a>
      </div>
      <p class="project-desc">${relay.description}</p>
      <div class="tech-pill-row">
        ${relay.technologies.map((t) => `<span class="tech-pill">${t}</span>`).join('')}
      </div>
    </article>
  </section>

</body>
</html>`;
}

console.log('Generating tailored HTML templates from portfolioData.js...');

for (const config of RESUME_CONFIGS) {
  const htmlContent = generateHTML(config);
  const htmlFile = path.resolve(templatesDir, `${config.id}.html`);
  fs.writeFileSync(htmlFile, htmlContent, 'utf-8');

  const pdfOutput = path.resolve(publicDir, config.pdfFilename);
  console.log(`Compiling PDF for ${config.roleTitle} -> ${config.pdfFilename}...`);

  const cmd = `"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfOutput}" "file://${htmlFile}"`;
  execSync(cmd, { stdio: 'pipe' });
}

// Also compile default fallback resume (pointing to fullstack-node)
const defaultPdf = path.resolve(publicDir, 'Rohan_Tandel_Resume.pdf');
const defaultHtml = path.resolve(templatesDir, 'fullstack-node.html');
console.log('Compiling default Rohan_Tandel_Resume.pdf...');
execSync(`"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${defaultPdf}" "file://${defaultHtml}"`, { stdio: 'pipe' });

console.log('✓ All tailored resumes successfully generated from portfolioData.js!');
