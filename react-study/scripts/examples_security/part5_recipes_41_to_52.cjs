// scripts/examples_security/part5_recipes_41_to_52.cjs
module.exports = [
  {
    id: "sec-ex-41",
    title: "AWS S3 Account-Level Block Public Access Configuration Script",
    category: "Container & Cloud Security",
    difficulty: "beginner",
    whatThisCodeCovers: "Automating account-wide AWS S3 Block Public Access using AWS SDK v3 to prevent public bucket data leaks.",
    conceptsCovered: ["AWS S3", "Block Public Access", "Cloud Governance", "S3 Control"],
    code: `// scripts/enableS3BlockPublicAccess.ts
import { S3ControlClient, PutPublicAccessBlockCommand } from '@aws-sdk/client-s3-control';

const client = new S3ControlClient({ region: 'us-east-1' });

export async function enforceAccountWideS3Block(accountId: string) {
  console.log(\`Enforcing global S3 Block Public Access on AWS Account \${accountId}...\`);

  await client.send(new PutPublicAccessBlockCommand({
    AccountId: accountId,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: true
    }
  }));

  console.log('Successfully enabled 100% S3 Block Public Access across entire AWS account.');
}`,
    breakdown: [
      "Applies global master override across all S3 buckets in the AWS account.",
      "Overrides any accidental 'public-read' ACLs or permissive bucket policies.",
      "Eliminates the #1 historical cause of catastrophic cloud data leaks."
    ],
    expectedOutput: "Sets all four S3 Block Public Access flags to true at the AWS account level."
  },
  {
    id: "sec-ex-42",
    title: "Terraform IAM Least-Privilege Policy with Permission Boundaries",
    category: "Container & Cloud Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "Defining an IAM role in Terraform constrained by an IAM Permission Boundary to prevent privilege escalation.",
    conceptsCovered: ["Terraform", "IAM Security", "Permission Boundary", "Privilege Escalation Defense"],
    code: `# main.tf - Hardened IAM Role with Permission Boundary
data "aws_iam_policy_document" "developer_boundary" {
  statement {
    sid       = "AllowStandardCloudServices"
    effect    = "Allow"
    actions   = ["s3:*", "dynamodb:*", "lambda:*", "logs:*"]
    resources = ["*"]
  }

  statement {
    sid       = "DenyPrivilegeEscalation"
    effect    = "Deny"
    actions   = [
      "iam:CreatePolicyVersion",
      "iam:SetDefaultPolicyVersion",
      "iam:PassRole",
      "iam:AttachUserPolicy",
      "iam:AttachRolePolicy"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "boundary" {
  name        = "DeveloperPermissionsBoundary"
  description = "Maximum ceiling for delegated roles"
  policy      = data.aws_iam_policy_document.developer_boundary.json
}

resource "aws_iam_role" "app_role" {
  name                 = "enterprise-microservice-role"
  assume_role_policy   = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" } }]
  })
  permissions_boundary = aws_iam_policy.boundary.arn
}`,
    breakdown: [
      "Sets an unbreakable permissions boundary ceiling on the role.",
      "Explicitly denies iam:PassRole and policy creation actions to prevent privilege escalation.",
      "Guarantees that even if policies are added, effective permissions cannot exceed the boundary."
    ],
    expectedOutput: "Provisions ECS task IAM role locked within a secure permissions boundary."
  },
  {
    id: "sec-ex-43",
    title: "CycloneDX Software Bill of Materials (SBOM) Generation Script",
    category: "DevSecOps & Supply Chain Security",
    difficulty: "beginner",
    whatThisCodeCovers: "Generating machine-readable CycloneDX JSON and SPDX Software Bills of Materials for Node.js projects using @cyclonedx/cyclonedx-npm.",
    conceptsCovered: ["SBOM", "CycloneDX", "Supply Chain Inventory", "Executive Order 14028"],
    code: `// scripts/generateSbom.ts
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export function generateProjectSbom() {
  console.log('[SBOM] Generating CycloneDX v1.5 Software Bill of Materials...');

  const outputPath = path.resolve(process.cwd(), 'sbom.cyclonedx.json');

  // Run CycloneDX CLI to analyze package-lock.json and dependency tree
  execSync(
    \`npx @cyclonedx/cyclonedx-npm --output-file \${outputPath} --output-format JSON --spec-version 1.5\`,
    { stdio: 'inherit' }
  );

  const stats = fs.statSync(outputPath);
  console.log(\`[SBOM] Successfully created \${outputPath} (\${(stats.size / 1024).toFixed(1)} KB)\`);
}

generateProjectSbom();`,
    breakdown: [
      "Parses package-lock.json to catalog all direct and transitive dependencies.",
      "Generates standardized CycloneDX v1.5 JSON SBOM with purl package identifiers.",
      "Enables instant CVE lookups in Dependency-Track when zero-days emerge."
    ],
    expectedOutput: "Outputs valid sbom.cyclonedx.json cataloging entire software supply chain."
  },
  {
    id: "sec-ex-44",
    title: "Sigstore Cosign Keyless Container Signing in GitHub Actions",
    category: "DevSecOps & Supply Chain Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configuring a GitHub Actions workflow to sign container images keylessly using Sigstore Fulcio and Rekor transparency logs.",
    conceptsCovered: ["Sigstore", "Cosign", "Keyless Signing", "OIDC Attestation", "GitHub Actions"],
    code: `# .github/workflows/sign-image.yml
name: Build and Sign Container Image

on:
  push:
    branches: [main]

permissions:
  contents: read
  packages: write
  id-token: write # MANDATORY: Required for Sigstore OIDC authentication!

jobs:
  build-and-sign:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Cosign
        uses: sigstore/cosign-installer@v3.4.0

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push Docker Image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/\${{ github.repository }}:latest

      - name: Sign Image with Sigstore (Keyless)
        run: |
          cosign sign --yes ghcr.io/\${{ github.repository }}@\${{ steps.build.outputs.digest }}`,
    breakdown: [
      "permissions.id-token: write enables GitHub Actions OIDC identity token generation.",
      "cosign sign --yes contacts Sigstore Fulcio CA to issue ephemeral 10-minute certificate.",
      "Publishes cryptographic signature to Rekor transparency log without static private keys."
    ],
    expectedOutput: "Signs container image and records verifiable attestation in public Rekor ledger."
  },
  {
    id: "sec-ex-45",
    title: "npm Private Registry Scoping Configuration (Dependency Confusion Defense)",
    category: "DevSecOps & Supply Chain Security",
    difficulty: "beginner",
    whatThisCodeCovers: "Hardening .npmrc and package.json to isolate company packages to an internal private registry and neutralize dependency confusion.",
    conceptsCovered: ["Dependency Confusion", ".npmrc", "Scoped Packages", "Registry Hardening"],
    code: `# .npmrc (Place in root of project)

# 1. Lock enterprise scoped packages strictly to private Artifactory/Verdaccio registry
@enterprise:registry=https://artifactory.enterprise.com/api/npm/npm-private/
//artifactory.enterprise.com/api/npm/npm-private/:_authToken=\${NPM_PRIVATE_TOKEN}
always-auth=true

# 2. Public packages resolve to standard public registry
registry=https://registry.npmjs.org/

# 3. Enforce strict lockfile compliance in CI builds
package-lock=true
save-exact=true`,
    breakdown: [
      "Directs @enterprise/* scope exclusively to private internal repository.",
      "Prevents npm from checking public npmjs.org for company-scoped package names.",
      "Neutralizes Alex Birsan dependency confusion attack vectors."
    ],
    expectedOutput: "Ensures private packages are never downloaded from public npm registries."
  },
  {
    id: "sec-ex-46",
    title: "Pre-Commit Gitleaks Secret Scanning Configuration Hook",
    category: "DevSecOps & Supply Chain Security",
    difficulty: "beginner",
    whatThisCodeCovers: "Configuring Gitleaks pre-commit hooks to block developers from accidentally committing AWS keys, JWTs, and private keys into git history.",
    conceptsCovered: ["Gitleaks", "Secret Scanning", "Pre-Commit Hooks", "Credential Defense"],
    code: `# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.2
    hooks:
      - id: gitleaks
        name: Detect Hardcoded Secrets
        entry: gitleaks protect --verbose --staged
        language: golang
        stages: [commit]

# Optional local gitleaks.toml customization:
/*
[extend]
useDefault = true

[allowlist]
description = "Ignore mock test keys in unit tests"
paths = [
  '''tests/mocks/.*'''
]
*/`,
    breakdown: [
      "Scans staged git diffs locally on developer machines before commit is created.",
      "Detects AWS, Stripe, Slack, private keys, and high-entropy password strings.",
      "Prevents secrets ever entering the immutable git repository commit graph."
    ],
    expectedOutput: "Aborts 'git commit' with error if private keys or tokens are detected in staged files."
  },
  {
    id: "sec-ex-47",
    title: "RFC 9116 security.txt Public Disclosure Manifest",
    category: "DevSecOps & Supply Chain Security",
    difficulty: "beginner",
    whatThisCodeCovers: "Deploying a compliant /.well-known/security.txt file adhering to RFC 9116 with PGP encryption keys and legal safe harbor terms.",
    conceptsCovered: ["RFC 9116", "security.txt", "Vulnerability Disclosure", "PGP Key", "Safe Harbor"],
    code: `# public/.well-known/security.txt (RFC 9116 Compliant)

# Primary security incident response mailbox
Contact: mailto:security-disclosure@enterprise.com
Contact: https://enterprise.com/security/report

# PGP Public Key for encrypted vulnerability reports
Encryption: https://enterprise.com/.well-known/pgp-key.asc

# Legal Safe Harbor Policy promising not to prosecute good-faith researchers
Policy: https://enterprise.com/security/safe-harbor

# Preferred languages for reports
Preferred-Languages: en

# Canonical location of this file
Canonical: https://enterprise.com/.well-known/security.txt

# Mandatory expiration timestamp (maximum 1 year into future)
Expires: 2027-11-01T00:00:00.000Z`,
    breakdown: [
      "Provides clear, standardized contact channel for ethical security researchers.",
      "Includes public PGP key URL for encrypting sensitive vulnerability disclosures.",
      "Links to legal Safe Harbor policy promising non-prosecution for good-faith testing."
    ],
    expectedOutput: "Serves standardized text file at /.well-known/security.txt."
  },
  {
    id: "sec-ex-48",
    title: "High-Throughput Structured Security Audit Logger (SIEM Ingest)",
    category: "Incident Response & Forensics",
    difficulty: "intermediate",
    whatThisCodeCovers: "A high-performance structured security logger formatting events into ECS (Elastic Common Schema) JSON for SIEM ingestion.",
    conceptsCovered: ["SIEM", "ECS Format", "Audit Logging", "Structured JSON", "Pino Logger"],
    code: `// lib/security/auditLogger.ts
import pino from 'pino';

// Dedicated audit logger writing to stdout for FluentBit / Datadog Agent collection
const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export interface SecurityEvent {
  action: string;
  category: 'authentication' | 'authorization' | 'data-access' | 'configuration';
  outcome: 'SUCCESS' | 'FAILURE';
  actor: {
    id: string;
    ip: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id: string;
  };
  metadata?: Record<string, any>;
}

export function logSecurityEvent(event: SecurityEvent) {
  logger.info({
    ecs_version: '1.12.0',
    event: {
      category: [event.category],
      action: event.action,
      outcome: event.outcome.toLowerCase()
    },
    user: { id: event.actor.id },
    client: { ip: event.actor.ip, user_agent: event.actor.userAgent },
    destination: { service: event.resource.type, resource_id: event.resource.id },
    ...event.metadata
  });
}`,
    breakdown: [
      "Formats logs according to Elastic Common Schema (ECS) standard.",
      "Captures Actor (user, IP), Action, Outcome, and Resource consistently.",
      "Streams structured JSON to stdout for zero-blocking asynchronous SIEM ingestion."
    ],
    expectedOutput: "Outputs normalized JSON log line ingestible by Splunk, Datadog, or Elastic Security."
  },
  {
    id: "sec-ex-49",
    title: "Cryptographic Hash-Chained Audit Ledger",
    category: "Incident Response & Forensics",
    difficulty: "advanced",
    whatThisCodeCovers: "Implementing an immutable, tamper-evident audit log ledger where each entry contains a SHA-256 hash chain of the previous entry.",
    conceptsCovered: ["Hash Chaining", "Merkle DAG", "Immutable Logs", "Tamper Detection", "Audit Trails"],
    code: `// lib/security/auditLedger.ts
import crypto from 'crypto';

export interface AuditBlock {
  sequence: number;
  timestamp: string;
  eventType: string;
  actorId: string;
  details: string;
  previousHash: string;
  currentHash: string;
}

export class CryptographicAuditLedger {
  private lastHash: string = '0000000000000000000000000000000000000000000000000000000000000000';
  private sequenceCounter: number = 0;

  appendEntry(eventType: string, actorId: string, details: string): AuditBlock {
    this.sequenceCounter += 1;
    const timestamp = new Date().toISOString();

    // Data string to hash: sequence:timestamp:eventType:actorId:details:previousHash
    const rawData = [
      this.sequenceCounter,
      timestamp,
      eventType,
      actorId,
      details,
      this.lastHash
    ].join('|');

    const currentHash = crypto.createHash('sha256').update(rawData).digest('hex');

    const block: AuditBlock = {
      sequence: this.sequenceCounter,
      timestamp,
      eventType,
      actorId,
      details,
      previousHash: this.lastHash,
      currentHash
    };

    // Advance chain pointer
    this.lastHash = currentHash;
    return block;
  }

  // Verifies the entire ledger chain is intact and un-tampered
  static verifyLedgerIntegrity(chain: AuditBlock[]): boolean {
    for (let i = 0; i < chain.length; i++) {
      const block = chain[i];
      const prevHash = i === 0
        ? '0000000000000000000000000000000000000000000000000000000000000000'
        : chain[i - 1].currentHash;

      if (block.previousHash !== prevHash) return false;

      const rawData = [
        block.sequence,
        block.timestamp,
        block.eventType,
        block.actorId,
        block.details,
        block.previousHash
      ].join('|');

      const expected = crypto.createHash('sha256').update(rawData).digest('hex');
      if (block.currentHash !== expected) return false;
    }
    return true;
  }
}`,
    breakdown: [
      "Chains each log entry mathematically to the SHA-256 hash of the preceding block.",
      "verifyLedgerIntegrity detects any retroactive modification, deletion, or reordering of logs.",
      "Provides courtroom-admissible proof that audit logs were not modified post-incident."
    ],
    expectedOutput: "Generates tamper-evident hash-chained logs; verifyLedgerIntegrity returns true."
  },
  {
    id: "sec-ex-50",
    title: "Emergency AWS EC2 Network Quarantine Automation Script",
    category: "Incident Response & Forensics",
    difficulty: "intermediate",
    whatThisCodeCovers: "An emergency incident response script modifying an EC2 instance's security groups to quarantine it without rebooting or destroying volatile RAM.",
    conceptsCovered: ["Quarantine SG", "Incident Response", "AWS SDK v3", "Blast Radius Isolation"],
    code: `// scripts/quarantineInstance.ts
import { EC2Client, ModifyInstanceAttributeCommand, DescribeInstancesCommand } from '@aws-sdk/client-ec2';

const ec2 = new EC2Client({ region: process.env.AWS_REGION || 'us-east-1' });

export async function emergencyQuarantineInstance(instanceId: string, quarantineSgId: string) {
  console.warn(\`[SEV-0 INCIDENT] Quarantining compromised EC2 instance: \${instanceId}...\`);

  // 1. Snapshot existing security groups for forensic records
  const describeRes = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
  const existingSgs = describeRes.Reservations?.[0]?.Instances?.[0]?.SecurityGroups?.map(sg => sg.GroupId) || [];
  console.log('Original Security Groups:', existingSgs);

  // 2. Atomically replace all Security Groups with Quarantine SG (zero ingress, zero egress!)
  await ec2.send(new ModifyInstanceAttributeCommand({
    InstanceId: instanceId,
    Groups: [quarantineSgId]
  }));

  console.log(\`[SUCCESS] Instance \${instanceId} is now isolated from internet & internal VPC. Blast radius contained.\`);
}`,
    breakdown: [
      "Atomically swaps all attached security groups for a single zero-ingress/zero-egress quarantine group.",
      "Drops all active TCP connections to attacker Command & Control servers within seconds.",
      "Keeps the virtual machine powered on to preserve volatile RAM memory state for forensics."
    ],
    expectedOutput: "Isolates compromised EC2 instance without rebooting or destroying forensic memory."
  },
  {
    id: "sec-ex-51",
    title: "Volatile Memory Dump (LiME) & Live Network Socket Collector",
    category: "Incident Response & Forensics",
    difficulty: "advanced",
    whatThisCodeCovers: "A forensic acquisition bash script capturing open network sockets, process tables, and dumping physical RAM via LiME.",
    conceptsCovered: ["Live Forensics", "LiME", "Volatile Memory", "Chain of Custody", "SHA-256"],
    code: `#!/usr/bin/env bash
# scripts/acquire_volatile_forensics.sh
set -euo pipefail

CASE_ID="INCIDENT-$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR="/mnt/forensic_usb/\${CASE_ID}"
mkdir -p "\${OUTPUT_DIR}"

echo "[+] Starting Volatile Forensic Acquisition for \${CASE_ID}..."

# 1. Capture system date and uptime
date -u --iso-8601=seconds > "\${OUTPUT_DIR}/system_time.txt"
uptime >> "\${OUTPUT_DIR}/system_time.txt"

# 2. Capture active network connections and sockets (Order of Volatility)
echo "[+] Capturing network sockets..."
ss -tlpna > "\${OUTPUT_DIR}/active_sockets.txt"
netstat -rn > "\${OUTPUT_DIR}/routing_table.txt"
arp -an > "\${OUTPUT_DIR}/arp_cache.txt"

# 3. Capture process tree with full arguments
echo "[+] Capturing process hierarchy..."
ps auxwwf > "\${OUTPUT_DIR}/process_tree.txt"

# 4. Dump physical RAM memory via LiME kernel module
if [ -f "/opt/lime/lime.ko" ]; then
  echo "[+] Dumping physical RAM memory via LiME..."
  insmod /opt/lime/lime.ko "path=\${OUTPUT_DIR}/memory.raw format=raw"
  rmmod lime
fi

# 5. Compute cryptographic SHA-256 checksums for Chain of Custody
echo "[+] Computing SHA-256 checksums..."
cd "\${OUTPUT_DIR}"
sha256sum * > "\${OUTPUT_DIR}/checksums.sha256"

echo "[SUCCESS] Acquisition complete. Verified evidence written to \${OUTPUT_DIR}."`,
    breakdown: [
      "Adheres strictly to RFC 3227 Order of Volatility: captures network, sockets, processes, and RAM.",
      "Dumps live memory using LiME kernel module to external write-blocked storage.",
      "Computes cryptographic SHA-256 hashes on all captured artifacts to preserve legal chain of custody."
    ],
    expectedOutput: "Captures volatile system memory and generates verifiable checksums.sha256 file."
  },
  {
    id: "sec-ex-52",
    title: "Athena Threat Hunting SQL Query for VPC Flow Log Exfiltration",
    category: "Incident Response & Forensics",
    difficulty: "advanced",
    whatThisCodeCovers: "An AWS Athena SQL query analyzing VPC Flow Logs to detect outbound data exfiltration anomalies and lateral movement.",
    conceptsCovered: ["Threat Hunting", "VPC Flow Logs", "AWS Athena", "Data Exfiltration Detection"],
    code: `-- athena/queries/hunt_data_exfiltration.sql
-- Identifies internal EC2/EKS instances transferring high volumes of data to unusual external IPs

SELECT 
    DATE_TRUNC('hour', FROM_UNIXTIME(starttime)) AS window_hour,
    srcaddr AS internal_source_ip,
    dstaddr AS external_destination_ip,
    dstport AS destination_port,
    protocol,
    COUNT(*) AS total_flow_records,
    SUM(packets) AS total_packets,
    ROUND(SUM(bytes) / (1024.0 * 1024.0), 2) AS exfiltrated_megabytes
FROM vpc_flow_logs
WHERE action = 'ACCEPT'
  -- Filter for internal VPC private source IPs (RFC 1918)
  AND (srcaddr LIKE '10.%' OR srcaddr LIKE '172.16.%' OR srcaddr LIKE '192.168.%')
  -- Exclude standard public web ports (HTTP/HTTPS) and internal VPC destinations
  AND dstport NOT IN (80, 443, 53)
  AND dstaddr NOT LIKE '10.%'
  AND dstaddr NOT LIKE '172.16.%'
  AND dstaddr NOT LIKE '192.168.%'
GROUP BY 1, 2, 3, 4, 5
HAVING SUM(bytes) > 50000000 -- Threshold: Greater than 50 Megabytes
ORDER BY exfiltrated_megabytes DESC
LIMIT 50;`,
    breakdown: [
      "Aggregates hourly traffic volumes per source-destination IP and port tuple.",
      "Filters for internal RFC 1918 IPs sending traffic to external destinations over non-standard ports.",
      "Pinpoints data exfiltration over custom TCP ports and hidden reverse shell connections."
    ],
    expectedOutput: "Returns ranked list of internal IPs exfiltrating large data volumes to unknown external endpoints."
  }
];
