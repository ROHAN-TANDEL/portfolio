const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 61,
    category: "Docker Compose & Local Orchestration",
    concept: "The Compose Specification (compose.yaml vs legacy versioning)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the modern Compose Specification, and why is the top-level `version: '3.8'` declaration obsolete?",
    quickAnswer: "The modern **Compose Specification** consolidates all Compose variations into an open standard. The preferred default filename is **`compose.yaml`** (or `compose.yml`). The top-level `version: 'x.x'` declaration is officially **deprecated and ignored** by modern Docker Compose V2, which automatically supports all modern specification features.",
    detailedAnswer: "Historically, Docker Compose files required declaring a version string (e.g. `version: '2'`, `version: '3.8'`), which caused confusion between Docker Engine versions, Compose versions, and Swarm capabilities. In 2020, Docker, AWS, and Microsoft formed the Compose Specification. In modern Compose V2 (Go implementation `docker compose`), the version attribute is obsolete and emits a warning if included.",
    code: `# MODERN STANDARD: compose.yaml (No 'version' string!)
services:
  web:
    build: .
    ports:
      - "80:8080"
    environment:
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pg_data:

secrets:
  db_password:
    file: ./secrets/db_pass.txt`,
    recallHint: "Standard filename is compose.yaml. Top-level 'version:' string is deprecated and omitted in Compose V2.",
    interviewTip: "When writing Compose files in technical coding interviews, do NOT include `version: '3.8'`. Omitting it proves you are current with modern Docker Compose V2 standards.",
    tags: ["compose", "compose-yaml", "specification", "compose-v2", "orchestration"],
    practice: [
      "What is the file resolution search order used by `docker compose` (`compose.yaml` vs `docker-compose.yml`)?",
      "How does Compose derive the default project namespace prefix for containers and networks?"
    ]
  }),

  createCard({
    idNum: 62,
    category: "Docker Compose & Local Orchestration",
    concept: "Service Dependencies & Healthcheck Conditions (depends_on)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does simple `depends_on: ['db']` fail to prevent race conditions during database startup, and how does `condition: service_healthy` fix it?",
    quickAnswer: "Simple `depends_on: ['db']` only waits for the database container to **start its process**, NOT for the database engine to finish initializing and accepting socket connections. PostgreSQL takes 5-15 seconds to run initialization scripts, during which the API container crashes with connection refused. Fixing this requires `condition: service_healthy` tied to a database healthcheck.",
    detailedAnswer: "When `db` starts, the container transitions to `running` immediately. But PostgreSQL is not ready: it initializes the cluster, runs schema migrations, restarts, and only then begins listening on port 5432. If `backend` boots in parallel, it fails its startup connection and crashes. Configuring `depends_on.db.condition: service_healthy` halts `backend` startup until `pg_isready` returns exit code 0.",
    code: `services:
  backend:
    build: ./backend
    # PREVENTS CRASH LOOP: Waits until DB is fully initialized and healthy!
    depends_on:
      database:
        condition: service_healthy
        restart: true # Restarts backend if database recovers

  database:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app_db
      POSTGRES_PASSWORD: secretpassword
    # Defines healthiness probe:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app_db"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s`,
    recallHint: "depends_on only checks container startup. Use condition: service_healthy to wait for database ready.",
    interviewTip: "This is one of the most frequent Docker Compose production questions. Mention that `condition: service_completed_successfully` can also be used to wait for one-off migration containers to finish.",
    tags: ["depends-on", "service-healthy", "startup-order", "race-conditions", "healthcheck"],
    practice: [
      "What does `condition: service_completed_successfully` do for database migration services?",
      "How does `restart: true` in `depends_on` handle database restarts?"
    ]
  }),

  createCard({
    idNum: 63,
    category: "Docker Compose & Local Orchestration",
    concept: "Environment Variable Precedence (.env vs env_file vs environment)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the order of precedence for environment variables in Docker Compose when multiple sources define the same variable?",
    quickAnswer: "From highest precedence (overrides everything) to lowest:\n1. **`docker compose run -e VAR=val`** (CLI override)\n2. **Host OS Shell Environment Variables**\n3. **`environment` block in `compose.yaml`**\n4. **`env_file` block in `compose.yaml`**\n5. **`.env` file** (used ONLY for variable interpolation in `compose.yaml`).",
    detailedAnswer: "Understanding precedence prevents production misconfiguration bugs. A common misunderstanding is that `.env` sets container environment variables directly. In reality, `.env` is read by the Compose CLI on the host to interpolate `${VAR}` tokens inside `compose.yaml`. To inject files directly into container environments at runtime, use the `env_file:` directive.",
    code: `# 1. .env file on host (used for Compose interpolation):
# PORT=8080
# DB_HOST=db.internal

# 2. compose.yaml:
services:
  api:
    image: my-api:latest
    # Loads external environment key-value file:
    env_file:
      - ./config/common.env
      - ./config/secrets.env
    # Explicit 'environment' overrides keys defined in env_file!
    environment:
      PORT: \${PORT:-3000}       # Reads host .env or falls back to 3000
      NODE_ENV: production     # Explicit override!

# 3. CLI override (highest priority):
# $ docker compose run -e NODE_ENV=development api`,
    recallHint: "CLI flag (-e) > Host Shell > environment: block > env_file: > .env (interpolation only).",
    interviewTip: "Emphasize that `.env` values are interpolated on the host at Compose parsing time. If you run Compose in CI, host shell environment variables will override `.env` values automatically.",
    tags: ["env-precedence", "env-file", "environment", "interpolation", "configuration"],
    practice: [
      "How do default values work in Compose interpolation, e.g. `${TAG:-latest}` vs `${TAG:?error}`?",
      "Can multiple `env_file` files be declared, and how are conflicts resolved?"
    ]
  }),

  createCard({
    idNum: 64,
    category: "Docker Compose & Local Orchestration",
    concept: "Compose Multi-File Overrides & compose.override.yaml",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do multi-file overrides work in Docker Compose, and when is `compose.override.yaml` loaded automatically?",
    quickAnswer: "If present in the working directory, `compose.override.yaml` (or `docker-compose.override.yml`) is **automatically merged** on top of `compose.yaml` when running `docker compose up`. To target specific environments (staging, production), pass files explicitly via `-f`: `docker compose -f compose.yaml -f compose.prod.yaml up -d`.",
    detailedAnswer: "Multi-file inheritance adheres to the DRY (Don't Repeat Yourself) principle. The base `compose.yaml` defines the core architecture (services, networks, dependencies). The developer's local `compose.override.yaml` adds volume bind mounts for hot-reloading and publishes debug ports. In production CI/CD, developers pass `-f compose.yaml -f compose.prod.yaml`, which replaces bind mounts with production image tags and applies strict resource limits.",
    code: `# 1. BASE FILE: compose.yaml (Shared architecture)
services:
  web:
    image: company/web-service:latest
    environment:
      - APP_ENV=production

# -------------------------------------------------------------
# 2. LOCAL DEV: compose.override.yaml (Auto-merged locally!)
services:
  web:
    build: .             # Overrides image with local source build
    volumes:
      - ./src:/app/src   # Hot reload bind mount
    ports:
      - "3000:3000"      # Exposes local port

# -------------------------------------------------------------
# 3. PRODUCTION DEPLOYMENT: Explicit merge
# $ docker compose -f compose.yaml -f compose.prod.yaml up -d`,
    recallHint: "compose.override.yaml is merged automatically locally. For prod, chain via -f compose.yaml -f compose.prod.yaml.",
    interviewTip: "Never commit `compose.override.yaml` to Git! Add it to `.gitignore` so developers can customize local ports and bind mounts without breaking team builds.",
    tags: ["compose-override", "multi-file", "dry", "environments", "configuration"],
    practice: [
      "How does Compose handle array merging vs object key replacement during multi-file inheritance?",
      "How do you inspect the final merged configuration using `docker compose config`?"
    ]
  }),

  createCard({
    idNum: 65,
    category: "Docker Compose & Local Orchestration",
    concept: "Compose Profiles for Conditional Service Execution",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Compose Profiles, and how do they allow managing developer tools, seeders, and debuggers in a single Compose file?",
    quickAnswer: "The `profiles` attribute assigns services to one or more named profiles (e.g. `profiles: [\"debug\", \"tools\"]`). Services with profiles are **ignored by default** when running `docker compose up`. They only start when their profile is explicitly enabled via `--profile <name>` or the `COMPOSE_PROFILES` environment variable.",
    detailedAnswer: "In large applications, developers often need auxiliary services (like database seeders, mock SMTP servers, Swagger UI, or Redis Commander) that should not consume CPU/RAM during standard application execution. Instead of maintaining separate Compose files, assign them to profiles. Running `docker compose up` starts only the core services; running `docker compose --profile debug up` starts the debuggers alongside core services.",
    code: `services:
  api:
    build: .
    ports: ["3000:3000"]

  database:
    image: postgres:16-alpine

  # Only starts when 'debug' profile is requested:
  adminer:
    image: adminer:latest
    ports: ["8080:8080"]
    profiles: ["debug", "tools"]

  # Only starts when 'test' profile is requested:
  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test
    profiles: ["test"]

# Execution:
# 1. Starts ONLY api and database:
# $ docker compose up -d

# 2. Starts api, database, AND adminer:
# $ docker compose --profile debug up -d`,
    recallHint: "profiles: [\"name\"] hides services from standard compose up. Enable via --profile <name>.",
    interviewTip: "Mention setting `COMPOSE_PROFILES=debug,tools` in a developer's local `.env` file so their preferred tools auto-start without typing `--profile` on every CLI command.",
    tags: ["profiles", "compose", "dev-tools", "orchestration", "optimization"],
    practice: [
      "Can a service belong to multiple profiles simultaneously?",
      "What happens if an un-profiled service declares a `depends_on` dependency on a profiled service?"
    ]
  }),

  createCard({
    idNum: 66,
    category: "Docker Compose & Local Orchestration",
    concept: "Docker Compose Secrets & Configs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do Docker Compose Secrets provide a secure alternative to environment variables for sensitive credentials?",
    quickAnswer: "Compose Secrets mount sensitive files (passwords, SSL certificates, API keys) into a temporary in-memory `tmpfs` directory inside the container (default: `/run/secrets/<secret_name>`). Unlike environment variables, secrets are never exposed in `docker inspect`, never leaked in crash dumps, and never recorded in image history.",
    detailedAnswer: "Injecting database passwords via `environment: - DB_PASS=secret` is insecure: any developer running `docker inspect` or inspecting process environments (`cat /proc/$PID/environ`) can view the credentials in plaintext. The modern Compose specification allows defining file-based or external secrets. Applications read the password directly from the `/run/secrets/` filesystem mount.",
    code: `services:
  backend:
    image: my-app:latest
    # Grants container access to specified secret:
    secrets:
      - db_password
      - api_key
    environment:
      # Pass the secret file path to application:
      - DB_PASSWORD_FILE=/run/secrets/db_password

  db:
    image: postgres:16-alpine
    secrets:
      - db_password
    environment:
      # Official postgres image supports _FILE suffix natively!
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password

# Top-level secrets declaration:
secrets:
  db_password:
    file: ./secrets/postgres_password.txt
  api_key:
    file: ./secrets/stripe_key.txt`,
    recallHint: "Secrets mount to in-memory /run/secrets/<name>. Not visible in docker inspect or environment variables.",
    interviewTip: "Highlight the `_FILE` convention: most enterprise Docker images (PostgreSQL, MySQL, Redis, WordPress) natively support `<VAR>_FILE=/run/secrets/...` to read passwords from file paths.",
    tags: ["secrets", "compose-secrets", "security", "credentials", "tmpfs"],
    practice: [
      "How do you read a secret file in Node.js using `fs.readFileSync(process.env.DB_PASSWORD_FILE)`?",
      "Can Compose Secrets be sourced from external Swarm secret stores?"
    ]
  }),

  createCard({
    idNum: 67,
    category: "Docker Compose & Local Orchestration",
    concept: "Resource Allocation & Service Scaling in Compose",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you enforce CPU/memory resource limits and scale container replicas horizontally using Docker Compose?",
    quickAnswer: "Define `deploy.resources.limits` and `deploy.resources.reservations` for CPU and memory constraints. Scale services horizontally using `docker compose up --scale <service>=<count>` (or declaring `deploy.replicas: 3`). When scaling, ensure host port publishing does NOT use fixed ports.",
    detailedAnswer: "In modern Compose V2, `deploy.resources` attributes are respected even in non-Swarm standalone Docker Engine mode. `limits` sets the hard ceiling (OOM killer terminates the container if exceeded). `reservations` guarantees minimal host capacity. When scaling services (e.g. `--scale worker=5`), the service must NOT bind to a fixed host port (`- 80:80`), otherwise port collision errors occur. Instead, route through an Nginx load balancer or expose container ports dynamically.",
    code: `services:
  worker:
    image: my-background-worker:latest
    deploy:
      replicas: 3 # Scale to 3 identical containers!
      resources:
        limits:
          cpus: '0.50'     # Max 50% of 1 CPU core
          memory: 512M     # Hard memory ceiling (OOM if exceeded)
        reservations:
          cpus: '0.10'     # Guaranteed minimum 10% CPU
          memory: 128M     # Guaranteed minimum 128MB RAM
    restart: on-failure

# Scale dynamically from CLI:
# $ docker compose up -d --scale worker=5`,
    recallHint: "deploy.resources.limits sets hard CPU/memory ceilings. Scale via docker compose up --scale worker=5.",
    interviewTip: "Remind interviewers that scaling a web service requires an upstream reverse proxy (like Nginx, Traefik, or Envoy) to distribute incoming traffic across the scaled container IPs.",
    tags: ["scaling", "resource-limits", "deploy", "cgroups", "compose"],
    practice: [
      "Why does scaling a service with `ports: [\"8080:8080\"]` fail with 'port already allocated'?",
      "What is the difference between `resources.limits` and `resources.reservations`?"
    ]
  }),

  createCard({
    idNum: 68,
    category: "Docker Compose & Local Orchestration",
    concept: "Docker Compose Watch Mode for Hot Reloading",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Docker Compose Watch (`docker compose watch`), and how does it revolutionize local development without slow bind mounts?",
    quickAnswer: "`docker compose watch` is a modern Compose feature that monitors host files and automatically synchronizes edits directly into running containers (or rebuilds images when package manifests change). It delivers instantaneous hot-reloading without the file-permission bugs or filesystem latency of traditional bind mounts.",
    detailedAnswer: "Traditional bind mounts (`-v ./src:/app/src`) suffer from slow file I/O on macOS/Windows and mess up host `node_modules` permissions. `docker compose watch` runs a background sync agent. You define `action: sync` for source code, and `action: rebuild` for `package.json`. When you save a TypeScript file, Compose copies the file into the container in milliseconds, triggering Vite/Nodemon without touching host volumes.",
    code: `# compose.yaml with Compose Watch:
services:
  frontend:
    build: .
    ports: ["3000:3000"]
    develop:
      watch:
        # 1. Instant file sync: copies edits directly to container
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - node_modules/

        # 2. Automatic image rebuild if dependencies change:
        - action: rebuild
          path: ./package.json

# Launch in watch mode:
# $ docker compose watch`,
    recallHint: "docker compose watch syncs source edits instantly and rebuilds on package.json edits without bind mount lag.",
    interviewTip: "Highlight `action: sync+restart`: if you edit backend configuration files that require process restart, Compose syncs the file and restarts the container automatically.",
    tags: ["compose-watch", "hot-reload", "development", "sync", "tooling"],
    practice: [
      "What are the three possible actions in Compose Watch: `sync`, `rebuild`, and `sync+restart`?",
      "Why is Compose Watch faster than native bind mounts on Docker Desktop for Mac?"
    ]
  }),

  createCard({
    idNum: 69,
    category: "Docker Compose & Local Orchestration",
    concept: "Volume & Network Scoping & External Assets",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Docker Compose namespace volumes and networks, and how do you reference pre-existing `external` assets?",
    quickAnswer: "Compose prefixes all generated resources with the project name: `<project_name>_<resource_name>` (e.g. `myapp_pg_data`). To connect to a pre-existing network or volume created outside of Compose, declare `external: true` (or `external: name: my-network`).",
    detailedAnswer: "By default, if your project folder is named `ecommerce`, a volume defined as `db_data:` will be created as `ecommerce_db_data`. This isolates different projects from colliding. However, if multiple independent Compose projects need to share a common reverse proxy network or centralized database volume, marking the resource as `external: true` prevents Compose from creating a new resource, instructing it to attach to the existing asset instead.",
    code: `services:
  web:
    image: my-app:latest
    networks:
      - default          # Internal private project network
      - proxy-net        # Pre-existing shared reverse proxy network
    volumes:
      - corporate-certs:/etc/ssl/certs:ro

networks:
  # Instructs Compose: DO NOT CREATE THIS! It already exists on host!
  proxy-net:
    external: true
    name: global_traefik_network

volumes:
  corporate-certs:
    external: true
    name: shared_pki_certs`,
    recallHint: "Compose prefixes resources with <project>_. Use external: true to attach to pre-existing resources.",
    interviewTip: "Explain how to customize the default project prefix using `docker compose -p my_custom_prefix up` or setting `COMPOSE_PROJECT_NAME=my_custom_prefix` in `.env`.",
    tags: ["scoping", "external-volumes", "external-networks", "namespacing", "compose"],
    practice: [
      "What happens if a Compose file specifies `external: true` for a network that does not exist on the host?",
      "How do you override the default project name prefix in Docker Compose?"
    ]
  }),

  createCard({
    idNum: 70,
    category: "Docker Compose & Local Orchestration",
    concept: "Zero-Downtime Rolling Service Updates with Compose",
    priority: "must-know",
    difficulty: "advanced",
    question: "How can you achieve near zero-downtime rolling deployments of an updated service using Docker Compose without Swarm or Kubernetes?",
    quickAnswer: "Combine an Nginx load balancer with Compose horizontal scaling: 1) Deploy initial service (`--scale api=2`), 2) Pull updated image, 3) Scale up with new containers (`--scale api=4`), 4) Nginx healthchecks route to healthy v2 instances, and 5) Scale back down (`--scale api=2`) to prune v1 instances.",
    detailedAnswer: "In standard single-node deployments, running `docker compose up -d` stops the existing container before creating the new one, resulting in 2-5 seconds of HTTP 502/503 dropped connections. By placing an Nginx dynamic upstream proxy in front of the service and scaling the containers during deployment, the new container becomes healthy before the old container is decommissioned.",
    code: `# Production Rolling Update Bash Script:
#!/bin/bash
set -e

# Step 1: Pull updated image
docker compose pull api

# Step 2: Scale up to 2 instances (spawns new container with updated image)
docker compose up -d --no-deps --scale api=2 --no-recreate api

# Step 3: Wait for new container to become healthy
echo "Waiting for healthcheck..."
sleep 10

# Step 4: Gracefully remove old container instance
OLD_CONTAINER_ID=$(docker compose ps -q api | head -n 1)
docker stop --time 15 $OLD_CONTAINER_ID
docker rm $OLD_CONTAINER_ID

# Step 5: Settle back to 1 instance
docker compose up -d --no-deps --scale api=1 api
echo "Zero-downtime rolling update complete!"`,
    recallHint: "Zero-downtime Compose: scale up updated instance behind Nginx -> verify healthy -> terminate old instance.",
    interviewTip: "Mention that for production enterprise high-availability, orchestrators like Kubernetes (with `RollingUpdate` strategy) or AWS ECS are standard, but this Compose pattern is ideal for single-node staging environments.",
    tags: ["zero-downtime", "rolling-update", "scaling", "nginx", "deployment"],
    practice: [
      "Why must `--no-recreate` be used when scaling up new instances during a rolling update?",
      "How does Nginx's `max_fails` and `fail_timeout` handle failing upstream container instances?"
    ]
  }),

  createCard({
    idNum: 71,
    category: "Docker Compose & Local Orchestration",
    concept: "Centralized Logging Drivers in Compose",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you configure centralized logging, log rotation, and third-party logging drivers in Docker Compose?",
    quickAnswer: "Configure the `logging` block under individual services or globally under `x-logging` extension anchors. Define `driver: json-file` or `driver: local` with `options.max-size: '10m'` and `options.max-file: '3'` to prevent container logs from filling host disks.",
    detailedAnswer: "By default, Docker's `json-file` driver stores logs indefinitely without size limits. In production, a runaway loop printing stack traces can generate 50GB of logs in hours, causing host disk exhaustion. The logging block enforces strict rotation boundaries. You can also stream logs directly to aggregation servers (Fluentd, AWS CloudWatch, Splunk, or Syslog) by changing the driver.",
    code: `# YAML Anchor pattern for DRY logging configuration:
x-logging: &default-logging
  driver: "json-file"
  options:
    max-size: "20m"    # Maximum log file size before rotation
    max-file: "5"      # Retain max 5 rotated archives (Total max: 100MB)
    compress: "true"   # Gzip old log files

services:
  api:
    image: my-api:latest
    logging: *default-logging

  worker:
    image: my-worker:latest
    logging: *default-logging

  # Stream directly to remote Syslog / ELK:
  payment-service:
    image: my-payments:latest
    logging:
      driver: syslog
      options:
        syslog-address: "tcp://logs.company.internal:514"
        tag: "payment-service"`,
    recallHint: "Enforce log rotation in Compose: driver: json-file with max-size: 20m and max-file: 5.",
    interviewTip: "Highlight YAML extension fields (`x-logging` with `&` anchor and `*` alias) as the cleanest way to enforce enterprise-wide logging standards across 20+ Compose services.",
    tags: ["logging", "log-rotation", "json-file", "yaml-anchors", "syslog"],
    practice: [
      "What happens to container logs when the number of log files exceeds `max-file`?",
      "Why does `docker logs` fail to work if a third-party non-dual logging driver is configured?"
    ]
  }),

  createCard({
    idNum: 72,
    category: "Docker Compose & Local Orchestration",
    concept: "Docker Compose V2 (Go) vs Legacy V1 (Python)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the difference between `docker compose` (Compose V2) and `docker-compose` (Compose V1)?",
    quickAnswer: "**Compose V1** (`docker-compose` with hyphen) was a standalone Python script, slow to execute, and officially deprecated in July 2023. **Compose V2** (`docker compose` with space) is a native Go plugin built directly into the Docker CLI, executing up to 10x faster, supporting modern Compose Specs, BuildKit by default, and `docker compose watch`.",
    detailedAnswer: "Legacy `docker-compose` required installing Python and pip, parsed YAML slowly, and suffered from synchronization issues with the core Docker Engine. Docker rewrote Compose from scratch in Go as an official CLI plugin (`docker compose`). V2 matches Docker CLI flags, uses BuildKit natively, provides sub-second execution, and integrates directly with Docker Desktop and Linux package repositories.",
    code: `# 1. LEGACY DEPRECATED SYNTAX (Python V1):
$ docker-compose up -d  # DEPRECATED! Do not use in modern projects!

# 2. MODERN OFFICIAL SYNTAX (Go V2 Plugin):
$ docker compose up -d

# Check installed Compose V2 version:
$ docker compose version
# Docker Compose version v2.26.1

# Enable V1 backwards compatibility alias on Linux:
# If legacy scripts still invoke docker-compose, install compose-switch:
$ sudo apt-get install docker-compose-plugin`,
    recallHint: "docker-compose (hyphen) = deprecated Python V1. docker compose (space) = modern Go V2.",
    interviewTip: "If you see a candidate or project still using `docker-compose` with a hyphen, immediately advise upgrading to `docker compose` for improved security patches and BuildKit support.",
    tags: ["compose-v2", "compose-v1", "go", "python", "migration"],
    practice: [
      "What is `compose-switch` and how does it translate legacy `docker-compose` calls to V2?",
      "Why is Compose V2 substantially faster when starting 20+ microservices?"
    ]
  })
];
