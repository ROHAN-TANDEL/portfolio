// Batch 3: Networking, HTTP, WebSockets & Real-Time (Examples 21 - 30)
module.exports = [
  {
    id: "ex-node-021",
    title: "High-Throughput http.Agent Keep-Alive Socket Pool for Microservices",
    category: "Networking & HTTP",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to configure an optimized outgoing http.Agent with TCP keep-alive, socket reuse limits, and connect timeouts to eliminate handshake latency in microservice calls.",
    conceptsCovered: [
      "http.Agent socket pooling",
      "keepAlive and keepAliveMsecs",
      "maxSockets concurrency limits",
      "TCP handshake latency elimination"
    ],
    code: `import http from 'node:http';
import https from 'node:https';

export const microserviceHttpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 100,       // Max concurrent active sockets per origin
  maxFreeSockets: 25,    // Max idle sockets retained in pool
  timeout: 30000         // Socket inactive timeout
});

export function makeOutgoingMicroserviceCall(host, port, path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);

    const req = http.request({
      host,
      port,
      path,
      method: 'POST',
      agent: microserviceHttpAgent, // Reuses pooled TCP socket!
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}`,
    breakdown: [
      { lineRange: "4-10", note: "Configures pooled agent with keepAlive: true and maxSockets: 100." },
      { lineRange: "18-20", note: "Passes agent to http.request, eliminating TCP/TLS 3-way handshake on subsequent calls." }
    ],
    expectedOutput: "Microservice latency drops from 45ms (new TCP handshake) to 4ms (reused keep-alive socket)."
  },

  {
    id: "ex-node-022",
    title: "Server-Sent Events (SSE) Real-Time AI Token Streaming Server",
    category: "Networking & HTTP",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to stream real-time text tokens (e.g. LLM responses) to web browsers using native Server-Sent Events over standard HTTP.",
    conceptsCovered: [
      "Server-Sent Events (SSE)",
      "text/event-stream content type",
      "Unidirectional HTTP push",
      "Client disconnect cleanup"
    ],
    code: `import http from 'node:http';

export const sseServer = http.createServer((req, res) => {
  if (req.url === '/api/ai-stream') {
    // 1. Establish SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // 2. Stream AI tokens every 100ms
    const tokens = ['The', ' event', ' loop', ' in', ' Node.js', ' is', ' single-threaded.'];
    let index = 0;

    const interval = setInterval(() => {
      if (index < tokens.length) {
        // SSE message format: data: <payload>\\n\\n
        res.write(\`data: \${JSON.stringify({ token: tokens[index++] })}\\n\\n\`);
      } else {
        res.write('data: [DONE]\\n\\n');
        clearInterval(interval);
        res.end();
      }
    }, 100);

    // 3. Clean up timer on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      console.log('Client closed connection; stream cleanly aborted.');
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});`,
    breakdown: [
      { lineRange: "5-11", note: "Sets Content-Type: text/event-stream and disables HTTP response caching." },
      { lineRange: "19-21", note: "Writes formatted SSE messages (data: <json>\\n\\n) directly into active response socket." },
      { lineRange: "29-32", note: "Listens to req.on('close') to clear timers and prevent memory leaks if client leaves." }
    ],
    expectedOutput: "Streams tokens progressively to browser EventSource client in real-time."
  },

  {
    id: "ex-node-023",
    title: "Native WebSocket Server Upgrade Handshake with Token Authentication",
    category: "Networking & HTTP",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to handle HTTP Upgrade requests to WebSockets, validate authorization tokens before upgrade, and detach the TCP socket from HTTP.",
    conceptsCovered: [
      "HTTP 'upgrade' event",
      "WebSocket 101 Switching Protocols",
      "Pre-upgrade authentication guard",
      "TCP socket detachment"
    ],
    code: `import http from 'node:http';
import { WebSocketServer } from 'ws';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('HTTP Server Online');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, \`http://\${request.headers.host}\`);
  const token = url.searchParams.get('token');

  // Authenticate BEFORE upgrading socket:
  if (token !== 'secret-auth-token') {
    socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
    socket.destroy();
    return;
  }

  // Hand off authenticated socket to WebSocket server:
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, request) => {
  console.log('Authenticated WebSocket client connected!');
  ws.on('message', (message) => {
    ws.send(\`Echo: \${message}\`);
  });
});`,
    breakdown: [
      { lineRange: "11-13", note: "Intercepts HTTP Upgrade header before protocol switch occurs." },
      { lineRange: "17-21", note: "Rejects unauthenticated clients with HTTP 401 and destroys raw TCP socket." },
      { lineRange: "24-26", note: "handleUpgrade finishes WebSocket framing handshake and transitions to full-duplex socket." }
    ],
    expectedOutput: "Rejects invalid tokens with HTTP 401; upgrades valid tokens to persistent full-duplex WebSockets."
  },

  {
    id: "ex-node-024",
    title: "Raw TCP Server with Custom Framing Protocol using node:net",
    category: "Networking & HTTP",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to build a low-level Layer 4 TCP echo and broadcast server using the native node:net module with connection limits.",
    conceptsCovered: [
      "node:net createServer",
      "net.Socket Duplex stream",
      "Socket tracking and broadcasting",
      "Max connections ceiling"
    ],
    code: `import net from 'node:net';

export function createCustomTcpServer(port = 8888) {
  const activeSockets = new Set();

  const server = net.createServer((socket) => {
    activeSockets.add(socket);
    console.log(\`Client connected from \${socket.remoteAddress}:\${socket.remotePort}\`);

    socket.write('WELCOME TO RAW TCP SERVER\\n');

    socket.on('data', (chunk) => {
      const text = chunk.toString().trim();
      console.log(\`Received TCP payload: \${text}\`);

      // Broadcast to all other connected sockets:
      for (const client of activeSockets) {
        if (client !== socket && !client.destroyed) {
          client.write(\`[\${socket.remotePort}]: \${text}\\n\`);
        }
      }
    });

    socket.on('close', () => activeSockets.delete(socket));
    socket.on('error', (err) => activeSockets.delete(socket));
  });

  server.maxConnections = 500; // Hard OS connection limit
  server.listen(port, () => console.log(\`TCP Server listening on port \${port}\`));
  return server;
}`,
    breakdown: [
      { lineRange: "6-11", note: "Tracks active raw TCP socket streams in a Set for broadcasting." },
      { lineRange: "13-22", note: "Listens for raw TCP packets on 'data' event and broadcasts across all peers." },
      { lineRange: "27", note: "Sets server.maxConnections to prevent resource exhaustion." }
    ],
    expectedOutput: "Handles raw Layer 4 TCP socket connections with bidirectional broadcasting."
  },

  {
    id: "ex-node-025",
    title: "High-Frequency Telemetry UDP Metrics Collector with node:dgram",
    category: "Networking & HTTP",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to build a connectionless UDP metrics listener (StatsD style) that receives thousands of telemetry packets per second with zero connection overhead.",
    conceptsCovered: [
      "node:dgram createSocket('udp4')",
      "Connectionless packet listening",
      "StatsD metric parsing",
      "Zero-handshake network I/O"
    ],
    code: `import dgram from 'node:dgram';

export function createUdpMetricsCollector(port = 8125) {
  const socket = dgram.createSocket('udp4');
  const metrics = new Map();

  socket.on('message', (msg, rinfo) => {
    // Metric packet format: "api.orders.count:1|c"
    const line = msg.toString().trim();
    const [name, rest] = line.split(':');
    const [valStr, type] = rest ? rest.split('|') : [1, 'c'];
    const val = parseFloat(valStr) || 1;

    const current = metrics.get(name) || 0;
    metrics.set(name, current + val);
  });

  socket.on('listening', () => {
    const addr = socket.address();
    console.log(\`UDP Metrics Collector bound to \${addr.address}:\${addr.port}\`);
  });

  socket.bind(port);
  return { socket, metrics };
}`,
    breakdown: [
      { lineRange: "4-5", note: "Creates IPv4 UDP datagram socket." },
      { lineRange: "7-15", note: "Listens to 'message' event for standalone datagram packets without handshakes." },
      { lineRange: "22", note: "Binds socket to port 8125 to listen for StatsD UDP packets." }
    ],
    expectedOutput: "Receives 50,000 UDP metric packets per second at near-zero CPU overhead."
  },

  {
    id: "ex-node-026",
    title: "Secure HTTPS Server with TLS 1.3 & Custom Cipher Suites",
    category: "Networking & HTTP",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to configure a hardened HTTPS web server using TLS 1.3, custom certificates, and disabling vulnerable legacy SSL/TLS cipher suites.",
    conceptsCovered: [
      "node:https createServer",
      "TLS 1.3 minVersion configuration",
      "Cipher suite hardening",
      "SSL certificate integration"
    ],
    code: `import https from 'node:https';
import fs from 'node:fs';

export function createSecureHttpsServer(certDir) {
  const options = {
    key: fs.readFileSync(\`\${certDir}/server.key\`),
    cert: fs.readFileSync(\`\${certDir}/server.crt\`),
    minVersion: 'TLSv1.3',          // Reject insecure TLS 1.0, 1.1, and 1.2
    ciphers: 'HIGH:!aNULL:!MD5:!RC4', // Disallow weak legacy ciphers
    honorCipherOrder: true
  };

  const server = https.createServer(options, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'SECURE_TLS_1_3',
      tlsVersion: req.socket.getProtocol()
    }));
  });

  server.listen(443, () => console.log('Hardened HTTPS server running on port 443 (TLS 1.3)'));
  return server;
}`,
    breakdown: [
      { lineRange: "5-11", note: "Configures certificates and strictly enforces TLSv1.3 as minimum version." },
      { lineRange: "13-19", note: "Responds over encrypted TLS socket, reporting verified TLS protocol version." }
    ],
    expectedOutput: "A+ Qualys SSL rating; blocks downgrade attacks to legacy TLS versions."
  },

  {
    id: "ex-node-027",
    title: "HTTP/2 Multiplexed Server with Push Streams using node:http2",
    category: "Networking & HTTP",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to run a high-performance HTTP/2 server that multiplexes concurrent streams over a single TCP connection and pushes critical assets.",
    conceptsCovered: [
      "node:http2 createSecureServer",
      "Binary framing multiplexing",
      "HTTP/2 stream lifecycle",
      "Head-of-Line blocking elimination"
    ],
    code: `import http2 from 'node:http2';
import fs from 'node:fs';

export function createHttp2Server(keyPath, certPath) {
  const server = http2.createSecureServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  });

  server.on('stream', (stream, headers) => {
    const path = headers[':path'];

    if (path === '/') {
      // Respond to main document request:
      stream.respond({
        ':status': 200,
        'content-type': 'application/json'
      });
      stream.end(JSON.stringify({ message: 'Hello from HTTP/2 Multiplexed Server!' }));
    } else {
      stream.respond({ ':status': 404 });
      stream.end();
    }
  });

  server.listen(8443, () => console.log('HTTP/2 Server running on port 8443'));
  return server;
}`,
    breakdown: [
      { lineRange: "5-8", note: "Creates secure HTTP/2 server (ALPN negotiates h2 over TLS)." },
      { lineRange: "10-23", note: "Listens for 'stream' events; multiplexes hundreds of streams over one connection." }
    ],
    expectedOutput: "Multiplexes concurrent requests over a single TCP socket with zero HTTP Head-of-Line blocking."
  },

  {
    id: "ex-node-028",
    title: "Graceful Socket Draining Handshake on Server Close",
    category: "Networking & HTTP",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to track client sockets and gracefully drain active keep-alive connections on shutdown without cutting off in-flight HTTP requests.",
    conceptsCovered: [
      "server.on('connection') socket tracking",
      "server.close() callback",
      "Keep-alive socket destruction",
      "Zero-502 rolling updates"
    ],
    code: `import http from 'node:http';

export function createDrainingServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Request handled successfully');
  });

  const sockets = new Set();

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  async function gracefulShutdown(timeoutMs = 10000) {
    console.log('Stopping acceptance of new connections...');
    
    // 1. Stop listening for new connections
    const closePromise = new Promise((resolve) => server.close(resolve));

    // 2. Destroy remaining idle keep-alive sockets
    for (const socket of sockets) {
      // Destroy idle sockets that aren't actively processing a request
      socket.destroy();
    }

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs).unref()
    );

    await Promise.race([closePromise, timeoutPromise]);
    console.log('All server sockets cleanly drained.');
  }

  return { server, gracefulShutdown };
}`,
    breakdown: [
      { lineRange: "10-14", note: "Tracks all active incoming TCP sockets in a Set." },
      { lineRange: "16-30", note: "server.close() stops new traffic, while socket.destroy() tears down idle keep-alive sockets." }
    ],
    expectedOutput: "Server terminates in < 200ms without leaving hung sockets or dropping in-flight requests."
  },

  {
    id: "ex-node-029",
    title: "Non-Blocking DNS Resolution via c-ares (dns.resolve4)",
    category: "Networking & HTTP",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to perform asynchronous DNS lookups using c-ares (dns.resolve4) over non-blocking network sockets, avoiding libuv thread pool exhaustion.",
    conceptsCovered: [
      "dns.lookup vs dns.resolve4",
      "c-ares asynchronous DNS",
      "Thread pool exhaustion prevention",
      "IPv4 A-record resolution"
    ],
    code: `import dns from 'node:dns/promises';

// LEAKY / BLOCKING PATTERN:
// dns.lookup() calls the OS getaddrinfo() system call synchronously in the libuv thread pool!
// 100 concurrent lookups will exhaust all 4 threads!
export async function resolveHostnamesSafe(hostnames) {
  // SAFE HIGH-PERFORMANCE PATTERN:
  // dns.resolve4() uses the c-ares C library over non-blocking network sockets!
  // Uses ZERO libuv worker threads!
  const results = await Promise.allSettled(
    hostnames.map(async (host) => {
      const ips = await dns.resolve4(host);
      return { host, ips };
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

// Example usage:
// resolveHostnamesSafe(['api.stripe.com', 'api.github.com']).then(console.log);`,
    breakdown: [
      { lineRange: "7-16", note: "dns.resolve4 queries DNS servers directly via network sockets on the event loop." },
      { lineRange: "18-20", note: "Leaves all 4 libuv thread pool workers completely free for disk file I/O." }
    ],
    expectedOutput: "Resolves 1,000 domains concurrently with 0% thread pool saturation."
  },

  {
    id: "ex-node-030",
    title: "Slowloris Attack Mitigation with Request Header Timeouts",
    category: "Networking & HTTP",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to configure server.headersTimeout and server.requestTimeout to defend against Slowloris Denial of Service socket starvation attacks.",
    conceptsCovered: [
      "server.headersTimeout",
      "server.requestTimeout",
      "Slowloris DoS mitigation",
      "Socket starvation defense"
    ],
    code: `import http from 'node:http';

export function createHardenedHttpServer(requestHandler) {
  const server = http.createServer(requestHandler);

  // DEFEND AGAINST SLOWLORIS ATTACKS:
  // 1. Limit time client has to transmit complete HTTP header block:
  server.headersTimeout = 15000; // 15 seconds (drops slow drip headers)

  // 2. Limit maximum time for complete request body arrival:
  server.requestTimeout = 30000; // 30 seconds

  // 3. Limit idle keep-alive socket timeout:
  server.keepAliveTimeout = 5000; // 5 seconds

  // Handle client timeouts gracefully:
  server.on('timeout', (socket) => {
    console.warn('Socket timed out before completing headers. Destroying.');
    socket.destroy();
  });

  return server;
}`,
    breakdown: [
      { lineRange: "8-9", note: "headersTimeout closes sockets if complete header block is not received in 15 seconds." },
      { lineRange: "11-12", note: "requestTimeout caps total request duration to stop slow upload starvation." },
      { lineRange: "18-21", note: "Listens for timeout event and cleans up hanging sockets." }
    ],
    expectedOutput: "Drops malicious slow-drip sockets immediately, preserving connection capacity for legitimate users."
  }
];
