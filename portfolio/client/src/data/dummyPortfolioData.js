export const portfolioData = {
  profile: {
    name: "Alexandre Vance",
    monogram: "AV",
    title: "Software Architect & Systems Craftsman",
    location: "San Francisco & Remote",
    status: "Considering select architecture roles & advisory",
    manifesto: "Designing resilient computing systems and tactile digital interfaces. Focused on mechanical sympathy, enduring architecture, and the elimination of superfluous friction.",
    email: "alexandre.vance@craftsman.io",
    github: "https://github.com",
    linkedin: "https://linkedin.com",
    twitter: "https://x.com"
  },

  principles: [
    {
      number: "01",
      title: "Subtraction Before Addition",
      essay: "True architectural richness doesn't come from layers of abstractions. It comes from stripping away every layer until only the essential remains. The best systems have remarkably few moving pieces."
    },
    {
      number: "02",
      title: "Mechanical Sympathy",
      essay: "Software becomes effortless when it aligns with how hardware actually works. From cache lines and memory layout to browser compositor threads, understanding physical constraints yields effortless speed."
    },
    {
      number: "03",
      title: "Enduring Durability",
      essay: "Chasing transient hype creates immediate technical debt. I architect systems meant to run stably for decades—prioritizing proven primitives, explicit contracts, and predictable failure modes."
    }
  ],

  selectedWorks: [
    {
      id: "work-1",
      year: "2025 – 2026",
      title: "Aether Spatial Canvas",
      classification: "Distributed Systems & Graphics",
      highlight: "Sub-8ms Multiplayer Sync",
      tagline: "Collaborative spatial computing environment with conflict-free state resolution.",
      narrative: "Designed from first principles to bridge browser graphics pipelines with distributed state machines. Developed custom WebGL shaders for infinite zooming and a low-footprint Rust/WASM CRDT runtime that operates peer-to-peer over WebRTC.",
      metrics: [
        { label: "Rendering Rate", val: "120 FPS" },
        { label: "State Latency", val: "< 8ms" },
        { label: "Bundle Footprint", val: "38 KB" }
      ],
      stack: ["Rust / WASM", "WebGL", "TypeScript", "WebRTC", "TailwindCSS"],
      deliverables: ["Custom CRDT Engine", "Hardware-Accelerated Canvas", "Zero-Latency Input Pipeline"]
    },
    {
      id: "work-2",
      year: "2024 – 2025",
      title: "Chronicle Event Core",
      classification: "High-Throughput Infrastructure",
      highlight: "400M Daily Events",
      tagline: "Deterministic telemetry streaming backbone with zero-loss audit replay.",
      narrative: "Built an enterprise event ingestion layer that handles bursts of 60k req/sec with guaranteed ordered delivery. Designed columnar write-path partitioning on ClickHouse and custom Go consumers that reduced overall infrastructure bills by 45%.",
      metrics: [
        { label: "Peak Ingestion", val: "65,000 evt/s" },
        { label: "Query P99", val: "12ms" },
        { label: "Infra Savings", val: "45%" }
      ],
      stack: ["Go", "ClickHouse", "Apache Kafka", "Kubernetes", "gRPC"],
      deliverables: ["Zero-Allocation Buffer Pools", "Dynamic Partition Rebalancer", "Real-time Telemetry Dashboard"]
    },
    {
      id: "work-3",
      year: "2023 – 2024",
      title: "Hyperion Orchestrator",
      classification: "Agentic Systems & Runtime",
      highlight: "Deterministic Execution",
      tagline: "Fault-tolerant state machine coordinator for autonomous agent workflows.",
      narrative: "An execution runtime designed to handle non-deterministic LLM agent invocations with strict replayability, distributed rollbacks, and budget-governed routing. Provides predictable reliability across chaotic LLM output spaces.",
      metrics: [
        { label: "Uptime Reliability", val: "99.995%" },
        { label: "Audit Accuracy", val: "100%" },
        { label: "Active Nodes", val: "1,200+" }
      ],
      stack: ["Python", "Temporal", "FastAPI", "PostgreSQL", "Docker"],
      deliverables: ["State Snapshot Engine", "Sandboxed Isolation Runtime", "Granular Cost Gateways"]
    },
    {
      id: "work-4",
      year: "2022 – 2023",
      title: "Komorebi Typographic System",
      classification: "Interface Architecture",
      highlight: "Design Engineering",
      tagline: "Precision design system engineered for high-density information display.",
      narrative: "An open, tokenized component architecture crafted for financial and data-dense enterprise applications. Features micro-typography tuning, accessibility primitives, and zero runtime CSS overhead.",
      metrics: [
        { label: "Adopting Teams", val: "18 Products" },
        { label: "Accessibility Score", val: "100 / 100" },
        { label: "CSS Weight", val: "0 KB runtime" }
      ],
      stack: ["React", "TypeScript", "Tailwind CSS", "ARIA Specs", "Vite"],
      deliverables: ["Headless Token Engine", "Micro-Typography Grid", "Keyboard Accessibility Model"]
    }
  ],

  careerArchive: [
    {
      period: "2023 — Present",
      role: "Principal Architect",
      organization: "HyperScale Labs",
      context: "San Francisco",
      impact: "Leading technical architecture for cross-organizational cloud primitives and interface performance standards. Established core latency budgets adopted by 65 engineers."
    },
    {
      period: "2020 — 2023",
      role: "Staff Systems Engineer",
      organization: "Veloce Systems",
      context: "Remote",
      impact: "Spearheaded real-time collaboration engine overhaul. Reduced memory overhead by 52% and scaled the foundation to support 3 million active users."
    },
    {
      period: "2017 — 2020",
      role: "Senior Full-Stack Engineer",
      organization: "Metropolis Digital",
      context: "New York",
      impact: "Designed distributed caching strategies and data visualization platforms for institutional clients. Mentored 8 junior and mid-level engineers."
    }
  ]
};
