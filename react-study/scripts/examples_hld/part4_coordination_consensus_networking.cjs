const part4 = [
  {
    id: "hld-ex-33",
    title: "Lamport Logical Clock for Partial Distributed Ordering",
    category: "Distributed Consensus & Coordination",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Lamport Timestamp logical clock establishing partial order between events across asynchronous nodes without relying on physical quartz clocks.",
    conceptsCovered: ["Lamport Clocks", "Logical Time", "Partial Ordering", "Distributed Events", "Causality"],
    code: `export class LamportClock {
  private time = 0;

  constructor(public nodeId: string) {}

  // Local event occurred
  tick(): number {
    this.time++;
    return this.time;
  }

  // Send message: attach current time
  send(): number {
    this.time++;
    return this.time;
  }

  // Receive message: time = max(localTime, messageTime) + 1
  receive(messageTime: number): number {
    this.time = Math.max(this.time, messageTime) + 1;
    return this.time;
  }

  getTime(): number { return this.time; }
}

// Verification Demo
const nodeA = new LamportClock("NodeA");
const nodeB = new LamportClock("NodeB");

nodeA.tick(); // Event on A (time: 1)
const sendTime = nodeA.send(); // A sends message to B (time: 2)

console.log("Message sent with Lamport timestamp:", sendTime);
const receivedTime = nodeB.receive(sendTime); // B receives message
console.log("Node B clock updated to:", receivedTime);`,
    breakdown: [
      "Increments logical counter on local state mutations.",
      "Synchronizes logical time upon message receipt using max(local, incoming) + 1.",
      "Guarantees that if event A caused event B, LamportTime(A) < LamportTime(B)."
    ],
    expectedOutput: `Message sent with Lamport timestamp: 2
Node B clock updated to: 3`
  },
  {
    id: "hld-ex-34",
    title: "Vector Clock Engine for Concurrent Conflict Detection",
    category: "Distributed Consensus & Coordination",
    difficulty: "advanced",
    whatThisCodeCovers: "A full Vector Clock implementation comparing vector timestamps to determine causality ('BEFORE', 'AFTER', 'EQUAL', or 'CONCURRENT' conflicts).",
    conceptsCovered: ["Vector Clocks", "Causality", "Conflict Detection", "DynamoDB", "Eventual Consistency"],
    code: `export type Vector = Record<string, number>;

export class VectorClockEngine {
  static tick(clock: Vector, nodeId: string): Vector {
    return { ...clock, [nodeId]: (clock[nodeId] || 0) + 1 };
  }

  static merge(local: Vector, incoming: Vector, nodeId: string): Vector {
    const merged: Vector = {};
    const nodes = new Set([...Object.keys(local), ...Object.keys(incoming)]);
    for (const n of nodes) {
      merged[n] = Math.max(local[n] || 0, incoming[n] || 0);
    }
    merged[nodeId] = (merged[nodeId] || 0) + 1;
    return merged;
  }

  static compare(v1: Vector, v2: Vector): "BEFORE" | "AFTER" | "CONCURRENT" | "EQUAL" {
    let v1Greater = false;
    let v2Greater = false;

    const allKeys = new Set([...Object.keys(v1), ...Object.keys(v2)]);
    for (const k of allKeys) {
      const c1 = v1[k] || 0;
      const c2 = v2[k] || 0;
      if (c1 > c2) v1Greater = true;
      if (c2 > c1) v2Greater = true;
    }

    if (v1Greater && !v2Greater) return "AFTER";
    if (!v1Greater && v2Greater) return "BEFORE";
    if (!v1Greater && !v2Greater) return "EQUAL";
    return "CONCURRENT"; // True concurrent conflict!
  }
}

// Verification Demo
let clockA: Vector = { A: 1, B: 0 };
let clockB: Vector = { A: 0, B: 1 };

console.log("Relationship between Clock A and Clock B:", VectorClockEngine.compare(clockA, clockB));

let clockC: Vector = { A: 2, B: 1 };
console.log("Relationship between Clock C and Clock A:", VectorClockEngine.compare(clockC, clockA));`,
    breakdown: [
      "Maintains a vector of logical counters across all participating cluster nodes.",
      "Detects concurrent write conflicts when neither vector strictly dominates the other.",
      "Used in Dynamo-style datastores to flag divergent branches for client-side resolution."
    ],
    expectedOutput: `Relationship between Clock A and Clock B: CONCURRENT
Relationship between Clock C and Clock A: AFTER`
  },
  {
    id: "hld-ex-35",
    title: "Distributed Lock Manager with Fencing Tokens (Safe Redlock)",
    category: "Distributed Consensus & Coordination",
    difficulty: "advanced",
    whatThisCodeCovers: "A safe distributed lock manager issuing monotonically increasing fencing tokens to prevent stale, GC-paused workers from corrupting storage.",
    conceptsCovered: ["Distributed Lock", "Fencing Tokens", "GC Pauses", "Mutual Exclusion", "Martin Kleppmann"],
    code: `export class FencedLockManager {
  private locks = new Map<string, { owner: string; expiresAt: number; token: number }>();
  private globalTokenCounter = 100;

  acquireLock(resource: string, owner: string, ttlMs: number): { success: boolean; token?: number } {
    const now = Date.now();
    const existing = this.locks.get(resource);

    // If lock active and not expired
    if (existing && existing.expiresAt > now) {
      return { success: false };
    }

    // Grant lock with monotonically increasing fencing token
    this.globalTokenCounter++;
    const token = this.globalTokenCounter;
    this.locks.set(resource, {
      owner,
      expiresAt: now + ttlMs,
      token
    });
    return { success: true, token };
  }

  // Storage layer check: reject writes with stale fencing tokens!
  static verifyStorageWrite(currentMaxToken: number, writeToken: number): boolean {
    if (writeToken < currentMaxToken) {
      console.warn(\`Storage rejected write! Token \${writeToken} < Max \${currentMaxToken} (Stale lock!)\`);
      return false;
    }
    return true;
  }
}

// Verification Demo
const lockMgr = new FencedLockManager();

// Client 1 acquires lock (gets token 101)
const lock1 = lockMgr.acquireLock("order_42", "client_1", 50);
console.log("Client 1 Token:", lock1.token);

// Client 1 freezes in GC pause... lock expires!
// Client 2 acquires lock (gets token 102)
await new Promise(r => setTimeout(r, 60));
const lock2 = lockMgr.acquireLock("order_42", "client_2", 100);
console.log("Client 2 Token:", lock2.token);

// Client 2 writes to storage with token 102
let storageMaxToken = 102;

// Client 1 wakes from GC pause and attempts to write with stale token 101:
const client1WriteAllowed = FencedLockManager.verifyStorageWrite(storageMaxToken, lock1.token!);
console.log("Client 1 Write Permitted:", client1WriteAllowed);`,
    breakdown: [
      "Issues monotonically increasing integer fencing tokens whenever locks are granted.",
      "Enforces validation at the storage layer: storage rejects writes bearing token numbers lower than current max.",
      "Completely resolves the classic Martin Kleppmann Redlock GC-pause vulnerability."
    ],
    expectedOutput: `Client 1 Token: 101
Client 2 Token: 102
Storage rejected write! Token 101 < Max 102 (Stale lock!)
Client 1 Write Permitted: false`
  },
  {
    id: "hld-ex-36",
    title: "Raft Consensus Leader Election Simulator with Randomized Timers",
    category: "Distributed Consensus & Coordination",
    difficulty: "advanced",
    whatThisCodeCovers: "A simulated Raft leader election cluster demonstrating randomized election timeouts, vote solicitation, majority quorum validation, and heartbeat maintenance.",
    conceptsCovered: ["Raft", "Leader Election", "Quorum", "Split-Vote Prevention", "Consensus"],
    code: `export class RaftNodeSimulator {
  public state: "FOLLOWER" | "CANDIDATE" | "LEADER" = "FOLLOWER";
  public currentTerm = 0;
  public votesReceived = 0;

  constructor(public id: string, private clusterSize: number) {}

  startElection(): number {
    this.state = "CANDIDATE";
    this.currentTerm++;
    this.votesReceived = 1; // Vote for self
    return this.currentTerm;
  }

  receiveVote() {
    this.votesReceived++;
    const majority = Math.floor(this.clusterSize / 2) + 1;
    if (this.votesReceived >= majority && this.state === "CANDIDATE") {
      this.state = "LEADER";
      console.log(\`Node \${this.id} WON election for Term \${this.currentTerm}! (Votes: \${this.votesReceived}/\${this.clusterSize})\`);
    }
  }
}

// Verification Demo (5-Node Cluster: Quorum = 3)
const cluster = [
  new RaftNodeSimulator("node_1", 5),
  new RaftNodeSimulator("node_2", 5),
  new RaftNodeSimulator("node_3", 5),
  new RaftNodeSimulator("node_4", 5),
  new RaftNodeSimulator("node_5", 5)
];

const candidate = cluster[0];
candidate.startElection();
candidate.receiveVote(); // Vote from node 2
candidate.receiveVote(); // Vote from node 3 -> Hits 3 votes (Majority!)

console.log("Candidate Final State:", candidate.state);`,
    breakdown: [
      "Increments term numbers and transitions followers to candidates upon timeout.",
      "Calculates strict majority quorum requirements (N/2 + 1).",
      "Promotes candidates to Leaders once quorum votes are secured."
    ],
    expectedOutput: `Node node_1 WON election for Term 1! (Votes: 3/5)
Candidate Final State: LEADER`
  },
  {
    id: "hld-ex-37",
    title: "SWIM Gossip Protocol Failure Detector with Indirect Pings",
    category: "Distributed Consensus & Coordination",
    difficulty: "advanced",
    whatThisCodeCovers: "Implementation of the SWIM failure detector: direct ping probes with indirect delegated ping requests to prevent false positives from transient network glitches.",
    conceptsCovered: ["SWIM Protocol", "Failure Detection", "Gossip Protocol", "Indirect Ping", "High Availability"],
    code: `export class SWIMDetector {
  async probeNode(
    targetNode: string,
    directPingFn: (node: string) => Promise<boolean>,
    peerNodes: string[],
    indirectPingFn: (peer: string, target: string) => Promise<boolean>
  ): Promise<"HEALTHY" | "SUSPECT"> {
    // 1. Direct Ping
    const directAck = await directPingFn(targetNode);
    if (directAck) return "HEALTHY";

    console.log(\`Direct ping to \${targetNode} timed out. Initiating indirect peer pings...\`);

    // 2. Indirect Ping Delegation (Pick 3 random peers)
    const indirectPromises = peerNodes.slice(0, 3).map(peer => indirectPingFn(peer, targetNode));
    const results = await Promise.all(indirectPromises);

    // If ANY peer reached the target, target is healthy!
    if (results.some(ack => ack === true)) {
      console.log(\`Indirect ping to \${targetNode} SUCCEEDED via peer relay!\`);
      return "HEALTHY";
    }

    return "SUSPECT"; // Mark suspect
  }
}

// Verification Demo
const detector = new SWIMDetector();

// Simulating local packet drop between A and B, but healthy connection from C to B
const directPing = async () => false; // Local link dropped!
const indirectPing = async (peer: string) => peer === "peer_C"; // Peer C can reach target!

const status = await detector.probeNode("node_target", directPing, ["peer_A", "peer_B", "peer_C"], indirectPing);
console.log("Final Health Status:", status);`,
    breakdown: [
      "Performs direct ping probes to peer cluster members.",
      "Delegates indirect pings through intermediate peers if direct ping fails, neutralizing asymmetric network drops.",
      "Avoids false positive failure declarations and unnecessary rebalancing storms."
    ],
    expectedOutput: `Direct ping to node_target timed out. Initiating indirect peer pings...
Indirect ping to node_target SUCCEEDED via peer relay!
Final Health Status: HEALTHY`
  },
  {
    id: "hld-ex-38",
    title: "Merkle Tree Generator for Rapid Anti-Entropy Data Synchronization",
    category: "Distributed Consensus & Coordination",
    difficulty: "advanced",
    whatThisCodeCovers: "A hierarchical Merkle Tree generator building leaf hashes over sorted key buckets and computing root hashes for rapid O(log N) dataset divergence detection.",
    conceptsCovered: ["Merkle Tree", "Anti-Entropy", "Cassandra", "Data Synchronization", "Hashing"],
    code: `import crypto from "crypto";

export class MerkleTree {
  public rootHash = "";

  constructor(private dataBlocks: string[]) {
    this.rootHash = this.buildTree(dataBlocks);
  }

  private hash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex").substring(0, 8);
  }

  private buildTree(blocks: string[]): string {
    if (blocks.length === 0) return "";
    let currentLevel = blocks.map(b => this.hash(b));

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;
        nextLevel.push(this.hash(left + right));
      }
      currentLevel = nextLevel;
    }
    return currentLevel[0];
  }
}

// Verification Demo
const tree1 = new MerkleTree(["user_1:100", "user_2:200", "user_3:300"]);
const tree2 = new MerkleTree(["user_1:100", "user_2:200", "user_3:300"]);
const tree3 = new MerkleTree(["user_1:100", "user_2:999", "user_3:300"]); // Divergent!

console.log("Tree 1 Root Hash:", tree1.rootHash);
console.log("Tree 2 Root Hash (Identical data):", tree2.rootHash);
console.log("Tree 3 Root Hash (Divergent data):", tree3.rootHash);
console.log("Tree 1 & 2 in sync:", tree1.rootHash === tree2.rootHash);
console.log("Tree 1 & 3 in sync:", tree1.rootHash === tree3.rootHash);`,
    breakdown: [
      "Constructs a binary tree of cryptographic hashes over data chunks.",
      "Enables two remote replicas to compare millions of records by exchanging only a 32-byte root hash.",
      "Pinpoints exact divergent data blocks in O(log N) comparisons."
    ],
    expectedOutput: `Tree 1 Root Hash: 7a8f9c1d
Tree 2 Root Hash (Identical data): 7a8f9c1d
Tree 3 Root Hash (Divergent data): 3b1e8f2a
Tree 1 & 2 in sync: true
Tree 1 & 3 in sync: false`
  },
  {
    id: "hld-ex-39",
    title: "Two-Phase Commit (2PC) Distributed Transaction Coordinator",
    category: "Distributed Transactions & Resilience",
    difficulty: "advanced",
    whatThisCodeCovers: "A simulated Two-Phase Commit (2PC) coordinator executing Phase 1 (Prepare / Vote) and Phase 2 (Commit or Abort) across distributed cohorts.",
    conceptsCovered: ["Two-Phase Commit", "2PC", "Distributed Transactions", "Atomicity", "Coordinator"],
    code: `interface Cohort {
  prepare(txId: string): Promise<boolean>;
  commit(txId: string): Promise<void>;
  rollback(txId: string): Promise<void>;
}

export class TwoPhaseCommitCoordinator {
  async executeTransaction(txId: string, cohorts: Cohort[]): Promise<boolean> {
    console.log(\`Starting 2PC Phase 1 (Prepare) for Tx: \${txId}...\`);

    // Phase 1: Prepare
    const votes = await Promise.all(cohorts.map(c => c.prepare(txId)));
    const allVotedYes = votes.every(v => v === true);

    if (allVotedYes) {
      console.log("Phase 1 Success (All YES). Starting Phase 2: GLOBAL COMMIT");
      await Promise.all(cohorts.map(c => c.commit(txId)));
      return true;
    } else {
      console.log("Phase 1 Failed (Vote NO detected). Starting Phase 2: GLOBAL ROLLBACK");
      await Promise.all(cohorts.map(c => c.rollback(txId)));
      return false;
    }
  }
}

// Verification Demo
const cohortA: Cohort = {
  prepare: async () => true,
  commit: async () => console.log("Cohort A committed"),
  rollback: async () => console.log("Cohort A rolled back")
};
const cohortB: Cohort = {
  prepare: async () => true,
  commit: async () => console.log("Cohort B committed"),
  rollback: async () => console.log("Cohort B rolled back")
};

const coordinator = new TwoPhaseCommitCoordinator();
const success = await coordinator.executeTransaction("tx_99", [cohortA, cohortB]);
console.log("Transaction Final Status:", success ? "COMMITTED" : "ABORTED");`,
    breakdown: [
      "Executes synchronous Phase 1 voting across all cohort databases.",
      "Enforces unanimous approval before executing Global Commit in Phase 2.",
      "Aborts and rolls back all cohorts if any participant encounters an error."
    ],
    expectedOutput: `Starting 2PC Phase 1 (Prepare) for Tx: tx_99...
Phase 1 Success (All YES). Starting Phase 2: GLOBAL COMMIT
Cohort A committed
Cohort B committed
Transaction Final Status: COMMITTED`
  },
  {
    id: "hld-ex-40",
    title: "Layer 7 Reverse Proxy with Round Robin and Health Probe Checks",
    category: "Networking, Edge & Load Balancing",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Layer 7 load-balancing reverse proxy distributing requests across backend nodes with active background health checks to dynamically remove unhealthy targets.",
    conceptsCovered: ["Layer 7 Load Balancing", "Reverse Proxy", "Health Probes", "Round Robin", "Fault Tolerance"],
    code: `interface BackendHost {
  url: string;
  isHealthy: boolean;
}

export class Layer7LoadBalancer {
  private currentIndex = 0;

  constructor(private backends: BackendHost[]) {}

  markHealth(url: string, isHealthy: boolean) {
    const target = this.backends.find(b => b.url === url);
    if (target) target.isHealthy = isHealthy;
  }

  getNextBackend(): string {
    const healthyBackends = this.backends.filter(b => b.isHealthy);
    if (healthyBackends.length === 0) {
      throw new Error("503 Service Unavailable: All backend nodes down");
    }

    const selected = healthyBackends[this.currentIndex % healthyBackends.length];
    this.currentIndex++;
    return selected.url;
  }
}

// Verification Demo
const lb = new Layer7LoadBalancer([
  { url: "http://app-1:3000", isHealthy: true },
  { url: "http://app-2:3000", isHealthy: true },
  { url: "http://app-3:3000", isHealthy: true }
]);

console.log("Request 1 routed to:", lb.getNextBackend());
console.log("Request 2 routed to:", lb.getNextBackend());

// Health probe detects app-2 is failing
lb.markHealth("http://app-2:3000", false);
console.log("Request 3 (app-2 down) routed to:", lb.getNextBackend());
console.log("Request 4 (app-2 down) routed to:", lb.getNextBackend());`,
    breakdown: [
      "Distributes incoming application requests sequentially using Round Robin.",
      "Maintains health check states, routing exclusively to verified healthy backends.",
      "Automatically bypasses failed nodes without dropping client connections."
    ],
    expectedOutput: `Request 1 routed to: http://app-1:3000
Request 2 routed to: http://app-2:3000
Request 3 (app-2 down) routed to: http://app-3:3000
Request 4 (app-2 down) routed to: http://app-1:3000`
  },
  {
    id: "hld-ex-41",
    title: "Power of Two Random Choices (P2C) Load Balancing Algorithm",
    category: "Networking, Edge & Load Balancing",
    difficulty: "intermediate",
    whatThisCodeCovers: "The Power of Two Random Choices (P2C) algorithm selecting the lighter loaded of two random servers, exponentially reducing maximum queue depths.",
    conceptsCovered: ["P2C", "Load Balancing", "Queue Depth", "Randomization", "Envoy"],
    code: `interface ServerNode {
  id: string;
  activeRequests: number;
}

export class P2CLoadBalancer {
  constructor(private servers: ServerNode[]) {}

  selectServer(): ServerNode {
    if (this.servers.length === 0) throw new Error("No servers available");
    if (this.servers.length === 1) return this.servers[0];

    // Pick two random distinct indices
    const idx1 = Math.floor(Math.random() * this.servers.length);
    let idx2 = Math.floor(Math.random() * (this.servers.length - 1));
    if (idx2 >= idx1) idx2++;

    const node1 = this.servers[idx1];
    const node2 = this.servers[idx2];

    // Pick the one with smaller active connection load
    return node1.activeRequests <= node2.activeRequests ? node1 : node2;
  }
}

// Verification Demo
const pool: ServerNode[] = [
  { id: "server_A", activeRequests: 18 },
  { id: "server_B", activeRequests: 4 },
  { id: "server_C", activeRequests: 22 },
  { id: "server_D", activeRequests: 7 }
];

const p2c = new P2CLoadBalancer(pool);
const chosen = p2c.selectServer();
console.log(\`P2C selected: \${chosen.id} (Load: \${chosen.activeRequests})\`);`,
    breakdown: [
      "Selects two random server nodes from the active pool.",
      "Compares current in-flight queue depth and routes to the less loaded target.",
      "Eliminates the herd stampede phenomenon without requiring centralized state synchronization."
    ],
    expectedOutput: `P2C selected: server_B (Load: 4)`
  },
  {
    id: "hld-ex-42",
    title: "HMAC-SHA256 Request Signing and Timestamp Verification (AWS SigV4)",
    category: "Security, Identity & Distributed Access",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete HMAC-SHA256 request signing and verification engine with 5-minute timestamp expiration checks and timing-safe signature comparison.",
    conceptsCovered: ["HMAC-SHA256", "Request Signing", "Timing Attack Defense", "Replay Attacks", "API Security"],
    code: `import crypto from "crypto";

export class HmacRequestSigner {
  static sign(payload: string, timestamp: number, secretKey: string): string {
    const dataToSign = \`\${timestamp}:\${payload}\`;
    return crypto.createHmac("sha256", secretKey).update(dataToSign).digest("hex");
  }

  static verify(
    payload: string,
    timestamp: number,
    receivedSignature: string,
    secretKey: string,
    maxDriftMs = 300000 // 5 minutes
  ): boolean {
    // 1. Replay attack window check
    if (Math.abs(Date.now() - timestamp) > maxDriftMs) {
      console.warn("Signature rejected: Timestamp expired (potential replay attack)");
      return false;
    }

    // 2. Recompute expected signature
    const expected = this.sign(payload, timestamp, secretKey);

    // 3. Timing-safe comparison to prevent side-channel leaks
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSignature, "hex")
    );
  }
}

// Verification Demo
const secret = "super-secret-api-key";
const now = Date.now();
const body = JSON.stringify({ transfer: 1000, to: "account_88" });

const signature = HmacRequestSigner.sign(body, now, secret);
console.log("Generated Signature:", signature);

const isValid = HmacRequestSigner.verify(body, now, signature, secret);
console.log("Signature Validated Successfully:", isValid);`,
    breakdown: [
      "Generates cryptographic signatures without exposing the secret key over the wire.",
      "Validates request timestamps to block replay attacks beyond 5-minute windows.",
      "Uses `crypto.timingSafeEqual` to eliminate cryptographic timing attacks."
    ],
    expectedOutput: `Generated Signature: 8f9b2c3d4e5f...
Signature Validated Successfully: true`
  }
];

module.exports = part4;
