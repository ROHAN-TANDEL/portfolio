const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 61,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Distributed Clocks: Physical Clocks, NTP Drift, Lamport Timestamps & Vector Clocks",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why can physical wall-clock timestamps never establish causal ordering in distributed systems, and how do Lamport Timestamps and Vector Clocks track causality?",
    answer: "Physical quartz clocks suffer from hardware drift and non-monotonic NTP jumps, meaning a write that occurred physically earlier can receive a lower timestamp on another node; relying on physical time causes silent data corruption. Lamport Timestamps provide a scalar logical clock for partial ordering, while Vector Clocks maintain an array of clocks per node to detect concurrent conflicting writes.",
    explanation: `The Physical Clock Trap:
- Computer quartz clocks drift by 17 seconds per day due to thermal variations.
- Network Time Protocol (NTP) synchronizes clocks over the internet, but network latency causes offsets (typically 10ms–100ms error margins).
- When NTP steps backward (clock slew or step), a write at 12:00:00.500 might receive a timestamp of 12:00:00.400.
- In Cassandra/DynamoDB with Last-Write-Wins (LWW), an older update can silently overwrite a newer update because of clock drift!

Logical Clocks to the Rescue:
1. Lamport Timestamps (Leslie Lamport, 1978):
   - Each process maintains an integer counter $C$.
   - On local event: $C = C + 1$.
   - On message send: attach $C$.
   - On message receive with timestamp $C_{\\text{msg}}$: $C = \\max(C, C_{\\text{msg}}) + 1$.
   - Property: If event $A$ caused event $B$ ($A \\to B$), then $L(A) < L(B)$.
   - Limitation: If $L(A) < L(B)$, you cannot know whether $A$ caused $B$ or if they were concurrent.
2. Vector Clocks (Full Causal Tracking):
   - Vector of size $N$ (number of nodes): $V = [c_1, c_2, \\dots, c_N]$.
   - $V_A < V_B$ if every element in $V_A \\le V_B$ and at least one is strictly less.
   - If neither $V_A \\le V_B$ nor $V_B \\le V_A$, the events are **concurrent**! The system flags a write conflict to be resolved by the application.`,
    code: `// Vector Clock Implementation in TypeScript
type VectorClock = Record<string, number>;

function tick(clock: VectorClock, nodeId: string): VectorClock {
  return { ...clock, [nodeId]: (clock[nodeId] || 0) + 1 };
}

function merge(local: VectorClock, incoming: VectorClock, nodeId: string): VectorClock {
  const merged: VectorClock = {};
  const allNodes = new Set([...Object.keys(local), ...Object.keys(incoming)]);
  for (const n of allNodes) {
    merged[n] = Math.max(local[n] || 0, incoming[n] || 0);
  }
  merged[nodeId] = (merged[nodeId] || 0) + 1;
  return merged;
}

function compare(v1: VectorClock, v2: VectorClock): "BEFORE" | "AFTER" | "CONCURRENT" | "EQUAL" {
  let v1Greater = false, v2Greater = false;
  const nodes = new Set([...Object.keys(v1), ...Object.keys(v2)]);
  for (const n of nodes) {
    const c1 = v1[n] || 0, c2 = v2[n] || 0;
    if (c1 > c2) v1Greater = true;
    if (c2 > c1) v2Greater = true;
  }
  if (v1Greater && !v2Greater) return "AFTER";
  if (!v1Greater && v2Greater) return "BEFORE";
  if (!v1Greater && !v2Greater) return "EQUAL";
  return "CONCURRENT"; // Conflict detected!
}`,
    recallHint: "Physical clocks drift (NTP lies). Lamport = single number order. Vector clocks = detect concurrent conflicts.",
    interviewTip: "Never use physical timestamps (`Date.now()`) for distributed conflict resolution unless you have Google Spanner's hardware atomic clocks (TrueTime). Recommend Vector Clocks or CRDTs.",
    tags: ["distributed-clocks", "vector-clocks", "lamport-timestamps", "ntp-drift", "concurrency"]
  }),

  createCard({
    idNum: 62,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Google TrueTime API & Hybrid Logical Clocks (HLC)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Google Spanner's TrueTime API bound clock uncertainty ($\pm \epsilon$) using atomic clocks and GPS, and how do Hybrid Logical Clocks (HLC) achieve similar ordering without specialized hardware?",
    answer: "Google TrueTime returns time as an interval $[t.\\text{earliest}, t.\\text{latest}]$ with guaranteed bounded uncertainty $\\pm \\epsilon$ (typically $< 7\\text{ms}$) via synchronized GPS receivers and atomic clocks; Spanner waits out the uncertainty interval (Commit Wait) to guarantee external consistency (linearizability). Hybrid Logical Clocks (HLC) combine physical NTP time with logical Lamport counters to provide monotonic causal ordering on commodity hardware.",
    explanation: `Google TrueTime Mechanics:
- TrueTime exposes \`TT.now()\`: returns $[t - \\epsilon, t + \\epsilon]$.
- Hardware: Every Spanner data center has master machines equipped with GPS antennas and atomic rubidium clocks. Even if GPS fails, atomic clocks drift less than 1 microsecond per day.
- Commit Wait (The Linearizability Secret):
  - When transaction $T_1$ writes at timestamp $s$:
  - The coordinator waits until \`TT.now().earliest > s\` before releasing locks and acknowledging to the client.
  - Guaranteed Result: Any transaction $T_2$ that starts after $T_1$ finishes is guaranteed to receive a timestamp $s_2 > s_1$.
  - Delivers global linearizable ACID transactions across continents without cross-region locks!

Hybrid Logical Clocks (HLC - CockroachDB / MongoDB):
- Most companies cannot afford atomic clocks in every rack.
- HLC maintains a tuple: $(l, c)$, where $l$ is the highest physical NTP time observed, and $c$ is a logical counter for events sharing the same physical millisecond.
- If physical clock jumps backward, $l$ remains high and $c$ increments monotonically.
- Combines the causality tracking of Lamport clocks with the human-readable physical time bounds of NTP.`,
    code: `/*
Spanner TrueTime Commit Wait Protocol:
T1 starts: Coordinator chooses commit timestamp s = TT.now().latest (e.g., 1007ms)
           TrueTime interval is [993ms .. 1007ms] (epsilon = 7ms)

Wait-Out-The-Uncertainty:
Coordinator sleeps until TT.now().earliest > 1007ms (sleeps ~14ms)
Commit acknowledged!
Result: Any subsequent T2 on any node anywhere in the world will get timestamp >= 1008ms!
*/`,
    recallHint: "TrueTime: Bounded uncertainty [t-e, t+e]; sleep out the error for linearizability. HLC: NTP physical + logical counter.",
    interviewTip: "When discussing global distributed ACID transactions, contrast Google Spanner's hardware TrueTime with CockroachDB's software Hybrid Logical Clocks (HLC).",
    tags: ["truetime", "spanner", "hlc", "consensus", "linearizability", "cockroachdb"]
  }),

  createCard({
    idNum: 63,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Raft Consensus Protocol: Leader Election, Log Replication & Safety",
    priority: "must-know",
    difficulty: "must-know",
    question: "Walk through the three subproblems of the Raft consensus protocol: Leader Election, Log Replication, and Safety invariants.",
    answer: "Raft decomposes consensus into: (1) Leader Election (randomized election timers elect a single leader per term via majority quorum votes); (2) Log Replication (leader appends client commands, replicates them to followers via AppendEntries RPCs, and commits upon majority ack); and (3) Safety (a candidate can only be elected if its log is at least as up-to-date as any majority member, ensuring committed entries are never overwritten).",
    explanation: `Raft Consensus Mechanics (Ongaro & Ousterhout):
A cluster typically consists of $2F + 1$ nodes (e.g., 5 nodes) to tolerate $F$ (2) node failures.

1. Leader Election:
   - Nodes exist in one of three states: \`Follower\`, \`Candidate\`, or \`Leader\`.
   - Followers reset an election timer (randomized between 150ms–300ms) upon receiving heartbeats.
   - If timer expires without heartbeat, node transitions to \`Candidate\`, increments \`currentTerm\`, votes for itself, and broadcasts \`RequestVote\` RPCs.
   - Wins election if it receives votes from a majority of nodes ($> N/2$). Randomized timers prevent split-vote deadlocks.

2. Log Replication:
   - Client sends write command to Leader.
   - Leader appends entry to its local log and sends \`AppendEntries\` RPCs to all followers.
   - When entry is acknowledged by a majority of followers, Leader commits it to state machine and returns success to client.
   - Leader piggybacks \`leaderCommit\` index in subsequent heartbeats so followers commit locally.

3. Raft Safety Invariants:
   - **Election Restriction**: A follower denies its vote if the candidate's log has a lower term or shorter log length than the follower's own log.
   - **Leader Completeness**: If a log entry is committed in a given term, that entry is guaranteed to be present in the logs of the leaders for all higher terms.`,
    code: `/*
Raft Cluster States & Transitions:

            ┌─── Times out, starts election ───┐
            ▼                                  │
    [ Follower ] ──────────────> [ Candidate ] ─── Receives Majority Votes ───> [ Leader ]
            ▲                          │                                            │
            └── Steps down (higher) ───┴────────── Discovers higher term ───────────┘
*/`,
    recallHint: "Raft = Leader Election (random timers) + Log Replication (majority acks) + Safety (most up-to-date log wins).",
    interviewTip: "Raft powers etcd, Consul, Kafka KRaft, and CockroachDB. Highlight that Raft requires an odd number of nodes ($2F+1$) to guarantee non-overlapping majorities.",
    tags: ["raft", "consensus", "leader-election", "distributed-systems", "etcd", "quorum"]
  }),

  createCard({
    idNum: 64,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Paxos vs Raft Consensus Protocols",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Paxos (Multi-Paxos) and Raft compare in terms of algorithmic complexity, leader dependency, and practical production implementation?",
    answer: "Basic Paxos achieves consensus on a single value through two rounds (Prepare/Promise and Accept/Accepted); Multi-Paxos amortizes the Prepare phase to stream a log of values using a stable leader. Raft is computationally equivalent to Multi-Paxos but formally constrains the design (strong leader, strict in-order log replication, simplified state transitions) to make the protocol understandable and provably implementable.",
    explanation: `Comparative Analysis:
1. Basic Paxos (Leslie Lamport):
   - Phase 1: Proposer sends \`Prepare(n)\`. Acceptors return \`Promise(n, max_accepted_val)\` if $n > \\text{any previous } n$.
   - Phase 2: Proposer sends \`Accept(n, value)\`. Acceptors accept if $n \\ge \\text{promised } n$.
   - Flaw: Single-value consensus. Deciding a log of 1,000,000 entries requires running Phase 1 and Phase 2 repeatedly for every single index.
   - Duel Proposer Livelock: Two proposers alternating higher proposal numbers can preempt each other indefinitely.
2. Multi-Paxos:
   - Amortizes Phase 1: Executes Prepare once to establish a leader. Subsequent writes require only Phase 2 (Accept/Accepted) round trips.
   - Flaw: Lamport's original paper left core implementation details underspecified (cluster membership changes, log compaction, leader election). Every real-world Paxos implementation (Chubby, Spanner) is a custom dialect.
3. Raft:
   - Explicitly designed for understandability.
   - Disallows out-of-order log gaps: Raft logs are strictly sequential without holes, whereas Multi-Paxos permits log entries to be committed out of order.`,
    code: `/*
Consensus Protocol Comparison:
| Feature | Basic Paxos | Multi-Paxos | Raft |
|---|---|---|---|
| Value Target | Single value | Continuous log | Continuous log |
| Leader Model | Symmetric / Any | Stable Proposer | Strong Leader only |
| Log Contiguity | Disjoint / Out-of-order | Out-of-order allowed | Strictly contiguous |
| Implementations | Academic | Spanner, Chubby | etcd, Kafka KRaft, Consul |
*/`,
    recallHint: "Paxos: Foundational but notoriously hard to implement. Raft: Equivalent power, strong leader, easy to build.",
    interviewTip: "Mention that Kafka removed ZooKeeper in favor of KRaft (Kafka Raft Metadata Mode), eliminating external JVM cluster dependencies and enabling 10x faster cluster recovery.",
    tags: ["paxos", "raft", "consensus", "kraft", "zookeeper", "distributed-systems"]
  }),

  createCard({
    idNum: 65,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Distributed Coordination with ZooKeeper & etcd",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What capabilities make Apache ZooKeeper and etcd the backbone of distributed coordination, and how do Ephemeral Nodes and Watches work?",
    answer: "ZooKeeper and etcd provide a strongly consistent, linearizable hierarchical key-value store backed by consensus (ZAB/Raft). They are used for service discovery, leader election, distributed configuration, and distributed locks. Ephemeral Nodes (or leases) automatically delete keys when a client's heartbeat session disconnects; Watches notify clients asynchronously of key changes without polling.",
    explanation: `Core Coordination Primitives:
1. Hierarchical Tree / Key-Value Store:
   - ZooKeeper: Filesystem-like tree of znodes (\`/services/orders/node-1\`).
   - etcd: Flat binary key-value store with range queries and multi-version concurrency control (MVCC).
2. Ephemeral Nodes & Leases:
   - A client connects and creates an Ephemeral Node (or attaches a 5-second TTL Lease in etcd).
   - The client streams periodic keep-alive heartbeats.
   - If the client crashes, network drops, or process dies: heartbeats stop -> TTL expires -> ZooKeeper/etcd automatically deletes the key.
   - This provides the foundation for automatic crash detection and leader failover!
3. Watches (Reactive Event Push):
   - Instead of 1,000 microservice pods polling \`SELECT * FROM config\` every second, clients register a Watch on key \`/config/rate-limit\`.
   - When an administrator modifies the key, etcd/ZooKeeper pushes a compact revision event to all 1,000 connected clients over gRPC streams in milliseconds.`,
    code: `// Distributed Leader Election using etcd3 Leases in Node.js
import { Etcd3 } from "etcd3";
const client = new Etcd3();

async function runLeaderElection(nodeId: string) {
  // Grant a 5-second lease with automated heartbeat refresh
  const lease = client.lease(5);
  const electionKey = "leader/order-service";

  try {
    // Attempt to set key only if it DOES NOT exist (Atomic CAS)
    const success = await client.if(electionKey, "Version", "==", 0)
      .then(client.put(electionKey).value(nodeId).lease(lease))
      .commit();

    if (success) {
      console.log(\`Node \${nodeId} is now the LEADER!\`);
      // Start leader duties...
    } else {
      console.log(\`Node \${nodeId} is a FOLLOWER. Watching leader key...\`);
      // Watch for deletion of leader key to trigger next election
      const watcher = await client.watch().key(electionKey).create();
      watcher.on("delete", () => {
        console.log("Leader crashed! Running for election...");
        runLeaderElection(nodeId);
      });
    }
  } catch (err) {
    console.error("Election error:", err);
  }
}`,
    recallHint: "ZooKeeper/etcd: Consensus-backed key-value store. Leases auto-delete on crash; Watches push updates.",
    interviewTip: "Never use ZooKeeper or etcd for high-throughput bulk data storage (e.g., user profiles). They are strictly meant for low-volume, high-value coordination metadata (cluster topology, schema versions, leader locks).",
    tags: ["zookeeper", "etcd", "coordination", "consensus", "leases", "watches"]
  }),

  createCard({
    idNum: 66,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Distributed Locking Hazards: Redlock, GC Pauses & Fencing Tokens",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why is distributed locking with Redis (Redlock) vulnerable to Garbage Collection (GC) pauses and clock drift, and how do Fencing Tokens mathematically protect storage?",
    answer: "If a client acquires a distributed lock with a TTL, an unexpected Stop-The-World GC pause or network delay can cause the lock's TTL to expire on the cluster while the client is frozen; another client acquires the lock, and both clients execute concurrent conflicting writes. Fencing Tokens (monotonically increasing IDs issued with each lock) solve this by rejecting writes with token numbers lower than the storage tier's latest observed token.",
    explanation: `Martin Kleppmann's Redlock Critique:
1. Client 1 acquires lock \`lock:order_42\` on Redis with a 10-second TTL.
2. Client 1 enters a JVM Stop-The-World Garbage Collection (GC) pause for 15 seconds.
3. While Client 1 is paused, Redis expires the lock lease.
4. Client 2 requests \`lock:order_42\`, successfully acquires it, and starts updating storage.
5. Client 1's GC pause ends. Client 1 assumes it still holds the lock and writes to storage!
6. Data Corruption: Client 1 and Client 2 write simultaneously without mutual exclusion.

The Mathematical Solution: Fencing Tokens:
- Every time a lock is granted, the lock manager (ZooKeeper, etcd, or Redis) issues a monotonically increasing token (e.g., Token 33, 34, 35).
- Storage Tier (Database / Storage Engine) checks the token on every write:
  - If incoming write has \`token >= current_max_token\`: accept write and update \`current_max_token = token\`.
  - If incoming write has \`token < current_max_token\`: reject write immediately with error!
- When paused Client 1 tries to write with Token 33, storage rejects it because Client 2 already committed with Token 34.`,
    code: `/*
Fencing Token Storage Protection:

Client 1                     Lock Manager                Storage (Postgres)
   │                              │                              │
   ├── Acquire Lock ─────────────>│                              │
   │<── Lock Acquired (Token 33) ─┤                              │
   │                              │                              │
 [ 15s GC Pause! Lock Expires ]   │                              │
   │                              │                              │
   │                       Client 2                              │
   │                          ├── Acquire Lock ──>│              │
   │                          │<─ Token 34 ───────┤              │
   │                          ├── Write (Token 34) ─────────────>│ (Accepted: max_token = 34)
   │                              │                              │
 [ GC Pause Ends ]                │                              │
   ├── Write (Token 33) ────────────────────────────────────────>│ (REJECTED: 33 < 34!)
*/`,
    recallHint: "Locks can expire while a process is frozen in GC. Fencing tokens (monotonically increasing IDs) stop stale writes at the storage layer.",
    interviewTip: "Citing Martin Kleppmann's analysis on Redlock vs Fencing Tokens demonstrates the highest tier of distributed systems maturity.",
    tags: ["distributed-locking", "redlock", "fencing-tokens", "gc-pauses", "redis", "concurrency"]
  }),

  createCard({
    idNum: 67,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Quorum Reads & Writes (R + W > N) & Tunable Consistency",
    priority: "must-know",
    difficulty: "must-know",
    question: "Explain the Quorum equations ($R + W > N$) in Dynamo-style databases (Cassandra, DynamoDB). What happens when $R + W \\le N$?",
    answer: "In a cluster with replication factor $N$, strong consistency (linearizability) requires $R + W > N$, where $W$ is the number of replicas that must acknowledge a write and $R$ is the number of replicas queried on a read. This guarantees that the read set and write set overlap by at least one node containing the latest version. If $R + W \\le N$, reads and writes can miss each other, yielding eventual consistency.",
    explanation: `The Pigeonhole Principle of Quorums:
Let $N = 3$ (Each row is stored on 3 distinct replica nodes):
- **Strong Consistency ($R + W > N$)**:
  - Set $W = 2$, $R = 2$ ($2 + 2 = 4 > 3$).
  - Write is written to Node 1 and Node 2.
  - Read queries Node 2 and Node 3.
  - Node 2 is present in both sets! The client compares timestamps/versions from Node 2 and Node 3, selects the latest write from Node 2, and performs Read Repair on Node 3.
- **Eventual Consistency / Fast Low Latency ($R + W \\le N$)**:
  - Set $W = 1$, $R = 1$ ($1 + 1 = 2 \\le 3$).
  - Write succeeds as soon as Node 1 acknowledges.
  - Read queries Node 3. Node 3 has not received the asynchronous background replication yet -> returns stale data!

Quorum Tuning Trade-offs:
- Fast Writes, Slow Reads: $W = 1$, $R = 3$ ($1 + 3 = 4 > 3$).
- Balanced: $W = \\text{QUORUM} (\\lfloor N/2 \\rfloor + 1)$, $R = \\text{QUORUM}$.`,
    code: `/*
Quorum Overlap Visualization (N = 3):
Replicas:      [ Node 1 ]      [ Node 2 ]      [ Node 3 ]
Write (W = 2): [  WRITE ]      [  WRITE ]
Read  (R = 2):                 [   READ ]      [   READ ]
                                     ▲
                       Node 2 is the Guaranteed Overlap!
*/

// Cassandra CQL Tunable Consistency Example
// session.execute(query, { consistency: types.consistencies.quorum });
// session.execute(query, { consistency: types.consistencies.one }); // Latency < 2ms, eventual`,
    recallHint: "W + R > N guarantees overlap (strong consistency). W + R <= N gives eventual consistency with fast speeds.",
    interviewTip: "In Apache Cassandra or DynamoDB, point out that `W=QUORUM, R=QUORUM` tolerates 1 node failure in an $N=3$ cluster without any downtime or consistency degradation.",
    tags: ["quorum", "tunable-consistency", "cassandra", "dynamodb", "replication", "storage"]
  }),

  createCard({
    idNum: 68,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Sloppy Quorum & Hinted Handoff",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Sloppy Quorum and Hinted Handoff in Dynamo-style databases allow writes to succeed even when the designated home replica nodes are completely offline?",
    answer: "Under network partitions, a strict quorum rejects writes if designated replicas are unreachable; a Sloppy Quorum accepts writes onto alternate healthy nodes outside the key's primary hash-ring range. These temporary surrogate nodes store the update as a 'hint' and use Hinted Handoff to deliver the write back to the primary node once it recovers.",
    explanation: `Strict Quorum vs Sloppy Quorum:
In a 9-node ring, suppose Key $K$ hashes to Nodes [A, B, C]:
- Strict Quorum: Writes for $K$ MUST be acknowledged by at least 2 nodes among {A, B, C}. If A and B crash, writes to $K$ fail completely (prefers Consistency over Availability - CP).
- Sloppy Quorum (Amazon Dynamo / Cassandra):
  - If Nodes A and B are unreachable due to a network partition, the coordinator routes the write to healthy surrogate nodes (e.g., Node D and Node E).
  - Nodes D and E accept the write and tag it with a metadata hint: 'This belongs to Node A; hold temporarily.'
  - The client receives a successful write confirmation (prefers Availability over Consistency - AP).

Hinted Handoff Mechanics:
- Node D periodically runs a background gossip check probing the health of Node A.
- As soon as Node A comes back online, Node D streams all buffered hint records back to Node A.
- Once Node A confirms persistent commit to its local commit log, Node D deletes the hints from its local disk.`,
    code: `/*
Sloppy Quorum with Hinted Handoff:

Normal Hash Placement: Key X belongs to [ Node A, Node B, Node C ]

Disaster: Node A and Node B go down!
1. Client sends write for Key X.
2. Coordinator writes to Node C (1st healthy) and Node D (Surrogate).
3. Node D stores: { Key: X, Val: "Data", HintFor: "Node A" }.
4. Node D returns Success to Client!

Recovery:
5. Node A reboots.
6. Node D detects Node A is alive via Gossip protocol.
7. Node D delivers Hinted Handoff to Node A, then deletes local hint.
*/`,
    recallHint: "Sloppy Quorum: Write to neighbors when home nodes are down. Hinted Handoff: Return data when home nodes recover.",
    interviewTip: "Mention that Sloppy Quorums maximize write availability for shopping carts (Amazon Dynamo), but sacrifice read-your-own-writes consistency until hinted handoff completes.",
    tags: ["sloppy-quorum", "hinted-handoff", "dynamo", "cassandra", "availability", "high-availability"]
  }),

  createCard({
    idNum: 69,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Gossip Protocol (Epidemic Routing & SWIM Failure Detection)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Gossip Protocol propagate cluster membership state in $O(\\log N)$ rounds, and how does the SWIM protocol detect node failures without false positives?",
    answer: "The Gossip protocol disseminates cluster state like an epidemic virus: each node periodically picks $k$ random peers and exchanges state digests, achieving complete cluster-wide eventual consistency in $O(\\log N)$ rounds. The SWIM failure detector uses direct ping-acks and indirect ping-request delegations with suspicious-state timeouts to detect node crashes accurately without broadcast storms.",
    explanation: `Why Centralized Heartbeats Fail at 10,000 Nodes:
- If 10,000 nodes send heartbeats to a central coordinator every second: coordinator must process 10,000 req/sec, creating a network bottleneck and SPOF.
- If every node broadcasts heartbeats to all other 9,999 nodes: network experiences an $O(N^2)$ message explosion ($100,000,000$ messages/sec!).

The Gossip Solution ($O(\\log N)$ Epidemic Dissemination):
- Every second, each node randomly selects 3 peers and exchanges cluster membership vectors.
- Information spreads exponentially: 1 -> 3 -> 9 -> 27 -> 81...
- In a cluster of 10,000 nodes, state propagates to every single node in under 14 rounds!

SWIM (Structured Weakly-Consistent Infection-Style Membership):
1. Direct Ping: Node A sends \`ping\` to Node B. If ack received within timeout, Node B is healthy.
2. Indirect Ping: If timeout expires, Node A does NOT declare Node B dead (could be a local routing glitch between A and B).
   - Node A picks 3 random peers (C, D, E) and asks them to ping Node B (\`ping-req(B)\`).
   - If any peer receives an ack from B, Node B is declared healthy.
3. Suspicion Mechanism: If all indirect pings fail, B is marked \`SUSPECT\`. A countdown timer begins. If B does not refute the suspicion within $T_{\\text{suspect}}$, it is declared \`DEAD\` and removed.`,
    code: `/*
SWIM Failure Detector Protocol:

1. Direct Ping:
   Node A ───(ping)───> Node B (Packet drops or network latency!)
   Node A <──(timeout)─

2. Indirect Ping Delegation (Avoid False Positives):
   Node A ───(ping-req: B)───> [ Node C ] ───(ping)───> Node B
                               [ Node C ] <──(ack)──── Node B
   Node A <──(ack from B via C)

Result: Node A avoids falsely marking Node B dead!
*/`,
    recallHint: "Gossip: Random peer gossip spreads state in O(log N). SWIM: Indirect pings stop false failure alarms.",
    interviewTip: "Gossip and SWIM power HashiCorp Consul, Nomad, and Apache Cassandra. Mention SWIM when designing peer-to-peer or large cluster failure detection.",
    tags: ["gossip-protocol", "swim", "failure-detection", "consul", "cassandra", "p2p"]
  }),

  createCard({
    idNum: 70,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Split-Brain Inconsistency & Quorum Resolution",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is Split-Brain syndrome in distributed clusters, and how does the Majority Quorum rule ($N/2 + 1$) mathematically prevent dual-leader data divergence?",
    answer: "Split-Brain occurs when a network partition cuts a cluster into isolated partitions, each believing the other partition is dead and independently electing its own leader; both leaders accept conflicting writes, causing irrecoverable data divergence. The Majority Quorum rule requires a leader to win votes from more than half of the total nodes ($> N/2$), guaranteeing that only one partition can ever form a majority.",
    explanation: `The Split-Brain Disaster Scenario:
Consider a 4-node cluster {A, B, C, D}:
- A network partition splits the cluster into two halves: {A, B} and {C, D}.
- {A, B} cannot communicate with {C, D}.
- {A, B} assumes {C, D} crashed, elects A as leader, and accepts writes for \`balance = 500\`.
- {C, D} assumes {A, B} crashed, elects C as leader, and accepts writes for \`balance = 200\`.
- Both sides modify data. When the network partition heals, the database contains irreconcilable conflicting state.

The Mathematical Prevention (Strict Majority Quorum):
- Total nodes $N$. Quorum size required to elect leader and commit writes:
  $$Q = \\left\\lfloor \\frac{N}{2} \\right\\rfloor + 1$$
- Why clusters always use **ODD node counts** ($3, 5, 7$):
  - In a 5-node cluster, $Q = \\lfloor 5/2 \\rfloor + 1 = 3$.
  - If partitioned into {A, B, C} (3 nodes) and {D, E} (2 nodes):
    - Partition {A, B, C} has 3 nodes $\\ge 3$ -> Forms majority, elects leader, continues processing.
    - Partition {D, E} has 2 nodes $< 3$ -> Cannot reach quorum! Rejects writes, suspends leader, preventing split-brain.
  - Two non-overlapping majorities can NEVER exist simultaneously because $(N/2 + 1) + (N/2 + 1) = N + 2 > N$.`,
    code: `/*
5-Node Cluster Partitioning:

   [ Node 1 ]   [ Node 2 ]   [ Node 3 ]    |   [ Node 4 ]   [ Node 5 ]
   └──────────────┬──────────────┘         |   └───────────┬──────────┘
           3 Nodes (Majority)              |         2 Nodes (Minority)
                   │                       |               │
         Quorum = 3/5 Achieved!            |     Quorum Failed (2 < 3)!
         ELECTS LEADER ✓                   |     READ-ONLY / SHUTDOWN ✗
         ACCEPTS WRITES ✓                  |     REJECTS WRITES ✗
*/`,
    recallHint: "Odd nodes only (3, 5). Majority = N/2 + 1. Two majorities can never physically exist.",
    interviewTip: "Never configure a consensus cluster (Raft, ZooKeeper, etcd) with an even number of nodes (e.g., 4 or 6). Explain that an even number provides zero additional fault tolerance while increasing failure surface.",
    tags: ["split-brain", "quorum", "consensus", "high-availability", "raft", "fault-tolerance"]
  }),

  createCard({
    idNum: 71,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Leaderless Replication Architectures (Dynamo, Cassandra)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Leaderless replication architectures handle client writes and reads, and what mechanisms achieve eventual consistency without a single leader?",
    answer: "In Leaderless replication (Amazon Dynamo, Apache Cassandra), any node can act as a coordinator for any read or write, eliminating leader bottlenecks and failover pauses. Eventual consistency is maintained through three decentralized mechanisms: (1) Quorum Reads/Writes ($W + R > N$), (2) Read Repair (repairing stale replicas during read queries), and (3) Background Anti-Entropy with Merkle Trees.",
    explanation: `Leaderless Read/Write Lifecycle:
1. Write Path:
   - Client sends write to ANY arbitrary node (which acts as Coordinator for that request).
   - Coordinator hashes partition key and forwards write in parallel to all $N$ replica nodes on the ring.
   - Once $W$ replicas reply with success, Coordinator returns success to client.
   - Replicas that were offline miss the write.

2. Read Path & Read Repair:
   - Client queries Coordinator for key.
   - Coordinator queries $R$ replicas in parallel (e.g., requests full data from Node 1, and lightweight cryptographic hashes from Node 2 and Node 3).
   - If hashes match, return data.
   - If hash mismatch detected: Coordinator fetches full records from all replicas, returns the record with highest timestamp to the client, and issues an asynchronous **Read Repair** write to overwrite the stale replica in the background.

3. Anti-Entropy with Merkle Trees:
   - For cold data that is rarely read, Read Repair is never triggered.
   - Replicas exchange hierarchical hash trees (Merkle Trees) in background sweeps.
   - Merkle trees allow replicas to compare millions of keys across the network using a few kilobytes of tree hashes, quickly pinpointing and synchronizing divergent ranges.`,
    code: `/*
Read Repair Sequence in Cassandra:

Client              Coordinator             Replica 1 (v2)        Replica 2 (v1 Stale)
  │                      │                        │                        │
  ├── GET /users/42 ────>│                        │                        │
  │                      ├── Read Data ──────────>│                        │
  │                      ├── Read Digest/Hash ────────────────────────────>│
  │                      │<── Return User (v2) ───┤                        │
  │                      │<── Return Hash (v1) ────────────────────────────┤
  │                      │ (Mismatch detected! v2 > v1)                    │
  │<── Return User (v2) ─┤                                                 │
  │                      ├── Asynchronous Read Repair (Write v2) ─────────>│ (Replica 2 fixed!)
*/`,
    recallHint: "Leaderless: Write to any node. Reconcile via Quorums, Read Repair, and Merkle tree anti-entropy.",
    interviewTip: "Highlight that Leaderless architectures are optimal for write-heavy systems that require 99.999% availability, because writes can succeed even if 1 or 2 nodes in the replica set are dead.",
    tags: ["leaderless-replication", "cassandra", "dynamo", "read-repair", "merkle-trees", "storage"]
  }),

  createCard({
    idNum: 72,
    category: "Distributed Coordination, Consensus & Clocks",
    concept: "Merkle Trees for Anti-Entropy Data Synchronization",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Merkle Trees (Cryptographic Hash Trees) enable distributed replicas to detect and synchronize data differences with minimal network bandwidth?",
    answer: "A Merkle Tree is a binary tree where leaf nodes represent cryptographic hashes of individual data keys, and parent nodes represent hashes of their concatenated children. Replicas compare root hashes: if root hashes match, datasets are 100% identical; if roots differ, replicas traverse down only the divergent branches in $O(\\log N)$ network steps, transmitting only the exact out-of-sync keys.",
    explanation: `The Problem of Naive Synchronization:
- Two database replicas each hold 50,000,000 records.
- To detect if any records diverged over the weekend, a naive comparison would require transmitting all 50M records (50GB of data) over the network.

The Merkle Tree Solution:
- Group keys into range buckets (e.g., keys 0–1000, 1001–2000...).
- Compute hash of each range bucket (Leaf nodes).
- Hash pairs of leaves together to form parents, repeating up to the single Root Hash.

The $O(\\log N)$ Synchronization Exchange:
1. Node A and Node B exchange only their 32-byte Root Hashes.
   - If \`Root_A == Root_B\`: Datasets are identical. Done! (32 bytes transmitted).
2. If \`Root_A != Root_B\`:
   - Node A requests children hashes from Node B (Left child and Right child).
   - If Left child matches, Left subtree is identical (skip 25,000,000 keys!).
   - If Right child differs, traverse down Right child.
3. In a tree of depth 20, exactly 20 hash comparisons pinpoint the single modified key out of 50 million records!`,
    code: `/*
Merkle Tree Structure:

                       [ Root Hash: H(1-4) ]
                                 │
                 ┌───────────────┴───────────────┐
         [ Hash: H(1-2) ]                [ Hash: H(3-4) ]
                 │                               │
         ┌───────┴───────┐               ┌───────┴───────┐
      [ H(1) ]        [ H(2) ]        [ H(3) ]        [ H(4) ]
         │               │               │               │
     Key: 1..10      Key: 11..20     Key: 21..30     Key: 31..40

If Key 25 changes on Node B:
H(3), H(3-4), and Root Hash change.
Nodes compare Root (differs) -> compare children -> pinpoint Hash 3 as sole divergence!
*/`,
    recallHint: "Merkle Tree: Compare roots. If match, done. If differ, binary search down the tree to find mismatched keys.",
    interviewTip: "Merkle trees are the foundational data structure behind Git commits, Bitcoin/Ethereum block validation, Cassandra anti-entropy, and DynamoDB cross-region replication.",
    tags: ["merkle-trees", "anti-entropy", "cryptography", "cassandra", "data-synchronization"]
  })
];

module.exports = cards;
