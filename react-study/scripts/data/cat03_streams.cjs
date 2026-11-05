const { makeItem } = require('../builder_helper.cjs');

const category = "3. Streams, Buffers & Binary I/O";

const items = [
  makeItem({
    idNum: 30,
    category,
    concept: "Buffer Class Internals & Slab Allocator",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is a Node.js Buffer, and how does the internal 8KB slab allocator optimize memory?",
    quickAnswer: "A Buffer is raw binary memory allocated outside the V8 heap in C++; Node uses an 8KB slab allocator to pool small buffers and reduce allocation overhead.",
    answer: "A Node.js `Buffer` represents a fixed-size chunk of binary memory allocated outside the V8 JavaScript heap (in C++ space). To prevent frequent expensive C++ heap allocations for small chunks, Node.js uses an internal 8KB Slab Allocator (`Buffer.poolSize = 8192`). Allocations under 4KB (half the pool size) are sliced out of a shared pre-allocated 8KB slab.",
    explanation: "Allocations larger than 4KB bypass the slab pool and allocate dedicated native memory via `ArrayBuffer`. Understanding this slab architecture is critical when retaining small slices of large buffers in memory.",
    code: "// Buffer creation:\nimport { Buffer } from 'node:buffer';\n\nconst buf = Buffer.alloc(10); // 10 bytes initialized to zero\nconst unsafeBuf = Buffer.allocUnsafe(10); // 10 bytes uninitialized (fast, but holds old RAM garbage)\nconst fromStr = Buffer.from('Hello World', 'utf8');\n\nconsole.log(fromStr); // <Buffer 48 65 6c 6c 6f 20 57 6f 72 6c 64>\nconsole.log(fromStr.toString('base64')); // SGVsbG8gV29ybGQ=",
    recallHint: "Buffers live outside V8 heap in C++ memory; allocations < 4KB share an 8KB pre-allocated slab pool.",
    interviewTip: "Mention that Buffer extends Uint8Array in modern Node.js, making it compatible with standard TypedArray methods.",
    tags: ["buffer", "slab-allocator", "binary", "memory", "v8"]
  }),

  makeItem({
    idNum: 31,
    category,
    concept: "Buffer.alloc vs Buffer.allocUnsafe vs Buffer.from",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What is the security difference between Buffer.alloc() and Buffer.allocUnsafe()?",
    quickAnswer: "Buffer.alloc zero-initializes memory; Buffer.allocUnsafe leaves old residual RAM intact, which can leak sensitive data (passwords, tokens).",
    answer: "`Buffer.alloc(size)` allocates memory and overwrites every byte with zeros. `Buffer.allocUnsafe(size)` allocates memory immediately without clearing it. It is significantly faster because it avoids writing zeros, but the allocated buffer may contain leftover residual data from previously freed memory (such as passwords, API keys, or private database fragments).",
    explanation: "Security rule: Never send `Buffer.allocUnsafe()` directly over the network or write it to disk without immediately filling it with data. Node.js deprecated the old `new Buffer(size)` constructor because it defaulted to unsafe behavior.",
    code: "// Unsafe memory leak risk:\n// const leak = Buffer.allocUnsafe(1024);\n// res.end(leak); // DANGEROUS: May expose old passwords or credentials in RAM!\n\n// Secure modern practices:\nconst safe = Buffer.alloc(1024); // Guaranteed clean zeroes\nconst filled = Buffer.allocUnsafe(1024);\nfilled.fill(0); // Manually zeroed if allocUnsafe was used for performance",
    recallHint: "Buffer.alloc = Safe zeroed memory; Buffer.allocUnsafe = Fast uninitialized memory (security leak hazard).",
    interviewTip: "Candidate security check: Always call out why new Buffer() was deprecated in favor of Buffer.alloc().",
    tags: ["buffer", "security", "alloc", "allocunsafe", "memory-leak"]
  }),

  makeItem({
    idNum: 32,
    category,
    concept: "Buffer Slicing vs Copying (Memory Sharing Trap)",
    priority: "important",
    difficulty: "Advanced",
    question: "Why can retaining a small Buffer.subarray() cause a major memory leak?",
    quickAnswer: "Buffer.subarray/slice creates a view sharing the original memory; retaining a 10-byte slice prevents the entire parent Buffer or 8KB slab from being garbage collected.",
    answer: "In Node.js, calling `buf.subarray(start, end)` (and legacy `buf.slice()`) does NOT copy memory. Instead, it creates a new Buffer instance that references the exact same underlying `ArrayBuffer` pool. If you read a 100MB file and extract a 20-byte token via `.subarray()`, keeping that 20-byte token in memory prevents the entire 100MB `ArrayBuffer` from being garbage collected.",
    explanation: "To prevent memory retention leaks, always explicitly copy small slices out of large buffers using `Buffer.from(slice)` or `Uint8Array.prototype.slice()`.",
    code: "// Memory Retention Trap:\nfunction extractTokenLeaky(large100MBBuffer) {\n  return large100MBBuffer.subarray(0, 32); // Holds entire 100MB parent in memory!\n}\n\n// Safe Pattern (Independent Copy):\nfunction extractTokenSafe(large100MBBuffer) {\n  const tokenCopy = Buffer.alloc(32);\n  large100MBBuffer.copy(tokenCopy, 0, 0, 32); // Explicitly copies only 32 bytes\n  return tokenCopy; // 100MB parent can now be safely garbage collected!\n}",
    recallHint: "Buffer.subarray shares memory; copying (Buffer.from/copy) isolates the slice and releases parent RAM.",
    interviewTip: "This is a classic memory leak question asked in senior backend and high-performance microservices interviews.",
    tags: ["buffer", "slice", "subarray", "memory-leak", "garbage-collection"]
  }),

  makeItem({
    idNum: 33,
    category,
    concept: "The 4 Types of Streams",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What are the four core types of Node.js streams and their responsibilities?",
    quickAnswer: "Readable (data source), Writable (data destination), Duplex (both read & write independently), Transform (modifies data as written).",
    answer: "Node.js provides four fundamental stream classes inheriting from `EventEmitter`: 1) Readable: an abstraction for a source from which data can be consumed (e.g. `fs.createReadStream`, `http.IncomingMessage`, `process.stdin`), 2) Writable: an abstraction for a destination to which data can be written (e.g. `fs.createWriteStream`, `http.ServerResponse`, `process.stdout`), 3) Duplex: an abstraction for a stream that is both Readable and Writable independently (e.g. `net.Socket`), and 4) Transform: a specialized Duplex stream where the output is computed by transforming the input (e.g. `zlib.createGzip`, crypto cipher).",
    explanation: "Streams process data incrementally in chunks, allowing Node.js to process files larger than total physical RAM without memory spikes.",
    code: "// The 4 Streams in a single pipeline:\nimport { createReadStream, createWriteStream } from 'node:fs';\nimport { createGzip } from 'node:zlib';\nimport { pipeline } from 'node:stream/promises';\n\nawait pipeline(\n  createReadStream('input.txt'), // Readable\n  createGzip(),                  // Transform (Compresses data)\n  createWriteStream('input.txt.gz') // Writable\n);",
    recallHint: "Streams: Readable (source), Writable (sink), Duplex (independent both), Transform (input-to-output).",
    interviewTip: "Highlight that Duplex streams have separate internal read and write buffers, whereas Transform streams link read and write through transformation logic.",
    tags: ["streams", "readable", "writable", "duplex", "transform"]
  }),

  makeItem({
    idNum: 34,
    category,
    concept: "Stream Flowing Mode vs Paused Mode",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What is the difference between Flowing Mode and Paused Mode in Readable streams?",
    quickAnswer: "Flowing mode pushes chunks as fast as possible via 'data' events; Paused mode requires explicit stream.read() calls.",
    answer: "A Readable stream operates in one of two modes: 1) Paused Mode (Default): Data does not flow automatically. The consumer must call `stream.read()` explicitly, typically in response to a `'readable'` event. 2) Flowing Mode: Data is read from the underlying system and provided to the consumer as fast as possible via `'data'` events. The stream switches to flowing mode when a `'data'` event handler is attached, or when `.resume()` or `.pipe()` is called.",
    explanation: "Danger of Flowing Mode: Attaching a `'data'` listener without proper backpressure handling floods the consumer with chunks faster than it can process them, leading to unbounded RAM consumption.",
    code: "// Paused Mode (Explicit pull):\nconst stream = createReadStream('data.txt');\nstream.on('readable', () => {\n  let chunk;\n  while ((chunk = stream.read()) !== null) {\n    console.log(`Read ${chunk.length} bytes`);\n  }\n});\n\n// Flowing Mode (Push):\n// stream.on('data', (chunk) => console.log('Chunk arrived!'));",
    recallHint: "Paused mode = consumer pulls with stream.read(); Flowing mode = stream pushes via 'data' events.",
    interviewTip: "Candidate trap: Listening to 'data' events on high-throughput streams disables built-in backpressure unless pause() is manually called.",
    tags: ["streams", "flowing-mode", "paused-mode", "backpressure"]
  }),

  makeItem({
    idNum: 35,
    category,
    concept: "HighWaterMark & Internal Buffer Thresholds",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What is highWaterMark in Node.js streams and how does it control buffering?",
    quickAnswer: "highWaterMark is the byte limit threshold (default 16KB for streams, 64KB for fs) that determines when write() returns false to trigger backpressure.",
    answer: "`highWaterMark` is a configuration option specifying the maximum number of bytes (or objects in objectMode) that a stream will buffer internally before it stops reading or signals backpressure. Default thresholds: 1) Standard streams: 16KB (`16 * 1024`), 2) File system streams (`fs.createReadStream`): 64KB (`64 * 1024`), and 3) Object mode streams: 16 objects.",
    explanation: "When a writable stream's internal buffer exceeds `highWaterMark`, `writable.write(chunk)` returns `false`. This informs the upstream producer to stop pushing data until the buffer drains.",
    code: "import { createReadStream, createWriteStream } from 'node:fs';\n\n// Tuning highWaterMark for high-throughput network streaming:\nconst reader = createReadStream('huge.bin', {\n  highWaterMark: 128 * 1024 // 128KB chunks for high performance\n});\n\nconst writer = createWriteStream('output.bin', {\n  highWaterMark: 128 * 1024\n});",
    recallHint: "highWaterMark dictates buffer capacity (16KB default, 64KB for fs). Exceeding it returns false from write().",
    interviewTip: "Explain that setting highWaterMark too large wastes RAM, while setting it too small causes excessive system call context switches.",
    tags: ["highwatermark", "streams", "buffers", "performance"]
  }),

  makeItem({
    idNum: 36,
    category,
    concept: "Stream Backpressure Mechanics",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How does backpressure work in Node.js streams, and how do you handle it manually?",
    quickAnswer: "When write() returns false, the producer must pause and wait for the 'drain' event before writing further chunks.",
    answer: "Backpressure is the flow-control feedback mechanism that prevents a fast data producer from overwhelming a slower data consumer. If a producer reads at 100MB/s and a client network socket can only send at 1MB/s, unhandled data accumulates in V8 RAM until the process crashes with Out Of Memory (OOM).",
    explanation: "Manual backpressure contract: 1) The producer checks the boolean returned by `writable.write(chunk)`, 2) If it returns `false`, the producer pauses reading (`readable.pause()`), 3) When the writable has flushed its internal buffer below `highWaterMark`, it emits `'drain'`, and 4) The producer resumes writing (`readable.resume()`).",
    code: "function writeWithBackpressure(readable, writable) {\n  readable.on('data', (chunk) => {\n    const canContinue = writable.write(chunk);\n    if (!canContinue) {\n      readable.pause(); // Buffer full: Pause reading!\n    }\n  });\n\n  writable.on('drain', () => {\n    readable.resume(); // Buffer drained: Resume reading!\n  });\n}",
    recallHint: "write() returns false -> pause producer; wait for 'drain' event -> resume producer.",
    interviewTip: "Emphasize that stream.pipeline() encapsulates this manual pause/drain logic automatically and safely.",
    tags: ["backpressure", "streams", "drain", "pause", "resume"]
  }),

  makeItem({
    idNum: 37,
    category,
    concept: "stream.pipeline vs stream.pipe",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "Why is stream.pipe() considered an anti-pattern in production code compared to stream.pipeline()?",
    quickAnswer: "stream.pipe() does not forward errors and fails to destroy destination streams on failure, causing memory and file descriptor leaks.",
    answer: "The legacy `readable.pipe(writable)` method has a critical architectural flaw: it does NOT close or destroy the destination stream if the source stream emits an error. If an error occurs reading a file, the destination network socket or file descriptor remains open in memory indefinitely. Furthermore, handling errors across multi-stage pipes (`a.pipe(b).pipe(c)`) requires manually attaching `.on('error')` to every single stream in the chain.",
    explanation: "`stream.pipeline()` solves this completely: it forwards all errors to a single callback, guarantees that ALL streams in the pipeline are cleanly closed and destroyed on error or completion, and handles backpressure natively.",
    code: "// Anti-pattern (Leaks descriptors if read fails):\n// readStream.pipe(transform).pipe(writeStream);\n\n// Production Best Practice (stream.pipeline):\nimport { pipeline } from 'node:stream';\n\npipeline(readStream, transform, writeStream, (err) => {\n  if (err) {\n    console.error('Pipeline failed, but all streams cleanly closed:', err);\n  } else {\n    console.log('Pipeline succeeded!');\n  }\n});",
    recallHint: "stream.pipe leaks file descriptors on error; stream.pipeline guarantees full cleanup and centralized error handling.",
    interviewTip: "Always recommend stream.pipeline() or stream/promises pipeline() over raw .pipe() in architectural reviews.",
    tags: ["pipeline", "pipe", "streams", "resource-leak", "cleanup"]
  }),

  makeItem({
    idNum: 38,
    category,
    concept: "stream/promises Modern Async Pipelines",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How do you use stream/promises to construct async/await streaming pipelines with AbortSignal?",
    quickAnswer: "Import pipeline from 'node:stream/promises' and await it directly with a try/catch block and optional signal cancellation.",
    answer: "Node.js 15+ introduced Promise-based stream utilities in `node:stream/promises`. It allows streams to be composed using clean `await pipeline(...)` syntax without callbacks. It also accepts an options object supporting `{ signal: abortController.signal }` for native cancellation.",
    explanation: "If the pipeline fails or is aborted via the signal, all underlying streams are automatically destroyed, and the promise rejects with the error.",
    code: "import { pipeline } from 'node:stream/promises';\nimport { createReadStream, createWriteStream } from 'node:fs';\nimport { createGzip } from 'node:zlib';\n\nexport async function compressFile(source, target) {\n  const ac = new AbortController();\n  const timer = setTimeout(() => ac.abort(), 10000);\n\n  try {\n    await pipeline(\n      createReadStream(source),\n      createGzip(),\n      createWriteStream(target),\n      { signal: ac.signal }\n    );\n    console.log('Compression complete.');\n  } finally {\n    clearTimeout(timer);\n  }\n}",
    recallHint: "await pipeline(...) from 'node:stream/promises' + { signal } = Modern async stream standard.",
    interviewTip: "Demonstrating stream/promises with an AbortController proves up-to-date modern Node.js knowledge.",
    tags: ["stream-promises", "pipeline", "async-await", "abortcontroller"]
  }),

  makeItem({
    idNum: 39,
    category,
    concept: "Custom Transform Streams (_transform & _flush)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How do you implement a custom Transform stream using _transform() and _flush()?",
    quickAnswer: "Extend Transform, implement _transform(chunk, enc, cb) to push modified data, and implement _flush(cb) for trailing data on close.",
    answer: "A `Transform` stream is a Duplex stream where output is calculated from input. To create one: 1) Extend `node:stream.Transform`, 2) Implement `_transform(chunk, encoding, callback)`: process the incoming chunk, push output via `this.push(data)`, and invoke `callback()` when ready for the next chunk, and 3) Optionally implement `_flush(callback)`: called when all written data has been consumed right before the stream closes, useful for writing trailing checksums or closing tags.",
    explanation: "Calling `callback(err)` immediately stops the stream and forwards the error down the pipeline.",
    code: "import { Transform } from 'node:stream';\n\nclass UpperCaseTransformer extends Transform {\n  _transform(chunk, encoding, callback) {\n    try {\n      const upper = chunk.toString().toUpperCase();\n      this.push(upper);\n      callback(); // Ready for next chunk\n    } catch (err) {\n      callback(err); // Emits error down pipeline\n    }\n  }\n\n  _flush(callback) {\n    this.push('\\n--- END OF STREAM ---');\n    callback();\n  }\n}",
    recallHint: "_transform() handles each chunk; _flush() flushes final trailing data before stream closes.",
    interviewTip: "Candidate trap: Forgetting to call callback() inside _transform halts the entire stream pipeline indefinitely.",
    tags: ["transform", "streams", "custom-stream", "flush"]
  }),

  makeItem({
    idNum: 40,
    category,
    concept: "Object Mode Streams vs Binary Byte Streams",
    priority: "important",
    difficulty: "Intermediate",
    question: "What is an Object Mode stream in Node.js and how does highWaterMark differ in object mode?",
    quickAnswer: "Object Mode allows streams to emit arbitrary JavaScript objects instead of Buffers/strings; highWaterMark counts objects (default 16) instead of bytes.",
    answer: "By default, Node.js streams only handle `Buffer` or `string` values. When `objectMode: true` is configured in the constructor options, the stream can push and receive arbitrary JavaScript objects (JSON objects, database row models, class instances).",
    explanation: "Crucial difference: In byte streams, `highWaterMark` specifies total byte size (e.g. 16,384 bytes). In `objectMode: true`, `highWaterMark` specifies the COUNT of individual objects (default 16 objects).",
    code: "import { Transform } from 'node:stream';\n\n// Stream that accepts raw JSON string and emits parsed JS objects:\nconst jsonParser = new Transform({\n  objectMode: true,\n  transform(chunk, encoding, callback) {\n    try {\n      const parsed = JSON.parse(chunk.toString());\n      this.push(parsed); // Emits raw JS object!\n      callback();\n    } catch (err) {\n      callback(err);\n    }\n  }\n});",
    recallHint: "objectMode: true streams JS objects; highWaterMark measures object count (default 16), not bytes.",
    interviewTip: "Explain that combining object-mode transforms with database cursors allows streaming millions of rows without loading all rows into RAM.",
    tags: ["objectmode", "streams", "json", "highwatermark"]
  }),

  makeItem({
    idNum: 41,
    category,
    concept: "Web Streams API in Modern Node.js",
    priority: "important",
    difficulty: "Intermediate",
    question: "What is the difference between Node.js native streams and the Web Streams API?",
    quickAnswer: "Node streams are EventEmitter-based; Web Streams (ReadableStream, WritableStream) are standard web APIs using reader/writer locks.",
    answer: "Node.js 18+ provides full native support for the WHATWG Web Streams Standard (`ReadableStream`, `WritableStream`, `TransformStream`) globally. While Node.js native streams rely on `EventEmitter` and callbacks (`.on('data')`, `write()`), Web Streams use Promise-based reader locks (`stream.getReader()`, `reader.read()`) matching browser APIs.",
    explanation: "Node.js provides utility functions in `node:stream` to convert between them: `Readable.toWeb()` and `Readable.fromWeb()`.",
    code: "import { Readable } from 'node:stream';\n\n// Convert Node.js stream to standard Web Stream (for fetch/browser interop):\nconst nodeStream = Readable.from(['Hello', ' ', 'World']);\nconst webStream = Readable.toWeb(nodeStream);\n\n// Consume using standard Web Stream reader lock:\nconst reader = webStream.getReader();\nlet result;\nwhile (!(result = await reader.read()).done) {\n  console.log('Web stream chunk:', result.value);\n}",
    recallHint: "Web Streams = WHATWG browser standard with getReader(); Readable.toWeb/fromWeb bridges Node streams.",
    interviewTip: "Mention that Web Streams are essential when building edge-compatible frameworks (Cloudflare Workers, Next.js, Fastify).",
    tags: ["web-streams", "whatwg", "readablestream", "standards"]
  }),

  makeItem({
    idNum: 42,
    category,
    concept: "Memory Spikes in Large File Uploads & Downloads",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "Why does using fs.readFile() for 2GB file downloads crash Node.js, and how do streams fix this?",
    quickAnswer: "fs.readFile buffers the entire 2GB into the V8 heap at once, triggering an OOM crash; streams stream chunks with a flat ~50MB memory footprint.",
    answer: "Calling `fs.readFile()` or `res.send(data)` buffers the entire file contents into V8 memory all at once. For multiple concurrent downloads of large files, memory usage spikes linearly: 10 concurrent 1GB downloads consume 10GB of RAM, exceeding the V8 default heap limit (~2GB-4GB) and causing the OS or Node to abort with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.",
    explanation: "Streams process files chunk by chunk (e.g. 64KB per chunk). Memory consumption stays flat at ~30MB-50MB regardless of whether the file is 100MB, 10GB, or 100GB.",
    code: "// BAD: OOM crash on large files:\n// app.get('/download', async (req, res) => {\n//   const data = await fs.promises.readFile('huge-video.mp4'); // 3GB into RAM!\n//   res.send(data);\n// });\n\n// GOOD: Constant ~40MB memory usage with streams:\nimport { createReadStream } from 'node:fs';\nimport { pipeline } from 'node:stream/promises';\n\napp.get('/download', async (req, res) => {\n  res.setHeader('Content-Type', 'video/mp4');\n  await pipeline(createReadStream('huge-video.mp4'), res);\n});",
    recallHint: "fs.readFile = entire file into RAM (OOM risk); createReadStream = constant 64KB chunks in flight.",
    interviewTip: "State the mathematical difference: Memory complexity is O(N) for buffer reads vs O(1) for streaming pipelines.",
    tags: ["oom", "large-files", "memory-spike", "streams", "scalability"]
  }),

  makeItem({
    idNum: 43,
    category,
    concept: "Stream Destroy & Resource Cleanup Guarantees",
    priority: "important",
    difficulty: "Advanced",
    question: "What does stream.destroy() do and how do you guarantee file descriptors are closed on client disconnection?",
    quickAnswer: "stream.destroy() emits 'close', terminates underlying I/O handles, and frees OS file descriptors immediately.",
    answer: "Calling `stream.destroy([error])` forcefully terminates the stream. It closes any open underlying resources (such as operating system file descriptors or TCP sockets), flushes pending error callbacks, and emits the `'close'` event. If an optional `error` argument is provided, the stream will also emit an `'error'` event before closing.",
    explanation: "Production pattern: In HTTP servers, if a client abruptly closes the TCP connection while downloading a file, listen to `req.on('close')` and destroy the upstream read stream to prevent dangling open file descriptors.",
    code: "import { createReadStream } from 'node:fs';\n\nfunction streamFileToResponse(filePath, res) {\n  const fileStream = createReadStream(filePath);\n  fileStream.pipe(res);\n\n  // Client disconnect guard:\n  res.on('close', () => {\n    if (!res.writableEnded) {\n      console.warn('Client disconnected early. Destroying file stream.');\n      fileStream.destroy(); // Releases file descriptor immediately!\n    }\n  });\n}",
    recallHint: "stream.destroy() releases OS file descriptors; hook into res.on('close') to clean up aborted client streams.",
    interviewTip: "Demonstrating defensive cleanup when clients cancel downloads separates senior engineers from juniors.",
    tags: ["destroy", "cleanup", "file-descriptors", "client-disconnect"]
  }),

  makeItem({
    idNum: 44,
    category,
    concept: "Readable.from() & Streamifying Iterables",
    priority: "good-to-know",
    difficulty: "Intermediate",
    question: "How does Readable.from() convert arrays, async iterables, and generator functions into streams?",
    quickAnswer: "Readable.from() constructs a Readable stream that iterates over an async or sync iterable, pausing on backpressure automatically.",
    answer: "`Readable.from(iterable, [options])` is a utility method introduced in Node.js 12+ that creates a Readable stream from any synchronous iterable (Array, Set, Map) or asynchronous iterable (Async Generator). It handles reading values sequentially and automatically respects downstream backpressure.",
    explanation: "This allows developers to convert database cursors, arrays of objects, or API pagination generators directly into streams that can be piped into CSV serializers or HTTP response bodies.",
    code: "import { Readable } from 'node:stream';\n\nasync function* generateTransactions() {\n  for (let i = 1; i <= 1000; i++) {\n    yield JSON.stringify({ id: i, amount: Math.random() * 100 }) + '\\n';\n  }\n}\n\n// Create stream from async generator:\nconst transactionStream = Readable.from(generateTransactions());\ntransactionStream.pipe(process.stdout);",
    recallHint: "Readable.from(iterable) converts arrays and async generators directly into backpressure-aware streams.",
    interviewTip: "Show how Readable.from connects async database pagination directly to streaming HTTP response pipelines.",
    tags: ["readable-from", "async-generators", "iterables", "streams"]
  })
];

module.exports = items;
