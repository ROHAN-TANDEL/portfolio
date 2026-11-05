const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 13,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "Dockerfile Core Directives & Layer Generation",
    priority: "must-know",
    difficulty: "beginner",
    question: "What are the primary Dockerfile instructions, and which instructions create persistent filesystem layers?",
    quickAnswer: "The core instructions are `FROM`, `RUN`, `COPY`, `ADD`, `WORKDIR`, `ENV`, `ARG`, `USER`, `EXPOSE`, `CMD`, and `ENTRYPOINT`. Only instructions that introduce filesystem modifications (`RUN`, `COPY`, and `ADD`) create persistent image layers. Metadata instructions (`ENV`, `EXPOSE`, `WORKDIR`, `USER`, `CMD`) modify image configuration without adding filesystem layer weight.",
    detailedAnswer: "A Dockerfile is an automated script of instructions executed sequentially by the build engine. Each `RUN`, `COPY`, or `ADD` instruction creates a new intermediate read-only layer (a tarball of changes). In contrast, metadata instructions like `WORKDIR /app` or `USER node` simply alter fields in the image's config JSON blob. Structuring Dockerfiles to group shell commands with `&&` chains reduces intermediate filesystem layers and keeps images lean.",
    code: `# syntax=docker/dockerfile:1
FROM alpine:3.19

# Metadata: 0 bytes added to filesystem
WORKDIR /app
ENV PORT=8080

# RUN creates a single layer by chaining commands and cleaning cache:
RUN apk add --no-cache curl ca-certificates && \
    adduser -D -u 1001 appuser

# COPY creates a filesystem layer containing application code:
COPY --chown=appuser:appuser ./bin/server /app/server

# Metadata: Swaps execution user (0 bytes layer weight)
USER appuser
EXPOSE 8080
CMD ["/app/server"]`,
    recallHint: "Only RUN, COPY, and ADD create filesystem layers. ENV, USER, EXPOSE, CMD only update config JSON.",
    interviewTip: "Highlight that `apk add --no-cache` (or `apt-get clean && rm -rf /var/lib/apt/lists/*`) must be executed in the SAME `RUN` instruction as the package installation, otherwise the package cache remains trapped in an underlying layer.",
    tags: ["dockerfile", "instructions", "layers", "caching", "best-practices"],
    practice: [
      "Why does running `RUN apt-get clean` in a separate instruction fail to reduce image size?",
      "What is the difference between `COPY` and `ADD`?"
    ]
  }),

  createCard({
    idNum: 14,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "CMD vs ENTRYPOINT (Exec Form vs Shell Form)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between `CMD` and `ENTRYPOINT`, and why is the Exec form preferred over the Shell form?",
    quickAnswer: "`ENTRYPOINT` specifies the executable that always runs when the container starts. `CMD` provides default arguments to that executable (or acts as the fallback command if no entrypoint is declared). The **Exec form** (`[\"executable\", \"param\"]`) runs the process directly as PID 1, allowing it to receive Unix signals (`SIGTERM`). The **Shell form** (`executable param`) wraps execution in `/bin/sh -c`, spawning a subshell that swallows termination signals.",
    detailedAnswer: "In the Exec form (`CMD [\"node\", \"server.js\"]`), the executable is spawned directly with `execve()`. In the Shell form (`CMD node server.js`), the kernel runs `/bin/sh -c 'node server.js'`. The shell becomes PID 1, and the application becomes PID 2. Because most standard shells do not forward `SIGTERM` signals to child processes, running in shell form prevents graceful shutdowns: `docker stop` times out after 10 seconds and forcefully kills the container with `SIGKILL`.",
    code: `# PATTERN 1: ENTRYPOINT as fixed command, CMD as overridable default arguments
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]

# Running without arguments executes: nginx -g "daemon off;"
$ docker run my-nginx

# Overriding arguments at runtime executes: nginx -t (tests config)
$ docker run my-nginx -t

# -------------------------------------------------------------
# DANGER: Shell form swallows signals!
# ENTRYPOINT ./my-app        -> Spawns: /bin/sh -c ./my-app (PID 2)

# SAFE: Exec form runs binary as PID 1 directly!
ENTRYPOINT ["./my-app"]     -> Spawns: ./my-app (PID 1, catches SIGTERM!)`,
    recallHint: "ENTRYPOINT = fixed executable. CMD = default arguments. Always use Exec JSON array syntax: [\"app\", \"arg\"].",
    interviewTip: "Whenever an interviewer asks why a container takes exactly 10 seconds to stop on `docker stop`, immediately answer: 'The Dockerfile used the shell form for CMD or ENTRYPOINT, so SIGTERM was not received by PID 1'.",
    tags: ["cmd", "entrypoint", "exec-form", "shell-form", "signals"],
    practice: [
      "How do you completely override an image's `ENTRYPOINT` using the Docker CLI?",
      "Can `ENTRYPOINT` and `CMD` be combined with an entrypoint bash wrapper script?"
    ]
  }),

  createCard({
    idNum: 15,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "Multi-Stage Builds Architecture",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do Multi-Stage builds work, and how do they eliminate build toolchains from final production images?",
    quickAnswer: "Multi-Stage builds use multiple `FROM` instructions in a single Dockerfile. Heavy compilers, SDKs (Node, Go, Rust, Maven), and source files reside in early 'builder' stages. The final production stage uses a minimal runtime base (Alpine, Distroless), using `COPY --from=builder` to copy only the compiled binaries or assets. This slashes image sizes from gigabytes to megabytes and eliminates compiler vulnerabilities.",
    detailedAnswer: "Historically, developers had to maintain two Dockerfiles (e.g. `Dockerfile.build` and `Dockerfile.prod`) and write shell scripts to extract binaries. Multi-stage builds native to Docker solve this. BuildKit automatically prunes intermediate stages that are not needed by the final target. If an application requires a 1.5GB Go SDK to compile, the final image only contains a 15MB statically linked Go binary on `scratch` or `alpine`.",
    code: `# syntax=docker/dockerfile:1

# STAGE 1: Heavyweight Build Environment
FROM golang:1.22-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Compile statically linked binary with stripped debug symbols (-ldflags="-s -w"):
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/api-server .

# STAGE 2: Ultra-Minimal Production Runtime
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
# Copy ONLY the compiled binary from the builder stage!
COPY --from=builder /bin/api-server /app/api-server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app/api-server"]`,
    recallHint: "Multi-stage: Multiple FROMs in 1 file; compile in builder stage, COPY --from=builder into minimal runtime.",
    interviewTip: "Mention that you can build specific intermediate targets using `docker build --target builder -t my-app:dev .` to create developer containers with debugging tools included.",
    tags: ["multi-stage", "optimization", "distroless", "security", "buildkit"],
    practice: [
      "How does `docker build --target <stage-name>` enable localized unit testing inside CI pipelines?",
      "Why is copying package manifests (`package.json`, `go.mod`) before copying application code crucial for layer caching?"
    ]
  }),

  createCard({
    idNum: 16,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "BuildKit Architecture & Low-Level Builder (LLB) DAG",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does BuildKit execute Dockerfile builds, and what is the Low-Level Builder (LLB) directed acyclic graph?",
    quickAnswer: "BuildKit converts high-level Dockerfile instructions into Low-Level Builder (LLB)—a binary intermediate representation modeled as a Directed Acyclic Graph (DAG). BuildKit analyzes independent nodes in the DAG and executes unrelated build stages and commands concurrently in parallel, while skipping unreferenced stages completely.",
    detailedAnswer: "In the legacy Docker builder, instructions executed strictly sequentially, layer by layer, from top to bottom. If Stage A built the frontend and Stage B built the backend, the legacy builder executed A, then B. BuildKit parses the Dockerfile into an LLB DAG. Because Stage A and Stage B have no shared dependencies, BuildKit builds both stages in parallel utilizing multi-core CPUs. Furthermore, BuildKit supports rootless builds, advanced mount caches, and remote distributed cache exports.",
    code: `# Enable BuildKit explicitly (default in Docker 20.10+):
export DOCKER_BUILDKIT=1

# Visualize BuildKit's parallel execution output:
$ docker build --progress=plain -t my-app .

# Example Dockerfile where BuildKit compiles frontend & backend in parallel:
# syntax=docker/dockerfile:1
FROM node:20-alpine AS frontend-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build  # <--- Runs concurrently with backend!

FROM golang:1.22-alpine AS backend-builder
WORKDIR /api
COPY api/go.* ./
RUN go mod download
COPY api/ .
RUN go build -o /bin/server .  # <--- Runs concurrently with frontend!

FROM alpine:3.19
COPY --from=frontend-builder /web/dist /var/www/html
COPY --from=backend-builder /bin/server /usr/local/bin/server
ENTRYPOINT ["/usr/local/bin/server"]`,
    recallHint: "BuildKit converts Dockerfile to LLB DAG; runs independent stages concurrently in parallel.",
    interviewTip: "Highlight that if an intermediate build stage is never referenced by the final stage (or by `COPY --from`), BuildKit skips executing it entirely, saving significant CI minutes.",
    tags: ["buildkit", "llb", "concurrency", "dag", "performance"],
    practice: [
      "What is the `# syntax=docker/dockerfile:1` directive at the top of modern Dockerfiles?",
      "How does BuildKit's `--cache-to` and `--cache-from` allow caching layers across remote GitHub Actions runners?"
    ]
  }),

  createCard({
    idNum: 17,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "BuildKit Cache Mounts (--mount=type=cache)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do BuildKit Cache Mounts work, and how do they speed up package managers (npm, pip, cargo, go, apt)?",
    quickAnswer: "`--mount=type=cache,target=<dir>` mounts a persistent host cache directory into the build container during a `RUN` instruction. Package managers write downloaded dependencies directly into this cache. The cache survives across rebuilds without being baked into the final image layer, cutting build times by 80-90%.",
    detailedAnswer: "In standard builds, if `package.json` changes, Docker invalidates the cache for `RUN npm install`, forcing a fresh download of every package over the internet. With `--mount=type=cache,target=/root/.npm`, the downloaded `.tar.gz` packages remain stored in BuildKit's host cache. When `package.json` mutates, `npm install` checks the local cache first, downloading only new packages. Crucially, because it is an ephemeral mount, the cache directory adds 0 megabytes to the resulting Docker image layer.",
    code: `# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./

# 1. npm cache mount: speeds up install 10x across code changes
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

COPY . .
RUN npm run build

# 2. Go compiler cache mount:
# RUN --mount=type=cache,target=/go/pkg/mod \
#     --mount=type=cache,target=/root/.cache/go-build \
#     go build -o /bin/app .

# 3. Alpine apk cache mount:
# RUN --mount=type=cache,target=/var/cache/apk \
#     apk add --update gcc musl-dev`,
    recallHint: "RUN --mount=type=cache,target=... preserves package manager download cache across builds with 0 layer weight.",
    interviewTip: "Mention that cache mounts are safe for concurrent builds: BuildKit locks the cache during execution to prevent parallel builds from corrupting shared package manager stores.",
    tags: ["buildkit", "cache-mounts", "performance", "npm", "ci-cd"],
    practice: [
      "Where does BuildKit store the cache mount data on the host disk?",
      "Why must `--mount=type=cache` be declared on every `RUN` instruction that accesses the cache directory?"
    ]
  }),

  createCard({
    idNum: 18,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "BuildKit Secret Mounts (--mount=type=secret)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why is passing secrets via `ARG` or `ENV` a critical security vulnerability, and how does `--mount=type=secret` solve it?",
    quickAnswer: "`ARG` and `ENV` values are permanently baked into image metadata and layer history (`docker history` or `docker inspect` exposes them in plaintext). `--mount=type=secret,id=<name>` mounts the secret as a temporary in-memory file (`/run/secrets/<name>`) during the `RUN` command. It is accessible to the build command but never recorded in any image layer.",
    detailedAnswer: "Developers frequently make the fatal mistake of writing `ARG GITHUB_TOKEN` and using it to download private npm packages. Even if the developer deletes the token later in the Dockerfile (`RUN rm token`), the layer where the token was introduced is stored in the image history forever. BuildKit's secret mounts mount credentials into a temporary `tmpfs` RAM disk during compilation. Once the `RUN` instruction finishes, the mount vanishes completely.",
    code: `# syntax=docker/dockerfile:1
FROM python:3.11-slim
WORKDIR /app

# VULNERABLE DISASTER ANTI-PATTERN:
# ARG AWS_SECRET_KEY=12345  # BAKED INTO IMAGE METADATA FOREVER!
# RUN pip install --extra-index-url https://$AWS_SECRET_KEY@pypi.company.com mypkg

# SECURE PRODUCTION REMEDIATION:
# Mounts secret securely without baking into layer history:
RUN --mount=type=secret,id=pip_token \
    PIP_INDEX_URL="https://token:$(cat /run/secrets/pip_token)@pypi.company.com/simple" \
    pip install --no-cache-dir my-private-package

# Build command passing the host secret securely:
# $ docker build --secret id=pip_token,src=$HOME/.pip_secret -t my-app .`,
    recallHint: "ARG/ENV leaks secrets into image history. Use RUN --mount=type=secret to mount in-memory without layer storage.",
    interviewTip: "In security reviews, demonstrate how `docker history --no-trunc <image>` easily extracts API keys passed via `ARG` or `ENV`.",
    tags: ["secrets", "security", "buildkit", "secret-mount", "vulnerability"],
    practice: [
      "How do you pass secrets from environment variables using `--secret id=mysecret,env=MY_ENV_VAR`?",
      "Why does multi-stage building alone fail to protect secrets if the secret was passed via ARG in the final stage?"
    ]
  }),

  createCard({
    idNum: 19,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "BuildKit SSH Mounts (--mount=type=ssh)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do BuildKit SSH Mounts allow cloning private Git repositories during build without copying private SSH keys into the image?",
    quickAnswer: "`--mount=type=ssh` forwards the host machine's active SSH agent socket (`SSH_AUTH_SOCK`) into the build container during a `RUN` instruction. Git commands inside the container authenticate using the host's existing SSH keys. The private key never touches the container filesystem.",
    detailedAnswer: "Before BuildKit, cloning private Git dependencies required copying an SSH private key (`id_rsa`) into the container, running `git clone`, and trying to delete the key. This frequently resulted in leaked private keys in intermediate layers. BuildKit SSH forwarding connects the container's SSH client to the host's running `ssh-agent`. Authentication challenges are signed on the host machine, guaranteeing that the container never sees or stores the private key bytes.",
    code: `# syntax=docker/dockerfile:1
FROM alpine:3.19
RUN apk add --no-cache git openssh-client

# Add GitHub host key to known_hosts to prevent interactive authenticity prompts:
RUN mkdir -p -m 0700 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts

# Clone private repository using the forwarded host SSH agent:
RUN --mount=type=ssh \
    git clone git@github.com:my-org/private-core-library.git /src/core

# On Host Machine:
# 1. Ensure SSH key is loaded into host ssh-agent:
# $ ssh-add ~/.ssh/id_ed25519
# 2. Build with SSH forwarding enabled:
# $ docker build --ssh default -t my-secure-app .`,
    recallHint: "RUN --mount=type=ssh forwards host ssh-agent socket; container clones private repos with 0 key storage.",
    interviewTip: "Always remember to add `ssh-keyscan <domain> >> ~/.ssh/known_hosts` beforehand, otherwise the build will hang or fail with host key verification errors.",
    tags: ["ssh-mount", "git", "buildkit", "security", "credentials"],
    practice: [
      "How do you specify different SSH keys for different repositories using `--ssh github=~/.ssh/github_key`?",
      "What happens if `ssh-agent` is not running on the host machine during a `--ssh` build?"
    ]
  }),

  createCard({
    idNum: 20,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "Base Image Taxonomy: Ubuntu vs Alpine vs Distroless vs scratch",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Compare the trade-offs of Ubuntu, Alpine, Google Distroless, and `scratch` base images.",
    quickAnswer: "1) **Ubuntu/Debian** (~80-120MB): Full glibc userland, package manager (`apt`), broad compatibility, large attack surface. 2) **Alpine** (~5-7MB): Ultra-lightweight, `apk` package manager, uses `musl libc` (can cause binary/allocator compatibility issues with glibc binaries). 3) **Distroless** (~20-40MB): Contains only the application and runtime dependencies (glibc, CA certs, tzdata); has **zero shell** and zero package managers. 4) **scratch** (0MB): Empty image; used exclusively for statically compiled binaries (Go, Rust).",
    detailedAnswer: "Choosing the correct base image dictates security, performance, and maintenance. While Alpine is tiny, its `musl libc` implementation has historically suffered from slower thread allocations and DNS resolution discrepancies compared to `glibc`. Google Distroless provides `glibc` compatibility while removing all shell binaries (`sh`, `bash`) and system utilities (`curl`, `cat`), rendering Remote Code Execution (RCE) attacks nearly impossible to escalate.",
    code: `# Comparison of Base Image Sizes & Shells:
# 1. Standard Debian:
FROM debian:12-slim       # ~75MB, glibc, apt, bash included

# 2. Alpine:
FROM alpine:3.19          # ~7MB, musl libc, apk, sh included

# 3. Google Distroless (glibc, NO SHELL, non-root user included):
FROM gcr.io/distroless/nodejs20-debian12:nonroot # ~35MB, ZERO shell!

# 4. Scratch (Pure empty filesystem):
FROM scratch              # 0MB! Used for static Go/Rust:
COPY ./my-static-bin /app
ENTRYPOINT ["/app"]`,
    recallHint: "Ubuntu = full glibc/apt (~80MB). Alpine = musl/apk (~7MB). Distroless = glibc, NO shell. Scratch = 0MB.",
    interviewTip: "In security interviews, champion Google Distroless: because it contains no package managers or shell, automated vulnerability scanners find near-zero CVEs, and attackers cannot run reverse shell scripts.",
    tags: ["base-images", "distroless", "alpine", "scratch", "security"],
    practice: [
      "Why do native C++ Node.js addons occasionally experience performance degradation or build failures on Alpine?",
      "How do you debug a running Distroless container if it has no shell?"
    ]
  }),

  createCard({
    idNum: 21,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "Layer Caching Invalidation Rules & Context Ordering",
    priority: "must-know",
    difficulty: "beginner",
    question: "What rules govern Docker layer cache invalidation, and how should instructions be ordered to maximize cache hits?",
    quickAnswer: "Docker checks the build cache layer by layer from top to bottom. For `RUN` instructions, Docker checks if the command string matches. For `COPY` and `ADD`, Docker compares the cryptographic checksum of the files being copied. **The Golden Rule**: Order instructions from lowest frequency of change (OS packages, dependencies) to highest frequency of change (source code).",
    detailedAnswer: "As soon as a single instruction invalidates the cache (e.g. `COPY . .` detects an edited file), ALL subsequent instructions in that stage have their cache busted and must re-run from scratch. A classic anti-pattern is copying the entire project directory before running `npm install`. By copying only `package.json` first, running install, and copying source files last, dependency installation is cached unless dependencies actually change.",
    code: `# 1. DISASTER ANTI-PATTERN: Busted cache on every single code edit!
COPY . .            # BUSTS CACHE on every keystroke!
RUN npm install     # Downloads 500MB of dependencies on EVERY build!

# -------------------------------------------------------------
# 2. PRODUCTION REMEDIATION: Layer-cached dependency ordering
WORKDIR /app

# Step A: Copy dependency manifests ONLY (changes rarely):
COPY package.json package-lock.json ./

# Step B: Install dependencies (CACHED unless package.json mutates!):
RUN npm ci

# Step C: Copy remaining source code (changes frequently):
COPY . .

# Step D: Compile application:
RUN npm run build`,
    recallHint: "Order instructions from least frequently changed (dependencies) to most frequently changed (code).",
    interviewTip: "Explain that `COPY` checks file checksums, but `RUN` only checks the command string. If a `RUN apt-get update` ran yesterday, Docker will use the cached layer and will NOT check for upstream OS security updates unless `--no-cache` is used.",
    tags: ["caching", "layer-invalidation", "optimization", "dockerfile", "best-practices"],
    practice: [
      "How does file timestamp metadata affect Docker layer caching in git checkouts?",
      "Why should package cache cleanups always reside in the same `RUN` step as package installation?"
    ]
  }),

  createCard({
    idNum: 22,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: ".dockerignore Syntax & Context Optimization",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `.dockerignore`, and how does an optimized whitelist pattern protect build speed and security?",
    quickAnswer: "`.dockerignore` defines files and directories excluded from the build context sent by the CLI to the Docker daemon. Excluding heavy or sensitive files (`.git`, `node_modules`, `.env`, build artifacts) reduces context transfer time from minutes to seconds, prevents cache invalidation, and prevents accidental credential leaks into images.",
    detailedAnswer: "When you run `docker build .`, the CLI tarballs everything in the current directory and transmits it to the daemon over the socket. If `node_modules` or `.git` are included, the CLI may transmit 1-2GB of unnecessary data. Furthermore, if `.env` is copied into an image via `COPY . .`, production API keys leak. An enterprise best practice is using a **whitelist pattern**: ignore everything with `*`, then explicitly re-include only necessary assets with `!`. ",
    code: `# .dockerignore - Enterprise Whitelist Pattern:

# 1. Ignore everything by default:
**

# 2. Re-include ONLY necessary source files and manifests:
!package.json
!package-lock.json
!tsconfig.json
!src/
!public/

# 3. Explicitly re-exclude nested junk even within included folders:
**/*.log
**/.DS_Store
**/node_modules
**/.git
**/.env*
**/coverage
**/dist`,
    recallHint: ".dockerignore prevents huge build context transfers and stops secrets (.env) from leaking into images.",
    interviewTip: "Mention that if you see 'Sending build context to Docker daemon: 1.5GB' in terminal logs, it indicates a missing or broken `.dockerignore` file transmitting `.git` or local `node_modules`.",
    tags: ["dockerignore", "build-context", "security", "optimization", "performance"],
    practice: [
      "Why is copying a local host `node_modules` into a Linux container harmful if C++ native bindings are used?",
      "How does the leading exclamation mark (`!`) function in `.dockerignore`?"
    ]
  }),

  createCard({
    idNum: 23,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "Dynamic Build Arguments (ARG) vs Runtime Variables (ENV)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the behavioral differences between `ARG` and `ENV` in a Dockerfile?",
    quickAnswer: "`ARG` (Build Argument) is available ONLY during image build time (`docker build --build-arg`); it does NOT persist into the running container. `ENV` (Environment Variable) persists into the image metadata, is accessible during both build time AND runtime in running containers, and can be overridden via `docker run -e`.",
    detailedAnswer: "`ARG` is intended for parameterizing the build process (e.g. setting software versions or target architectures). As soon as the image build completes, `ARG` variables cease to exist for running containers. `ENV` sets permanent environment variables that containerized processes read via `process.env` or `os.environ`. If an `ARG` has the same name as an `ENV`, the `ENV` instruction overrides it.",
    code: `# syntax=docker/dockerfile:1
FROM node:20-alpine

# ARG: Only available during build time!
ARG APP_VERSION=1.0.0
RUN echo "Compiling version: \${APP_VERSION}"

# ENV: Persists into container runtime!
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app
COPY . .

# In running container:
# process.env.NODE_ENV === "production" (Available!)
# process.env.APP_VERSION === undefined   (NOT available!)

# Override at runtime:
# $ docker run -e PORT=8080 -e NODE_ENV=development my-app`,
    recallHint: "ARG = Build-time only (docker build --build-arg). ENV = Runtime permanent (docker run -e).",
    interviewTip: "Remember that `ARG` declared before `FROM` is globally scoped for parameterizing base image tags, but is NOT available inside build stages unless re-declared with a blank `ARG <name>` inside the stage.",
    tags: ["arg", "env", "configuration", "buildtime", "runtime"],
    practice: [
      "How do you use `ARG` before the `FROM` line to dynamically select base image versions?",
      "Why is `ARG` visible in `docker history` even though it is not accessible at container runtime?"
    ]
  }),

  createCard({
    idNum: 24,
    category: "Dockerfile Mastery & BuildKit Optimization",
    concept: "Minimizing Image Layers, Flattening & docker squash",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does every extra layer add overhead, and what are the modern best practices for layer minimization?",
    quickAnswer: "Each layer adds filesystem metadata overhead and increases the time required by storage drivers (`overlay2`) to traverse the layer stack during file lookups. Best practices: 1) Chain related shell commands with `&&`, 2) Clean temporary caches in the same `RUN` command, and 3) Use Multi-Stage builds instead of legacy `--squash` flags.",
    detailedAnswer: "In early Docker versions, developers used experimental flags like `docker build --squash` to combine all layers into a single layer at the end. However, squashing destroys layer caching between different images! The modern approach is surgical multi-stage structuring: keep intermediate compilation layers granular for fast developer rebuilds, but create a clean, single-copy step in the final production stage.",
    code: `# 1. INEFFICIENT: 4 separate layers, temporary files trapped in layer history!
RUN apt-get update
RUN apt-get install -y gcc
RUN make build
RUN rm -rf /var/lib/apt/lists/* # Fails to recover disk space! Trapped in layer 1!

# -------------------------------------------------------------
# 2. PRODUCTION STANDARD: 1 single layer, 0 trapped temporary files:
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc make && \
    make build && \
    apt-get purge -y --auto-remove gcc make && \
    rm -rf /var/lib/apt/lists/* /tmp/*`,
    recallHint: "Chain commands with && and clean up in the same RUN step to avoid trapping deleted files in lower layers.",
    interviewTip: "Explain that deleting a file in a later layer does NOT reduce image size—it merely writes an OverlayFS 'whiteout' marker in the upper layer that hides the file from the unified view.",
    tags: ["optimization", "layers", "squashing", "best-practices", "overlayfs"],
    practice: [
      "What is an OverlayFS whiteout file (`.wh.<filename>`) and how does it hide deleted files?",
      "Why does multi-stage building eliminate the need for `docker build --squash`?"
    ]
  })
];
