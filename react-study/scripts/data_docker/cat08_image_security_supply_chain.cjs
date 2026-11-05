const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 85,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Vulnerability Scanning with Trivy & Grype (CVE Detection)",
    priority: "must-know",
    difficulty: "beginner",
    question: "How do container vulnerability scanners like Trivy and Grype detect security vulnerabilities (CVEs) in Docker images?",
    quickAnswer: "Scanners unpack image layers, inspect installed OS package manifests (e.g. `apk`, `dpkg`, `rpm`) and application dependency lockfiles (`package-lock.json`, `pom.xml`, `go.sum`), and query national vulnerability databases (NVD, GitHub Security Advisory) for known Common Vulnerabilities and Exposures (CVEs), grading them from Low to Critical.",
    detailedAnswer: "In modern CI/CD pipelines, automated scanning gates deployments: if an image contains an unpatched Critical CVE with an available fix, the build fails automatically. Aqua Security's **Trivy** and Anchore's **Grype** are industry standards. They scan both the underlying Linux OS packages and language-level application dependencies, reporting exact package versions, fixed versions, and CVSS severity scores.",
    code: `# 1. Scan a local image with Trivy and filter for Critical/High vulnerabilities only:
$ trivy image --severity HIGH,CRITICAL my-app:latest

# 2. Block CI/CD pipeline if fixable vulnerabilities exist (exit code 1):
$ trivy image --exit-code 1 --ignore-unfixed --severity CRITICAL my-app:latest

# 3. Output results as JSON for security dashboards:
$ trivy image -f json -o trivy-report.json my-app:latest

# 4. Scan using Anchore Grype:
$ grype my-app:latest --only-fixed`,
    recallHint: "Trivy / Grype inspect OS packages and language lockfiles; fail CI pipelines on Critical/High CVEs.",
    interviewTip: "Always use the `--ignore-unfixed` flag in automated CI pipelines: this prevents pipeline builds from breaking on vulnerabilities that do not have an official vendor patch available yet.",
    tags: ["trivy", "grype", "cve", "vulnerability-scanning", "ci-cd"],
    practice: [
      "What is the difference between an OS-level CVE (e.g. OpenSSL) vs an application dependency CVE (e.g. Log4j)?",
      "Why does switching to a Google Distroless base image immediately reduce scanner CVE counts by ~95%?"
    ]
  }),

  createCard({
    idNum: 86,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Docker Scout & Shift-Left BuildKit Scanning",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Docker Scout, and how does it provide real-time vulnerability feedback and remediation recommendations?",
    quickAnswer: "Docker Scout is Docker's native supply chain security platform integrated directly into the Docker CLI and Docker Desktop. It analyzes images during build time, indexes the software composition, highlights critical CVEs, and provides automated **base image update recommendations** that eliminate vulnerabilities without breaking application code.",
    detailedAnswer: "Historically, developers had to install third-party CLIs to scan images after building. Docker Scout shifts security left directly into the developer workflow. Running `docker scout quickview` produces an instant CVE health summary. Running `docker scout recommendations` compares your active base image against newer patches in Docker Hub and tells you: 'Updating to node:20.11-alpine reduces your Critical CVE count from 4 to 0'.",
    code: `# 1. High-level security quickview of an image:
$ docker scout quickview my-app:latest
# Target: my-app:latest
# Packages: 142
# Vulnerabilities: 0C, 2H, 5M, 12L

# 2. Compare image against newer base image tags to find fixes:
$ docker scout recommendations my-app:latest
# Recommendation: Change base image from node:20.0-alpine to node:20.12-alpine
# Benefit: Eliminates 2 High vulnerabilities!

# 3. Inspect policy compliance against organization standards:
$ docker scout cves my-app:latest`,
    recallHint: "Docker Scout: native CLI scanning with automated base image update recommendations.",
    interviewTip: "Highlight that Docker Scout analyzes image layers locally before pushing to remote registries, catching security regressions before code leaves developer workstations.",
    tags: ["docker-scout", "shift-left", "cve", "remediation", "docker-desktop"],
    practice: [
      "How does `docker scout compare` highlight newly introduced vulnerabilities between two image tags?",
      "Can Docker Scout evaluate custom enterprise security policies (e.g. no GPL-3.0 licenses)?"
    ]
  }),

  createCard({
    idNum: 87,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Software Bill of Materials (SBOM) Generation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Software Bill of Materials (SBOM), and how do you generate standard CycloneDX or SPDX SBOMs for Docker images?",
    quickAnswer: "An SBOM is a comprehensive, machine-readable inventory of every software component, library, dependency, version, and license packaged inside a container image. Generate using **`docker sbom`** (or Syft): `syft <image> -o cyclonedx-json > sbom.json`.",
    detailedAnswer: "Prompted by executive cybersecurity orders and major supply chain attacks (SolarWinds, Log4j), enterprise customers mandate an SBOM before deploying any software container. If a zero-day vulnerability is announced in a library tomorrow, security teams don't need to rebuild or scan images; they query their centralized SBOM database to immediately discover which running containers contain that library. Standard formats are CycloneDX (OWASP) and SPDX (Linux Foundation).",
    code: `# 1. Generate an SBOM using Anchore Syft in CycloneDX JSON format:
$ syft my-app:latest -o cyclonedx-json=sbom.cyclonedx.json

# 2. Generate an SBOM in SPDX format:
$ syft my-app:latest -o spdx-json=sbom.spdx.json

# 3. Attach an SBOM directly into the container image using BuildKit attestations:
$ docker buildx build \
    --sbom=true \
    --provenance=true \
    -t my-registry.com/my-app:1.0.0 \
    --push .

# Inspect the attached SBOM attestation from the registry:
$ docker buildx imagetools inspect --format '{{json .SBOM}}' my-registry.com/my-app:1.0.0`,
    recallHint: "SBOM is a machine-readable ingredient list (CycloneDX/SPDX). Generate via syft or buildx --sbom=true.",
    interviewTip: "Explain why `--sbom=true` in `docker buildx` is the modern gold standard: BuildKit generates the SBOM during compilation and cryptographically packages it as an OCI attestation layer directly into the container manifest.",
    tags: ["sbom", "cyclonedx", "spdx", "syft", "supply-chain"],
    practice: [
      "What is the difference between CycloneDX and SPDX format standards?",
      "How does an enterprise security team use SBOMs to detect newly disclosed zero-day vulnerabilities in minutes?"
    ]
  }),

  createCard({
    idNum: 88,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Image Signing & Verification with Cosign (Sigstore)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Cosign (Sigstore) sign container images cryptographically, and how do Kubernetes clusters enforce signature verification?",
    quickAnswer: "`cosign` signs container images using public/private key pairs (or keyless OIDC signatures via GitHub/Google identity). It writes cryptographic signatures directly into the OCI registry alongside the image manifest. Admission controllers in Kubernetes (Kyverno, OPA Gatekeeper) verify the signature before allowing pods to deploy, preventing unsigned or tampered images from running.",
    detailedAnswer: "In modern DevSecOps, preventing rogue code from running in production requires cryptographic image provenance. Once an image passes CI tests and vulnerability scans, the CI runner signs the image digest using `cosign sign`. When an engineer or malicious actor attempts to push an unverified image or modify a layer, the signature check fails. Keyless signing uses OpenID Connect (OIDC) and the Sigstore transparency log (Rekor), eliminating the hassle of managing and rotating private keys.",
    code: `# 1. Generate a Cosign cryptographic keypair:
$ cosign generate-key-pair
# Generates cosign.key (private) and cosign.pub (public)

# 2. Sign a container image by its immutable SHA256 digest:
$ cosign sign --key cosign.key my-registry.com/my-app@sha256:7f83b165...

# 3. Verify the image signature before running:
$ cosign verify --key cosign.pub my-registry.com/my-app@sha256:7f83b165...
# Output:
# The following checks were performed on each of these signatures:
#   - The cosign claims were validated
#   - The signatures were successfully verified against the specified public key

# 4. Keyless signing in GitHub Actions using native OIDC token:
# $ cosign sign my-registry.com/my-app@sha256:... (zero private keys needed!)`,
    recallHint: "Cosign signs image digests and stores signatures in the OCI registry. Verifiers block unsigned images.",
    interviewTip: "Highlight keyless signing: it uses short-lived Fulcio certificates issued via OIDC (e.g. GitHub Actions identity) recorded on the Rekor transparency log, completely eliminating leaked private key risks.",
    tags: ["cosign", "sigstore", "image-signing", "verification", "supply-chain"],
    practice: [
      "Why must images be signed by their immutable `@sha256:...` digest rather than mutable `:latest` tags?",
      "How does Kyverno enforce signature verification policies in Kubernetes clusters?"
    ]
  }),

  createCard({
    idNum: 89,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Docker Content Trust (DCT) & The Update Framework (TUF)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Docker Content Trust (DCT), and what happens when `DOCKER_CONTENT_TRUST=1` is enabled on a host?",
    quickAnswer: "Docker Content Trust (DCT) implements The Update Framework (TUF) using Notary. When `DOCKER_CONTENT_TRUST=1` is enabled, the Docker client **refuses to pull, run, or build** from any image that does not have a valid, trusted cryptographic digital signature published to the Notary server.",
    detailedAnswer: "Without Content Trust, if a malicious attacker poisons DNS or hijacks an upstream registry account and pushes a compromised `:latest` tag, your servers will blindly download and run the malware. When DCT is active, the Docker engine verifies the image's publisher key before downloading layers. If the signature is missing, expired, or corrupted, the client aborts with `Error: remote trust data does not exist`.",
    code: `# 1. Enable Docker Content Trust in shell:
$ export DOCKER_CONTENT_TRUST=1

# 2. Attempting to pull an unsigned image FAILS:
$ docker pull untrusted-user/malicious-image:latest
# Error: remote trust data does not exist for docker.io/untrusted-user/malicious-image: ...

# 3. Pulling an official signed image succeeds:
$ docker pull alpine:latest
# Pull (1 of 1): alpine:latest@sha256:d734...
# Tagging alpine@sha256:... as alpine:latest

# 4. Sign and push an image with DCT:
# Prompts for passphrase to generate local Root and Repository keys:
$ docker push my-company/secure-app:1.0.0
# Signing and pushing trust metadata...`,
    recallHint: "DOCKER_CONTENT_TRUST=1 forces Docker to verify digital signatures before pulling or running images.",
    interviewTip: "Explain why the industry is migrating from Notary V1/DCT to Sigstore/Cosign: Notary V1 required maintaining separate Notary servers, while Cosign stores signatures natively as OCI artifacts directly in standard registries.",
    tags: ["dct", "docker-content-trust", "notary", "tuf", "integrity"],
    practice: [
      "What are the roles of the Root Key, Snapshot Key, Targets Key, and Timestamp Key in The Update Framework (TUF)?",
      "Why does Docker Content Trust protect against replay attacks?"
    ]
  }),

  createCard({
    idNum: 90,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Immutable Tags vs The Mutable :latest Anti-Pattern",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why is deploying containers with the `:latest` tag an anti-pattern in production, and what should be used instead?",
    quickAnswer: "The `:latest` tag is **mutable**: it does not mean 'most stable', it simply means 'the most recent build without an explicit tag'. Using `:latest` leads to non-deterministic deployments, breaks rollback capabilities, prevents auditing, and causes cache confusion. Production must use **immutable tags** (Git commit SHA, semantic version `1.4.2`, or immutable digest `@sha256:...`).",
    detailedAnswer: "If you deploy `image: my-app:latest` across 10 Kubernetes nodes, Node 1 may pull the image at 10:00 AM (containing build A), while Node 10 pulls at 10:30 AM after a new commit (containing build B). Your production cluster is now running two completely different codebases under the same tag! Rollbacks are impossible because pulling `:latest` continues to download build B. Pinning to a Git commit SHA (`my-app:sha-8f2a1b4`) guarantees 100% reproducible deployments.",
    code: `# 1. DISASTER ANTI-PATTERN: Mutable, non-deterministic deployment
$ docker run -d my-app:latest

# -------------------------------------------------------------
# 2. PRODUCTION STANDARD A: Semantic Versioning + Git Commit SHA
$ docker build -t my-registry.com/api:v1.4.2 \
               -t my-registry.com/api:sha-a8f1b2c .
$ docker push my-registry.com/api:v1.4.2
$ docker push my-registry.com/api:sha-a8f1b2c

# 3. PRODUCTION STANDARD B: Pinning by Cryptographic Digest (100% Immutable!)
# Pulls the EXACT immutable byte sequence, immune to tag overwriting:
$ docker run -d my-registry.com/api@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069`,
    recallHint: "Never use :latest in production. Tag with Git Commit SHA or Semantic Version; pin by @sha256 for total immutability.",
    interviewTip: "State emphatically: '`:latest` is an ephemeral pointer, not a version'. Mention that many enterprise registries (Harbor, AWS ECR) feature 'Tag Immutability' settings that block re-pushing an existing tag.",
    tags: ["latest-tag", "immutability", "git-sha", "semver", "deployments"],
    practice: [
      "How do you enable Tag Immutability in AWS Elastic Container Registry (ECR)?",
      "How does pulling by `@sha256:...` digest protect against registry account compromises?"
    ]
  }),

  createCard({
    idNum: 91,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Registry Authentication & Credential Helpers (~/.docker/config.json)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Docker store registry credentials, and why should you use Credential Helpers instead of storing plaintext base64 passwords?",
    quickAnswer: "By default, `docker login` stores usernames and passwords as **unencrypted base64 strings** in plaintext inside `~/.docker/config.json`! Anyone with read access to your home directory can decode your credentials. **Credential Helpers** (e.g. `pass`, `osxkeychain`, `secretservice`, `docker-credential-ecr-login`) delegate credential storage to secure OS keychains or generate temporary IAM tokens.",
    detailedAnswer: "A common security finding on developer machines is reading `~/.docker/config.json` and base64-decoding the `auth` string (`echo <auth> | base64 -d`) to reveal raw production registry passwords. Credential helpers intercept Docker login calls and store tokens inside macOS Keychain, Windows Credential Manager, or Linux Secret Service (`libsecret`). In cloud environments, cloud credential helpers (like `docker-credential-gcr` or AWS ECR helper) exchange instance IAM roles for short-lived OAuth tokens.",
    code: `# INSECURE DEFAULT ~/.docker/config.json (Plaintext base64 credentials!):
# {
#   "auths": {
#     "https://index.docker.io/v1/": {
#       "auth": "dXNlcm5hbWU6bXlwYXNzd29yZDEyMw=="  # Decode with base64 -d!
#     }
#   }
# }

# -------------------------------------------------------------
# SECURE PRODUCTION CONFIGURATION: Use Credential Helper:
{
  "credsStore": "osxkeychain", # On macOS (or "secretservice" on Linux)
  "credHelpers": {
    "public.ecr.aws": "ecr-login",
    "gcr.io": "gcr"
  }
}

# Test native cloud credential helper for AWS ECR:
$ docker-credential-ecr-login get <<< "123456789012.dkr.ecr.us-east-1.amazonaws.com"`,
    recallHint: "Default config.json stores plaintext base64 passwords! Use credsStore (osxkeychain/secretservice) to secure credentials.",
    interviewTip: "Warn against committing `~/.docker/config.json` into Git repositories or baking it into Docker images: this is among the top causes of corporate registry breaches.",
    tags: ["credential-helpers", "config-json", "docker-login", "security", "passwords"],
    practice: [
      "How do you inspect your decoded credentials from `~/.docker/config.json` using `echo ... | base64 -d`?",
      "How does Kubernetes `imagePullSecrets` differ from Docker's local `config.json`?"
    ]
  }),

  createCard({
    idNum: 92,
    category: "Image Security, Supply Chain & Scanning",
    concept: "OCI Distribution Specification & Content-Addressable Pulls",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the OCI Distribution Specification, and how does Content-Addressable storage guarantee that an image has not been tampered with?",
    quickAnswer: "The OCI Distribution Specification defines the standard HTTP API for pushing, pulling, and discovering container images across registries. Storage is **content-addressable**: every layer blob and manifest is named exclusively after the cryptographic SHA256 hash of its contents. If a single byte in an image is modified, its hash changes completely, breaking the manifest signature.",
    detailedAnswer: "In the OCI Distribution spec, all image assets are stored as `/v2/<name>/blobs/sha256:<digest>`. When Docker pulls an image, it downloads the manifest, reads the list of layer hashes, and computes the SHA256 checksum of each incoming layer chunk stream. If the computed hash does not match the manifest descriptor, Docker immediately aborts the pull, preventing Man-in-the-Middle (MitM) payload injections.",
    code: `# Inspect an image manifest directly from a remote registry using curl:
$ TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/alpine:pull" | jq -r .token)
$ curl -s -H "Authorization: Bearer $TOKEN" \
       -H "Accept: application/vnd.oci.image.manifest.v1+json" \
       https://registry-1.docker.io/v2/library/alpine/manifests/latest | jq .

# Sample OCI Manifest Structure:
# {
#   "schemaVersion": 2,
#   "mediaType": "application/vnd.oci.image.manifest.v1+json",
#   "config": {
#     "mediaType": "application/vnd.oci.image.config.v1+json",
#     "digest": "sha256:ace17d5d883e...",
#     "size": 1471
#   },
#   "layers": [
#     {
#       "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
#       "digest": "sha256:d734292770f8...",  # Content-Addressable Layer Hash!
#       "size": 3401490
#     }
#   ]
# }`,
    recallHint: "OCI Distribution: Content-Addressable storage names assets by their SHA256 hash; prevents MitM tampering.",
    interviewTip: "Explain that OCI registries can store non-container artifacts (Helm charts, WebAssembly binaries, Singularity images, SBOMs) using the exact same generic OCI artifact specification.",
    tags: ["oci-distribution", "content-addressable", "sha256", "manifest", "registry-api"],
    practice: [
      "What is an OCI Image Index (manifest list) and how does it support multi-architecture images?",
      "Can an OCI registry store generic file artifacts like Helm charts or Cosign signatures?"
    ]
  }),

  createCard({
    idNum: 93,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Base Image Poisoning & Supply Chain Attacks",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Base Image Poisoning, and what controls prevent pulling compromised third-party images in enterprise environments?",
    quickAnswer: "Base Image Poisoning occurs when an attacker uploads a malicious image to a public registry disguised as a popular library (typosquatting, e.g. `ubunntu` or `nginx-alpine-cors`), or compromises an abandoned public tag to inject cryptominers, credential stealers, or backdoors. Prevent via: 1) Pulling only **Docker Official Images** or verified publishers, 2) Enforcing an internal curated base image registry, and 3) Scanning base images continuously.",
    detailedAnswer: "Over 30% of public images on Docker Hub contain known vulnerabilities, and thousands of malicious images are purged monthly. Developers often blindly copy `FROM someuser/node-backend` from StackOverflow tutorials. Enterprise controls mandate that all Dockerfiles MUST build from internally audited, golden base images hosted on a private corporate registry (e.g. `FROM registry.company.com/golden/node:20`), rejecting all unapproved public registries.",
    code: `# DANGEROUS: Pulling unverified, untrusted community images:
# FROM some-random-dev/python-fastapi:latest  # Could contain hidden rootkit!

# -------------------------------------------------------------
# PRODUCTION ENTERPRISE STANDARD:
# 1. Use verified Docker Official Images with pinned digests:
FROM node:20.12-alpine3.19@sha256:d734292770f8b1a...

# 2. Or pull exclusively from internal private golden image repository:
FROM harbor.company.internal/golden-images/distroless-nodejs:20

# Enforce in CI/CD pipeline via Hadolint linter:
# hadolint checks for unapproved registries:
$ hadolint --trusted-registry harbor.company.internal Dockerfile`,
    recallHint: "Prevent base image poisoning: Pull only Docker Official Images, pin SHA256 digests, and use internal golden registries.",
    interviewTip: "Mention **Hadolint** (Haskell Dockerfile Linter): it can be integrated into pre-commit hooks and CI pipelines to enforce trusted registry rules and block unpinned base images automatically.",
    tags: ["supply-chain", "base-image-poisoning", "hadolint", "golden-images", "security"],
    practice: [
      "How do attackers use typosquatting on Docker Hub to trick developers into pulling malicious images?",
      "How does an internal registry mirror (e.g. Harbor proxy cache) protect against Docker Hub rate limits and image deletion?"
    ]
  }),

  createCard({
    idNum: 94,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Hermetic & Reproducible Builds (SOURCE_DATE_EPOCH)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are Reproducible Container Builds, and why is `SOURCE_DATE_EPOCH` required to generate bit-for-bit identical image hashes?",
    quickAnswer: "A reproducible build guarantees that compiling the exact same source code produces **bit-for-bit identical image binaries and SHA256 hashes**, regardless of when or where the build executes. Because file modification timestamps (`mtime`) normally change on every build, standard images produce different hashes. `SOURCE_DATE_EPOCH` clamps timestamps to a fixed Unix epoch, enabling reproducible layer digests.",
    detailedAnswer: "In high-assurance security environments, you must prove that the container image deployed in production was generated strictly from a specific Git commit, without backdoor injections introduced by compromised CI runners. By locking timestamps (`SOURCE_DATE_EPOCH`), sorting directory file lists alphabetically, and pinning package versions, two independent developers building the same commit arrive at the exact same SHA256 image digest.",
    code: `# syntax=docker/dockerfile:1
FROM alpine:3.19
WORKDIR /app

# Accept fixed commit timestamp from Git (e.g. 1700000000):
ARG SOURCE_DATE_EPOCH=1700000000

# Set build timestamps deterministically:
ENV SOURCE_DATE_EPOCH=\${SOURCE_DATE_EPOCH}

COPY . .

# Build with BuildKit preserving reproducible timestamps:
# $ docker buildx build \
#     --build-arg SOURCE_DATE_EPOCH=$(git log -1 --pretty=%ct) \
#     -t my-reproducible-app .`,
    recallHint: "Reproducible builds generate bit-for-bit identical hashes from same code. Clamps timestamps via SOURCE_DATE_EPOCH.",
    interviewTip: "Highlight that reproducible builds provide independent cryptographic proof against software supply chain attacks, aligning with SLSA Level 3/4 compliance.",
    tags: ["reproducible-builds", "source-date-epoch", "determinism", "slsa", "integrity"],
    practice: [
      "Why does standard `tar` packaging break image hash reproducibility across different build servers?",
      "How does `SOURCE_DATE_EPOCH` interact with package manager timestamps inside `apt` or `apk`?"
    ]
  }),

  createCard({
    idNum: 95,
    category: "Image Security, Supply Chain & Scanning",
    concept: "SLSA Framework & BuildKit Provenance Attestations",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is SLSA (Supply-chain Levels for Software Artifacts), and how does BuildKit attach Provenance Attestations to container images?",
    quickAnswer: "SLSA is a security framework that defines standards for software supply chain integrity. **Provenance Attestation** is a tamper-proof cryptographic metadata document attached to an image that describes *how*, *when*, and *by what CI pipeline* the image was built. BuildKit generates provenance automatically with `--provenance=mode=max`.",
    detailedAnswer: "Before provenance attestations, there was no cryptographic proof linking an image on Docker Hub to a specific GitHub Actions workflow or source commit. An attacker with registry credentials could push a modified image directly. BuildKit's provenance attestation (in SLSA format) records source repository URLs, commit SHAs, build arguments, environment variables, and build tools, storing this signed statement as an OCI artifact linked to the image manifest.",
    code: `# Build and push an image with maximum SLSA provenance attestation:
$ docker buildx build \
    --provenance=mode=max \
    --sbom=true \
    -t my-registry.com/my-app:1.0.0 \
    --push .

# Inspect the cryptographic SLSA provenance attestation using buildx imagetools:
$ docker buildx imagetools inspect --format '{{json .Provenance}}' my-registry.com/my-app:1.0.0 | jq .
# Sample Output:
# {
#   "_type": "https://in-toto.io/Statement/v0.1",
#   "predicateType": "https://slsa.dev/provenance/v0.2",
#   "predicate": {
#     "builder": { "id": "https://github.com/moby/buildkit" },
#     "buildType": "https://mobyproject.org/buildkit@v1",
#     "materials": [
#       { "uri": "git+https://github.com/my-org/my-app", "digest": { "sha1": "a1b2c3..." } }
#     ]
#   }
# }`,
    recallHint: "SLSA Provenance proves image origin; BuildKit adds it via --provenance=mode=max as an OCI attestation.",
    interviewTip: "Mention that Google Cloud Artifact Registry and AWS ECR natively display SLSA provenance and SBOM attestations directly in their cloud web consoles.",
    tags: ["slsa", "provenance", "attestations", "buildkit", "supply-chain-security"],
    practice: [
      "What are the 4 levels of the SLSA framework?",
      "How does an in-toto attestation statement format structure container provenance data?"
    ]
  }),

  createCard({
    idNum: 96,
    category: "Image Security, Supply Chain & Scanning",
    concept: "Private Container Registries Deployment (Harbor, ECR)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What enterprise capabilities do private registries like CNCF Harbor provide over a basic Docker Distribution registry?",
    quickAnswer: "While a basic registry only stores and serves layer blobs, **Harbor** provides: 1) Role-Based Access Control (RBAC) with LDAP/OIDC integration, 2) Automated vulnerability scanning on push (Trivy), 3) Policy-based image retention and garbage collection, 4) Tag immutability rules, 5) Webhook notifications, and 6) Proxy-caching mirrors for Docker Hub.",
    detailedAnswer: "Running `docker run -d -p 5000:5000 registry:2` provides an unauthenticated raw registry suitable only for local prototyping. In enterprise environments, CNCF graduated project **Harbor** is the standard self-hosted registry. It allows security teams to enforce policies like 'Block images from being pulled if they contain Critical CVEs' or 'Enforce Cosign signature verification before deployment'.",
    code: `# 1. Deploy lightweight local private registry for testing:
$ docker run -d -p 5000:5000 --name local-registry registry:2

# 2. Tag and push an image to local registry:
$ docker tag alpine:latest localhost:5000/my-alpine:1.0
$ docker push localhost:5000/my-alpine:1.0

# 3. Pull from local registry:
$ docker pull localhost:5000/my-alpine:1.0

# 4. Insecure Registry Configuration:
# By default, Docker requires HTTPS for all registries except localhost!
# To allow an internal HTTP registry, declare in /etc/docker/daemon.json:
# {
#   "insecure-registries": ["192.168.1.50:5000"]
# }`,
    recallHint: "Basic registry: simple blob storage. Harbor: Enterprise RBAC, Trivy scanning on push, tag immutability, and proxy cache.",
    interviewTip: "Highlight Harbor's Proxy Cache feature: it caches public Docker Hub images on-premises, completely shielding your CI/CD pipelines from Docker Hub's 100-pull-per-6-hours rate limit.",
    tags: ["harbor", "private-registry", "ecr", "rbac", "image-governance"],
    practice: [
      "Why does Docker reject connecting to a non-localhost registry over unencrypted HTTP by default?",
      "How does Harbor's Proxy Cache protect CI/CD pipelines from Docker Hub rate limiting?"
    ]
  })
];
