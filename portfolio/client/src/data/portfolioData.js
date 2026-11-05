export const portfolio = {
  identity: {
    name: "Rohan Tandel",
    title: "Platform Engineer & Senior Backend Architect",
    location: "India / Remote",
    email: "r9591343@gmail.com",
    linkedin: "https://www.linkedin.com/in/rohan-devendra",
    github: "https://github.com/ROHAN-TANDEL"
  },

  hero: {
    eyebrow: "SOFTWARE ENGINEERING",
    titlePrefix: "Building systems\nthat ",
    titleHighlight: "scale with purpose.",
    description:
      "A software engineer focused on designing reliable backend systems, configurable multi-tenant platforms, and resilient distributed architectures.",
    meta: [
      "8+ years of engineering experience",
      "Backend & distributed systems",
      "Platform architecture"
    ]
  },

  about: {
    main:
      "I work at the intersection of software engineering, system architecture and product thinking.",
    paragraphs: [
      "My experience spans backend microservices, asynchronous event pipelines, transactional integrity, and configurable multi-tenant platforms.",
      "I enjoy understanding complex business requirements and translating them into maintainable systems with clear boundaries, operational guardrails, and fault-tolerant patterns.",
      "My focus is on building software that remains understandable and reliable as products, compliance rules, and teams scale."
    ]
  },

  // Section 02: Personal Work (Independent SaaS Products)
  personalProjects: [
    {
      number: "01",
      name: "Nexora",
      subtitle: "Configurable Data Platform SaaS",
      category: "Platform Engineering",
      state: "Active Development",
      link: "https://github.com/ROHAN-TANDEL/nexora",
      problem:
        "Business software frequently requires bespoke, hard-coded UI tables, filter logic, and query adapters, creating continuous engineering maintenance overhead.",
      description:
        "A metadata-driven data platform that standardizes dynamic table rendering, column behaviors, filtering, sorting, permissions, and entity schemas across business applications—eliminating repetitive conditional development.",
      highlights: [
        "Metadata-Driven Architecture: Standardized backend-defined column dependencies, validation rules, and action behaviors rendered dynamically.",
        "Query Optimization: Translates UI filter graphs into optimized PostgreSQL queries with automated indexing hints and pagination.",
        "Reusable UI Behaviors: Abstracted table behaviors into modular components, removing boilerplate conditional logic from product features."
      ],
      technologies: [
        "TypeScript",
        "Angular",
        "Node.js",
        "PostgreSQL",
        "Tailwind CSS",
        "API Design"
      ]
    },
    {
      number: "02",
      name: "Relay",
      subtitle: "Recovery Operations & Resolution Platform",
      formerName: "formerly Kooey Recover",
      category: "Product & Platform Architecture",
      state: "Active Development",
      link: "https://github.com/ROHAN-TANDEL/relay",
      problem:
        "Disjointed coordination, fragmented communication, and inflexible batch update mechanisms between financial institutions and debt recovery agencies.",
      description:
        "A capability-driven, multi-tenant recovery operations platform connecting financial institutions and recovery agencies. Focused on dispute tracking, batch workflows, automated scheduling rules, and payment resolution lifecycles.",
      highlights: [
        "Capability-Driven Modular Architecture: Modularized service boundaries allowing isolated workflow customization per institution while sharing processing pipelines.",
        "Configurable Batch Scheduler: Manages asynchronous processing queues, SLA tracking, and automated status escalations across recovery stages.",
        "Multi-Tenant Partitioning: Strict data isolation and role-based access control protecting sensitive institutional recovery records."
      ],
      technologies: [
        "Node.js",
        "TypeScript",
        "PostgreSQL",
        "Multi-tenancy",
        "Redis",
        "Modular Monolith"
      ]
    }
  ],

  // Section 03: Career (Enterprise Experience & Contributions)
  experience: [
    {
      period: "14 Jul 2022 — Present",
      role: "Lead Reliability & Engineering · Sr. Backend & Integration Engineer",
      company: "Fintua · European TaxTech & Fintech SaaS",
      location: "Remote",
      summary:
        "Led reliability engineering and served as Scrum Lead. Architected core compliance infrastructure, OpenID Connect identity services, outbox submission engines, and metadata-driven frameworks across European jurisdictions.",
      contributions: [
        {
          title: "Configurable Return Data & Table Framework",
          description:
            "Designed and developed a backend-metadata-driven configuration framework for reusable data tables and return-specific XML data definitions. Standardized dependencies, filters, and field rules across countries and return types, reducing repetitive conditional development and cutting delivery time for new tables and return-data structures by approximately 70%."
        },
        {
          title: "Shared Transaction Ingestion Across Return Types",
          description:
            "Reworked transaction ingestion to decouple raw transaction storage from individual return lifecycles. Enabled multiple related return types to process shared transaction data while maintaining independent catch rules, audit trails, editing permissions, and status transitions. Integrated SQS, DLQ recovery, Redis caching, and PostgreSQL query optimizations."
        },
        {
          title: "Automated Return Submission Service",
          description:
            "Engineered an automated tax-return submission service using a scheduler-triggered transactional outbox pattern. Managed tax-office API submissions, response collection, exponential backoff retries with randomized jitter, and structured submission states, while retaining manual submission as a fallback."
        },
        {
          title: "OpenID Connect Identity Infrastructure & E-Invoice",
          description:
            "Configured and implemented Fintua's OpenID Connect identity provider (OIDC discovery, Authorization Code flow, JWKS, UserInfo, and RS256 token signing). Developed supporting client data-upload APIs and authenticated navigation between Compliance and the E-Invoice product."
        },
        {
          title: "B2B Subdomain & Partner Onboarding",
          description:
            "Implemented an end-to-end B2B partner onboarding and authentication workflow, supporting both subdomain-based and standard configurations with partner-specific login, email setup, and UI routing."
        },
        {
          title: "Standalone Expense Management Integration (Ramp)",
          description:
            "Independently developed an end-to-end integration with Ramp as a solo initiative, implementing OAuth authentication and API connectivity to ingest company expense transactions into the expense management workflow."
        },
        {
          title: "Return Lifecycle & 8-Stage Status Architecture",
          description:
            "Restructured the return lifecycle status system into 8 deterministic states (Data provided → Prepare → Reviewed → Approve → Submit → Submitting / Submission failed → Submitted to Tax Authority) with country-specific event transitions."
        },
        {
          title: "Engineering Leadership & Reliability",
          description:
            "Led the Reliability & Engineering team and served as Scrum Lead. Optimized CI/CD deployment pipelines, conducted low-level design (LLD) reviews, and mentored engineers through feature development and delivery."
        }
      ],
      technologies: [
        "TypeScript",
        "Node.js",
        "AWS (Lambda, SQS, ECS)",
        "Redis",
        "PostgreSQL",
        "OpenID Connect",
        "Docker",
        "Transactional Outbox"
      ]
    },
    {
      period: "02 Jul 2020 — 31 May 2022",
      role: "Senior Software Engineer",
      company: "Tech Mahindra Pvt Ltd",
      location: "India",
      summary:
        "Engineered distributed synchronization systems for offline educational software and developed broadband customer onboarding workflows for British Telecom.",
      contributions: [
        {
          title: "OfflineSync (Educational Initiative / Mindspark)",
          description:
            "Developed a bidirectional data synchronization system for offline Mindspark deployments in field schools with limited bandwidth. Engineered schedulers, retry logic, versioning, JSON data compression, remote updates/rollbacks, and an operational dashboard for remote monitoring and manual sync triggers."
        },
        {
          title: "Plusnet Broadband ISP (British Telecom)",
          description:
            "Developed customer-facing dashboard features for broadband connection requests, address validation support systems, and mini approval workflow engines."
        },
        {
          title: "Mindspark Core Maintenance",
          description:
            "Delivered core learning feature enhancements, production bug resolutions, and legacy codebase migrations."
        }
      ],
      technologies: [
        "JavaScript",
        "Node.js",
        "PHP",
        "Laravel",
        "MySQL",
        "Offline-First Sync",
        "REST APIs"
      ]
    },
    {
      period: "04 Jun 2018 — 02 Jul 2020",
      role: "Software Developer",
      company: "Scriptbees Pvt Ltd",
      location: "India",
      summary:
        "Built authentication, academic credential systems, and enterprise Salesforce integrations.",
      contributions: [
        {
          title: "Client Greenlight",
          description:
            "Engineered JWT authentication systems, academic transcript management workflows, and multi-tenant organization onboarding."
        },
        {
          title: "VolunteerMarks",
          description:
            "Integrated Salesforce APIs, implemented user check-in and check-out tracking mechanisms, and developed automated email and notification delivery engines."
        }
      ],
      technologies: [
        "JavaScript",
        "Node.js",
        "Express",
        "MongoDB",
        "Salesforce API",
        "JWT Auth"
      ]
    }
  ],

  // Section 04: Capabilities (The 6-Category Matrix)
  expertise: [
    {
      title: "Backend",
      skills: [
        "Node.js",
        "Express",
        "TypeScript",
        "PHP",
        "Laravel"
      ]
    },
    {
      title: "Application",
      skills: [
        "Angular",
        "React",
        "Next.js",
        "JavaScript"
      ]
    },
    {
      title: "Data",
      skills: [
        "PostgreSQL",
        "Redis",
        "MongoDB"
      ]
    },
    {
      title: "Cloud & Delivery",
      skills: [
        "AWS (ECS / Fargate, Lambda)",
        "Docker & ECR",
        "SQS & SNS",
        "API Gateway & CloudFront",
        "CI/CD Pipelines"
      ]
    },
    {
      title: "Architecture",
      skills: [
        "Multi-tenancy",
        "Modular Monoliths",
        "Event-Driven Systems",
        "Asynchronous Processing",
        "Transactional Outbox",
        "Authentication & RBAC"
      ]
    },
    {
      title: "AI Integration",
      skills: [
        "LLM Orchestration",
        "Prompt Design",
        "Structured Outputs",
        "Tool Calling",
        "Agent Workflows",
        "Guardrails"
      ]
    }
  ],

  contact: {
    title: "Have an interesting problem to solve?",
    description:
      "Interested in conversations around platform engineering, backend architecture, and building scalable, reliable software systems."
  }
};
