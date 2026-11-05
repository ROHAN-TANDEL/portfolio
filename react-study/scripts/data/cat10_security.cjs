const { makeItem } = require('../builder_helper.cjs');

const category = "10. Security & Hardening";

const items = [
  makeItem({
    idNum: 119,
    category,
    concept: "Prototype Pollution Vulnerabilities & Deep Cloning",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is Prototype Pollution, how does it occur, and how do you defend against it in Node.js?",
    quickAnswer: "Attackers inject '__proto__' into recursive object merges, mutating Object.prototype and poisoning all objects in the runtime.",
    answer: "Prototype Pollution is a severe JavaScript vulnerability where an attacker manipulates object prototype inheritance. When an application recursively merges or deep-clones untrusted JSON inputs into an existing object without key validation, keys like `__proto__`, `constructor`, or `prototype` can overwrite properties on the global `Object.prototype`.",
    explanation: "Because all objects inherit from `Object.prototype`, properties injected by the attacker (e.g. `isAdmin: true` or `shell: '/bin/sh'`) become present on EVERY object in the entire application, leading to authentication bypasses or Remote Code Execution (RCE).",
    code: "// VULNERABLE RECURSIVE MERGE:\nfunction unsafeMerge(target, source) {\n  for (const key in source) {\n    if (typeof source[key] === 'object') {\n      if (!target[key]) target[key] = {};\n      unsafeMerge(target[key], source[key]);\n    } else {\n      target[key] = source[key];\n    }\n  }\n}\n// Attack Payload: JSON.parse('{\"__proto__\": {\"isAdmin\": true}}')\n// Result: ({}).isAdmin is now true globally!\n\n// DEFENSE PATTERNS:\n// 1. Validate keys: reject '__proto__', 'constructor', 'prototype'\n// 2. Use Object.create(null) for dictionary maps (no prototype to pollute!)\n// 3. Freeze the prototype at startup: Object.freeze(Object.prototype);",
    recallHint: "Recursive merge with __proto__ mutates Object.prototype. Defend via key rejection or Object.create(null).",
    interviewTip: "Candidate check: Always mention Object.freeze(Object.prototype) or Object.create(null) as defense-in-depth strategies.",
    tags: ["prototype-pollution", "security", "vulnerability", "object-create-null"]
  }),

  makeItem({
    idNum: 120,
    category,
    concept: "Regular Expression Denial of Service (ReDoS)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What causes Regular Expression Denial of Service (ReDoS) and how do you prevent catastrophic backtracking?",
    quickAnswer: "Nested quantifiers (e.g. (a+)+$) cause exponential backtracking in V8's regex engine, freezing the event loop for minutes.",
    answer: "V8 uses a Non-deterministic Finite Automaton (NFA) regex engine with backtracking. When a regular expression contains overlapping nested quantifiers (e.g. `/^([a-zA-Z0-9]+)*$/` or `/([a-z]+)+$/`), an input string of repeated characters followed by a mismatched trailing character (e.g. `aaaaaaaaaaaaaaaaaaaaaaaaaaaa!`) forces the engine to test every possible combination of splits before failing.",
    explanation: "This results in O(2^N) exponential time complexity. A 30-character payload can freeze the single-threaded Node event loop at 100% CPU for hours. Mitigations: 1) Avoid nested quantifiers, 2) Use non-backtracking regex engines (`re2`), 3) Run regex checks with strict length limits on user input.",
    code: "// VULNERABLE TO REDOS (Exponential Backtracking):\nconst vulnerableEmailRegex = /^([a-zA-Z0-9_.-]+)+@([a-zA-Z0-9_.-]+)+$/;\n\n// Attacker payload freezes Node completely:\n// vulnerableEmailRegex.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!');\n\n// SECURE: Linear-time regex without nested quantifiers or use validator.js:\nimport validator from 'validator';\nconsole.log(validator.isEmail('user@test.com'));",
    recallHint: "Nested quantifiers cause exponential backtracking; freezes single thread. Use linear regex or re2.",
    interviewTip: "Explain why catastrophic backtracking is uniquely dangerous to Node.js compared to multi-threaded runtimes: 1 request freezes the entire server.",
    tags: ["redos", "regex", "dos", "security", "catastrophic-backtracking"]
  }),

  makeItem({
    idNum: 121,
    category,
    concept: "Constant-Time Comparison with crypto.timingSafeEqual",
    priority: "must-know",
    difficulty: "Advanced",
    question: "Why does standard string comparison (===) leak secrets through timing attacks, and how does crypto.timingSafeEqual prevent it?",
    quickAnswer: "=== returns false at the first mismatched character; timingSafeEqual takes constant time regardless of where mismatches occur.",
    answer: "Standard JavaScript equality operators (`===` or `!==`) use short-circuit evaluation: they compare strings byte-by-byte from left to right and return `false` the exact millisecond the first mismatched character is detected. An attacker measuring sub-microsecond response latencies over thousands of requests can guess a secret HMAC signature or API key character by character (Timing Attack).",
    explanation: "`crypto.timingSafeEqual(bufA, bufB)` executes in constant time: it checks every single byte regardless of mismatches, ensuring identical CPU execution time and eliminating timing leaks.",
    code: "import crypto from 'node:crypto';\n\nexport function verifySignature(userSignature, expectedSignature) {\n  const bufA = Buffer.from(userSignature, 'utf8');\n  const bufB = Buffer.from(expectedSignature, 'utf8');\n\n  // Length check must also not leak timing:\n  if (bufA.length !== bufB.length) return false;\n\n  // Constant-time execution prevents microsecond side-channel leaks:\n  return crypto.timingSafeEqual(bufA, bufB);\n}",
    recallHint: "=== short-circuits on mismatch (timing attack leak); crypto.timingSafeEqual runs in constant time.",
    interviewTip: "Essential when verifying webhook signatures (Stripe, GitHub), HMAC tokens, and password reset hashes.",
    tags: ["timing-attack", "crypto", "timingsafeequal", "security", "hmac"]
  }),

  makeItem({
    idNum: 122,
    category,
    concept: "Password Hashing: crypto.scrypt & PBKDF2 vs bcrypt",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "Why should you never use SHA-256 for passwords, and how does node:crypto scrypt protect against GPU attacks?",
    quickAnswer: "SHA-256 is designed to be fast; password hashing must be intentionally slow and memory-hard (scrypt, argon2, bcrypt) to thwart GPU cracking.",
    answer: "Cryptographic hash functions like MD5, SHA-1, and SHA-256 are engineered for high throughput. Modern consumer GPUs can compute billions of SHA-256 hashes per second, making brute-force dictionary attacks trivial. Password hashing algorithms MUST be slow and computationally expensive.",
    explanation: "Node.js provides `node:crypto.scrypt` natively. Scrypt is a memory-hard key derivation function specifically designed to resist hardware brute-force attacks (ASICs and GPUs) by requiring significant RAM to calculate each hash.",
    code: "import crypto from 'node:crypto';\nimport { promisify } from 'node:util';\n\nconst scryptAsync = promisify(crypto.scrypt);\n\nexport async function hashPassword(password) {\n  const salt = crypto.randomBytes(16).toString('hex');\n  // 64-byte key with high memory cost:\n  const derivedKey = await scryptAsync(password, salt, 64);\n  return `${salt}:${derivedKey.toString('hex')}`;\n}",
    recallHint: "Never use fast hashes (SHA256) for passwords; use memory-hard slow algorithms: scrypt, argon2, or bcrypt.",
    interviewTip: "Highlight that scrypt is available natively in node:crypto without needing external native C++ npm dependencies like bcrypt.",
    tags: ["passwords", "hashing", "scrypt", "pbkdf2", "security", "crypto"]
  }),

  makeItem({
    idNum: 123,
    category,
    concept: "Code Injection via eval(), Function() & vm Module",
    priority: "must-know",
    difficulty: "Foundational",
    question: "Why is eval() catastrophic and why is the Node.js vm module explicitly NOT a security sandbox?",
    quickAnswer: "eval executes arbitrary strings with full process permissions; the vm module can be escaped via prototype constructors.",
    answer: "Using `eval()`, `new Function()`, or `setTimeout('string')` on user-supplied input executes arbitrary JavaScript with full process permissions, allowing attackers to access `process.env`, read private SSH keys, and spawn reverse shells. A common misconception is that the `node:vm` module (`vm.runInContext`) provides a secure sandbox.",
    explanation: "The official Node.js documentation explicitly states: 'The node:vm module is not a security mechanism. Do not use it to run untrusted code.' Attackers can easily escape the VM context by walking up the `constructor.constructor` prototype chain to access the host's `Function` and `process` objects.",
    code: "// VM ESCAPE EXPLOIT EXAMPLE:\nimport vm from 'node:vm';\n\n// Attacker payload escapes vm context and executes process commands on host:\nconst maliciousCode = `\n  this.constructor.constructor('return process')().mainModule.require('child_process').execSync('whoami');\n`;\n\n// vm.runInNewContext(maliciousCode); // DANGEROUS: Escapes sandbox and runs shell command!",
    recallHint: "eval() allows Remote Code Execution; node:vm is NOT a security sandbox and can be escaped.",
    interviewTip: "If asked how to safely run untrusted user code in Node.js, recommend isolated OS processes or WebAssembly (Wasm) micro-VMs.",
    tags: ["eval", "vm", "sandbox-escape", "remote-code-execution", "security"]
  }),

  makeItem({
    idNum: 124,
    category,
    concept: "HTTP Security Headers & Helmet Principles",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What essential HTTP security headers should every Node.js web service set (Helmet)?",
    quickAnswer: "Content-Security-Policy, HSTS, X-Content-Type-Options, X-Frame-Options, and removing X-Powered-By.",
    answer: "The `helmet` package automates setting crucial HTTP response headers that protect browsers against web vulnerabilities: 1) `Content-Security-Policy` (CSP): Restricts origins from which scripts, styles, and images can be loaded (neutralizes XSS). 2) `Strict-Transport-Security` (HSTS): Enforces HTTPS connections and prevents SSL stripping. 3) `X-Content-Type-Options: nosniff`: Prevents browsers from MIME-type sniffing executable files. 4) `X-Frame-Options: DENY`: Prevents Clickjacking by disallowing the page inside iframes. 5) Removing `X-Powered-By: Express`: Obscures server technology stack from automated vulnerability scanners.",
    explanation: "In Node.js: `app.use(helmet())` enables all these protections by default.",
    code: "// Native implementation of Helmet headers:\nfunction applySecurityHeaders(res) {\n  res.removeHeader('X-Powered-By');\n  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');\n  res.setHeader('X-Content-Type-Options', 'nosniff');\n  res.setHeader('X-Frame-Options', 'DENY');\n  res.setHeader('Content-Security-Policy', \"default-src 'self'\");\n}",
    recallHint: "CSP (anti-XSS), HSTS (force HTTPS), nosniff (MIME check), X-Frame-Options (anti-clickjacking), remove X-Powered-By.",
    interviewTip: "Mention that hiding X-Powered-By is security-by-obscurity, but still useful to filter automated mass-scanning bots.",
    tags: ["helmet", "http-headers", "csp", "hsts", "security", "clickjacking"]
  }),

  makeItem({
    idNum: 125,
    category,
    concept: "Rate Limiting Strategies (Token Bucket & Redis Sliding Window)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How do you implement distributed rate limiting in Node.js to protect endpoints from brute-force attacks?",
    quickAnswer: "Use a Redis Sliding Window counter or Token Bucket algorithm keyed by client IP or user ID.",
    answer: "Without rate limiting, public endpoints (login, password reset, checkout, OTP) are vulnerable to brute-force attacks, credential stuffing, and DoS outages. In-memory rate limiters fail across horizontal multi-pod deployments because memory is not shared.",
    explanation: "Production pattern: Use a distributed rate limiter backed by Redis. Algorithms: 1) Fixed Window: Resets every minute (vulnerable to traffic spikes at window boundaries). 2) Sliding Window Log / Counter: Uses Redis Sorted Sets (`ZADD`, `ZREMRANGEBYSCORE`) to track request timestamps, ensuring smooth, precise rate limiting over a sliding 60-second window across all Node pods.",
    code: "// Redis Sliding Window Rate Limiter concept:\nasync function checkRateLimit(redis, clientIp, limit = 100, windowSeconds = 60) {\n  const now = Date.now();\n  const windowStart = now - (windowSeconds * 1000);\n  const key = `rate:${clientIp}`;\n\n  const tx = redis.multi();\n  tx.zremrangebyscore(key, 0, windowStart); // Evict requests outside window\n  tx.zadd(key, now, now);                   // Record current request\n  tx.zcard(key);                            // Count requests in window\n  tx.expire(key, windowSeconds);\n  const [, , count] = await tx.exec();\n\n  return count <= limit; // True if allowed, False if exceeded (HTTP 429)\n}",
    recallHint: "Use Redis Sliding Window Rate Limiting keyed by IP; returns HTTP 429 Too Many Requests when exceeded.",
    interviewTip: "Candidate check: Always return standard headers: Retry-After, X-RateLimit-Limit, and X-RateLimit-Remaining.",
    tags: ["rate-limiting", "redis", "sliding-window", "dos", "security"]
  }),

  makeItem({
    idNum: 126,
    category,
    concept: "Node.js Native Permission Model (--permission)",
    priority: "important",
    difficulty: "Advanced",
    question: "What is Node.js's native Permission Model (--permission) and how does it restrict filesystem and child process access?",
    quickAnswer: "Node 20+ introduced an experimental permission model that restricts file read/write, child processes, and worker threads at runtime.",
    answer: "Node.js 20+ introduced an experimental native Permission Model enabled via the `--permission` flag. Inspired by Deno, it allows developers to restrict what system resources the Node process is allowed to access at runtime, even if malicious dependencies (npm packages) attempt to perform unauthorized actions.",
    explanation: "Flags: 1) `--allow-fs-read=/var/data`: Restricts filesystem read access to specific directories. 2) `--allow-fs-write=/tmp`: Restricts filesystem writes. 3) `--allow-child-process`: Restricts spawning child processes. If code violates these permissions, Node throws an `ERR_ACCESS_DENIED` exception.",
    code: "# Launching Node with locked-down security sandbox:\n# node --permission --allow-fs-read=\"/app/*\" --allow-fs-write=\"/tmp/*\" server.js\n\n# Any attempt by compromised npm dependencies to read /etc/passwd or spawn bash fails instantly!",
    recallHint: "node --permission restricts filesystem, child processes, and worker threads at the runtime level.",
    interviewTip: "Showcasing familiarity with Node's Permission Model demonstrates you stay abreast of latest Node 20-22 security features.",
    tags: ["permission-model", "node20", "sandbox", "security", "supply-chain"]
  }),

  makeItem({
    idNum: 127,
    category,
    concept: "Secure Cookie Management (HttpOnly, Secure, SameSite)",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What flags must be set on session/JWT cookies in Node.js to prevent XSS and CSRF attacks?",
    quickAnswer: "HttpOnly prevents XSS theft via document.cookie; Secure enforces HTTPS; SameSite=Strict/Lax blocks CSRF attacks.",
    answer: "When setting session or authentication cookies in Node.js (`res.setHeader('Set-Cookie', ...)`), three flags are mandatory: 1) `HttpOnly`: Prevents client-side JavaScript (`document.cookie`) from accessing the cookie, completely neutralizing cookie theft via Cross-Site Scripting (XSS). 2) `Secure`: Ensures the browser transmits the cookie over encrypted HTTPS connections only, preventing man-in-the-middle packet sniffing. 3) `SameSite=Strict` (or `Lax`): Instructs browsers not to send the cookie on cross-site requests, mitigating Cross-Site Request Forgery (CSRF).",
    explanation: "Also configure `Path=/` and an appropriate `Max-Age` or `Expires` limit.",
    code: "// Setting secure session cookie in Node.js:\nfunction setAuthCookie(res, token) {\n  res.setHeader('Set-Cookie', [\n    `authToken=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`\n  ]);\n}",
    recallHint: "HttpOnly (anti-XSS) + Secure (HTTPS only) + SameSite=Strict (anti-CSRF) = Secure Cookie Standard.",
    interviewTip: "Candidate mistake: Storing JWT tokens in browser localStorage. Always advocate for HttpOnly cookies for session storage.",
    tags: ["cookies", "httponly", "samesite", "xss", "csrf", "security"]
  }),

  makeItem({
    idNum: 128,
    category,
    concept: "Supply Chain Attacks & npm Security Defenses",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How do npm supply chain attacks occur and what defenses (lockfiles, ignore-scripts, audit) should CI/CD pipelines enforce?",
    quickAnswer: "Attackers compromise popular packages to execute postinstall malware; protect via package-lock.json, npm audit, and --ignore-scripts.",
    answer: "A supply chain attack occurs when a compromised dependency (via account hijacking, typosquatting, or malicious pull requests) injects malware that runs during `npm install` via lifecycle scripts (`postinstall`), exfiltrating `.env` secrets or SSH keys to an external server.",
    explanation: "CI/CD Hardening Best Practices: 1) Use `npm ci` (clean install) which strictly verifies `package-lock.json` integrity hashes and fails if dependencies mismatch. 2) Run with `--ignore-scripts` in build containers to prevent arbitrary shell commands during install. 3) Automate `npm audit` and Snyk checks in CI pipelines. 4) Use scoped internal registries or npm token provenance.",
    code: "# Production CI/CD command pattern:\n# npm ci --ignore-scripts --audit\n\n# Running audit fix:\n# npm audit --audit-level=high",
    recallHint: "npm ci enforces lockfile hashes; --ignore-scripts blocks postinstall malware; npm audit checks CVEs.",
    interviewTip: "Explain why npm ci should ALWAYS be used in Docker builds and CI runners instead of npm install.",
    tags: ["supply-chain", "npm-audit", "npm-ci", "lockfile", "postinstall"]
  }),

  makeItem({
    idNum: 129,
    category,
    concept: "Asymmetric Cryptography: RSA, ECDSA & Ed25519 in node:crypto",
    priority: "important",
    difficulty: "Advanced",
    question: "How do you sign and verify cryptographic data using asymmetric key pairs in node:crypto?",
    quickAnswer: "Sign with private key using crypto.createSign or crypto.sign; verify with public key using crypto.verify.",
    answer: "Asymmetric cryptography uses key pairs: a Private Key for signing or decrypting, and a Public Key for verification or encrypting. In Node.js: 1) `crypto.generateKeyPairSync()` creates RSA, ECDSA, or Ed25519 keys, 2) The sender creates a signature with `crypto.sign(algorithm, data, privateKey)`, 3) The recipient verifies the signature with `crypto.verify(algorithm, data, publicKey, signature)`.",
    explanation: "Ed25519 (Edwards-curve Digital Signature Algorithm) is the modern standard: it provides superior security and faster verification with much smaller key sizes (32 bytes) than legacy RSA.",
    code: "import crypto from 'node:crypto';\n\n// 1. Generate Ed25519 key pair\nconst { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');\nconst data = Buffer.from('Financial transaction: transfer $500');\n\n// 2. Sign with Private Key\nconst signature = crypto.sign(null, data, privateKey);\n\n// 3. Verify with Public Key\nconst isValid = crypto.verify(null, data, publicKey, signature);\nconsole.log('Signature verified:', isValid); // true",
    recallHint: "Sign with private key -> Verify with public key. Modern recommendation: Ed25519 over RSA.",
    interviewTip: "Explain that JWTs signed with RS256 or EdDSA follow this exact asymmetric sign/verify workflow.",
    tags: ["asymmetric-crypto", "ed25519", "rsa", "digital-signatures", "crypto"]
  }),

  makeItem({
    idNum: 130,
    category,
    concept: "SSRF (Server-Side Request Forgery) in Outbound Fetch",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is Server-Side Request Forgery (SSRF) and how do you prevent outbound requests to cloud metadata services?",
    quickAnswer: "SSRF occurs when user input directs the server to request internal IPs (169.254.169.254); prevent via strict IP and domain allowlists.",
    answer: "Server-Side Request Forgery (SSRF) occurs when a backend server accepts a user-provided URL (e.g. webhook registration, image download URL) and makes an outbound HTTP request without validating the destination. In AWS, GCP, and Azure, an attacker can supply the internal Cloud Metadata IP address: `http://169.254.169.254/latest/meta-data/iam/security-credentials/`, allowing them to steal AWS IAM credentials and take over the cloud infrastructure.",
    explanation: "Defenses: 1) Restrict protocols to `http:` and `https:`, 2) Resolve the DNS hostname before connecting, 3) Validate that the resolved IP address is NOT a private, loopback, or link-local address (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`).",
    code: "import dns from 'node:dns/promises';\nimport ipaddr from 'ipaddr.js';\n\nexport async function validateSafeOutboundUrl(targetUrl) {\n  const parsed = new URL(targetUrl);\n  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');\n\n  const addresses = await dns.resolve4(parsed.hostname);\n  for (const ip of addresses) {\n    const addr = ipaddr.parse(ip);\n    // Block loopback, private RFC1918, and link-local (169.254.x.x cloud metadata):\n    if (addr.range() !== 'unicast') {\n      throw new Error(`SSRF Blocked: Destination IP ${ip} is in restricted range ${addr.range()}`);\n    }\n  }\n}",
    recallHint: "SSRF targets internal IPs (169.254.169.254 cloud metadata). Resolve DNS and block non-unicast IPs.",
    interviewTip: "Highlight the AWS Capital One breach as the classic real-world example of SSRF cloud metadata credential theft.",
    tags: ["ssrf", "security", "cloud-metadata", "aws", "vulnerability"]
  })
];

module.exports = items;
