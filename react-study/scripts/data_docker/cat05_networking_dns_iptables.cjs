const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 49,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Docker Network Drivers Overview (bridge, host, none, macvlan, overlay)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What are the core built-in network drivers in Docker, and what is the primary use case for each?",
    quickAnswer: "1) **`bridge`** (default): Software bridge on the host with private subnet and NAT port forwarding; standard for standalone containers. 2) **`host`**: Removes network isolation; container shares host network stack directly with zero NAT latency. 3) **`none`**: Completely disables networking (loopback interface only); ideal for secure offline batch jobs. 4) **`macvlan`**: Assigns unique physical MAC and LAN IP addresses directly from host router. 5) **`overlay`**: Encrypted multi-host mesh network across Docker Swarm or distributed clusters.",
    detailedAnswer: "Docker manages container connectivity through its pluggable Container Network Model (CNM). The `bridge` driver creates a software switch on the host, isolating containers in private RFC 1918 subnets (e.g. `172.17.0.0/16`). `host` bypasses Docker's virtual network layer entirely, offering maximum packet throughput at the expense of port conflict risks. `macvlan` makes containers look like real physical servers on the physical network switch.",
    code: `# List available network drivers:
$ docker network ls
# NETWORK ID     NAME      DRIVER    SCOPE
# 1a2b3c4d5e6f   bridge    bridge    local
# 7g8h9i0j1k2l   host      host      local
# 3m4n5o6p7q8r   none      null      local

# 1. Run container completely isolated from internet (offline compute):
$ docker run --rm --network none alpine ip addr
# 1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 ... (Only loopback exists!)

# 2. Run container sharing host network directly:
$ docker run -d --network host nginx:alpine
# Port 80 opens directly on host NIC without any -p flag needed!`,
    recallHint: "bridge = private NAT subnet (standard). host = no isolation (fastest). none = offline. overlay = multi-host.",
    interviewTip: "Remember that `--network host` on Docker Desktop for macOS and Windows attaches to the Linux virtual machine's network, NOT the macOS/Windows host network interface.",
    tags: ["networking", "bridge", "host-network", "drivers", "cnm"],
    practice: [
      "Why does `--network host` ignore port mappings (`-p 8080:80`)?",
      "Can a container be connected to multiple networks simultaneously?"
    ]
  }),

  createCard({
    idNum: 50,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Linux Virtual Ethernet (veth) Pairs & Network Namespaces",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Docker connect a container's private network namespace to the host's `docker0` bridge using Linux `veth` pairs?",
    quickAnswer: "Docker creates a **virtual ethernet pair (`veth` pair)**—a virtual wire with two endpoints. One endpoint is placed inside the container's private network namespace and renamed to `eth0`. The peer endpoint (`vethxxxx`) is plugged into the host's software bridge switch (`docker0`). Packets entering the container's `eth0` exit onto `docker0` on the host.",
    detailedAnswer: "In Linux, a `veth` pair acts as a bi-directional pipe. When `docker run` starts a container with the bridge driver: 1) Docker creates a network namespace, 2) Creates a veth pair via `ip link add type veth`, 3) Moves one end into the container's netns and assigns a private IP (e.g. `172.17.0.2`), 4) Attaches the host end to `docker0`, and 5) Sets the container's default gateway to the `docker0` bridge IP (`172.17.0.1`).",
    code: `# Inspect the host veth interfaces connected to the docker0 bridge:
$ ip link show master docker0
# 5: veth92b510c@if4: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 ... master docker0

# Find the container's internal interface peer index:
$ docker exec -it my-container cat /sys/class/net/eth0/iflink
5  # Matches host veth index 5!

# Verify bridge connections on host using brctl / bridge-utils:
$ sudo brctl show docker0
# bridge name   bridge id           STP enabled   interfaces
# docker0       8000.02425d97f5b7   no            veth92b510c`,
    recallHint: "veth pair is a virtual cable: one end is eth0 inside container netns; peer end is veth* plugged into docker0 bridge.",
    interviewTip: "Diagramming the veth pair connecting the container netns to `docker0` on a whiteboard proves elite Linux networking credentials.",
    tags: ["veth", "netns", "docker0", "bridge", "linux-kernel"],
    practice: [
      "What happens if you delete a container's `veth` interface on the host using `ip link delete`?",
      "How does the Linux kernel forward packets between two veth interfaces attached to the same bridge?"
    ]
  }),

  createCard({
    idNum: 51,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "User-Defined Bridge vs Default Bridge Network",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why should you NEVER use the default `bridge` network in production, and what advantages do User-Defined Bridge networks offer?",
    quickAnswer: "1) **Automatic DNS Resolution**: Containers on a user-defined bridge resolve each other by container name (e.g. `http://database:5432`); the default bridge does NOT support DNS (requires hardcoded IPs or deprecated `--link`). 2) **Better Network Isolation**: Only containers on the same custom bridge can communicate. 3) **Dynamic Attachment**: Containers can connect/disconnect from custom networks on-the-fly without restarting.",
    detailedAnswer: "On the default `bridge` network, all containers from all projects share the same broadcast domain and subnet. If one container is compromised, it can scan and connect to every other container on that host. User-Defined bridges segment applications into isolated micro-networks. Furthermore, modern microservice discovery relies on Docker's embedded DNS server, which is disabled on the default bridge.",
    code: `# 1. Create an isolated user-defined bridge network:
$ docker network create --driver bridge my-app-net

# 2. Run database container on the custom network:
$ docker run -d --name postgres-db --network my-app-net postgres:16

# 3. Run API container on the SAME network:
$ docker run -d --name backend-api --network my-app-net my-api

# 4. Automatic DNS resolution works natively by container name:
$ docker exec -it backend-api ping -c 2 postgres-db
# PING postgres-db (172.20.0.2): 56 data bytes
# 64 bytes from 172.20.0.2: seq=0 ttl=64 time=0.082 ms`,
    recallHint: "User-defined bridge provides automatic DNS resolution by container name and proper isolation. Default bridge does not.",
    interviewTip: "Highlight that Docker Compose automatically creates a dedicated user-defined bridge network for every project by default.",
    tags: ["user-defined-bridge", "dns", "service-discovery", "isolation", "networking"],
    practice: [
      "Why is the legacy `--link` flag deprecated in modern Docker?",
      "How do you connect a running container to a second network using `docker network connect`?"
    ]
  }),

  createCard({
    idNum: 52,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Embedded Docker DNS Server (127.0.0.11) & Name Resolution",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Docker's embedded DNS server (`127.0.0.11`) resolve container names and external internet domains?",
    quickAnswer: "Every container attached to a user-defined network has its `/etc/resolv.conf` pointed to Docker's internal DNS server at `127.0.0.11`. The embedded DNS daemon resolves container names to private container IPs. If a domain is external (e.g. `google.com`), `127.0.0.11` forwards the query to the host's configured upstream DNS servers.",
    detailedAnswer: "Inside the container network namespace, iptables rules redirect all UDP/TCP port 53 DNS traffic to an internal resolver daemon managed by Docker. This daemon maintains a dynamic table of container names, network aliases, and their corresponding IP addresses on that network. If multiple containers share the same network alias (e.g. 3 replicas of `api`), the embedded DNS performs automatic round-robin load balancing.",
    code: `# Inspect /etc/resolv.conf inside any container on a custom network:
$ docker run --rm --network my-app-net alpine cat /etc/resolv.conf
# nameserver 127.0.0.11
# options ndots:0

# Test Round-Robin DNS Load Balancing:
# Start two web servers with the same network alias 'web-service':
$ docker run -d --network my-app-net --network-alias web-service nginx:alpine
$ docker run -d --network my-app-net --network-alias web-service nginx:alpine

# Querying 'web-service' returns multiple IPs in round-robin order:
$ docker run --rm --network my-app-net alpine nslookup web-service
# Name:      web-service
# Address 1: 172.20.0.2
# Address 2: 172.20.0.3`,
    recallHint: "127.0.0.11 is Docker's embedded DNS server; resolves container names locally and forwards external domains to host DNS.",
    interviewTip: "Mention that if you configure custom DNS servers via `--dns 8.8.8.8`, Docker forwards external queries to that server while still resolving local container names through `127.0.0.11`.",
    tags: ["dns", "127.0.0.11", "round-robin", "service-discovery", "resolv-conf"],
    practice: [
      "What causes DNS timeout delays when an application queries a short hostname with `ndots` configured?",
      "Why does `ping localhost` never touch the embedded DNS server?"
    ]
  }),

  createCard({
    idNum: 53,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Port Publishing (-p) vs EXPOSE & NAT Forwarding",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the difference between `EXPOSE` in a Dockerfile and `-p host:container` in `docker run`?",
    quickAnswer: "`EXPOSE` is purely **documentation metadata** for developers; it does NOT publish or open any ports on the host. `-p <host_port>:<container_port>` (or `-P` for dynamic publishing) actively configures host Linux kernel `iptables` NAT rules to route external incoming traffic from the host port into the container's private IP and port.",
    detailedAnswer: "Declaring `EXPOSE 8080` in a Dockerfile merely informs human users that the service inside listens on 8080. If you start the container with `docker run -d my-app`, port 8080 is accessible ONLY to other containers on the same Docker network; it is completely invisible to the outside host network. To make it publicly accessible on host interface IP at port 80, you must publish it explicitly: `docker run -p 80:8080 my-app`.",
    code: `# 1. In Dockerfile: Documentation metadata only (0 host ports opened)
EXPOSE 3000

# 2. Publish to all host interfaces on port 80:
$ docker run -d -p 80:3000 my-app

# 3. Publish to specific host IP (e.g. localhost only, blocking public WAN):
$ docker run -d -p 127.0.0.1:8080:3000 my-app

# 4. Publish dynamic random high port:
$ docker run -d -p 3000 my-app
# Check assigned port:
$ docker port <container_id>
# 3000/tcp -> 0.0.0.0:49153

# 5. Publish UDP port explicitly:
$ docker run -d -p 53:53/udp coredns`,
    recallHint: "EXPOSE = documentation only. -p host:container = creates iptables NAT rule to publish port to host.",
    interviewTip: "Emphasize `-p 127.0.0.1:5432:5432` for databases: publishing `-p 5432:5432` binds to `0.0.0.0`, exposing your database to the entire public internet!",
    tags: ["ports", "expose", "publishing", "nat", "iptables"],
    practice: [
      "What does `-P` (uppercase) do when running a container with exposed ports?",
      "How do you view which host port maps to a container port using `docker port`?"
    ]
  }),

  createCard({
    idNum: 54,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Host Networking Mode (--network host) & Performance",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When should you use `--network host`, and what are its performance benefits and operational drawbacks?",
    quickAnswer: "Use `--network host` when you require maximum raw network throughput and microsecond latency (e.g. high-frequency trading, video streaming, or network monitoring tools). Benefits: Zero NAT packet inspection overhead. Drawbacks: Zero network isolation, cannot run two containers listening on the same port, and only works natively on Linux.",
    detailedAnswer: "In standard bridge networking, every packet passing between the host and container must be processed by Linux kernel `iptables` Network Address Translation (NAT) and cross the `veth` pair boundary. This adds a slight CPU overhead (~5-10% in high packet-per-second workloads). In `--network host`, the container is placed directly into the host's root network namespace. It shares the host's `eth0`, localhost, and routing table directly.",
    code: `# Run high-performance web benchmark on host network:
$ docker run -d --name benchmark-nginx \
    --network host \
    nginx:alpine

# The Nginx server is immediately accessible on host port 80:
$ curl http://localhost:80

# Inspect container network settings:
$ docker inspect -f '{{.NetworkSettings.IPAddress}}' benchmark-nginx
# (Empty! The container has no private IP; it shares the host IP directly!)`,
    recallHint: "host network: zero NAT overhead, highest throughput; but zero isolation and port conflict risks.",
    interviewTip: "Warn interviewers that `--network host` breaks on Docker Desktop for macOS and Windows because the container binds to the virtual machine's network stack, not your actual Mac/Windows host machine.",
    tags: ["host-network", "performance", "latency", "benchmarking", "nat-overhead"],
    practice: [
      "Why can't you run two instances of Nginx on `--network host` on the same machine without altering `nginx.conf`?",
      "How does `--network host` affect container security and localhost binding isolation?"
    ]
  }),

  createCard({
    idNum: 55,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Macvlan & Ipvlan Networks (Direct LAN Integration)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are Macvlan and Ipvlan network drivers, and when are they used in legacy enterprise networking?",
    quickAnswer: "`macvlan` assigns a unique physical MAC address and dedicated LAN IP to each container directly from the host physical network switch, making containers look like real physical servers. `ipvlan` operates similarly but shares a single physical MAC address across all containers, routing at Layer 3 to prevent overwhelming network switch MAC tables.",
    detailedAnswer: "Certain legacy enterprise applications, VoIP PBX systems, and network monitoring tools require direct Layer 2 connectivity to the corporate LAN, requiring containers to reside in the same IP subnet as physical hardware servers (e.g. `192.168.1.0/24`) without any port-forwarding or NAT. Macvlan creates sub-interfaces on the host NIC (`eth0.10`). However, most cloud providers (AWS, GCP, Azure) block promiscuous mode and multiple MACs per VM, making Macvlan suitable only for bare-metal on-premise datacenters.",
    code: `# Create a macvlan network attached to host physical interface eth0:
$ docker network create -d macvlan \
    --subnet=192.168.1.0/24 \
    --gateway=192.168.1.1 \
    -o parent=eth0 \
    corp-lan-net

# Run container with static IP directly on physical corporate LAN:
$ docker run -d --name legacy-db \
    --network corp-lan-net \
    --ip=192.168.1.150 \
    postgres:16

# NOTE: Linux kernel security blocks the host from pinging its own macvlan child IPs!
# External physical devices on LAN can reach 192.168.1.150 directly without NAT!`,
    recallHint: "Macvlan: unique MAC + LAN IP per container. Ipvlan: shared MAC, L3 routing. Used on bare-metal enterprise LANs.",
    interviewTip: "Mention that by default, the Linux host cannot communicate directly with its own macvlan child containers due to a kernel safety feature; creating a macvlan bridge sub-interface on the host is required for host-to-container communication.",
    tags: ["macvlan", "ipvlan", "layer2", "bare-metal", "enterprise-networking"],
    practice: [
      "Why do cloud providers like AWS EC2 terminate network packets from Macvlan containers?",
      "What is the difference between Macvlan Bridge mode vs 802.1q Trunk VLAN mode?"
    ]
  }),

  createCard({
    idNum: 56,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Multi-Host Overlay Networks & VXLAN Encapsulation",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Docker Overlay Networks enable seamless container-to-container communication across multiple physical hosts?",
    quickAnswer: "Overlay networks use **VXLAN (Virtual Extensible LAN)** encapsulation to create a virtual Layer 2 network over a Layer 3 underlay network. Container packets are wrapped inside standard UDP packets (port 4789) on Host A, transmitted across the physical network, and unwrapped inside Host B, allowing containers on different physical servers to communicate as if on the same local switch.",
    detailedAnswer: "In multi-host clustering (Docker Swarm), containers running on Host 1 must be able to ping containers on Host 2 using private IPs without manual port forwarding. Overlay networks allocate a virtual subnet (e.g. `10.0.0.0/24`). The Linux kernel's built-in VXLAN driver encapsulates the inner Ethernet frame inside an outer UDP datagram with a VXLAN Network Identifier (VNI). Optional IPSec encryption (`--opt encrypted`) encrypts the payload in transit with zero application code changes.",
    code: `# 1. Initialize Swarm cluster manager on Host 1:
$ docker swarm init

# 2. Create an encrypted multi-host overlay network:
$ docker network create --driver overlay --opt encrypted my-overlay-net

# 3. Deploy a multi-node service attached to the overlay:
$ docker service create --name web-cluster \
    --network my-overlay-net \
    --replicas 4 \
    nginx:alpine

# Containers distributed across Host 1 and Host 2 communicate directly
# over the encrypted VXLAN tunnel (UDP port 4789)!`,
    recallHint: "Overlay networks wrap container packets in UDP (port 4789) via VXLAN to connect multi-host clusters.",
    interviewTip: "Ensure firewall rules permit UDP 4789 (VXLAN data plane), TCP/UDP 7946 (node discovery control plane), and protocol 50 ESP (if IPSec encryption is enabled).",
    tags: ["overlay-network", "vxlan", "swarm", "multi-host", "ipsec"],
    practice: [
      "What ports must be open in corporate firewalls for Docker Overlay networks to function?",
      "How does VXLAN encapsulation overhead affect network Maximum Transmission Unit (MTU) size?"
    ]
  }),

  createCard({
    idNum: 57,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Docker & Linux iptables NAT Table Manipulation",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Docker manipulate Linux `iptables` rules to route external traffic into private container subnets?",
    quickAnswer: "Docker creates custom iptables chains: `DOCKER`, `DOCKER-USER`, and `DOCKER-ISOLATION-STAGE-*`. In the `nat` table, Docker adds Destination NAT (`DNAT`) rules in the `PREROUTING` chain, rewriting incoming packets on published host ports to target the container's private IP. In the `POSTROUTING` chain, Source NAT (`MASQUERADE`) allows containers to reach the internet using the host's public IP.",
    detailedAnswer: "When you run `docker run -p 80:8080`, Docker does NOT bind a standard socket in userspace (unless `docker-proxy` is used as fallback). Instead, the Linux kernel handles packet forwarding directly in kernel space via `iptables`. An incoming packet on `eth0:80` matches a DNAT rule in chain `DOCKER`, which modifies the destination IP to `172.17.0.2:8080`. When the container responds, `MASQUERADE` translates the source IP back to the host IP.",
    code: `# Inspect Docker's custom NAT rules in iptables:
$ sudo iptables -t nat -L DOCKER -n -v
# Chain DOCKER (2 references)
# pkts bytes target     prot opt in     out     source      destination
#   12   720 DNAT       tcp  --  !docker0 *     0.0.0.0/0   0.0.0.0/0   tcp dpt:80 to:172.17.0.2:8080

# Inspect outgoing Masquerade rules (Container internet access):
$ sudo iptables -t nat -L POSTROUTING -n -v | grep MASQUERADE
#  145 10250 MASQUERADE all  --  *      !docker0 172.17.0.0/16 0.0.0.0/0`,
    recallHint: "PREROUTING DNAT rewrites host port to container IP. POSTROUTING MASQUERADE gives container internet access.",
    interviewTip: "Explain `docker-proxy`: it is a lightweight userspace proxy spawned by Docker to forward traffic from `localhost` connections that bypass standard Linux PREROUTING iptables chains.",
    tags: ["iptables", "nat", "dnat", "masquerade", "packet-flow"],
    practice: [
      "What is the role of `docker-proxy` compared to kernel-level iptables DNAT?",
      "What happens if you disable Docker iptables management with `\"iptables\": false` in `daemon.json`?"
    ]
  }),

  createCard({
    idNum: 58,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "The UFW / Firewalld Bypass Vulnerability",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why does publishing a port with `docker run -p 8080:8080` bypass Ubuntu UFW firewall rules, and how do you fix it?",
    quickAnswer: "UFW (Uncomplicated Firewall) injects filtering rules into the `INPUT` chain. However, Docker routes published container traffic through the `PREROUTING` and `FORWARD` chains, bypassing the `INPUT` chain entirely! Consequently, publishing a port exposes it to the entire internet even if UFW is set to block that port. Fix by injecting rules into the `DOCKER-USER` chain.",
    detailedAnswer: "This is one of the most dangerous and notorious security traps in Linux server administration. A sysadmin configures `ufw default deny incoming`, enables UFW, and assumes all ports are blocked. Then they run a test Elasticsearch or Redis container with `-p 6379:6379`. Because Docker manipulates iptables rules directly before UFW's rules execute, port 6379 is wide open to the public internet. Docker reserves the `DOCKER-USER` chain for administrator rules, which execute before Docker's own rules.",
    code: `# DANGEROUS DISASTER:
$ sudo ufw status
# Status: active (Default: deny incoming)
$ docker run -d -p 6379:6379 redis:alpine
# RESULT: Redis is publicly accessible to any IP on the internet! UFW was bypassed!

# -------------------------------------------------------------
# PRODUCTION REMEDIATION:

# FIX 1: Bind ONLY to localhost (Private access only):
$ docker run -d -p 127.0.0.1:6379:6379 redis:alpine

# FIX 2: Restrict access via the DOCKER-USER iptables chain:
# Allow only trusted corporate IP (203.0.113.50) to reach container port 6379:
$ sudo iptables -I DOCKER-USER -i eth0 -p tcp --dport 6379 ! -s 203.0.113.50 -j DROP`,
    recallHint: "Docker publishes via FORWARD chain, bypassing UFW INPUT chain! Always bind to 127.0.0.1 or use DOCKER-USER chain.",
    interviewTip: "In security audits, discovering Docker ports exposed through UFW is an instant Critical finding. Knowing the `DOCKER-USER` chain fix proves senior Linux security expertise.",
    tags: ["ufw", "firewalld", "security-vulnerability", "iptables", "docker-user"],
    practice: [
      "Why does Docker use the `FORWARD` chain instead of the `INPUT` chain for published ports?",
      "How does the `chainguard/ufw-docker` utility automate syncing Docker with UFW?"
    ]
  }),

  createCard({
    idNum: 59,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Custom Network Aliases & Multi-Network Containers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you connect a single container to multiple isolated networks, and what are Network Aliases?",
    quickAnswer: "A container can join multiple networks using `docker network connect <net> <container>`. It receives a separate IP address and network interface (`eth0`, `eth1`) in each network. **Network Aliases** (`--network-alias <name>`) provide alternative DNS hostnames for that container within that specific network.",
    detailedAnswer: "Multi-network connectivity is vital for secure DMZ architectures. An API Gateway container connects to two networks: a public-facing `frontend-net` (shared with Nginx reverse proxy) and an internal isolated `backend-net` (shared with database and Redis). The database is on `backend-net` only, making it physically impossible for public frontend traffic to route directly to the database.",
    code: `# 1. Create two isolated networks:
$ docker network create frontend-net
$ docker network create backend-net

# 2. Database sits strictly on the backend network (isolated from frontend):
$ docker run -d --name secure-db --network backend-net postgres:16

# 3. API Gateway starts on frontend-net, then connects to backend-net:
$ docker run -d --name api-gateway --network frontend-net my-api
$ docker network connect --alias internal-api backend-net api-gateway

# Result:
# api-gateway has 2 network cards (eth0 on frontend, eth1 on backend).
# secure-db has 1 card (backend only).
# It is physically impossible for traffic on frontend-net to reach secure-db!`,
    recallHint: "Containers can attach to multiple networks (multi-homed). Use to isolate databases from public frontend networks.",
    interviewTip: "Mention that network aliases allow implementing canary deployments: assign `api-v2` the alias `api-service`, and Docker's embedded DNS will distribute 50% of traffic to the canary.",
    tags: ["network-alias", "dmz", "multi-network", "security", "microservices"],
    practice: [
      "What happens to container routing tables when attached to two networks with conflicting subnets?",
      "How do you remove a container from a network dynamically with `docker network disconnect`?"
    ]
  }),

  createCard({
    idNum: 60,
    category: "Networking Engine & Multi-Host Topologies",
    concept: "Network Troubleshooting & tcpdump in Container Netns",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you capture and inspect live network packet traffic (`tcpdump`) inside a container that has no network tools installed?",
    quickAnswer: "Do NOT install `tcpdump` inside production images! Instead, spawn an ephemeral diagnostic container attached directly to the target container's network namespace using **`--network=container:<target_name>`** (or use `nsenter -t $PID -n tcpdump`).",
    detailedAnswer: "In production, minimal base images (Alpine, Distroless) lack `curl`, `netstat`, or `tcpdump` for security reasons. Docker allows containers to share another container's network namespace. Running an ephemeral container with `--network=container:target` gives the diagnostic container identical access to the target's `eth0` network card, loopback interface, and open ports, allowing you to sniff packets using `tcpdump` or test local endpoints using `curl`.",
    code: `# Scenario: Target container 'production-api' is minimal distroless with zero tools!

# 1. Attach an ephemeral network troubleshooting container to target's netns:
$ docker run --rm -it \
    --network=container:production-api \
    nicolaka/netshoot \
    tcpdump -nnvv -i eth0 port 8080

# 2. Inspect active sockets and listening ports inside target container:
$ docker run --rm -it \
    --network=container:production-api \
    nicolaka/netshoot \
    ss -tlpn

# 3. Using Linux nsenter directly on the host:
$ PID=$(docker inspect -f '{{.State.Pid}}' production-api)
$ sudo nsenter -t $PID -n tcpdump -i any -c 10`,
    recallHint: "Run diagnostic tools using --network=container:<target> (e.g. nicolaka/netshoot) to sniff packets without modifying images.",
    interviewTip: "Mention `nicolaka/netshoot`: it is the gold-standard Docker diagnostic image bundled with `tcpdump`, `curl`, `dig`, `iperf`, `ngrep`, and `strace` for zero-footprint troubleshooting.",
    tags: ["tcpdump", "netshoot", "troubleshooting", "network-namespace", "nsenter"],
    practice: [
      "Why does sharing a network namespace (`--network=container:<target>`) allow connecting via `localhost`?",
      "How do you capture packets to a `.pcap` file and download it for analysis in Wireshark?"
    ]
  })
];
