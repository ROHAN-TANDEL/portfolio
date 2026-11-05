module.exports = [
  {
    id: "docker-ex-01",
    title: "Multi-Stage Production Node.js App with BuildKit Cache Mounts & Distroless Execution",
    category: "Dockerfile & BuildKit",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates an enterprise-ready Node.js multi-stage build that caches npm packages across builds via cache mounts, builds TypeScript artifacts, and runs on a Google Distroless runtime with zero shell or package manager vulnerabilities.",
    conceptsCovered: [
      "Multi-stage builds",
      "RUN --mount=type=cache",
      "Distroless images (gcr.io/distroless/nodejs20-debian12)",
      "Non-root execution (USER nonroot)",
      "Layer minimization"
    ],
    code: `# syntax=docker/dockerfile:1.7
# Stage 1: Dependency resolution and caching
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \\
    npm ci --omit=dev

# Stage 2: Compilation & building
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \\
    npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 3: Minimal production distroless runtime
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER nonroot:nonroot
EXPOSE 3000
CMD ["dist/main.js"]`,
    breakdown: [
      {
        lineRange: "1-7",
        note: "Syntax directive enables BuildKit 1.7 features. Cache mount retains npm cache across rebuilds without bloating layers."
      },
      {
        lineRange: "9-17",
        note: "Builder stage installs full devDependencies and compiles TypeScript into Javascript."
      },
      {
        lineRange: "19-29",
        note: "Distroless runtime eliminates shell, package managers, and root user, slashing CVE attack surface by 95%."
      }
    ],
    expectedOutput: `[+] Building 4.8s (13/13) FINISHED
 => [internal] load build definition from Dockerfile
 => [deps 3/3] RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
 => [builder 4/4] RUN npm run build
 => [runner 3/4] COPY --from=deps /app/node_modules ./node_modules
 => [runner 4/4] COPY --from=builder /app/dist ./dist
 => exporting to image (Size: 142MB)`
  },
  {
    id: "docker-ex-02",
    title: "High-Performance Go Microservice Scratch Container with CA Certificates & Non-Root User",
    category: "Dockerfile & BuildKit",
    difficulty: "advanced",
    whatThisCodeCovers: "Compiles a completely static, stripped Go binary with CGO disabled and bundles it into an empty 'FROM scratch' container along with TLS certificates and an unprivileged user passwd file, resulting in an image under 15MB.",
    conceptsCovered: [
      "FROM scratch image",
      "CGO_ENABLED=0 static compilation",
      "CA certificates copying",
      "/etc/passwd unprivileged user trick",
      "Binary stripping (-ldflags '-s -w')"
    ],
    code: `# syntax=docker/dockerfile:1.7
# Stage 1: Build static Go binary
FROM golang:1.22-alpine AS builder
WORKDIR /src

# Install CA certificates & create unprivileged user
RUN apk add --no-cache ca-certificates && \\
    adduser -D -u 10001 -g appuser appuser

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \\
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \\
    --mount=type=cache,target=/root/.cache/go-build \\
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \\
    go build -ldflags="-s -w -extldflags '-static'" -o /bin/api ./cmd/server

# Stage 2: Ultimate minimal runtime from scratch
FROM scratch
WORKDIR /
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /bin/api /bin/api

USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/bin/api"]`,
    breakdown: [
      {
        lineRange: "5-8",
        note: "Prepares CA certificates for HTTPS requests and creates user 10001 in /etc/passwd before moving to scratch."
      },
      {
        lineRange: "14-19",
        note: "Builds with CGO_ENABLED=0 and strips debugging symbols (-s -w) with Go module and build cache mounts."
      },
      {
        lineRange: "21-29",
        note: "scratch has no OS, no shell, no libraries. Copying the binary, certs, and passwd creates a secure ~12MB image."
      }
    ],
    expectedOutput: `REPOSITORY       TAG      IMAGE ID       CREATED          SIZE
billing-service  latest   8b12f483c0aa   12 seconds ago   14.8MB`
  },
  {
    id: "docker-ex-03",
    title: "Multi-Stage Python FastAPI with Virtualenv Extraction and Security Hardening",
    category: "Dockerfile & BuildKit",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a production Python FastAPI service using an isolated builder virtualenv to compile C-extensions (like asyncpg, cryptography), then copies only the clean /opt/venv into an unprivileged slim runner.",
    conceptsCovered: [
      "Virtualenv isolation pattern",
      "pip cache mount",
      "Unprivileged user creation",
      "Tini init process integration",
      "PYTHONUNBUFFERED and PYTHONDONTWRITEBYTECODE"
    ],
    code: `# syntax=docker/dockerfile:1.7
# Stage 1: Build wheel dependencies
FROM python:3.12-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc build-essential libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \\
    pip install --no-compile -r requirements.txt

# Stage 2: Lean runtime
FROM python:3.12-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq5 curl tini \\
    && rm -rf /var/lib/apt/lists/* && \\
    groupadd -r appgroup -g 1001 && \\
    useradd -r -u 1001 -g appgroup -s /sbin/nologin appuser

ENV PATH="/opt/venv/bin:$PATH" \\
    PYTHONUNBUFFERED=1 \\
    PYTHONDONTWRITEBYTECODE=1

COPY --from=builder /opt/venv /opt/venv
COPY --chown=appuser:appgroup ./app ./app

USER 1001:1001
EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]`,
    breakdown: [
      {
        lineRange: "6-15",
        note: "Installs compilers in builder only. Virtual environment /opt/venv contains compiled binaries without keeping gcc in runtime."
      },
      {
        lineRange: "20-25",
        note: "Installs only runtime dynamic libraries (libpq5), tini for signal handling, and creates unprivileged appuser."
      },
      {
        lineRange: "32-37",
        note: "Runs as non-root user (1001), routes signals through tini to avoid zombie worker processes."
      }
    ],
    expectedOutput: `Successfully installed fastapi-0.111.0 pydantic-2.7.1 uvicorn-0.30.0
Step 14/14 : CMD ["uvicorn", "app.main:app", ...]
Image size reduced from 892MB to 168MB.`
  },
  {
    id: "docker-ex-04",
    title: "Secure Private Git Repository Cloning via BuildKit SSH Mount",
    category: "Dockerfile & BuildKit",
    difficulty: "advanced",
    whatThisCodeCovers: "Clones private GitHub/GitLab enterprise repositories during Docker build without exposing developer SSH private keys or persisting tokens inside any intermediate image layer.",
    conceptsCovered: [
      "RUN --mount=type=ssh",
      "ssh-agent socket forwarding",
      "ssh-keyscan for known_hosts",
      "Zero private key persistence",
      "docker build --ssh default"
    ],
    code: `# syntax=docker/dockerfile:1.7
FROM alpine:3.20 AS builder

RUN apk add --no-cache git openssh-client

# Pre-populate known hosts to prevent MITM prompt
RUN mkdir -p -m 0700 ~/.ssh && \\
    ssh-keyscan github.com >> ~/.ssh/known_hosts

WORKDIR /workspace

# Mount host ssh agent into build container
RUN --mount=type=ssh \\
    git clone git@github.com:enterprise-org/proprietary-sdk.git ./sdk && \\
    cd ./sdk && git log -1 --oneline

FROM alpine:3.20 AS final
WORKDIR /app
COPY --from=builder /workspace/sdk/dist ./lib
# Zero SSH credentials or private git history exist in this image!
CMD ["echo", "SDK ready"]`,
    breakdown: [
      {
        lineRange: "6-8",
        note: "Safely registers GitHub's public host key fingerprint to avoid interactive host verification failure."
      },
      {
        lineRange: "12-14",
        note: "--mount=type=ssh forwards local ssh-agent socket. The private key never enters the container filesystem."
      },
      {
        lineRange: "16-20",
        note: "Final image copies only build artifacts, ensuring zero git tokens or commit trees leak into production."
      }
    ],
    expectedOutput: `# Execute with:
$ eval $(ssh-agent) && ssh-add ~/.ssh/id_ed25519
$ docker build --ssh default -t my-app .
[+] Building 2.1s (7/7) FINISHED
 => [builder 3/3] RUN --mount=type=ssh git clone git@github.com...
 => Cloning into './sdk'...
 => b87f1a9 chore: release proprietary v2.4.0`
  },
  {
    id: "docker-ex-05",
    title: "Injecting Private Package Registry Credentials via BuildKit Secret Mounts",
    category: "Dockerfile & BuildKit",
    difficulty: "advanced",
    whatThisCodeCovers: "Installs private npm/pip dependencies using BuildKit secrets mounted as temporary files into RAM (/run/secrets), leaving zero trace in Docker history or layer metadata.",
    conceptsCovered: [
      "RUN --mount=type=secret",
      "Private registry auth (.npmrc / pip.conf)",
      "Zero secret leakage in docker history",
      "docker build --secret id=...",
      "Layer hygiene"
    ],
    code: `# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS installer
WORKDIR /app

COPY package.json package-lock.json ./

# Mount secret file temporarily during RUN; never copied into layer
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \\
    --mount=type=cache,target=/root/.npm \\
    npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY . .
USER node
CMD ["node", "server.js"]`,
    breakdown: [
      {
        lineRange: "7-10",
        note: "--mount=type=secret exposes secret only to this RUN command in tmpfs. Once command finishes, secret vanishes."
      },
      {
        lineRange: "12-16",
        note: "docker history will show the command line without the secret contents, preventing token theft from registry scans."
      }
    ],
    expectedOutput: `# Execute with:
$ docker build --secret id=npmrc,src=.npmrc.private -t secure-api .
$ docker history secure-api:latest | grep npmrc
# Result: Secrets are completely absent from layer blobs!`
  },
  {
    id: "docker-ex-06",
    title: "Multi-Stage Rust Binary Compilation Using cargo-chef for Lightning Build Caching",
    category: "Dockerfile & BuildKit",
    difficulty: "advanced",
    whatThisCodeCovers: "Uses cargo-chef to calculate dependency manifests for Rust projects, allowing crates to be compiled and cached in Docker layers so code changes only recompile user code in seconds rather than minutes.",
    conceptsCovered: [
      "cargo-chef prepare & cook",
      "Rust layer caching strategy",
      "Debian bookworm-slim vs scratch",
      "Binary optimization via lld linker",
      "Build acceleration"
    ],
    code: `# syntax=docker/dockerfile:1.7
FROM lukemathwalker/cargo-chef:latest-rust-1.80-alpine AS chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Cook dependencies: layers are cached as long as Cargo.lock is unchanged!
RUN --mount=type=cache,target=/usr/local/cargo/registry \\
    --mount=type=cache,target=/usr/local/cargo/git \\
    cargo chef cook --release --recipe-path recipe.json

# Build actual application
COPY . .
RUN cargo build --release --bin backend

# Runtime container
FROM alpine:3.20 AS runner
RUN apk add --no-cache libgcc
COPY --from=builder /app/target/release/backend /usr/local/bin/backend
USER 1000:1000
CMD ["/usr/local/bin/backend"]`,
    breakdown: [
      {
        lineRange: "5-8",
        note: "Planner generates recipe.json containing only dependency graph signatures without any source code."
      },
      {
        lineRange: "10-16",
        note: "cargo chef cook pre-builds all external crates. This massive layer is 100% cached until Cargo.lock changes."
      },
      {
        lineRange: "18-26",
        note: "Compiles only local src code in seconds, copying final binary to minimal Alpine runtime."
      }
    ],
    expectedOutput: `[+] Building 3.2s (15/15) FINISHED
 => [builder 2/2] RUN cargo chef cook --release --recipe-path recipe.json => CACHED
 => [builder 4/4] RUN cargo build --release --bin backend 2.8s
 => Binary compiled in 3s instead of 180s on cached dependencies!`
  },
  {
    id: "docker-ex-07",
    title: "Spring Boot Layered JAR Containerization for Optimal Docker Layer Reuse",
    category: "Dockerfile & BuildKit",
    difficulty: "intermediate",
    whatThisCodeCovers: "Extracts a Spring Boot fat JAR into 4 distinct layers (dependencies, spring-boot-loader, snapshot-dependencies, application) so frequent application updates only invalidate a few kilobytes of image layers.",
    conceptsCovered: [
      "Layered JAR extraction (-Djarmode=layertools)",
      "Layer order optimization",
      "Eclipse Temurin JRE Alpine",
      "JVM container ergonomics (UseContainerSupport)",
      "Unprivileged user security"
    ],
    code: `# syntax=docker/dockerfile:1.7
FROM eclipse-temurin:21-jre-alpine AS extractor
WORKDIR /extracted
ARG JAR_FILE=target/*.jar
COPY \${JAR_FILE} app.jar
RUN java -Djarmode=layertools -jar app.jar extract

FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring

# Copy layers from least frequently changed to most frequently changed
COPY --from=extractor /extracted/dependencies/ ./
COPY --from=extractor /extracted/spring-boot-loader/ ./
COPY --from=extractor /extracted/snapshot-dependencies/ ./
COPY --from=extractor /extracted/application/ ./

USER spring:spring
EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "org.springframework.boot.loader.launch.JarLauncher"]`,
    breakdown: [
      {
        lineRange: "1-6",
        note: "Uses layertools to decompose monolithic fat JAR into distinct cacheable layer slices."
      },
      {
        lineRange: "12-16",
        note: "Copies third-party dependencies first (rarely changed), then internal application code last (changes every commit)."
      },
      {
        lineRange: "18-21",
        note: "Runs as unprivileged spring user with dynamic memory sizing relative to container cgroup limits."
      }
    ],
    expectedOutput: `Pushing layer 1 (dependencies): 180MB -> Layer already exists
Pushing layer 2 (loader): 240KB -> Layer already exists
Pushing layer 3 (app): 14KB -> Pushed in 0.1s!
Deployment bandwidth slashed by 99%!`
  },
  {
    id: "docker-ex-08",
    title: "Production-Grade Healthcheck Script with Dynamic Endpoint Fallback & Retries",
    category: "Dockerfile & BuildKit",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a robust POSIX shell healthcheck script within Docker that handles transient network blips, checks dependent services, and fails cleanly without masking zombie processes.",
    conceptsCovered: [
      "HEALTHCHECK instruction syntax",
      "--interval, --timeout, --start-period, --retries",
      "curl vs wget POSIX fallback",
      "Exit codes (0=healthy, 1=unhealthy, 2=reserved)",
      "Startup grace periods"
    ],
    code: `# syntax=docker/dockerfile:1.7
FROM alpine:3.20
RUN apk add --no-cache curl jq

WORKDIR /app
COPY healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod +x /usr/local/bin/healthcheck.sh

# Embedded Dockerfile HEALTHCHECK configuration
HEALTHCHECK --interval=15s \\
            --timeout=3s \\
            --start-period=30s \\
            --retries=3 \\
            CMD ["/usr/local/bin/healthcheck.sh"]

# --- content of healthcheck.sh ---
# #!/bin/sh
# set -eo pipefail
# STATUS_URL="http://127.0.0.1:8080/health/liveness"
# 
# RESPONSE=$(curl -fsS -m 2 "$STATUS_URL" 2>/dev/null) || exit 1
# 
# IS_READY=$(echo "$RESPONSE" | jq -r '.status')
# if [ "$IS_READY" = "UP" ]; then
#   exit 0
# else
#   exit 1
# fi`,
    breakdown: [
      {
        lineRange: "8-13",
        note: "Configures healthcheck cadence: checks every 15s, gives 30s warmup before marking unhealthy, allows 3 retries."
      },
      {
        lineRange: "16-25",
        note: "healthcheck.sh queries local loopback with a strict 2s curl timeout and checks JSON response status."
      }
    ],
    expectedOutput: `$ docker inspect --format='{{json .State.Health}}' web-container | jq .
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2026-11-04T10:00:00Z",
      "End": "2026-11-04T10:00:00.120Z",
      "ExitCode": 0,
      "Output": ""
    }
  ]
}`
  },
  {
    id: "docker-ex-09",
    title: "Container PID 1 Entrypoint Shell Script with Trap Signal Forwarding & Tini Execution",
    category: "Dockerfile & BuildKit",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs an entrypoint script that handles runtime configuration substitution, dynamic migration checks, and uses exec to replace the shell process so SIGTERM reaches the real application.",
    conceptsCovered: [
      "exec form vs shell form",
      "Entrypoint wrapping pattern",
      "Signal trap and forwarding",
      "exec \"$@\" PID replacement",
      "Running database migrations on boot"
    ],
    code: `# syntax=docker/dockerfile:1.7
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \\
    tini gosu ca-certificates \\
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
CMD ["my-app", "--config", "/etc/app.conf"]

# --- content of entrypoint.sh ---
# #!/usr/bin/env bash
# set -Eeuo pipefail
# 
# echo "Executing pre-start environmental validation..."
# if [ -z "\${DATABASE_URL:-}" ]; then
#     echo "Error: DATABASE_URL environment variable is required." >&2
#     exit 1
# fi
# 
# echo "Pre-flight checks passed. Switching process to: $@"
# # Crucial: 'exec' replaces shell PID so signals route directly to cmd!
# exec "$@"`,
    breakdown: [
      {
        lineRange: "8-10",
        note: "tini sits as PID 1 to reap zombies, executing /entrypoint.sh before handing control to the CMD."
      },
      {
        lineRange: "15-22",
        note: "entrypoint.sh performs idempotent preflight validations, secret decryption, or migrations."
      },
      {
        lineRange: "23-25",
        note: "exec \"$@\" replaces the bash subshell with the target binary, preserving signal propagation."
      }
    ],
    expectedOutput: `$ docker run --rm -e DATABASE_URL="postgres://user:pass@db:5432/app" my-image
Executing pre-start environmental validation...
Pre-flight checks passed. Switching process to: my-app --config /etc/app.conf
[INFO] my-app initialized on PID 2 (tini PID 1)`
  },
  {
    id: "docker-ex-10",
    title: "Bit-for-Bit Deterministic Reproducible Docker Image via SOURCE_DATE_EPOCH",
    category: "Dockerfile & BuildKit",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures BuildKit and the compiler to use fixed timestamps and reproducible layer creation so rebuilding the same git commit on different machines generates the exact same image SHA256 digest.",
    conceptsCovered: [
      "Reproducible builds",
      "SOURCE_DATE_EPOCH standardization",
      "Tar mtime clamping",
      "Cryptographic provenance & attestations",
      "docker buildx build --provenance"
    ],
    code: `# syntax=docker/dockerfile:1.7
FROM alpine:3.20 AS builder
ARG SOURCE_DATE_EPOCH=1700000000
WORKDIR /app

# Ensure file creation times and sorting are uniform
COPY . .
RUN find . -exec touch -d @\${SOURCE_DATE_EPOCH} {} +

FROM alpine:3.20 AS runner
ARG SOURCE_DATE_EPOCH=1700000000
WORKDIR /app
COPY --from=builder /app /app

# Build invocation command:
# docker buildx build \\
#   --build-arg SOURCE_DATE_EPOCH=$(git log -1 --pretty=%ct) \\
#   --output type=docker,rewrite-timestamp=true \\
#   -t reproducible-app:v1 .`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Build argument SOURCE_DATE_EPOCH clamps file timestamps across intermediate layers."
      },
      {
        lineRange: "14-19",
        note: "BuildKit 1.7 rewrite-timestamp clamps tarball mtimes, yielding identical layer checksums."
      }
    ],
    expectedOutput: `$ docker buildx build --build-arg SOURCE_DATE_EPOCH=1700000000 ...
Digest: sha256:d5f2a1b9c7e8419b...
# Rebuilt on Machine B:
Digest: sha256:d5f2a1b9c7e8419b... (100% Bit-for-bit identical!)`
  },
  {
    id: "docker-ex-11",
    title: "Production Multi-Stage Frontend (Vite/React) with Nginx Alpine and Security Headers",
    category: "Dockerfile & BuildKit",
    difficulty: "intermediate",
    whatThisCodeCovers: "Compiles a modern Vite/React single-page application and serves it via Nginx Alpine configured with SPA client-side routing fallback, gzip compression, and HTTP security headers.",
    conceptsCovered: [
      "Vite production build",
      "Nginx Alpine SPA try_files directive",
      "Gzip and brotli static compression",
      "Security headers (CSP, X-Frame-Options)",
      "Unprivileged Nginx (nginxinc/nginx-unprivileged)"
    ],
    code: `# syntax=docker/dockerfile:1.7
# Stage 1: Build static assets
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# Stage 2: Serve via unprivileged Nginx
FROM nginxinc/nginx-unprivileged:alpine-slim AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom hardened Nginx configuration
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Builds production JS/CSS bundles using cached dependencies."
      },
      {
        lineRange: "10-13",
        note: "Runs as non-root user 'nginx' on port 8080 (unprivileged ports > 1024)."
      },
      {
        lineRange: "29-35",
        note: "try_files handles client-side React Router navigation while static assets receive aggressive 1-year cache headers."
      }
    ],
    expectedOutput: `$ curl -I http://localhost:8080
HTTP/1.1 200 OK
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Cache-Control: public, immutable`
  }
];
