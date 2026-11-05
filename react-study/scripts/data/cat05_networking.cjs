const { makeItem } = require('../builder_helper.cjs');

const category = "5. Networking, HTTP, HTTPS & HTTP/2";

const items = [
  makeItem({
    idNum: 57,
    category,
    concept: "node:http Architecture (IncomingMessage & ServerResponse)",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does the native node:http module work and what are IncomingMessage and ServerResponse?",
    quickAnswer: "http.createServer receives req (IncomingMessage, a Readable stream) and res (ServerResponse, a Writable stream).",
    answer: "The `node:http` module is the foundation for almost all Node.js web frameworks (Express, Fastify, Koa, NestJS). When `http.createServer((req, res) => {})` receives a TCP connection, the C-based HTTP parser (`llhttp`) parses HTTP headers and constructs two objects: 1) `req` (`http.IncomingMessage`): A Readable Stream providing incoming headers, HTTP method, URL, and the streaming request body, and 2) `res` (`http.ServerResponse`): A Writable Stream for sending status codes, headers, and the response body back to the client socket.",
    explanation: "Because both `req` and `res` are streams, Node servers can process uploads and stream downloads with minimal memory consumption.",
    code: "import http from 'node:http';\n\nconst server = http.createServer((req, res) => {\n  console.log(`Method: ${req.method}, URL: ${req.url}`);\n  \n  res.writeHead(200, {\n    'Content-Type': 'application/json',\n    'X-Powered-By': 'NodeJS'\n  });\n  res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));\n});\nserver.listen(3000);",
    recallHint: "req = IncomingMessage (Readable stream); res = ServerResponse (Writable stream).",
    interviewTip: "Candidate gotcha: In raw node:http, req body is not populated automatically; you must stream chunks or use body-parser.",
    tags: ["http", "incomingmessage", "serverresponse", "streams"]
  }),

  makeItem({
    idNum: 58,
    category,
    concept: "Socket Pooling with http.Agent & Keep-Alive",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is http.Agent and why does enabling keepAlive dramatically improve outgoing HTTP microservice throughput?",
    quickAnswer: "http.Agent pools TCP sockets for outbound requests; keepAlive reuses established connections, eliminating expensive TCP/TLS handshake latency.",
    answer: "When making outbound HTTP requests (`http.request()`, `fetch()`, Axios), establishing a new TCP connection requires a 3-way handshake (SYN, SYN-ACK, ACK), plus an additional 2-3 round trips for TLS/SSL certificate negotiation. By default, legacy Node `http.Agent` closed connections after each request (`keepAlive: false`).",
    explanation: "Configuring `keepAlive: true` instructs `http.Agent` to maintain a pool of idle, reusable TCP sockets. When the next request targets the same host, it reuses an already authenticated socket immediately—reducing request latency by 60%-80% in microservice environments.",
    code: "import http from 'node:http';\n\n// Production HTTP Agent for microservice communication:\nexport const agent = new http.Agent({\n  keepAlive: true,\n  keepAliveMsecs: 30000, // Send TCP keepalive probes every 30s\n  maxSockets: 100,       // Max concurrent open sockets per origin host\n  maxFreeSockets: 20,    // Max idle sockets kept open in pool\n  timeout: 60000         // Socket timeout\n});\n\n// Usage in outgoing requests:\n// http.request({ host: 'api.service.internal', agent, ... });",
    recallHint: "http.Agent with keepAlive: true reuses TCP sockets; eliminates TCP/TLS handshakes in microservices.",
    interviewTip: "Always mention keep-alive socket pooling when asked how to optimize Node.js microservice-to-microservice throughput.",
    tags: ["http-agent", "keepalive", "socket-pooling", "performance", "networking"]
  }),

  makeItem({
    idNum: 59,
    category,
    concept: "TCP Sockets with node:net",
    priority: "important",
    difficulty: "Intermediate",
    question: "How do you build a low-level raw TCP server and client using the node:net module?",
    quickAnswer: "Use net.createServer() for the server and net.createConnection() for the client; the socket is a full Duplex stream.",
    answer: "The `node:net` module provides an asynchronous network API for creating stream-based TCP servers and clients (Layer 4 transport). A `net.Socket` instance is a full Duplex stream that can both emit `'data'` events and accept `.write()` calls directly over raw TCP packets.",
    explanation: "This is the underlying module upon which HTTP, HTTPS, WebSockets, and database drivers (PostgreSQL, MySQL, Redis) are built.",
    code: "import net from 'node:net';\n\n// 1. TCP Server\nconst server = net.createServer((socket) => {\n  console.log('Client connected from:', socket.remoteAddress);\n  \n  socket.on('data', (buffer) => {\n    console.log('Received TCP payload:', buffer.toString());\n    socket.write(`ACK: ${buffer.length} bytes received\\n`);\n  });\n  socket.on('close', () => console.log('Client disconnected'));\n});\nserver.listen(9000);\n\n// 2. TCP Client\n// const client = net.createConnection({ port: 9000 }, () => {\n//   client.write('Hello Server!');\n// });",
    recallHint: "node:net = Raw TCP sockets (Layer 4); net.Socket is a Duplex stream.",
    interviewTip: "Explain that node:http is simply an application-layer parser sitting on top of node:net TCP sockets.",
    tags: ["tcp", "net", "sockets", "layer4", "duplex"]
  }),

  makeItem({
    idNum: 60,
    category,
    concept: "UDP / Datagram Sockets with node:dgram",
    priority: "important",
    difficulty: "Intermediate",
    question: "What is the difference between TCP (node:net) and UDP (node:dgram), and when is UDP preferred in Node.js?",
    quickAnswer: "TCP is connection-oriented with guaranteed delivery; UDP is connectionless and lightweight, ideal for metrics (StatsD), gaming, and DNS.",
    answer: "TCP (`node:net`) guarantees packet order, retransmits lost packets, and provides congestion control via handshakes. UDP (`node:dgram`) is connectionless and unreliable: it sends standalone datagram packets without a handshake, without acknowledgements, and without ordering guarantees.",
    explanation: "In Node.js, UDP is preferred for high-frequency telemetry metrics (StatsD, DogStatsD), DNS queries, video/audio live streaming, and gaming where losing an occasional packet is far better than stalling traffic to wait for retransmission.",
    code: "import dgram from 'node:dgram';\n\n// UDP Server (StatsD receiver pattern):\nconst server = dgram.createSocket('udp4');\n\nserver.on('message', (msg, rinfo) => {\n  console.log(`Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);\n  console.log(`Metric payload: ${msg.toString()}`);\n});\n\nserver.bind(8125, () => {\n  console.log('UDP server bound to port 8125');\n});",
    recallHint: "UDP (node:dgram) = Connectionless, zero handshake, fire-and-forget. Used for metrics (StatsD) and DNS.",
    interviewTip: "Explain why StatsD metrics uses UDP: application code should never crash or block if the metrics collector goes down.",
    tags: ["udp", "dgram", "statsd", "networking", "telemetry"]
  }),

  makeItem({
    idNum: 61,
    category,
    concept: "TLS/SSL Encryption & node:tls Configuration",
    priority: "important",
    difficulty: "Advanced",
    question: "How do you configure secure TLS/SSL encryption in Node.js using keys, certificates, and modern cipher suites?",
    quickAnswer: "Use tls.createServer or https.createServer with key, cert, and ca options; configure minVersion: 'TLSv1.2' to disable insecure ciphers.",
    answer: "The `node:tls` module wraps OpenSSL to provide Transport Layer Security (TLS/SSL) encryption over TCP streams. When creating an HTTPS or TLS server, you provide: 1) `key`: Private key (PEM format), 2) `cert`: Public certificate, 3) `ca`: Certificate Authority bundle for mutual TLS (mTLS).",
    explanation: "Security best practice: In production, configure `minVersion: 'TLSv1.2'` (or `'TLSv1.3'`) to prevent protocol downgrade attacks against deprecated SSLv3, TLS 1.0, and TLS 1.1.",
    code: "import https from 'node:https';\nimport fs from 'node:fs';\n\nconst options = {\n  key: fs.readFileSync('./certs/private.key'),\n  cert: fs.readFileSync('./certs/certificate.crt'),\n  minVersion: 'TLSv1.3', // Enforce strongest modern encryption\n  ciphers: 'HIGH:!aNULL:!MD5' // Disable weak ciphers\n};\n\nconst server = https.createServer(options, (req, res) => {\n  res.writeHead(200);\n  res.end('Encrypted over TLS 1.3');\n});\nserver.listen(443);",
    recallHint: "Configure minVersion: 'TLSv1.3' and restrict weak ciphers in https.createServer options.",
    interviewTip: "Mention that in enterprise cloud architectures, TLS termination is often offloaded to an AWS ALB or Cloudflare edge proxy.",
    tags: ["tls", "ssl", "https", "security", "certificates"]
  }),

  makeItem({
    idNum: 62,
    category,
    concept: "HTTP/2 Multiplexing with node:http2",
    priority: "important",
    difficulty: "Advanced",
    question: "What advantages does HTTP/2 provide over HTTP/1.1 and how does node:http2 implement multiplexing?",
    quickAnswer: "HTTP/2 allows multiplexing hundreds of requests concurrently over a single TCP connection, with HPACK header compression and server push.",
    answer: "HTTP/1.1 suffered from 'Head-of-Line Blocking' at the request level: a browser could only send one request per TCP connection at a time, requiring browsers to open 6 parallel TCP connections per domain. HTTP/2 (`node:http2`) introduces binary framing, allowing hundreds of concurrent request and response streams to be multiplexed simultaneously over a SINGLE TCP connection without blocking each other.",
    explanation: "HTTP/2 also includes HPACK (efficient HTTP header compression) and server push capabilities.",
    code: "import http2 from 'node:http2';\nimport fs from 'node:fs';\n\nconst server = http2.createSecureServer({\n  key: fs.readFileSync('server.key'),\n  cert: fs.readFileSync('server.crt')\n});\n\nserver.on('stream', (stream, headers) => {\n  console.log(`HTTP/2 Stream #${stream.id} requested: ${headers[':path']}`);\n  stream.respond({\n    ':status': 200,\n    'content-type': 'application/json'\n  });\n  stream.end(JSON.stringify({ protocol: 'h2', streamId: stream.id }));\n});\nserver.listen(8443);",
    recallHint: "HTTP/2 multiplexes hundreds of streams over 1 TCP connection using binary frames; eliminates HoL blocking.",
    interviewTip: "Distinguish between HTTP request Head-of-Line blocking (solved by HTTP/2) and TCP packet HoL blocking (solved by HTTP/3 over QUIC).",
    tags: ["http2", "multiplexing", "binary-framing", "hpack"]
  }),

  makeItem({
    idNum: 63,
    category,
    concept: "Chunked Transfer-Encoding in Node.js",
    priority: "important",
    difficulty: "Intermediate",
    question: "What is Transfer-Encoding: chunked and how does Node.js handle it automatically?",
    quickAnswer: "It streams responses of dynamic, unknown size in series of length-delimited chunks without needing a Content-Length header.",
    answer: "When a server sends a response where total byte length is unknown in advance (e.g., streaming live database rows, dynamic HTML, or compressed streams), it cannot set a `Content-Length` header. In HTTP/1.1, Node automatically sets `Transfer-Encoding: chunked`.",
    explanation: "In chunked encoding, the connection stays open and the server writes chunks prefixed by their hexadecimal byte length. When `res.end()` is finally called, Node writes a zero-length chunk (`0\\r\\n\\r\\n`) to indicate the end of the response body.",
    code: "import http from 'node:http';\n\nconst server = http.createServer((req, res) => {\n  // Do NOT set Content-Length; Node defaults to Transfer-Encoding: chunked\n  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });\n  \n  res.write('Chunk 1\\n');\n  setTimeout(() => res.write('Chunk 2\\n'), 500);\n  setTimeout(() => res.end('Final Chunk\\n'), 1000); // Sends terminal 0-byte chunk\n});\nserver.listen(3000);",
    recallHint: "Transfer-Encoding: chunked streams dynamic data without Content-Length; terminated with a 0-byte chunk.",
    interviewTip: "Explain that setting res.setHeader('Content-Length', N) explicitly disables chunked transfer encoding in Node.",
    tags: ["chunked-encoding", "http", "streaming", "content-length"]
  }),

  makeItem({
    idNum: 64,
    category,
    concept: "WebSockets Protocol Upgrade & Framing (ws)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How does the WebSocket HTTP Upgrade handshake work in Node.js?",
    quickAnswer: "The client sends 'Upgrade: websocket' headers; Node's 'upgrade' event intercepts the underlying TCP socket and detaches it from HTTP.",
    answer: "WebSockets start as a standard HTTP/1.1 request containing `Upgrade: websocket` and `Connection: Upgrade` headers, along with a `Sec-WebSocket-Key` challenge. In Node.js: 1) The HTTP server intercepts this request via `server.on('upgrade', (req, socket, head) => {})`, 2) The server computes the SHA-1 response hash of the key + standard GUID, 3) It writes the `HTTP/1.1 101 Switching Protocols` handshake, and 4) It detaches the raw TCP socket from the HTTP parser.",
    explanation: "From that moment forward, communication uses the lightweight binary WebSocket framing protocol over the persistent TCP socket.",
    code: "import http from 'node:http';\nimport { WebSocketServer } from 'ws';\n\nconst server = http.createServer();\nconst wss = new WebSocketServer({ noServer: true });\n\nserver.on('upgrade', (request, socket, head) => {\n  // Verify authentication before upgrading socket:\n  const isAuthorized = request.headers['authorization'] === 'secret-token';\n  if (!isAuthorized) {\n    socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');\n    socket.destroy();\n    return;\n  }\n\n  wss.handleUpgrade(request, socket, head, (ws) => {\n    wss.emit('connection', ws, request);\n  });\n});\nserver.listen(8080);",
    recallHint: "HTTP Upgrade event detaches TCP socket from HTTP parser and transitions to WebSocket binary framing.",
    interviewTip: "Explain that authentication and cookies must be validated DURING the upgrade handshake before switching protocols.",
    tags: ["websockets", "upgrade", "ws", "realtime", "protocols"]
  }),

  makeItem({
    idNum: 65,
    category,
    concept: "Server-Sent Events (SSE) Implementation",
    priority: "important",
    difficulty: "Intermediate",
    question: "How do Server-Sent Events (SSE) differ from WebSockets and how are they implemented in Node.js?",
    quickAnswer: "SSE is a unidirectional text stream over standard HTTP (Content-Type: text/event-stream); WebSockets is bidirectional over raw TCP.",
    answer: "Server-Sent Events (SSE) provide a simple, unidirectional (server-to-client) streaming channel over standard HTTP without requiring custom protocols. The client connects using the browser's native `EventSource` API. The Node server responds with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive`. Data is written using the text format `data: <message>\\n\\n`.",
    explanation: "When to use: Use SSE for live dashboards, stock price feeds, and AI LLM token streaming. Use WebSockets when full-duplex client-to-server communication is required (e.g. chat, collaborative editing, gaming).",
    code: "import http from 'node:http';\n\nconst server = http.createServer((req, res) => {\n  if (req.url === '/events') {\n    res.writeHead(200, {\n      'Content-Type': 'text/event-stream',\n      'Cache-Control': 'no-cache',\n      'Connection': 'keep-alive'\n    });\n\n    const interval = setInterval(() => {\n      res.write(`data: ${JSON.stringify({ time: new Date().toISOString() })}\\n\\n`);\n    }, 1000);\n\n    req.on('close', () => clearInterval(interval)); // Cleanup on client disconnect!\n  }\n});\nserver.listen(4000);",
    recallHint: "SSE = Unidirectional HTTP stream (text/event-stream); WebSockets = Bidirectional full-duplex TCP.",
    interviewTip: "Call out that ChatGPT/Claude AI token streaming uses SSE because generation is unidirectional from server to client.",
    tags: ["sse", "server-sent-events", "websockets", "streaming", "llm"]
  }),

  makeItem({
    idNum: 66,
    category,
    concept: "CORS Negotiation at the HTTP Header Level",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does Cross-Origin Resource Sharing (CORS) work at the HTTP header level in Node.js?",
    quickAnswer: "Browsers enforce CORS for security; non-simple requests send an OPTIONS preflight checking Access-Control-Allow-* headers.",
    answer: "CORS is a browser security mechanism that restricts web pages from making AJAX requests to a different domain, port, or protocol. For 'non-simple' requests (custom headers like `Authorization`, or methods like `PUT`/`DELETE`), the browser sends an automatic preflight `OPTIONS` request before the actual request.",
    explanation: "The Node.js server must respond to `OPTIONS` with: 1) `Access-Control-Allow-Origin: <origin>`, 2) `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, 3) `Access-Control-Allow-Headers: Content-Type, Authorization`, and 4) `Access-Control-Max-Age: 86400` (caches preflight result).",
    code: "// Native CORS handling in raw Node.js:\nfunction handleCors(req, res) {\n  res.setHeader('Access-Control-Allow-Origin', 'https://myapp.com');\n  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');\n  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');\n\n  if (req.method === 'OPTIONS') {\n    res.writeHead(204); // No Content for preflight\n    res.end();\n    return true;\n  }\n  return false;\n}",
    recallHint: "OPTIONS preflight checks Access-Control-Allow-Origin, Methods, and Headers before main request fires.",
    interviewTip: "Candidate trap: Setting Access-Control-Allow-Origin: * while also setting Access-Control-Allow-Credentials: true is rejected by modern browsers.",
    tags: ["cors", "security", "http-headers", "preflight"]
  }),

  makeItem({
    idNum: 67,
    category,
    concept: "Slowloris Attacks & Request Header Timeouts",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is a Slowloris attack and how does server.headersTimeout protect Node.js servers?",
    quickAnswer: "Slowloris opens thousands of connections sending partial headers byte-by-byte; headersTimeout drops sockets that don't finish headers in time.",
    answer: "A Slowloris attack is a Denial of Service (DoS) technique where an attacker opens thousands of TCP connections to a Node server and sends HTTP headers extremely slowly (e.g. 1 byte every 10 seconds). The server keeps the sockets allocated in memory waiting for headers to finish, exhausting file descriptors and connection pools until legitimate users are locked out.",
    explanation: "Node.js introduced `server.headersTimeout` (default 60 seconds) and `server.requestTimeout` (default 5 minutes). If a client does not transmit the complete HTTP header block within `headersTimeout`, the server destroys the socket and emits an HTTP 408 Request Timeout.",
    code: "import http from 'node:http';\n\nconst server = http.createServer((req, res) => res.end('ok'));\n\n// Harden against Slowloris:\nserver.headersTimeout = 15000; // Drop connection if headers take > 15s\nserver.requestTimeout = 30000; // Drop connection if whole request takes > 30s\nserver.keepAliveTimeout = 5000; // Close idle keep-alive sockets after 5s\n\nserver.listen(3000);",
    recallHint: "headersTimeout drops slow drip headers, neutralizing Slowloris Denial of Service attacks.",
    interviewTip: "Point out that edge reverse proxies (Nginx, Cloudflare) usually provide the first line of defense against Slowloris.",
    tags: ["slowloris", "dos", "security", "headerstimeout", "timeouts"]
  }),

  makeItem({
    idNum: 68,
    category,
    concept: "DNS Resolution: dns.lookup vs dns.resolve",
    priority: "must-know",
    difficulty: "Advanced",
    question: "Why can dns.lookup() exhaust the libuv thread pool and why should high-traffic apps use dns.resolve()?",
    quickAnswer: "dns.lookup uses synchronous getaddrinfo() in the libuv thread pool; dns.resolve uses c-ares for asynchronous non-blocking network DNS.",
    answer: "In Node.js: 1) `dns.lookup()`: Calls the operating system's native `getaddrinfo(3)` C system call. Because `getaddrinfo` is synchronous in the OS, libuv MUST run it inside the worker thread pool. If your server makes 100 outbound API calls, all 4 default libuv threads are blocked waiting for DNS responses, stalling all file system operations! 2) `dns.resolve()`: Uses the C-Ares C library, which communicates over non-blocking network sockets on the main event loop WITHOUT touching the thread pool.",
    explanation: "Important catch: `dns.lookup` respects `/etc/hosts` and OS search domains; `dns.resolve` queries DNS network servers directly.",
    code: "import dns from 'node:dns/promises';\n\n// Uses Libuv Worker Thread Pool (can exhaust pool if slow):\n// const res1 = await dns.lookup('api.stripe.com');\n\n// Uses C-Ares network sockets (Zero thread pool usage!):\nconst addresses = await dns.resolve4('api.stripe.com');\nconsole.log('Non-blocking DNS resolved:', addresses);",
    recallHint: "dns.lookup = OS getaddrinfo (consumes thread pool); dns.resolve = c-ares (non-blocking network I/O).",
    interviewTip: "This is one of the deepest architectural questions in Node.js systems design. Outbound fetch/http requests use dns.lookup by default.",
    tags: ["dns", "dns-lookup", "dns-resolve", "threadpool", "c-ares"]
  }),

  makeItem({
    idNum: 69,
    category,
    concept: "HTTP Keep-Alive Timeout Handshake with Reverse Proxies",
    priority: "must-know",
    difficulty: "Advanced",
    question: "Why does mismatching keepAliveTimeout between Node.js and AWS ALB / Nginx cause intermittent HTTP 502 Bad Gateway errors?",
    quickAnswer: "If Node closes an idle keep-alive socket at the exact millisecond the proxy reuses it, the proxy sends data into a dead socket (ECONNRESET/502).",
    answer: "In production, an upstream reverse proxy (AWS ALB, Nginx, Cloudflare) pools keep-alive connections to Node.js backend pods. If the Node backend has a shorter `keepAliveTimeout` (e.g. default 5 seconds) than the proxy (e.g. AWS ALB default 60 seconds), a race condition occurs: Node.js decides to close an idle socket via a TCP FIN packet at the exact moment the proxy forwards an incoming user request onto that socket. The proxy receives `ECONNRESET` and returns an immediate `502 Bad Gateway` to the end user.",
    explanation: "Golden Rule: Always set Node's `server.keepAliveTimeout` HIGHER than the upstream load balancer's idle timeout (e.g. ALB = 60s, Node.js = 65s).",
    code: "import http from 'node:http';\n\nconst server = http.createServer((req, res) => res.end('ok'));\n\n// AWS ALB Idle Timeout is typically 60 seconds:\nserver.keepAliveTimeout = 65000; // 65 seconds (must be higher than proxy!)\nserver.headersTimeout = 66000;   // Must be higher than keepAliveTimeout\n\nserver.listen(3000);",
    recallHint: "Node keepAliveTimeout MUST be higher than upstream proxy timeout to eliminate race condition 502s.",
    interviewTip: "This is a real-world, high-frequency production incident experienced by almost every senior engineer operating Node in Kubernetes/AWS.",
    tags: ["502-bad-gateway", "keepalivetimeout", "aws-alb", "nginx", "production-incident"]
  }),

  makeItem({
    idNum: 70,
    category,
    concept: "HTTP Header Size Limits & 431 Request Header Fields Too Large",
    priority: "good-to-know",
    difficulty: "Intermediate",
    question: "What is max-http-header-size in Node.js and what happens when JWT cookie headers exceed it?",
    quickAnswer: "Node enforces a default 16KB limit on total HTTP header size; exceeding it drops the request with HTTP 431 before route logic runs.",
    answer: "To prevent memory exhaustion attacks, Node.js limits the maximum combined size of incoming HTTP headers (`--max-http-header-size`, default 16,384 bytes / 16KB). In enterprise applications with large JWT cookies, SAML assertions, or bloated analytics headers, total header size can exceed 16KB.",
    explanation: "When this threshold is exceeded, the C HTTP parser (`llhttp`) rejects the connection immediately with `HTTP 431 Request Header Fields Too Large`. To increase the threshold: start Node with `--max-http-header-size=32768` (32KB).",
    code: "// Launching Node with expanded 32KB HTTP header ceiling:\n// $ node --max-http-header-size=32768 server.js\n\n// Best practice: Keep JWT cookies lean; store large session state in Redis instead of headers.",
    recallHint: "Default header ceiling is 16KB; large JWT cookies trigger HTTP 431. Increase via --max-http-header-size.",
    interviewTip: "Advocate for lightweight JWTs (storing only user ID and roles) to prevent bloating HTTP request headers.",
    tags: ["http-headers", "431", "max-http-header-size", "jwt", "cookies"]
  })
];

module.exports = items;
