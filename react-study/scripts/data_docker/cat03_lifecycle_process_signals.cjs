const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 25,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "The PID 1 Problem & Zombie Process Reaping",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the 'PID 1 Problem' in Docker containers, and why does running Node.js or Python directly as PID 1 lead to zombie process leaks?",
    quickAnswer: "In Unix systems, the process with PID 1 (traditionally `systemd` or `init`) has two special responsibilities: 1) Reaping orphaned child processes ('zombies') via `waitpid()`, and 2) Handling default Unix signals. Standard application runtimes (Node.js, Python, Java) were never designed to be init systems. They ignore orphaned processes (exhausting the host PID table) and reject default `SIGTERM` signals, breaking graceful shutdown.",
    detailedAnswer: "When a child process forks and dies before its parent calls `waitpid()`, it becomes a 'zombie' (`defunct`). If the parent dies, the kernel re-parents the orphaned zombie to PID 1. Standard init systems continuously reap these processes. But if Node.js is PID 1, it does not implement child reaping. Over days, thousands of zombie processes accumulate, eventually exhausting the Linux host's `kernel.pid_max` limit and crashing all host processes.",
    code: `# Inspect zombie processes inside a container running Node as PID 1:
$ docker exec -it leaky-container ps aux
# USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
# node         1  0.1  0.8 750000 65000 ?        Ssl  10:00   0:01 node server.js
# node        42  0.0  0.0      0     0 ?        Z    10:05   0:00 [sh] <defunct>  # ZOMBIE!
# node        48  0.0  0.0      0     0 ?        Z    10:06   0:00 [sh] <defunct>  # ZOMBIE!

# Fix by running with Docker's built-in init system (tini):
$ docker run --init -d --name fixed-container my-node-app

# Process tree inside container now properly managed:
# PID 1: /sbin/docker-init (tini) -> Reaps zombies & forwards SIGTERM!
# PID 6: node server.js`,
    recallHint: "PID 1 must reap orphaned zombie processes and handle signals; standard runtimes ignore this duty.",
    interviewTip: "This is a classic Staff/Principal DevOps interview question. Mention that Node.js spawning subprocesses (e.g. `child_process.exec()`) without `tini` is the #1 cause of container PID exhaustion.",
    tags: ["pid1", "zombie-processes", "tini", "signals", "linux-kernel"],
    practice: [
      "Why does Linux treat PID 1 specially by disabling default signal handlers for SIGTERM?",
      "How do you inspect the zombie process count on a host system using `ps aux | grep defunct`?"
    ]
  }),

  createCard({
    idNum: 26,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "Container Init Systems (tini, dumb-init, docker run --init)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do `tini` and `dumb-init` solve container process management, and how do you enable them?",
    quickAnswer: "`tini` and `dumb-init` are lightweight (~30kB) init systems designed specifically for containers. They run as PID 1, register a subreaper to clean up orphaned zombie child processes via `waitpid()`, and transparently forward all incoming Unix signals (`SIGTERM`, `SIGINT`) down to the actual application process. Enable via `docker run --init` or baking `tini` into the Dockerfile `ENTRYPOINT`.",
    detailedAnswer: "In production images where applications spawn background shell scripts or subprocesses, adding an init system is mandatory. Docker bundles `tini` directly into the engine, accessible via the `--init` flag. Alternatively, in multi-stage production Dockerfiles, downloading `tini` and placing it in `ENTRYPOINT [\"/sbin/tini\", \"--\"]` guarantees safe signal forwarding and zombie reaping across any container orchestrator (Kubernetes, ECS, Nomad) without requiring CLI flags.",
    code: `# METHOD 1: Built-in Docker Engine flag
$ docker run --init -d my-node-app

# -------------------------------------------------------------
# METHOD 2: Bake tini directly into Dockerfile (Best for Kubernetes)
FROM alpine:3.19
RUN apk add --no-cache tini nodejs npm
WORKDIR /app
COPY . .

# tini runs as PID 1; node runs as child and receives all signals:
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]`,
    recallHint: "tini / dumb-init runs as PID 1, reaps zombies, and forwards SIGTERM. Use docker run --init.",
    interviewTip: "Explain why `--` is required after `/sbin/tini --`: it separates tini's own arguments from the command and arguments passed to the child process.",
    tags: ["tini", "dumb-init", "init-systems", "pid1", "process-management"],
    practice: [
      "What is the difference between `tini` and Yelp's `dumb-init`?",
      "Does a Go static binary need an init system if it never spawns child processes?"
    ]
  }),

  createCard({
    idNum: 27,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "Unix Signal Lifecycle (SIGTERM, SIGINT, SIGKILL)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the sequence of Unix signals sent to a container during shutdown, and how should applications handle `SIGTERM`?",
    quickAnswer: "When `docker stop` is called, Docker sends **`SIGTERM` (signal 15)** to PID 1, requesting a graceful shutdown. Docker starts a countdown timer (default 10 seconds). If PID 1 has not terminated when the timeout expires, Docker sends **`SIGKILL` (signal 9)** to forcefully terminate the process. Applications must catch `SIGTERM`, stop accepting new traffic, finish in-flight requests, close database pools, and exit with code 0.",
    detailedAnswer: "`SIGTERM` is a polite notification: the operating system requests termination, allowing the application to execute cleanup callbacks. In contrast, `SIGKILL` cannot be caught, handled, or ignored by any process; the kernel immediately destroys the process memory space. If an application fails to listen to `SIGTERM`, open database transactions may be corrupted or left dangling when `SIGKILL` arrives.",
    code: `// Node.js Production Graceful Shutdown Handler:
const server = app.listen(3000, () => console.log('Server online'));

// Catch SIGTERM from Docker Engine:
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Starting graceful shutdown...');

  // 1. Stop accepting new incoming HTTP connections:
  server.close(() => {
    console.log('HTTP connections closed.');

    // 2. Close database pools, Redis connections, active file handles:
    databasePool.end().then(() => {
      console.log('Database connections closed cleanly.');
      process.exit(0); // Exit successfully with code 0!
    });
  });

  // 3. Force exit if cleanup takes longer than 8 seconds (before Docker SIGKILL):
  setTimeout(() => {
    console.error('Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 8000);
});`,
    recallHint: "docker stop sends SIGTERM (polite) -> waits 10s -> sends SIGKILL (forceful destruction).",
    interviewTip: "Always configure the application's internal shutdown timeout (e.g. 8s) to be slightly SHORTER than Docker/Kubernetes termination grace period (e.g. 10s or 30s) so error logs can flush before SIGKILL hits.",
    tags: ["signals", "sigterm", "sigkill", "graceful-shutdown", "lifecycle"],
    practice: [
      "How do you increase the grace period timeout using `docker stop --time 30 <container>`?",
      "Why can `SIGKILL` never be intercepted or handled in userland code?"
    ]
  }),

  createCard({
    idNum: 28,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "docker stop vs docker kill vs docker pause",
    priority: "must-know",
    difficulty: "beginner",
    question: "What are the behavioral differences between `docker stop`, `docker kill`, and `docker pause`?",
    quickAnswer: "`docker stop` sends `SIGTERM`, waits a grace period (default 10s), then sends `SIGKILL`. `docker kill` sends `SIGKILL` immediately (or a custom signal specified via `--signal`). `docker pause` freezes all processes in the container using the Linux cgroups freezer subsystem without terminating them, consuming zero CPU while retaining memory state.",
    detailedAnswer: "Use `docker stop` for standard graceful shutdowns in production. Use `docker kill` during emergency response when a rogue container refuses to respond to `SIGTERM`. Use `docker pause` when you need to temporarily reclaim host CPU cycles for an intensive batch job without restarting the container or losing in-memory cache data.",
    code: `# 1. Graceful stop (waits 10s for SIGTERM, then SIGKILL):
$ docker stop my-app

# 2. Custom grace period (waits 30s):
$ docker stop --time 30 my-app

# 3. Instant kill (immediate SIGKILL):
$ docker kill my-app

# 4. Send custom signal (e.g. SIGHUP to reload Nginx configuration):
$ docker kill --signal=HUP my-nginx

# 5. Freeze container execution instantly (0% CPU, RAM preserved):
$ docker pause my-app
# Resume execution:
$ docker unpause my-app`,
    recallHint: "stop = SIGTERM then SIGKILL. kill = instant SIGKILL. pause = cgroup freeze (0% CPU, RAM kept).",
    interviewTip: "Mention sending `docker kill --signal=SIGHUP` to Nginx or Apache containers as the canonical way to reload certificates and configs without dropping active connections.",
    tags: ["docker-stop", "docker-kill", "docker-pause", "cgroups-freezer", "signals"],
    practice: [
      "What happens to network connections when a container is paused via `docker pause`?",
      "How does the Linux cgroups freezer subsystem suspend thread execution?"
    ]
  }),

  createCard({
    idNum: 29,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "Container Restart Policies (no, on-failure, always, unless-stopped)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Explain the four Docker container restart policies: `no`, `on-failure`, `always`, and `unless-stopped`.",
    quickAnswer: "1) `no`: Default. Never restarts the container. 2) `on-failure[:max-retries]`: Restarts only if the container exits with a non-zero exit code. 3) `always`: Restarts whenever the container stops, and restarts automatically on host reboot. 4) `unless-stopped`: Like `always`, but will NOT restart on host reboot if the container was explicitly stopped manually before reboot.",
    detailedAnswer: "Restart policies are handled by the Docker daemon. `always` is problematic during maintenance: if a sysadmin stops a container with `docker stop`, and the host reboots, `always` will unexpectedly bring the container back up. `unless-stopped` is preferred for production single-node deployments because it respects manual administrative shutdowns across host reboots.",
    code: `# 1. Only restart on crashes (non-zero exit code), max 5 attempts:
$ docker run -d --restart=on-failure:5 my-app

# 2. Production standard: Restarts on crash and reboot, unless manually stopped:
$ docker run -d --restart=unless-stopped --name prod-api my-app

# Update restart policy on an already running container dynamically:
$ docker update --restart=unless-stopped prod-api

# Inspect restart count and current status:
$ docker inspect -f '{{.RestartCount}} restarts, status: {{.State.Status}}' prod-api`,
    recallHint: "on-failure = crash only; always = always + reboot; unless-stopped = always EXCEPT when manually stopped.",
    interviewTip: "Highlight that `unless-stopped` prevents stopped legacy/testing containers from accidentally resurrecting after an unscheduled Linux host reboot.",
    tags: ["restart-policy", "reliability", "production", "daemon", "lifecycle"],
    practice: [
      "Why does `docker run --rm` conflict with restart policies?",
      "What backoff algorithm does Docker use when restarting an `on-failure` container in a crash loop?"
    ]
  }),

  createCard({
    idNum: 30,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "The HEALTHCHECK Instruction & Health Status Lifecycle",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the `HEALTHCHECK` instruction work, what are its parameters, and what exit codes determine status?",
    quickAnswer: "`HEALTHCHECK` runs a command periodically inside the container to verify application health. Exit codes: **0 = healthy**, **1 = unhealthy**, **2 = reserved**. Parameters: `--interval` (frequency), `--timeout` (max execution time), `--start-period` (grace period during startup), and `--retries` (consecutive failures before marking unhealthy).",
    detailedAnswer: "By default, Docker only checks if the main process PID is still alive. If a web server deadlocks, enters an infinite loop, or loses its database connection, the PID remains alive, so Docker reports `Up` even though the service is broken. `HEALTHCHECK` probes application vitality from the inside. When marked `unhealthy`, Docker Compose (with `service_healthy`) and orchestrators can trigger automated restarts or reroute load balancer traffic.",
    code: `# In Dockerfile:
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Or specify via Docker CLI:
$ docker run -d --name web-api \
    --health-cmd="curl -f http://localhost:8080/health || exit 1" \
    --health-interval=20s \
    --health-timeout=3s \
    --health-retries=3 \
    --health-start-period=10s \
    nginx:alpine

# Inspect container health history and logs:
$ docker inspect --format '{{json .State.Health}}' web-api | jq .
# {
#   "Status": "healthy",
#   "FailingStreak": 0,
#   "Log": [
#     { "ExitCode": 0, "Output": "OK" }
#   ]
# }`,
    recallHint: "HEALTHCHECK: exit 0 = healthy, exit 1 = unhealthy. Parameters: interval, timeout, start-period, retries.",
    interviewTip: "Always mention `--start-period`: it prevents slow-booting applications (like Java Spring Boot taking 45 seconds to initialize) from being marked unhealthy and killed before they finish starting.",
    tags: ["healthcheck", "monitoring", "reliability", "orchestration", "dockerfile"],
    practice: [
      "Does a standard Docker Engine automatically restart a container when its status becomes `unhealthy`?",
      "How do you write a lightweight health check in images that lack `curl` or `wget`?"
    ]
  }),

  createCard({
    idNum: 31,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "docker exec vs docker attach",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the operational difference between `docker exec` and `docker attach`?",
    quickAnswer: "`docker exec` creates and runs a **brand new process** inside the existing container's namespaces. `docker attach` connects your terminal standard I/O streams directly to the container's **existing PID 1 process**. Pressing Ctrl+C inside `docker attach` terminates the main process and kills the container.",
    detailedAnswer: "`docker exec -it <container> sh` joins the container's namespaces (mount, pid, net) and starts an independent shell instance. When you exit that shell, the container continues running unaffected. In contrast, `docker attach <container>` taps into the original process's stdin/stdout. If you press Ctrl+C, you send `SIGINT` directly to PID 1, stopping the container unless you detach using the escape key sequence `Ctrl+P, Ctrl+Q`.",
    code: `# 1. SAFE DEBUGGING: Spawns an independent shell session (leaves PID 1 alive on exit):
$ docker exec -it prod-api sh
/app # exit  # Container continues running!

# 2. DANGEROUS: Attaches terminal directly to PID 1:
$ docker attach prod-api
# Pressing Ctrl+C sends SIGINT to PID 1 -> KILLS CONTAINER!
# Safe detachment sequence: Press Ctrl+P followed by Ctrl+Q

# 3. Run a one-off diagnostic command as root inside a non-root container:
$ docker exec -u 0 -it prod-api cat /var/log/app.log`,
    recallHint: "exec = spawns NEW process in container (safe). attach = taps into existing PID 1 (Ctrl+C kills it).",
    interviewTip: "Highlight `docker exec -u 0` (executing as root) as a critical troubleshooting tool to inspect files or install diagnostic packages in containers locked down with unprivileged `USER` accounts.",
    tags: ["docker-exec", "docker-attach", "debugging", "cli", "process"],
    practice: [
      "What keyboard shortcut detaches from a `docker attach` session without killing the container?",
      "Can you execute a command in a stopped container using `docker exec`?"
    ]
  }),

  createCard({
    idNum: 32,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "Container Lifecycle State Machine",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the states in the Docker container lifecycle state machine, and what commands transition between them?",
    quickAnswer: "The states are: **created** (`docker create`), **running** (`docker start` / `run`), **paused** (`docker pause`), **restarting** (crash recovery loop), **exited** (`docker stop` / process exit), and **dead** (failed removal / corrupted unmount).",
    detailedAnswer: "When `docker create` runs, Docker prepares namespaces, allocates volume directories, and sets up network endpoints, placing the container in `created`. `docker start` invokes `runc` to execute the entrypoint, moving to `running`. If paused, cgroups freezer suspends threads (`paused`). When PID 1 terminates, the state becomes `exited`. If the daemon fails to clean up volume unmounts during removal, the container enters the unrecoverable `dead` state.",
    code: `# View state transitions programmatically:
$ docker create --name demo alpine sleep 5
# Status: created

$ docker start demo
# Status: running

$ docker pause demo
# Status: paused

$ docker unpause demo
# Status: running

# Wait for sleep 5 to complete:
$ docker wait demo
0
# Status: exited (0)

# Delete container completely:
$ docker rm demo`,
    recallHint: "created -> running <-> paused -> exited -> dead.",
    interviewTip: "Explain `docker wait <container>`: it blocks synchronously until the container exits and prints its numeric exit code, making it invaluable in CI/CD automation scripts.",
    tags: ["lifecycle", "states", "created", "running", "exited", "state-machine"],
    practice: [
      "How do you remove all containers in `exited` or `dead` status in a single command?",
      "What causes a container to get stuck in the `dead` state?"
    ]
  }),

  createCard({
    idNum: 33,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "Auto-Removal & Ephemeral Containers (docker run --rm)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What does the `docker run --rm` flag do, and why is it essential for CI/CD pipelines and one-off utilities?",
    quickAnswer: "`--rm` instructs the Docker daemon to automatically delete the container and its associated anonymous writable layer and anonymous volumes as soon as the container exits. It prevents thousands of stopped container corpses from accumulating on disk.",
    detailedAnswer: "By default, when a container process exits, Docker preserves the container metadata and filesystem on disk so you can inspect its logs (`docker logs`) or file changes (`docker diff`). In automated CI/CD runners or one-off tasks (e.g. running database migrations, linting, or curl tests), omitting `--rm` leaves hundreds of dead containers that quickly consume host storage and inode tables.",
    code: `# 1. One-off utility container cleaned up automatically on completion:
$ docker run --rm -it alpine ping -c 3 google.com

# 2. Ephemeral database migration task:
$ docker run --rm \
    --network=app-network \
    -e DATABASE_URL="postgres://user:pass@db:5432/mydb" \
    my-migration-runner:latest npm run db:migrate

# 3. Clean up existing dangling stopped containers:
$ docker container prune -f`,
    recallHint: "docker run --rm: automatically deletes container and anonymous layers as soon as it terminates.",
    interviewTip: "Always use `--rm` in CI/CD shell scripts. A common CI outage occurs when runners run out of disk space due to thousands of uncleaned non-`--rm` containers.",
    tags: ["rm-flag", "ephemeral", "cleanup", "ci-cd", "automation"],
    practice: [
      "Does `docker run --rm` delete named volumes mounted to the container?",
      "Can `--rm` and `-d` (detached mode) be combined in `docker run`?"
    ]
  }),

  createCard({
    idNum: 34,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "Overriding ENTRYPOINT and CMD at Runtime",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you override an image's `ENTRYPOINT` and `CMD` from the command line?",
    quickAnswer: "Override `CMD` simply by appending arguments to the end of the `docker run` command: `docker run <image> <new_cmd>`. Override `ENTRYPOINT` using the `--entrypoint` flag: `docker run --entrypoint <new_binary> <image> <new_args>`.",
    detailedAnswer: "In production troubleshooting, you often need to bypass a failing entrypoint script (e.g. a database migration script crashing on startup) to open an interactive debugging shell. Passing `sh` at the end of `docker run my-app sh` only overrides `CMD`. If the image defines `ENTRYPOINT [\"python\", \"app.py\"]`, running `docker run my-app sh` results in `python app.py sh`! To bypass python and launch a shell, you must explicitly pass `--entrypoint sh`.",
    code: `# Imagine an image with:
# ENTRYPOINT ["python", "app.py"]
# CMD ["--port", "8080"]

# 1. Overriding CMD only:
$ docker run my-python-app --port 9090
# Executes: python app.py --port 9090

# 2. ATTEMPTING to open shell by appending 'sh' FAILS:
$ docker run my-python-app sh
# Executes: python app.py sh (Fails! Python tries to parse 'sh' as arg)

# 3. PROPER OVERRIDE: Bypass ENTRYPOINT to debug container:
$ docker run --entrypoint sh -it my-python-app
# Executes: sh (Opens root interactive shell directly!)`,
    recallHint: "Append to end overrides CMD; use --entrypoint <bin> to override ENTRYPOINT.",
    interviewTip: "Remember that `--entrypoint` only accepts a single binary (not arguments). Any arguments to that new entrypoint must follow the image name.",
    tags: ["entrypoint", "cmd", "override", "debugging", "cli"],
    practice: [
      "How do you completely clear/disable an entrypoint using `--entrypoint=\"\"`?",
      "Can you override entrypoint in a `docker-compose.yml` service definition?"
    ]
  }),

  createCard({
    idNum: 35,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "Foreground vs Detached Mode (-d vs -it)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What do the `-d`, `-i`, and `-t` flags do in `docker run`?",
    quickAnswer: "`-d` (detached) runs the container in the background and prints the container ID. `-i` (interactive) keeps `STDIN` open even if unattached. `-t` (tty) allocates a pseudo-TTY terminal connected to the container standard input. Combining `-it` enables full interactive terminal interaction (Ctrl+C, terminal coloring, tab completion).",
    detailedAnswer: "Running in foreground mode (default without `-d`) blocks the active terminal and streams stdout/stderr directly to the console. Running with `-d` immediately yields control back to your shell. Combining `-i` and `-t` (`-it`) is required for interactive command-line sessions (like bash or python REPLs) because `-t` creates the terminal device driver abstraction while `-i` passes keyboard keypresses through standard input.",
    code: `# 1. Background server in detached mode:
$ docker run -d -p 80:80 --name web nginx:alpine
# Prints container ID and exits immediately to terminal prompt

# 2. Interactive shell session (combining -i and -t):
$ docker run --rm -it ubuntu:22.04 bash
root@9a8b7c6d:/# ls -la  # Fully interactive shell with color & tab-completion!

# 3. Piping data into container via STDIN (-i without -t):
$ cat database_dump.sql | docker exec -i postgres-db psql -U postgres mydb`,
    recallHint: "-d = detached background. -i = keep STDIN open. -t = allocate pseudo-TTY terminal. -it = interactive.",
    interviewTip: "Never use `-t` when piping data into a container (e.g. `cat dump.sql | docker exec -i db psql`). Using `-t` injects raw terminal escape characters and carriage returns into the data stream, corrupting SQL/binary imports.",
    tags: ["flags", "detached", "interactive", "tty", "stdin"],
    practice: [
      "Why does omitting `-i` cause an interactive shell like bash to exit immediately?",
      "How do you attach your terminal back to a container running in `-d` detached mode?"
    ]
  }),

  createCard({
    idNum: 36,
    category: "Container Lifecycle, Process Management & Signals",
    concept: "Container Exit Codes Interpretation (0, 1, 137, 139, 143)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you interpret common Docker container exit codes, specifically 0, 1, 127, 137, 139, and 143?",
    quickAnswer: "Standard Unix exit codes map to 1-125 for application errors. Exit codes above 128 signify termination by a Unix signal: **`Exit Code = 128 + Signal Number`**. \n- **0**: Success\n- **1**: General application crash\n- **127**: Command not found\n- **137**: $128 + 9$ (`SIGKILL` - typically OOMKilled or `docker kill`)\n- **139**: $128 + 11$ (`SIGSEGV` - Segmentation Fault)\n- **143**: $128 + 15$ (`SIGTERM` - Graceful shutdown completed).",
    detailedAnswer: "Exit codes are the primary telemetry for diagnosing container failures. When an application exits, the kernel captures its exit code. If the Linux Out-Of-Memory (OOM) killer terminates a container, the kernel issues `SIGKILL` (signal 9), yielding exit code $128 + 9 = 137$. Similarly, `SIGSEGV` (signal 11) yields 139, indicating invalid memory access in C/C++ or compiled binaries.",
    code: `# Inspect the exit code and OOMKilled status of a stopped container:
$ docker inspect -f 'ExitCode: {{.State.ExitCode}}, OOMKilled: {{.State.OOMKilled}}' my-app

# Common Scenarios:
# 1. ExitCode 137 + OOMKilled: true
# -> Container exceeded memory limit (--memory) and was destroyed by kernel OOM killer!

# 2. ExitCode 137 + OOMKilled: false
# -> Container was forcefully terminated via 'docker kill' or 'docker stop' timeout!

# 3. ExitCode 127
# -> Binary or script in CMD/ENTRYPOINT does not exist in the image (e.g. bash in Alpine)!

# 4. ExitCode 143
# -> Application caught SIGTERM and exited gracefully.`,
    recallHint: "Exit code > 128 means terminated by signal (128 + signal). 137 = SIGKILL / OOM. 143 = SIGTERM.",
    interviewTip: "When diagnosing a container with exit code 137, always check `docker inspect -f '{{.State.OOMKilled}}'` to confirm whether it was host memory exhaustion or a manual `docker stop` timeout.",
    tags: ["exit-codes", "137", "oomkilled", "sigkill", "troubleshooting"],
    practice: [
      "Why does a shell script failing with `command not found` exit with code 127?",
      "What is the difference between exit code 137 and exit code 143?"
    ]
  })
];
