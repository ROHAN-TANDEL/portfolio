module.exports = [
  {
    id: "docker-ex-12",
    title: "Custom User-Defined Bridge Network with Static IP and Network Aliasing",
    category: "Networking & DNS",
    difficulty: "beginner",
    whatThisCodeCovers: "Creates a dedicated Docker bridge network with defined subnets and gateways, then attaches containers with static IP addresses and custom network aliases for predictable service discovery.",
    conceptsCovered: [
      "docker network create --subnet",
      "Static IP assignment (--ip)",
      "Network aliases (--network-alias)",
      "Automatic DNS resolution",
      "Network isolation"
    ],
    code: `#!/usr/bin/env bash
set -euo pipefail

# 1. Create a custom bridge network with custom subnet & gateway
docker network create \\
  --driver bridge \\
  --subnet 172.28.0.0/16 \\
  --ip-range 172.28.5.0/24 \\
  --gateway 172.28.0.1 \\
  tier-app-net

# 2. Launch database container with static IP and network alias
docker run -d \\
  --name prod-postgres \\
  --network tier-app-net \\
  --ip 172.28.5.10 \\
  --network-alias db.internal \\
  -e POSTGRES_PASSWORD=secret \\
  postgres:16-alpine

# 3. Launch application resolving database via alias
docker run --rm \\
  --network tier-app-net \\
  curlimages/curl:8.7.1 \\
  nslookup db.internal`,
    breakdown: [
      {
        lineRange: "5-10",
        note: "Defines explicit CIDR block 172.28.0.0/16 and restricts DHCP allocation pool to 172.28.5.0/24."
      },
      {
        lineRange: "13-19",
        note: "Assigns static IP 172.28.5.10 and registers 'db.internal' in Docker's 127.0.0.11 embedded DNS server."
      },
      {
        lineRange: "22-25",
        note: "Queries the alias from another container on the same network to verify name resolution."
      }
    ],
    expectedOutput: `Server:    127.0.0.11
Address 1: 127.0.0.11
Name:      db.internal
Address 1: 172.28.5.10 prod-postgres.tier-app-net`
  },
  {
    id: "docker-ex-13",
    title: "High-Throughput Host Network Mode for Low-Latency In-Memory Caches",
    category: "Networking & DNS",
    difficulty: "intermediate",
    whatThisCodeCovers: "Bypasses Docker's virtual bridge and iptables NAT overhead by attaching a high-throughput Redis instance directly to the host's network namespace for maximum packet performance.",
    conceptsCovered: [
      "--network host",
      "Bypassing iptables NAT",
      "Zero network latency overhead",
      "Port conflict implications",
      "High performance networking"
    ],
    code: `# Launch Redis directly on host network interface (Linux)
docker run -d \\
  --name redis-host-net \\
  --network host \\
  --restart unless-stopped \\
  redis:7.2-alpine \\
  redis-server --protected-mode no --port 6379

# Verification: redis-cli connects directly to host 127.0.0.1 without port mapping
redis-cli -p 6379 ping

# Check network namespace identity (Process matches host netns inode)
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' redis-host-net)
ls -l /proc/1/ns/net /proc/\${CONTAINER_PID}/ns/net`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "--network host disables the veth pair. The container shares host interfaces (eth0, lo) directly."
      },
      {
        lineRange: "10-14",
        note: "Inspects network namespace inodes: /proc/1/ns/net and container's ns/net will match identically."
      }
    ],
    expectedOutput: `PONG
lrwxrwxrwx 1 root root 0 net:[4026531992] /proc/1/ns/net
lrwxrwxrwx 1 root root 0 net:[4026531992] /proc/12938/ns/net`
  },
  {
    id: "docker-ex-14",
    title: "Macvlan Network Attaching Containers Directly to Physical Local Area Network",
    category: "Networking & DNS",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures a Macvlan network driver so containers get their own physical MAC addresses and routable IP addresses directly on the corporate or home LAN subnet.",
    conceptsCovered: [
      "docker network create -d macvlan",
      "Parent interface binding (-o parent=eth0)",
      "Dedicated MAC address per container",
      "Promiscuous mode routing",
      "Legacy service integration"
    ],
    code: `#!/usr/bin/env bash
# 1. Create Macvlan network bound to host physical interface (e.g. eth0)
docker network create -d macvlan \\
  --subnet=192.168.1.0/24 \\
  --gateway=192.168.1.1 \\
  --ip-range=192.168.1.192/27 \\
  -o parent=eth0 \\
  lan-macvlan

# 2. Run container with routable LAN IP
docker run -d \\
  --name legacy-telephony \\
  --network lan-macvlan \\
  --ip=192.168.1.195 \\
  --mac-address=02:42:c0:a8:01:c3 \\
  alpine:3.20 sleep 3600

# 3. Test LAN ping from an external machine on 192.168.1.0/24:
# ping 192.168.1.195 (responds directly as physical LAN node!)`,
    breakdown: [
      {
        lineRange: "3-8",
        note: "Binds Docker virtual MAC sub-interfaces directly onto physical parent eth0 with dedicated IP pool."
      },
      {
        lineRange: "11-16",
        note: "Container appears as an independent physical hardware device to external LAN routers and switches."
      }
    ],
    expectedOutput: `$ ping -c 3 192.168.1.195
64 bytes from 192.168.1.195: icmp_seq=1 ttl=64 time=0.412 ms
64 bytes from 192.168.1.195: icmp_seq=2 ttl=64 time=0.380 ms
--- 192.168.1.195 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss`
  },
  {
    id: "docker-ex-15",
    title: "Communicating with Host Services via host.docker.internal Across Linux and Mac",
    category: "Networking & DNS",
    difficulty: "intermediate",
    whatThisCodeCovers: "Enables containers running on both Linux and macOS/Windows to seamlessly access services listening on the developer's host machine (like local databases or mocks) via host.docker.internal.",
    conceptsCovered: [
      "--add-host host.docker.internal:host-gateway",
      "Docker Desktop vs Linux Docker Engine differences",
      "Local developer workflow",
      "Accessing host database ports"
    ],
    code: `# On Linux, host.docker.internal is not added by default.
# Use --add-host to map it to host-gateway dynamically:

docker run --rm -it \\
  --add-host host.docker.internal:host-gateway \\
  curlimages/curl:8.7.1 \\
  http://host.docker.internal:5432

# In docker-compose.yaml:
# services:
#   api:
#     image: my-api:latest
#     extra_hosts:
#       - "host.docker.internal:host-gateway"
#     environment:
#       - DB_HOST=host.docker.internal`,
    breakdown: [
      {
        lineRange: "4-7",
        note: "--add-host dynamically resolves the host's docker0 bridge IP (e.g. 172.17.0.1) inside Linux containers."
      },
      {
        lineRange: "10-16",
        note: "Compose extra_hosts configures the DNS entry across all developer workstations cross-platform."
      }
    ],
    expectedOutput: `* Trying 172.17.0.1:5432...
* Connected to host.docker.internal (172.17.0.1) port 5432
* Connection established to host database!`
  },
  {
    id: "docker-ex-16",
    title: "Multi-Host Overlay Network with IPSec Encryption across Distributed Daemons",
    category: "Networking & DNS",
    difficulty: "advanced",
    whatThisCodeCovers: "Initializes a Docker Swarm manager and creates an encrypted multi-host overlay network using AES-GCM IPSec encapsulation to protect inter-container traffic across physical data centers.",
    conceptsCovered: [
      "docker network create -d overlay",
      "--opt encrypted (IPSec ESP)",
      "VXLAN encapsulation (UDP 4789)",
      "Overlay mesh routing",
      "Multi-host cross-node security"
    ],
    code: `#!/usr/bin/env bash
# 1. Initialize Swarm control plane
docker swarm init --advertise-addr 192.168.10.50

# 2. Create secure encrypted overlay network
docker network create \\
  --driver overlay \\
  --opt encrypted \\
  --subnet 10.0.9.0/24 \\
  --attachable \\
  secure-payment-mesh

# 3. Attach services across multiple physical worker nodes
docker service create \\
  --name order-processor \\
  --network secure-payment-mesh \\
  --replicas 4 \\
  payment-service:v2.1

# All traffic between workers on UDP 4789 is encrypted via kernel IPSec!`,
    breakdown: [
      {
        lineRange: "2-3",
        note: "Initializes swarm cluster to enable the gossip protocol and distributed service discovery."
      },
      {
        lineRange: "6-11",
        note: "--opt encrypted triggers Linux kernel IPSec tunnel mode on VXLAN packets between hosts."
      },
      {
        lineRange: "14-18",
        note: "Services communicate across data centers as if connected to the same local switch with automatic AES encryption."
      }
    ],
    expectedOutput: `Network secure-payment-mesh created with ID: v8u91ks81b
Service order-processor converged across 4 nodes.
IPSec security association verified on port 4789.`
  },
  {
    id: "docker-ex-17",
    title: "Air-Gapped Backend Tier Using Internal Bridge Network (internal: true)",
    category: "Networking & DNS",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs an isolated database network tier that completely blocks external default gateway routing and internet access, preventing unauthorized outbound data exfiltration.",
    conceptsCovered: [
      "docker network create --internal",
      "Zero default gateway injection",
      "Blocking data exfiltration",
      "Multi-homed application container",
      "Security zones"
    ],
    code: `#!/usr/bin/env bash
# 1. Create public gateway network (has internet access)
docker network create public-edge-net

# 2. Create strictly internal network (NO default gateway, NO WAN access)
docker network create --internal private-db-net

# 3. Database attached ONLY to private network
docker run -d \\
  --name isolated-postgres \\
  --network private-db-net \\
  -e POSTGRES_PASSWORD=topsecret \\
  postgres:16-alpine

# 4. API Gateway attached to BOTH networks (can bridge traffic)
docker run -d \\
  --name backend-api \\
  --network public-edge-net \\
  my-api:latest
docker network connect private-db-net backend-api

# 5. Verify isolated database cannot reach the internet:
docker exec isolated-postgres ping -c 1 8.8.8.8 || echo "BLOCKED (No route to host)"`,
    breakdown: [
      {
        lineRange: "5-6",
        note: "--internal instructs Docker NOT to configure an iptables MASQUERADE rule or default gateway."
      },
      {
        lineRange: "9-13",
        note: "Database container is physically unreachable from the public internet and cannot make outbound connections."
      },
      {
        lineRange: "16-20",
        note: "backend-api acts as a secure bastion by multi-homing onto both networks."
      }
    ],
    expectedOutput: `ping: connect: Network is unreachable
BLOCKED (No route to host)
Database successfully air-gapped from internet!`
  },
  {
    id: "docker-ex-18",
    title: "Debugging Embedded Docker DNS (127.0.0.11) and Overriding Upstream Resolvers",
    category: "Networking & DNS",
    difficulty: "intermediate",
    whatThisCodeCovers: "Diagnoses container DNS latency and lookup failures, inspecting internal iptables DNAT rules routing to 127.0.0.11, and overrides fallback nameservers via container flags.",
    conceptsCovered: [
      "Embedded DNS 127.0.0.11",
      "--dns and --dns-search flags",
      "/etc/resolv.conf inspection",
      "dig and nslookup inside containers",
      "Resolving slow DNS query timeouts"
    ],
    code: `# Launch container with explicit upstream DNS and search domains
docker run --rm -it \\
  --name dns-troubleshooter \\
  --dns 1.1.1.1 \\
  --dns 8.8.8.8 \\
  --dns-search corporate.internal \\
  --dns-opt timeout:2 \\
  --dns-opt attempts:2 \\
  alpine:3.20 sh -c '
    echo "=== Container /etc/resolv.conf ==="
    cat /etc/resolv.conf
    echo "=== Testing DNS Resolution ==="
    apk add --no-cache bind-tools >/dev/null 2>&1
    dig +short google.com
'`,
    breakdown: [
      {
        lineRange: "4-8",
        note: "Overrides host DNS resolvers with Cloudflare/Google public DNS and sets strict timeout limits."
      },
      {
        lineRange: "10-15",
        note: "Reads dynamically generated resolv.conf and performs authoritative lookup with dig."
      }
    ],
    expectedOutput: `=== Container /etc/resolv.conf ===
nameserver 127.0.0.11
search corporate.internal
options timeout:2 attempts:2 ndots:0

=== Testing DNS Resolution ===
142.250.190.46`
  },
  {
    id: "docker-ex-19",
    title: "Zero-Downtime Blue/Green Container Traffic Shifting via Dynamic Nginx Upstream",
    category: "Networking & DNS",
    difficulty: "advanced",
    whatThisCodeCovers: "Executes a zero-downtime deployment by spinning up a new 'green' container version alongside 'blue', verifying health, and atomically reloading Nginx proxy upstreams.",
    conceptsCovered: [
      "Blue/Green deployment architecture",
      "Atomic Nginx configuration reload (nginx -s reload)",
      "Zero-downtime rolling cutover",
      "Health validation before traffic swap",
      "Automated rollback script"
    ],
    code: `#!/usr/bin/env bash
set -euo pipefail

ACTIVE_COLOR=$(docker ps --filter "name=app-" --format "{{.Names}}" | grep -oE "blue|green" || echo "blue")
TARGET_COLOR=$([ "$ACTIVE_COLOR" = "blue" ] && echo "green" || echo "blue")
TARGET_PORT=$([ "$TARGET_COLOR" = "blue" ] && echo "8001" || echo "8002")

echo "Current active: $ACTIVE_COLOR. Deploying: $TARGET_COLOR on port $TARGET_PORT"

# 1. Start new version container
docker run -d --name "app-$TARGET_COLOR" --network app-net -p "$TARGET_PORT:8080" my-app:v2

# 2. Wait for healthcheck to pass
echo "Waiting for $TARGET_COLOR to become healthy..."
docker run --rm --network app-net curlimages/curl:8.7.1 \\
  --retry 10 --retry-connrefused --retry-delay 2 -s "http://app-$TARGET_COLOR:8080/health"

# 3. Atomically update Nginx reverse proxy configuration
docker exec nginx-lb sh -c "
cat <<EOF > /etc/nginx/conf.d/upstream.conf
upstream backend {
    server app-$TARGET_COLOR:8080;
}
EOF
nginx -s reload
"

echo "Traffic shifted to $TARGET_COLOR! Terminating old $ACTIVE_COLOR..."
docker stop "app-$ACTIVE_COLOR" && docker rm "app-$ACTIVE_COLOR"`,
    breakdown: [
      {
        lineRange: "4-6",
        note: "Calculates target color and isolated internal port dynamically."
      },
      {
        lineRange: "14-17",
        note: "Polls new target container health endpoint to ensure readiness before shifting any production traffic."
      },
      {
        lineRange: "20-27",
        note: "Overwrites upstream conf and sends SIGHUP to master Nginx worker to switch traffic with zero dropped TCP packets."
      }
    ],
    expectedOutput: `Current active: blue. Deploying: green on port 8002
Waiting for green to become healthy...
{"status":"healthy"}
2026/11/04 10:30:15 [notice] 1#1: signal 1 (SIGHUP) received, reconfiguring
Traffic shifted to green! Terminating old blue...`
  },
  {
    id: "docker-ex-20",
    title: "Inspecting Container iptables Rules & Preventing UFW/Firewall Bypass",
    category: "Networking & DNS",
    difficulty: "advanced",
    whatThisCodeCovers: "Inspects how Docker manipulates the PREROUTING and DOCKER iptables chains, and configures the host daemon with iptables: false or DOCKER-USER rules to prevent bypassing host firewalls.",
    conceptsCovered: [
      "DOCKER and DOCKER-USER iptables chains",
      "UFW bypass vulnerability fix",
      "iptables -t nat -L -n -v",
      "/etc/docker/daemon.json iptables flag",
      "Firewall rule ordering"
    ],
    code: `#!/usr/bin/env bash
# 1. Inspect existing Docker NAT forwarding rules on host
sudo iptables -t nat -L DOCKER -n -v --line-numbers

# 2. Protect host by injecting rules into DOCKER-USER chain
# (The DOCKER-USER chain is evaluated BEFORE Docker's own rules)

# Block all external access to container port 5432 except from trusted office subnet:
sudo iptables -I DOCKER-USER -i eth0 -p tcp --dport 5432 -j DROP
sudo iptables -I DOCKER-USER -i eth0 -s 203.0.113.0/24 -p tcp --dport 5432 -j ACCEPT

# 3. View DOCKER-USER chain to verify defense in depth
sudo iptables -S DOCKER-USER`,
    breakdown: [
      {
        lineRange: "3-4",
        note: "Displays the automated DNAT port redirection rules created by the Docker daemon."
      },
      {
        lineRange: "8-11",
        note: "DOCKER-USER chain is guaranteed not to be overwritten by Docker. Injecting DROP and subnet rules locks down public exposure."
      }
    ],
    expectedOutput: `-P DOCKER-USER - [0:0]
-A DOCKER-USER -s 203.0.113.0/24 -i eth0 -p tcp -m tcp --dport 5432 -j ACCEPT
-A DOCKER-USER -i eth0 -p tcp -m tcp --dport 5432 -j DROP
-A DOCKER-USER -j RETURN`
  },
  {
    id: "docker-ex-21",
    title: "Routing All Container Traffic Through a Dedicated WireGuard Sidecar",
    category: "Networking & DNS",
    difficulty: "advanced",
    whatThisCodeCovers: "Chains a web scraper or microservice to a WireGuard VPN container using container networking mode (--network container:<name>), forcing all egress through an encrypted tunnel.",
    conceptsCovered: [
      "--network container:<target>",
      "Sidecar network proxying",
      "Egress VPN routing",
      "Shared localhost loopback",
      "Public IP masking"
    ],
    code: `#!/usr/bin/env bash
# 1. Start the WireGuard VPN client container
docker run -d \\
  --name vpn-sidecar \\
  --cap-add=NET_ADMIN \\
  --device /dev/net/tun \\
  -v /etc/wireguard/wg0.conf:/config/wg0.conf:ro \\
  linuxserver/wireguard:latest

# 2. Start application container sharing the VPN's network namespace
docker run --rm \\
  --name web-crawler \\
  --network container:vpn-sidecar \\
  curlimages/curl:8.7.1 \\
  curl -s https://ifconfig.me/ip

# web-crawler shares vpn-sidecar's localhost and IP interfaces directly!`,
    breakdown: [
      {
        lineRange: "3-8",
        note: "VPN client initializes tun interface and connects to remote gateway with NET_ADMIN capability."
      },
      {
        lineRange: "11-15",
        note: "--network container:vpn-sidecar attaches curl directly into the VPN container's netns."
      },
      {
        lineRange: "17-18",
        note: "Egress traffic routes over the VPN tunnel; ifconfig.me sees the WireGuard server's public IP."
      }
    ],
    expectedOutput: `198.51.100.42
# Output matches remote VPN exit node IP instead of host public IP!`
  },
  {
    id: "docker-ex-22",
    title: "Live Packet Sniffing via Ephemeral Netshoot Container Attached to Target Netns",
    category: "Networking & DNS",
    difficulty: "advanced",
    whatThisCodeCovers: "Troubleshoots mysterious network drops and latency by joining an ephemeral Nicolaka Netshoot diagnostic container to a live production container's network namespace to run tcpdump and netstat.",
    conceptsCovered: [
      "Ephemeral diagnostic container",
      "tcpdump inside container netns",
      "nicolaka/netshoot toolkit",
      "Analyzing TLS handshakes and RST packets",
      "Zero production container modification"
    ],
    code: `# Attach netshoot toolkit directly into target production container netns
docker run --rm -it \\
  --network container:production-api \\
  --cap-add=NET_ADMIN \\
  nicolaka/netshoot \\
  tcpdump -nn -vv -i any port 8080 or port 5432 -c 5

# Or inspect live TCP connection table:
# docker run --rm --network container:production-api nicolaka/netshoot ss -tulpn`,
    breakdown: [
      {
        lineRange: "2-6",
        note: "Attaches netshoot into production-api netns without restarting it or installing diagnostic tools in prod."
      },
      {
        lineRange: "7-8",
        note: "Runs tcpdump to capture the first 5 TCP packets arriving at ports 8080 or 5432."
      }
    ],
    expectedOutput: `tcpdump: listening on any, link-type LINUX_SLL
10:35:01.120 IP 172.28.0.5.49812 > 172.28.0.10.8080: Flags [S], seq 381921
10:35:01.121 IP 172.28.0.10.8080 > 172.28.0.5.49812: Flags [S.], ack 381922
10:35:01.122 IP 172.28.0.5.49812 > 172.28.0.10.8080: Flags [.], ack 1
5 packets captured`
  }
];
