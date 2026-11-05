const { makeItem } = require('../builder_helper.cjs');

const category = "4. File System & OS System Calls";

const items = [
  makeItem({
    idNum: 45,
    category,
    concept: "fs/promises vs Synchronous fs vs Callback fs",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What are the three flavours of the Node.js fs module and when should each be used?",
    quickAnswer: "fs/promises (async/await, standard), callback fs (legacy performance edge cases), synchronous fs (bootstrap/CLI startup only).",
    answer: "Node.js provides three APIs in `node:fs`: 1) `node:fs/promises`: modern Promise-based async methods (`await fs.readFile()`), 2) `node:fs` callbacks: classic error-first callbacks (`fs.readFile('path', (err, data) => {})`), and 3) Synchronous `node:fs`: blocking methods (`fs.readFileSync()`).",
    explanation: "Rule of thumb: Default to `fs/promises` for all backend services. NEVER call synchronous methods (`readFileSync`, `writeFileSync`) inside HTTP request handlers because they block the single thread. Synchronous methods are ONLY acceptable during initial process bootstrap (e.g. reading config before server starts) or in CLI build scripts.",
    code: "import fs from 'node:fs/promises';\n\n// Modern standard:\nasync function loadConfig(path) {\n  const raw = await fs.readFile(path, 'utf8');\n  return JSON.parse(raw);\n}\n\n// Only during process startup:\n// import fsSync from 'node:fs';\n// const initialConfig = JSON.parse(fsSync.readFileSync('./config.json', 'utf8'));",
    recallHint: "fs/promises = Standard async; synchronous fs = Startup/CLI only; never call sync fs in request handlers.",
    interviewTip: "Candidate mistake: Using fs.readFileSync in an Express/Fastify route handler. Point out that it blocks all concurrent users.",
    tags: ["fs", "fspromises", "filesystem", "async-await"]
  }),

  makeItem({
    idNum: 46,
    category,
    concept: "File Descriptors & OS Limits (EMFILE / ENFILE)",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is a File Descriptor and what causes EMFILE / ENFILE errors under heavy load?",
    quickAnswer: "A File Descriptor (FD) is an integer index to an open OS resource; EMFILE occurs when the process exceeds its max open file limit (ulimit -n).",
    answer: "A File Descriptor (FD) is a non-negative integer assigned by the operating system kernel to represent an open file, socket, or pipe. Operating systems enforce strict limits on the number of concurrent open FDs: 1) `EMFILE`: Too many open files for this specific process (exceeded `ulimit -n`), and 2) `ENFILE`: System-wide file table is full across all processes.",
    explanation: "Common cause: Opening hundreds of files simultaneously via `Promise.all(files.map(f => fs.open(f)))` without concurrency pooling, or leaking unclosed file handles. Fix: Use concurrency limiters (`p-limit`, `graceful-fs`) and always close handles in `finally` blocks.",
    code: "import fs from 'node:fs/promises';\n\n// Guarding file handle lifecycle:\nasync function safeFileOperation(path) {\n  let handle;\n  try {\n    handle = await fs.open(path, 'r');\n    const data = await handle.readFile();\n    return data;\n  } finally {\n    if (handle) await handle.close(); // GUARANTEES FD is released back to OS!\n  }\n}",
    recallHint: "EMFILE = Process exceeded open file descriptor limit. Always close handles in finally blocks.",
    interviewTip: "Mention that network sockets also consume file descriptors; high socket traffic + unclosed files triggers EMFILE rapidly.",
    tags: ["file-descriptors", "emfile", "enfile", "ulimit", "resource-limits"]
  }),

  makeItem({
    idNum: 47,
    category,
    concept: "Atomic File Writes via Temp Files & Rename",
    priority: "important",
    difficulty: "Intermediate",
    question: "How do you guarantee an atomic file write in Node.js to prevent corrupt state if the server crashes mid-write?",
    quickAnswer: "Write complete content to a unique temporary file, then use fs.rename() to atomically replace the destination file.",
    answer: "Directly calling `fs.writeFile('data.json', content)` is NOT atomic. If the server loses power, crashes, or runs out of disk space halfway through writing, the target file is left truncated or corrupted with 0 bytes or half-written JSON.",
    explanation: "The battle-tested production solution is the Write-Rename pattern: 1) Write the data to a temporary file in the same filesystem directory (e.g., `data.json.tmp.12345`), 2) Optionally call `fs.fsync()` to flush OS disk cache, and 3) Call `fs.rename()`. On POSIX systems, `rename()` is guaranteed to be an atomic filesystem system call: readers either see the old version or the full new version, never corrupted bytes.",
    code: "import fs from 'node:fs/promises';\nimport path from 'node:path';\nimport { randomUUID } from 'node:crypto';\n\nexport async function atomicWriteFile(targetPath, data) {\n  const dir = path.dirname(targetPath);\n  const tempPath = path.join(dir, `.${path.basename(targetPath)}.${randomUUID()}.tmp`);\n\n  // 1. Write to temp file\n  await fs.writeFile(tempPath, data);\n\n  // 2. Atomically rename temp file over target file\n  await fs.rename(tempPath, targetPath);\n}",
    recallHint: "Write to temp file -> fs.rename() = Atomic file replacement with zero corruption risk.",
    interviewTip: "Call out that the temp file MUST reside on the same filesystem/partition for rename() to be atomic.",
    tags: ["atomic-write", "filesystem", "rename", "reliability"]
  }),

  makeItem({
    idNum: 48,
    category,
    concept: "File Watching: fs.watch vs fs.watchFile vs Chokidar",
    priority: "important",
    difficulty: "Intermediate",
    question: "What is the difference between fs.watch() and fs.watchFile(), and why do production tools use Chokidar?",
    quickAnswer: "fs.watch uses OS notifications (fast, but erratic events); fs.watchFile uses polling (slow, high CPU); Chokidar normalizes both.",
    answer: "1) `fs.watch`: Leverages native operating system event notifications (`inotify` on Linux, `FSEvents` on macOS, `ReadDirectoryChangesW` on Windows). It is lightweight and fast, but its event delivery is erratic, often firing duplicate 'change' events or failing on recursive directory creation. 2) `fs.watchFile`: Polls the file system at regular intervals (default 5007ms) using `fs.stat()`. It is reliable across all filesystems (including network shares like NFS), but consumes high CPU and has high latency. 3) `chokidar`: The industry standard npm wrapper that uses `fs.watch` by default, deduplicates events, and falls back to polling when needed.",
    explanation: "Modern Node.js (v19+) improved `fs.watch` with native recursive support on Linux and macOS, but Chokidar remains standard for complex dev tooling.",
    code: "import fs from 'node:fs';\n\n// Native recursive watch in modern Node.js:\nconst watcher = fs.watch('./src', { recursive: true }, (eventType, filename) => {\n  console.log(`Event: ${eventType} on file: ${filename}`);\n});\n\n// Stop watching:\n// watcher.close();",
    recallHint: "fs.watch = OS events (fast, duplicate events); fs.watchFile = stat polling (slow, CPU heavy).",
    interviewTip: "Explain why build tools (Vite, Webpack) rely on OS-level file watchers for instant Hot Module Replacement (HMR).",
    tags: ["fs-watch", "watchfile", "chokidar", "fsevents", "inotify"]
  }),

  makeItem({
    idNum: 49,
    category,
    concept: "Directory Reading with withFileTypes: true",
    priority: "important",
    difficulty: "Intermediate",
    question: "Why should you always pass { withFileTypes: true } to fs.readdir() when scanning directories?",
    quickAnswer: "It returns Dirent objects containing file type info, eliminating thousands of expensive fs.stat() system call round-trips.",
    answer: "Calling `await fs.readdir(dir)` returns an array of string filenames. If your code needs to determine whether each entry is a file, folder, or symlink, it must make a separate `fs.stat()` call for every single item—causing N+1 expensive filesystem system calls.",
    explanation: "Passing `{ withFileTypes: true }` returns an array of `fs.Dirent` objects. The OS directory scanning system call already retrieves file type metadata in the directory entry itself, meaning `dirent.isDirectory()` and `dirent.isFile()` are instant in-memory operations with zero additional system calls.",
    code: "import fs from 'node:fs/promises';\n\n// FAST: Single system call retrieves names and types\nasync function scanDirectory(dir) {\n  const entries = await fs.readdir(dir, { withFileTypes: true });\n  \n  for (const entry of entries) {\n    if (entry.isDirectory()) {\n      console.log(`Directory: ${entry.name}`);\n    } else if (entry.isFile()) {\n      console.log(`File: ${entry.name}`);\n    }\n  }\n}",
    recallHint: "{ withFileTypes: true } gives Dirent objects; eliminates N+1 expensive fs.stat() system calls.",
    interviewTip: "Mentioning Dirent and eliminating N+1 stat calls demonstrates optimization instincts for disk-heavy tasks.",
    tags: ["readdir", "dirent", "performance", "system-calls"]
  }),

  makeItem({
    idNum: 50,
    category,
    concept: "Path Traversal Attacks & Canonicalization",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How do Path Traversal attacks occur in Node.js and how do you protect against them using path.resolve()?",
    quickAnswer: "Attackers supply '../' in user inputs to access restricted files (/etc/passwd); protect by resolving paths and verifying base directory prefixes.",
    answer: "A Path Traversal (Directory Traversal) vulnerability occurs when an application accepts user input (e.g. query param `?file=../../../../etc/passwd`) and passes it directly to `fs.readFile()` without sanitization. The attacker navigates out of the intended public directory to read sensitive OS credentials or private keys.",
    explanation: "Mitigation: 1) Resolve the absolute canonical path using `path.resolve()`, 2) Verify that the resolved target path strictly starts with the authorized root directory prefix plus a path separator, and 3) Optionally reject any input containing null bytes or `..` sequences.",
    code: "import path from 'node:path';\nimport fs from 'node:fs/promises';\n\nconst PUBLIC_ROOT = path.resolve('/var/www/uploads');\n\nexport async function serveUserFile(userInputFilename) {\n  // 1. Resolve absolute path\n  const safePath = path.resolve(PUBLIC_ROOT, userInputFilename);\n\n  // 2. Strict base directory boundary check\n  if (!safePath.startsWith(PUBLIC_ROOT + path.sep)) {\n    throw new Error('Access Denied: Path Traversal attempt detected!');\n  }\n\n  return await fs.readFile(safePath);\n}",
    recallHint: "path.resolve() + safePath.startsWith(PUBLIC_ROOT + path.sep) = Foolproof Path Traversal defense.",
    interviewTip: "Always emphasize the path.sep boundary check; otherwise '/var/www/uploads-secret' could match a prefix of '/var/www/uploads'.",
    tags: ["security", "path-traversal", "path-resolve", "vulnerability"]
  }),

  makeItem({
    idNum: 51,
    category,
    concept: "File Permissions & POSIX Mode Masks (chmod & umask)",
    priority: "important",
    difficulty: "Advanced",
    question: "How do file permissions work in Node.js, and what role does process.umask() play?",
    quickAnswer: "Node specifies POSIX permissions via octal modes (e.g. 0o600 for owner read/write); umask strips permissions from new files automatically.",
    answer: "On POSIX systems (Linux/macOS), file access is governed by read, write, and execute permissions for user, group, and others. In Node.js, permissions are represented as octal numbers: `0o600` (read/write by owner only), `0o644` (read/write owner, read others), `0o755` (executable script).",
    explanation: "When creating a file with `fs.writeFile('key.pem', data, { mode: 0o600 })`, the actual applied permissions equal `mode & ~process.umask()`. The `umask` (user file creation mask) is an OS setting that automatically masks out specific permission bits for newly created files.",
    code: "import fs from 'node:fs/promises';\n\n// Creating a private SSL certificate file with strict permissions:\nawait fs.writeFile('private.key', 'SECRET_KEY_DATA', {\n  mode: 0o600 // Owner Read/Write only; Group and Others have NO access\n});",
    recallHint: "Use octal notation 0o600 for private credentials; OS umask modifies effective permissions.",
    interviewTip: "Crucial for security-critical backend services writing sensitive private keys or database credential files.",
    tags: ["permissions", "chmod", "umask", "posix", "security"]
  }),

  makeItem({
    idNum: 52,
    category,
    concept: "Symlinks vs Hardlinks in Node.js",
    priority: "good-to-know",
    difficulty: "Intermediate",
    question: "What is the difference between a Symlink and a Hardlink in the Node.js fs module?",
    quickAnswer: "A Hardlink points directly to the underlying inode on disk; a Symlink is a pointer file referencing another path.",
    answer: "1) Hardlink (`fs.link`): Creates a new directory entry pointing directly to the exact same filesystem inode. Deleting the original file does not delete the data; data is only freed when all hard links to that inode are deleted. Hard links cannot span across different file partitions. 2) Symbolic Link (`fs.symlink`): Creates a special file that contains a path string referencing another target file or directory. If the target file is deleted or moved, the symlink becomes 'broken' (dangling pointer). Symlinks can cross partition boundaries.",
    explanation: "In Node.js: `fs.stat()` follows symlinks and inspects the target file; `fs.lstat()` inspects the symbolic link file itself without following it.",
    code: "import fs from 'node:fs/promises';\n\n// Create symlink:\nawait fs.symlink('/var/logs/app.log', './current-log.log');\n\n// lstat inspects the link itself:\nconst linkInfo = await fs.lstat('./current-log.log');\nconsole.log(linkInfo.isSymbolicLink()); // true\n\n// stat inspects the target file:\nconst targetInfo = await fs.stat('./current-log.log');\nconsole.log(targetInfo.isFile()); // true",
    recallHint: "Hardlink = Direct pointer to inode; Symlink = Path pointer file. Use fs.lstat() to avoid following symlinks.",
    interviewTip: "Remember that npm and pnpm heavily use symlinks and hardlinks in node_modules to deduplicate dependencies.",
    tags: ["symlinks", "hardlinks", "lstat", "filesystem"]
  }),

  makeItem({
    idNum: 53,
    category,
    concept: "Streaming Large Files with HTTP Range Headers",
    priority: "important",
    difficulty: "Intermediate",
    question: "How do you implement HTTP 206 Partial Content video streaming using createReadStream start and end options?",
    quickAnswer: "Parse the Range header (bytes=start-end), calculate chunk boundaries, and pass { start, end } to createReadStream with HTTP 206.",
    answer: "For media streaming (video/audio playback), clients send an HTTP `Range: bytes=1000-5000` header to request specific byte ranges instead of downloading the whole file. In Node.js: 1) Parse the range header, 2) Calculate `start` and `end` byte offsets, 3) Set HTTP status `206 Partial Content`, 4) Send `Content-Range: bytes start-end/totalSize` and `Content-Length`, and 5) Create a stream with `fs.createReadStream(path, { start, end })` piped directly to the response.",
    explanation: "This enables seeking, pause/resume, and instant video playback in modern web browsers.",
    code: "import { createReadStream } from 'node:fs';\nimport fs from 'node:fs/promises';\n\nexport async function streamVideoChunk(req, res, videoPath) {\n  const stat = await fs.stat(videoPath);\n  const range = req.headers.range || 'bytes=0-';\n  const parts = range.replace(/bytes=/, '').split('-');\n  const start = parseInt(parts[0], 10);\n  const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;\n\n  res.writeHead(206, {\n    'Content-Range': `bytes ${start}-${end}/${stat.size}`,\n    'Accept-Ranges': 'bytes',\n    'Content-Length': (end - start) + 1,\n    'Content-Type': 'video/mp4'\n  });\n\n  createReadStream(videoPath, { start, end }).pipe(res);\n}",
    recallHint: "Parse Range header -> Return HTTP 206 -> createReadStream(path, { start, end }).pipe(res).",
    interviewTip: "Crucial for video delivery, large file resumable downloads, and CDN edge optimization.",
    tags: ["http-range", "video-streaming", "partial-content", "streams"]
  }),

  makeItem({
    idNum: 54,
    category,
    concept: "Temporary Files & Isolated Directories (fs.mkdtemp)",
    priority: "important",
    difficulty: "Intermediate",
    question: "How does fs.mkdtemp() prevent race conditions and collisions when generating temporary files?",
    quickAnswer: "It creates a guaranteed unique, cryptographically randomized temporary directory in the OS temp folder.",
    answer: "Creating temporary files with predictable names (e.g. `/tmp/upload.jpg`) creates dangerous security race conditions (Symlink vulnerability attacks) and causes file collisions if multiple worker processes run concurrently. `fs.mkdtemp(prefix)` generates a guaranteed unique directory using random cryptographic suffixes.",
    explanation: "All processing work can be performed safely inside this isolated temporary directory and deleted entirely upon completion.",
    code: "import fs from 'node:fs/promises';\nimport os from 'node:os';\nimport path from 'node:path';\n\nasync function performIsolatedWork(workFn) {\n  // Generates unique folder: /tmp/my-job-a3F9xZ\n  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'my-job-'));\n  try {\n    return await workFn(tempDir);\n  } finally {\n    // Recursively clean up temp directory on finish\n    await fs.rm(tempDir, { recursive: true, force: true });\n  }\n}",
    recallHint: "fs.mkdtemp() creates unique random temp folder; clean up with fs.rm(dir, { recursive: true }).",
    interviewTip: "Highlight the security aspect: predictable temp filenames allow local privilege escalation attacks on multi-tenant servers.",
    tags: ["mkdtemp", "temp-files", "security", "cleanup"]
  }),

  makeItem({
    idNum: 55,
    category,
    concept: "fs.constants Access Flags & Bitmasks",
    priority: "good-to-know",
    difficulty: "Advanced",
    question: "What are fs.constants access flags (F_OK, R_OK, W_OK, X_OK) and why is checking access before open an anti-pattern?",
    quickAnswer: "They test file existence/permissions; checking access before opening creates a TOCTOU (Time-of-Check to Time-of-Use) race condition.",
    answer: "`fs.constants` provides bitmasks for checking file accessibility with `fs.access()`: `F_OK` (file exists), `R_OK` (readable), `W_OK` (writable), and `X_OK` (executable).",
    explanation: "Anti-pattern: Calling `await fs.access('file.txt')` immediately followed by `await fs.readFile('file.txt')`. This is a classic TOCTOU (Time-Of-Check to Time-Of-Use) security vulnerability: another process could delete or swap the file between the check and the read. Correct approach: Attempt to open or read the file directly, and handle errors (`ENOENT`, `EACCES`) in the `catch` block.",
    code: "// ANTI-PATTERN (TOCTOU Race Condition):\n// if (await fs.access('file.txt', fs.constants.R_OK)) {\n//   const data = await fs.readFile('file.txt'); // Could be deleted between these two lines!\n// }\n\n// CORRECT (Direct attempt with error handling):\ntry {\n  const data = await fs.readFile('file.txt');\n} catch (err) {\n  if (err.code === 'ENOENT') console.log('File does not exist');\n}",
    recallHint: "Never check fs.access before fs.readFile; handle errors directly to prevent TOCTOU race conditions.",
    interviewTip: "Identifying TOCTOU vulnerabilities is a major differentiator in senior engineering and security interviews.",
    tags: ["toctou", "fs-constants", "access", "race-condition", "security"]
  }),

  makeItem({
    idNum: 56,
    category,
    concept: "Flushing OS Disk Buffers (fs.fsync)",
    priority: "important",
    difficulty: "Advanced",
    question: "Why is fs.writeFile() not guaranteed to be physically written to disk until fs.fsync() is called?",
    quickAnswer: "Operating systems buffer disk writes in RAM cache; fsync forces the OS to physically write dirty pages to persistent storage.",
    answer: "When `fs.writeFile()` succeeds, the bytes have been transferred to the operating system's internal page cache in RAM, not necessarily written to the physical SSD or HDD platters. If a hardware power outage occurs seconds later, that written data is permanently lost.",
    explanation: "For mission-critical data integrity (e.g. database commit logs or financial transactions), call `handle.sync()` or `fs.fsync(fd)` after writing. This issues the `fsync()` system call, which forces the operating system kernel and storage controller to flush dirty cache pages directly to physical storage before returning.",
    code: "import fs from 'node:fs/promises';\n\nasync function writeMissionCriticalLog(filePath, data) {\n  const handle = await fs.open(filePath, 'a');\n  try {\n    await handle.write(data);\n    // Force physical flush to disk:\n    await handle.sync();\n  } finally {\n    await handle.close();\n  }\n}",
    recallHint: "fsync() flushes OS RAM page cache to physical disk platters/SSD; essential for ACID database logs.",
    interviewTip: "Connect fsync to database write-ahead logs (WAL) in PostgreSQL and SQLite to demonstrate full-stack systems acumen.",
    tags: ["fsync", "disk-cache", "data-integrity", "durability"]
  })
];

module.exports = items;
