module.exports = [
  {
    id: "docker-ex-33",
    title: "Production Full-Stack Microservices Architecture with Docker Compose",
    category: "Docker Compose & Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Defines an enterprise-grade multi-tier stack combining a Next.js/React frontend, Node/Go REST API, Redis cache, PostgreSQL cluster, and Caddy reverse proxy with automated TLS certificates.",
    conceptsCovered: [
      "Multi-tier service topologies",
      "Network segregation (public vs data)",
      "Caddy reverse proxy automatic TLS",
      "Named volumes for database persistence",
      "Resource limits in Compose"
    ],
    code: `services:
  caddy:
    image: caddy:2.8-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - public-net
    depends_on:
      - api
      - web

  web:
    image: my-frontend:latest
    restart: unless-stopped
    expose:
      - "3000"
    networks:
      - public-net

  api:
    image: my-backend:latest
    restart: unless-stopped
    expose:
      - "8080"
    environment:
      - DATABASE_URL=postgres://app:secret@postgres:5432/appdb
      - REDIS_URL=redis://redis:6379
    networks:
      - public-net
      - backend-net
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend-net

  redis:
    image: redis:7.2-alpine
    restart: unless-stopped
    networks:
      - backend-net

networks:
  public-net:
    driver: bridge
  backend-net:
    internal: true

volumes:
  pgdata:
  caddy_data:
  caddy_config:`,
    breakdown: [
      {
        lineRange: "2-16",
        note: "Caddy provides automated HTTPS, terminating TLS and proxying traffic to web and api."
      },
      {
        lineRange: "27-41",
        note: "API connects to public-net (for ingress from Caddy) and backend-net (to reach database)."
      },
      {
        lineRange: "56-62",
        note: "backend-net is marked internal: true, completely blocking database and cache from internet access."
      }
    ],
    expectedOutput: `[+] Running 5/5
 ✔ Network compose_public-net   Created
 ✔ Network compose_backend-net  Created
 ✔ Volume "compose_pgdata"      Created
 ✔ Container compose-postgres-1 Started
 ✔ Container compose-redis-1    Started
 ✔ Container compose-api-1      Started
 ✔ Container compose-web-1      Started
 ✔ Container compose-caddy-1    Started`
  },
  {
    id: "docker-ex-34",
    title: "Deterministic Startup Ordering with depends_on condition: service_healthy",
    category: "Docker Compose & Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Guarantees that database migrations and API workers only start after PostgreSQL and Redis are 100% initialized and accepting TCP connections, eliminating race conditions on boot.",
    conceptsCovered: [
      "depends_on with condition: service_healthy",
      "Postgres pg_isready healthcheck",
      "Redis ping healthcheck",
      "One-shot migration container",
      "Eliminating startup race conditions"
    ],
    code: `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: production
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secretpassword
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin -d production"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7.2-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  # Runs migrations once and terminates before API starts
  migrator:
    image: my-app:latest
    command: ["npm", "run", "db:migrate"]
    depends_on:
      db:
        condition: service_healthy

  api:
    image: my-app:latest
    command: ["npm", "start"]
    ports:
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrator:
        condition: service_completed_successfully`,
    breakdown: [
      {
        lineRange: "8-14",
        note: "PostgreSQL runs pg_isready every 5 seconds until the engine accepts incoming connections."
      },
      {
        lineRange: "23-29",
        note: "migrator container waits for db to be healthy before executing schema migrations."
      },
      {
        lineRange: "31-42",
        note: "api waits for both db and redis to be healthy AND migrator to exit cleanly with code 0."
      }
    ],
    expectedOutput: `[+] Running 4/4
 ✔ Container db        Healthy
 ✔ Container redis     Healthy
 ✔ Container migrator  Exited (0)
 ✔ Container api       Started`
  },
  {
    id: "docker-ex-35",
    title: "Dynamic Environment Overrides Using compose.override.yaml for Dev vs Prod",
    category: "Docker Compose & Orchestration",
    difficulty: "beginner",
    whatThisCodeCovers: "Structures modular Docker Compose configurations where a base compose.yaml defines production baseline settings, automatically merged with compose.override.yaml during local development.",
    conceptsCovered: [
      "Compose file merging hierarchy",
      "docker compose -f file1.yaml -f file2.yaml",
      "Local development overrides (bind mounts, debugger ports)",
      "Production immutability",
      "Clean configuration separation"
    ],
    code: `# === compose.yaml (Production Base) ===
services:
  api:
    image: enterprise/api:v1.0.0
    restart: always
    environment:
      - NODE_ENV=production
    ports:
      - "8080:8080"

# === compose.override.yaml (Applied automatically in development) ===
services:
  api:
    build:
      context: .
      target: dev
    environment:
      - NODE_ENV=development
      - DEBUG=express:*
    ports:
      - "9229:9229" # Node.js V8 Debugger port
    volumes:
      - .:/app
    command: ["npm", "run", "dev"]`,
    breakdown: [
      {
        lineRange: "1-9",
        note: "Base compose.yaml points to production immutable prebuilt container images."
      },
      {
        lineRange: "11-23",
        note: "compose.override.yaml injects live build contexts, bind mounts, and debugger ports without touching production files."
      }
    ],
    expectedOutput: `$ docker compose config
# Outputs deep merged configuration:
services:
  api:
    build: { context: . }
    environment:
      DEBUG: express:*
      NODE_ENV: development
    ports:
      - mode: ingress, target: 8080, published: 8080
      - mode: ingress, target: 9229, published: 9229`
  },
  {
    id: "docker-ex-36",
    title: "Docker Compose Watch Mode for Instant Code Synchronization and Rebuilding",
    category: "Docker Compose & Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Leverages modern Compose Watch (docker compose watch) to automatically synchronize changed frontend files directly into running containers without full image rebuilds.",
    conceptsCovered: [
      "Compose develop / watch syntax",
      "Sync action vs rebuild action",
      "docker compose watch command",
      "Instant feedback development loop",
      "Ignoring node_modules sync"
    ],
    code: `services:
  web:
    build: .
    ports:
      - "3000:3000"
    develop:
      watch:
        # Instantly sync UI changes without rebuilding container
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - ./src/**/*.test.ts

        # Sync package.json and trigger background rebuild
        - action: rebuild
          path: ./package.json

        # Sync static public assets
        - action: sync+restart
          path: ./public
          target: /app/public`,
    breakdown: [
      {
        lineRange: "6-12",
        note: "action: sync mirrors changes in ./src into the container within 10ms, enabling frontend HMR."
      },
      {
        lineRange: "14-16",
        note: "Modifications to package.json automatically trigger a background Dockerfile rebuild."
      },
      {
        lineRange: "18-21",
        note: "sync+restart replaces assets and gracefully restarts the server process."
      }
    ],
    expectedOutput: `$ docker compose watch
Watch enabled for service "web"
Syncing /src/components/Header.tsx -> web:/app/src/components/Header.tsx
File synced in 14ms!`
  },
  {
    id: "docker-ex-37",
    title: "Secure Secret Management with File-Based Docker Compose Secrets",
    category: "Docker Compose & Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Injects database passwords and private API keys into containers via Docker Compose file secrets mounted as in-memory /run/secrets files rather than leaking them in environment variables.",
    conceptsCovered: [
      "Top-level secrets block",
      "File-based secrets mounting",
      "Mounting at /run/secrets/<secret_name>",
      "Preventing env var leakage (docker inspect)",
      "Zero secret disk persistence"
    ],
    code: `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: dbuser
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

  api:
    image: my-backend:latest
    environment:
      DATABASE_PASSWORD_FILE: /run/secrets/db_password
      STRIPE_KEY_FILE: /run/secrets/stripe_key
    secrets:
      - db_password
      - stripe_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  stripe_key:
    file: ./secrets/stripe_live_key.txt`,
    breakdown: [
      {
        lineRange: "6-8",
        note: "POSTGRES_PASSWORD_FILE instructs PostgreSQL to read its credentials from /run/secrets/db_password in RAM."
      },
      {
        lineRange: "11-17",
        note: "Secrets are mounted as read-only files accessible only to processes in the container."
      },
      {
        lineRange: "19-24",
        note: "Top-level secrets declare local host files that Compose loads securely into tmpfs mounts."
      }
    ],
    expectedOutput: `$ docker inspect api-1 | grep -i password
# Output: Password is NOT visible anywhere in container environment variables!
$ docker exec api-1 cat /run/secrets/db_password
SuperSecureP@ssw0rd! (Mounted read-only in memory)`
  },
  {
    id: "docker-ex-38",
    title: "Dynamic Environment Variable Interpolation and Default Fallbacks",
    category: "Docker Compose & Orchestration",
    difficulty: "beginner",
    whatThisCodeCovers: "Utilizes bash-style variable interpolation in compose.yaml (${VAR:-default}, ${VAR:?error}) along with .env files to create dynamic, portable multi-environment configs.",
    conceptsCovered: [
      "${VARIABLE:-default} fallback syntax",
      "${VARIABLE:?mandatory error} validation",
      ".env file precedence",
      "Inline port mapping interpolation",
      "Self-documenting templates"
    ],
    code: `services:
  app:
    image: "enterprise/api:\${TAG:-latest}"
    ports:
      # If PORT is not set on host, defaults to 8080
      - "\${PORT:-8080}:8080"
    environment:
      # Mandates that DB_HOST must be set, otherwise Compose errors out
      DATABASE_HOST: "\${DB_HOST:?Database host must be provided in .env}"
      MAX_WORKERS: "\${MAX_WORKERS:-4}"
      LOG_LEVEL: "\${LOG_LEVEL:-info}"
    deploy:
      resources:
        limits:
          cpus: "\${CPU_LIMIT:-1.5}"
          memory: "\${MEM_LIMIT:-2G}"`,
    breakdown: [
      {
        lineRange: "3-6",
        note: "${TAG:-latest} and ${PORT:-8080} provide safe defaults if host environment variables are missing."
      },
      {
        lineRange: "9-12",
        note: "${DB_HOST:?error} enforces required configuration, immediately halting deployment if unset."
      }
    ],
    expectedOutput: `$ docker compose up
# If DB_HOST is missing:
Error: required variable DB_HOST is missing a value: Database host must be provided in .env
# If DB_HOST is set:
[+] Running 1/1 ✔ Container app-1 Started`
  },
  {
    id: "docker-ex-39",
    title: "Multi-Profile Orchestration for On-Demand Debugging, Testing, and Migrations",
    category: "Docker Compose & Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Organizes peripheral services (pgAdmin, Mailpit, Jaeger, Integration Test runners) into named Compose profiles (profiles: ['debug', 'test']) that only start when explicitly requested.",
    conceptsCovered: [
      "Compose profiles attribute",
      "--profile flag syntax",
      "Selective service activation",
      "Lightweight default developer footprint",
      "Isolated test suite execution"
    ],
    code: `services:
  api:
    image: my-app:latest
    ports:
      - "8080:8080"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret

  # Profile: debug (Only starts when developer wants visual inspection)
  pgadmin:
    image: dpage/pgadmin4:latest
    profiles: ["debug"]
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@test.com
      PGADMIN_DEFAULT_PASSWORD: admin

  # Profile: test (Only runs during CI or local integration runs)
  integration-tests:
    image: my-test-runner:latest
    profiles: ["test"]
    depends_on:
      - api
    command: ["npm", "run", "test:integration"]`,
    breakdown: [
      {
        lineRange: "2-10",
        note: "Core services (api, db) have no profile and launch on standard 'docker compose up'."
      },
      {
        lineRange: "12-21",
        note: "pgadmin has profiles: ['debug'], completely ignored unless requested with --profile debug."
      },
      {
        lineRange: "23-30",
        note: "integration-tests has profiles: ['test'], perfect for automated test workflows."
      }
    ],
    expectedOutput: `$ docker compose up -d
[+] Running 2/2 ✔ Container db-1 Started, Container api-1 Started
$ docker compose --profile debug up -d
[+] Running 3/3 ✔ Container pgadmin-1 Started`
  },
  {
    id: "docker-ex-40",
    title: "Horizontal Service Auto-Scaling with Docker Compose and Nginx Load Balancer",
    category: "Docker Compose & Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Scales stateless API containers across multiple replicas using docker compose up --scale api=5, balanced across instances using Nginx round-robin upstream routing.",
    conceptsCovered: [
      "docker compose up --scale <service>=N",
      "Round-robin load balancing",
      "Embedded DNS multi-A record resolution",
      "Stateless container scaling",
      "Dynamic port management"
    ],
    code: `# compose.yaml
services:
  lb:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api

  api:
    image: hashicorp/http-echo:latest
    command: ["-text=Hello from scaled container!"]
    # Do NOT bind host port directly on api! Docker resolves multiple IPs internally.

# --- nginx.conf ---
# events {}
# http {
#   upstream api_backend {
#     server api:5678; # Docker DNS resolves to all scaled container IPs!
#   }
#   server {
#     listen 80;
#     location / {
#       proxy_pass http://api_backend;
#     }
#   }
# }`,
    breakdown: [
      {
        lineRange: "2-9",
        note: "Nginx load balancer binds port 80 and forwards requests to upstream api_backend."
      },
      {
        lineRange: "11-15",
        note: "api omits host port binding, allowing unlimited instances to spin up without port collisions."
      },
      {
        lineRange: "20-22",
        note: "server api:5678 automatically load balances across all running replica IP addresses."
      }
    ],
    expectedOutput: `$ docker compose up -d --scale api=4
[+] Running 5/5
 ✔ Container compose-api-1  Started
 ✔ Container compose-api-2  Started
 ✔ Container compose-api-3  Started
 ✔ Container compose-api-4  Started
 ✔ Container compose-lb-1   Started
$ curl http://localhost/ -> Round-robins across all 4 containers!`
  },
  {
    id: "docker-ex-41",
    title: "Zero-Downtime Rolling Service Updates via Docker Compose Deploy Config",
    category: "Docker Compose & Orchestration",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures rolling update policies (update_config: parallelism, delay, order) to upgrade replica containers in batches without downtime.",
    conceptsCovered: [
      "deploy.update_config",
      "parallelism and delay",
      "order: start-first vs stop-first",
      "failure_action: rollback",
      "Zero-downtime rolling deploys"
    ],
    code: `services:
  web:
    image: enterprise/web:v2.0
    deploy:
      replicas: 4
      update_config:
        # Update 2 containers at a time
        parallelism: 2
        # Wait 10 seconds between update batches
        delay: 10s
        # Start new container and verify health BEFORE killing old container!
        order: start-first
        # Automatically abort and rollback if healthcheck fails
        failure_action: rollback
        monitor: 15s
        max_failure_ratio: 0.1
      restart_policy:
        condition: on-failure
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 5s
      timeout: 3s
      retries: 3`,
    breakdown: [
      {
        lineRange: "5-17",
        note: "update_config orchestrates rolling upgrades: start-first ensures healthy standby capacity before stopping old versions."
      },
      {
        lineRange: "19-24",
        note: "Healthcheck validates new container readiness during the monitor window before the rollout proceeds."
      }
    ],
    expectedOutput: `$ docker stack deploy -c compose.yaml production-app
Updating service production-app_web (replicas: 4)
overall progress: 2 out of 4 tasks (updating...)
overall progress: 4 out of 4 tasks (rolling update completed with 0 errors)`
  },
  {
    id: "docker-ex-42",
    title: "Centralized Log Aggregation Stack with Grafana Loki, Promtail, and Compose",
    category: "Docker Compose & Orchestration",
    difficulty: "advanced",
    whatThisCodeCovers: "Stands up an observability stack using Grafana Loki and Promtail in Docker Compose, collecting stdout logs from all running containers into an indexed queryable dashboard.",
    conceptsCovered: [
      "Grafana Loki log ingestion",
      "Promtail Docker socket scraper",
      "Mounting /var/lib/docker/containers",
      "LogQL querying in Grafana",
      "Production container observability"
    ],
    code: `services:
  loki:
    image: grafana/loki:3.0.0
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:3.0.0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./promtail-config.yaml:/etc/promtail/config.yaml:ro
    command: -config.file=/etc/promtail/config.yaml
    depends_on:
      - loki

  grafana:
    image: grafana/grafana:11.0.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    depends_on:
      - loki`,
    breakdown: [
      {
        lineRange: "2-6",
        note: "Loki stores compressed log streams indexed by labels."
      },
      {
        lineRange: "8-17",
        note: "Promtail scrapes container logs from /var/lib/docker/containers and ships them to Loki in real time."
      },
      {
        lineRange: "19-26",
        note: "Grafana provides visual search dashboards using LogQL queries like {compose_service=\"api\"}."
      }
    ],
    expectedOutput: `[+] Running 3/3
 ✔ Container compose-loki-1      Started
 ✔ Container compose-promtail-1  Started
 ✔ Container compose-grafana-1   Started
Grafana accessible at http://localhost:3000 (Loki data source attached)`
  }
];
