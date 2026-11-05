// scripts/data_security/cat10_incident_forensics.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "Incident Response & Forensic Telemetry";

module.exports = [
  card(
    109,
    cat,
    "Incident Response Lifecycles: NIST SP 800-61 vs SANS",
    "must-know",
    "intermediate",
    "What are the standardized phases of the incident response lifecycle according to NIST SP 800-61 and SANS?",
    "NIST SP 800-61 defines four continuous phases: 1) Preparation; 2) Detection & Analysis; 3) Containment, Eradication & Recovery; 4) Post-Incident Activity. SANS breaks this into six discrete steps: Preparation, Identification, Containment, Eradication, Recovery, and Lessons Learned.",
    "During an active security breach, panic and chaotic ad-hoc troubleshooting lead to evidence destruction or accidental attacker notification. Standardized frameworks enforce structured response: 1) Preparation: Establishing communication out-of-band (Signal/Slack), rotating on-call IR rotas, and provisioning forensic toolkits; 2) Detection & Analysis: Triaging alerts, assessing scope, and validating whether an anomaly is a genuine incident; 3) Containment: Isolating compromised hosts (network quarantine) to halt lateral movement without destroying volatile RAM; 4) Eradication: Purging malware, rotating compromised credentials, and closing vulnerabilities; 5) Recovery: Restoring systems from clean, verified backups and monitoring for recurrence; 6) Post-Incident Activity: Documenting root cause, timeline, and corrective actions.",
    `// Incident Severity Classification Matrix:
type IncidentSeverity = 'SEV-0' | 'SEV-1' | 'SEV-2' | 'SEV-3';

interface IncidentTriage {
  id: string;
  severity: IncidentSeverity;
  dataCompromised: boolean; // Triggers legal/compliance breach clock!
  affectedHosts: number;
  containmentStatus: 'ACTIVE_EXFILTRATION' | 'CONTAINED' | 'ERADICATED';
}

// SEV-0: Active exfiltration of production database / complete root compromise
// SEV-1: Single server compromised, lateral movement blocked
// SEV-2: Potential malware infection on isolated employee laptop
// SEV-3: Non-critical automated phishing / scanning alert`,
    "Never reboot or terminate a compromised machine immediately. Rebooting destroys volatile RAM evidence containing cryptographic keys, uncommitted malware payloads, and active network connections.",
    ["incident-response", "nist-800-61", "sans", "incident-lifecycle", "containment"]
  ),
  card(
    110,
    cat,
    "Security Information & Event Management (SIEM) Ingestion",
    "must-know",
    "intermediate",
    "What is the role of a SIEM (Splunk, Datadog, Elastic Security) in correlating distributed telemetry and detecting advanced persistent threats?",
    "A SIEM aggregates, normalizes, and correlates high-volume security logs from disparate infrastructure tiers (WAF, cloud audit logs, VPC flow logs, endpoint EDR, identity providers) to detect multi-stage attack patterns using real-time correlation rules.",
    "Individual logs rarely reveal an intrusion: an authentication failure is normal, and an unusual outbound port connection may seem innocuous. A SIEM connects the dots in real-time: Alert triggers IF (5 failed logins on User X from IP Y) THEN (Successful login from IP Y 2 minutes later) AND (New AWS IAM Access Key created by User X) AND (Outbound connection to known Tor exit node). Correlation engines convert millions of raw events per second into prioritized actionable security alerts.",
    `// Structured JSON Security Event Logging for SIEM ingestion
export function logSecurityEvent(event: {
  action: string;
  actor: { userId: string; ip: string; userAgent?: string };
  resource: { type: string; id: string };
  outcome: 'SUCCESS' | 'DENIED' | 'ERROR';
  riskScore?: number;
}) {
  const payload = {
    schema_version: "1.2.0",
    timestamp: new Date().toISOString(),
    event_category: "authentication",
    ...event
  };

  // Writes to stdout -> Collected by FluentBit/Datadog Agent -> Forwarded to SIEM
  console.log(JSON.stringify(payload));
}`,
    "Ensure all timestamps across all servers are synchronized using NTP and formatted in UTC (ISO 8601). Asymmetric clocks make forensic timeline reconstruction impossible.",
    ["siem", "splunk", "datadog", "log-correlation", "security-telemetry"]
  ),
  card(
    111,
    cat,
    "Immutable Audit Logging & Cryptographic Hash Chaining",
    "must-know",
    "intermediate",
    "How does cryptographic hash chaining (Merkle DAG / Ledger) guarantee that audit logs cannot be modified or deleted by an attacker with root access?",
    "In a cryptographic hash-chained audit log, every log entry includes the SHA-256 hash of the previous log entry: Hash(N) = SHA256(EntryData || Hash(N-1)). Any retroactive deletion or alteration breaks the mathematical hash chain of all subsequent entries.",
    "When sophisticated attackers compromise a server, their standard procedure is clearing system logs (history -c, shred /var/log/auth.log) to erase forensic footprints. Defense requires: 1) Real-time streaming: logs are shipped out-of-band immediately over network pipes to a separate, isolated logging account; 2) Cryptographic chaining: each entry is tied to the preceding hash; 3) Write-Once-Read-Many (WORM) storage: storing logs in AWS S3 with Object Lock Compliance Mode, making it physically impossible to delete logs even with AWS root credentials.",
    `import crypto from 'crypto';

interface AuditLogBlock {
  index: number;
  timestamp: string;
  event: string;
  prevHash: string;
  hash: string;
}

export function createAuditEntry(event: string, prevHash: string, index: number): AuditLogBlock {
  const timestamp = new Date().toISOString();
  const raw = \`\${index}:\${timestamp}:\${event}:\${prevHash}\`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  return { index, timestamp, event, prevHash, hash };
}`,
    "Ship audit logs out-of-band in real-time to an isolated AWS account with S3 Object Lock Compliance Mode enabled.",
    ["immutable-logs", "hash-chaining", "audit-trail", "forensics", "s3-object-lock"]
  ),
  card(
    112,
    cat,
    "Live Memory Forensics & Volatility Analysis",
    "advanced",
    "advanced",
    "Why is volatile RAM the most critical forensic artifact during an incident, and how do tools like LiME and Volatility extract injected malware?",
    "Volatile memory (RAM) contains artifacts that never touch the physical disk: decrypted cryptographic keys, plaintext passwords, injected fileless in-memory DLL/ELF malware, active network socket states, and recently executed bash commands.",
    "Modern sophisticated malware operates filelessly in RAM (using memfd_create on Linux or process hollowing on Windows) to evade disk-based antivirus scanners. If an investigator reboots or powers down the machine, the entire malware payload and running state evaporate. Forensic procedure: 1) Dump live physical RAM using a kernel module (LiME on Linux or WinPmem on Windows) to an external encrypted drive; 2) Capture volatile network socket tables (netstat / ss); 3) Analyze the memory dump offline using Volatility to reconstruct process trees, scan for injected shellcode, and extract TLS master secrets.",
    `# Linux Live Memory Acquisition using LiME (Linux Memory Extractor):
# insmod lime-kernel-module.ko "path=/mnt/forensic-usb/mem_dump.raw format=raw"

# Offline Analysis using Volatility 3:
# python3 vol.py -f mem_dump.raw linux.pslist.PsList        # List all running processes
# python3 vol.py -f mem_dump.raw linux.malfind.Malfind      # Scan memory for injected hidden code
# python3 vol.py -f mem_dump.raw linux.sockstat.Sockstat    # List active open TCP/UDP sockets`,
    "Never pull the power plug or reboot a compromised server before capturing a RAM memory image. Powering down erases the evidence.",
    ["memory-forensics", "volatility", "lime", "fileless-malware", "dfir"]
  ),
  card(
    113,
    cat,
    "Compromise Containment: Quarantine vs Snapshot vs Termination",
    "must-know",
    "intermediate",
    "During an active server compromise, what are the exact technical steps to isolate the blast radius without destroying forensic evidence?",
    "Instead of rebooting or terminating the instance, the correct containment protocol is: 1) Take live disk and RAM snapshots; 2) Swap the instance's Security Group to an isolated Quarantine Security Group (blocking all ingress and egress); 3) Preserve instance metadata for legal forensics.",
    "Terminating a server immediately stops data exfiltration, but destroys all volatile evidence, making it impossible to determine how the attacker got in or what data was stolen. Protocol: 1) Apply Quarantine Security Group: Inbound: none, Outbound: none (stops C2 and exfiltration immediately); 2) Take an immediate AWS EBS volume snapshot; 3) Take a memory dump via AWS SSM; 4) Check CloudTrail to see what IAM role the instance held and revoke all active STS credentials for that role immediately.",
    `# Emergency AWS Containment CLI Script:
INSTANCE_ID="i-0123456789abcdef0"
QUARANTINE_SG="sg-quarantine-deny-all"

# 1. Isolate network immediately (drops all inbound/outbound packets!)
aws ec2 modify-instance-attribute \\
  --instance-id $INSTANCE_ID \\
  --groups $QUARANTINE_SG

# 2. Snapshot disk for offline forensics
aws ec2 create-snapshot \\
  --volume-id vol-0123456789 \\
  --description "Forensic Snapshot Incident #408"`,
    "Containment means cutting network connectivity while keeping power on to preserve forensic memory.",
    ["containment", "quarantine", "incident-triage", "ebs-snapshot", "blast-radius"]
  ),
  card(
    114,
    cat,
    "Indicators of Compromise (IoC) vs Indicators of Attack (IoA)",
    "must-know",
    "intermediate",
    "What is the operational difference between Indicators of Compromise (IoCs) and Indicators of Attack (IoAs) in modern threat hunting?",
    "Indicators of Compromise (IoCs) are forensic evidence of past intrusions (e.g. specific file hashes, malicious IP addresses, known malware domain names). Indicators of Attack (IoAs) focus on real-time adversary intent, behaviors, and tactics (e.g. process injection, unauthorized credential dumping, lateral movement) regardless of the specific malware used.",
    "IoCs are reactive and brittle: an attacker can change their IP address in 10 seconds and recompile their malware with a single byte change to generate a new SHA-256 hash, bypassing all IoC matchers. IoAs are proactive and durable (mapped to MITRE ATT&CK): whether the attacker uses Mimikatz or a custom zero-day script, if a process attempts to read the memory of lsass.exe or invoke vssadmin delete shadows, the IoA behavioral detection engine flags the attack in real-time.",
    `// IoC vs IoA Detection Logic:
// 1. Brittle IoC Rule:
// IF file.sha256 == "8f14e45fceea167a5a36dedd4bea2543" -> Block
// (Bypassed if attacker changes a single byte in the binary!)

// 2. Resilient Behavioral IoA Rule:
// IF process.name == "powershell.exe"
//    AND command_line CONTAINS "-enc" 
//    AND parent_process == "w3wp.exe" (IIS Web Server spawning shell!)
//    AND network.outbound_connections > 0
// -> BLOCK & ALERT IMMEDIATELY! (Catches zero-days!)`,
    "Focus detection engineering on IoAs (adversary behavior and techniques) rather than chasing ephemeral IoCs (IP addresses and file hashes).",
    ["ioc", "ioa", "threat-hunting", "behavioral-detection", "mitre-attack"]
  ),
  card(
    115,
    cat,
    "Threat Hunting & Anomaly Detection",
    "advanced",
    "advanced",
    "How do security teams conduct proactive Threat Hunting using hypothesis-driven methodologies and behavioral baselines?",
    "Threat hunting is the proactive, iterative search through networks and endpoints to detect advanced adversaries who have bypassed automated security alerts and established undetected persistence.",
    "Automated alerts catch known threats. Threat hunting assumes sophisticated attackers are already inside the environment undetected (e.g. dwell time averaging 10-30 days). The hunting cycle: 1) Formulate Hypothesis based on threat intelligence (e.g. 'Adversaries are abusing cloud metadata via SSRF'); 2) Query historical telemetry (VPC Flow Logs, CloudTrail, auditd); 3) Identify anomalies (e.g. a worker pod communicating with external IPs over non-standard ports); 4) Investigate findings; 5) Automate new detection rules in the SIEM based on hunt results.",
    `-- Threat Hunting SQL Query in Athena / Snowflake over VPC Flow Logs:
-- Identify internal pods establishing high-volume outbound connections to unusual external ports
SELECT 
    srcaddr AS internal_pod_ip,
    dstaddr AS external_destination_ip,
    dstport AS destination_port,
    SUM(bytes) / 1024 / 1024 AS total_megabytes_exfiltrated
FROM vpc_flow_logs
WHERE action = 'ACCEPT'
  AND dstport NOT IN (80, 443, 53)
  AND srcaddr LIKE '10.0.%'
GROUP BY 1, 2, 3
HAVING SUM(bytes) > 100000000 -- Over 100MB
ORDER BY total_megabytes_exfiltrated DESC;`,
    "Threat hunting is not waiting for an alert to fire; it is actively investigating raw data with the hypothesis that a breach has already occurred.",
    ["threat-hunting", "athena-queries", "vpc-flow-logs", "dwell-time", "dfir"]
  ),
  card(
    116,
    cat,
    "Breach Disclosure Regulations: GDPR 72-Hour & SEC 4-Day Rules",
    "must-know",
    "intermediate",
    "What are the strict legal notification timelines under GDPR (72 hours) and SEC Form 8-K (4 business days) upon confirming a material cybersecurity incident?",
    "Under GDPR Article 33, organizations must notify supervisory authorities within 72 hours of becoming aware of a personal data breach. Under SEC Item 1.05 of Form 8-K, public companies must disclose any cybersecurity incident determined to be 'material' within 4 business days.",
    "Failing to meet legal disclosure deadlines results in massive regulatory fines (up to 4% of global annual turnover under GDPR) and SEC enforcement actions. The clock starts not when the investigation finishes, but the moment the organization confirms a breach occurred. Incident response plans must have pre-established legal triage workflows: 1) General Counsel and outside privacy counsel notified immediately; 2) Assessment of whether breach affects personal data (PII) or material financial impact; 3) Preparation of formal notification reports detailing nature of breach, affected user categories, approximate numbers, and mitigation steps taken.",
    `// Incident Response Legal Escalation SLA Clock:
// T+0h: Incident Detected & Confirmed
// T+4h: Forensic triage confirms exfiltration of customer database table
// T+12h: Legal Counsel convened; Breach declared Material
// T+48h: Formal notification drafted with affected record counts & CISO statement
// T+72h: HARD DEADLINE: Submission to Data Protection Authority (DPA) under GDPR
// T+4 Business Days: Submission of Form 8-K to US SEC`,
    "Ensure your incident response playbook includes direct contacts for outside legal counsel, cyber-insurance carriers, and public relations firms.",
    ["breach-disclosure", "gdpr-72-hours", "sec-8-k", "legal-compliance", "cyber-insurance"]
  ),
  card(
    117,
    cat,
    "Business Continuity & Disaster Recovery: RTO vs RPO",
    "must-know",
    "intermediate",
    "What is the critical operational difference between Recovery Time Objective (RTO) and Recovery Point Objective (RPO) in disaster recovery planning?",
    "RTO (Recovery Time Objective) is the maximum acceptable duration of system downtime before business operations must be restored. RPO (Recovery Point Objective) is the maximum acceptable amount of data loss measured in time (e.g. how many minutes/hours of transactions can be lost).",
    "RTO defines downtime: if RTO = 1 hour, your infrastructure and automation must spin up a replacement production cluster within 60 minutes of catastrophic failure. RPO defines data loss: if database backups run every 24 hours at midnight, an outage at 11:00 PM means up to 23 hours of customer data is lost (RPO = 24h). Achieving near-zero RPO requires synchronous multi-AZ database replication, write-ahead log (WAL) archiving to S3, and continuous point-in-time recovery (PITR).",
    `// RTO and RPO Architectural Mapping:
// Tier 1 (Core Payments & Order Ledger):
// - RTO: < 5 minutes (Automated Multi-Region Failover via Route 53 Health Checks)
// - RPO: 0 seconds (Synchronous Multi-AZ Aurora Replication + Global Database)

// Tier 2 (Reporting & Analytics Warehouse):
// - RTO: < 24 hours (Rebuild from S3 Parquet backups)
// - RPO: < 4 hours (Batched Kafka streaming offset replay)`,
    "Low RTO and RPO numbers require significant cloud infrastructure spend. Align RTO/RPO tiering strictly to business financial impact.",
    ["bcdr", "rto", "rpo", "disaster-recovery", "high-availability"]
  ),
  card(
    118,
    cat,
    "Tabletop Exercises & Red vs Blue vs Purple Teaming",
    "must-know",
    "intermediate",
    "How do Tabletop Exercises, Red Teaming, Blue Teaming, and Purple Teaming validate an organization's actual defensive readiness?",
    "A Tabletop Exercise is a facilitated discussion where stakeholders walk through hypothetical cyberattack scenarios. Red Teams act as ethical adversaries executing real-world attacks; Blue Teams defend and monitor; Purple Teaming is collaborative exercise where Red and Blue work together in real-time to test and improve detection rules.",
    "Security policies on paper are useless if the incident response team doesn't know who has authority to take down production during a ransomware outbreak. A Tabletop Exercise puts engineering, legal, executive, and communications teams in a room to simulate an escalating crisis. Red Teaming tests full-spectrum attacks (social engineering, zero-days, physical bypasses). Purple Teaming maximizes ROI: the Red Team executes a specific MITRE ATT&CK technique (e.g. T1003 OS Credential Dumping), and the Blue Team checks if their SIEM fired an alert; if not, they tune the detection rule together on the spot.",
    `// Purple Team Exercise Test Matrix:
interface PurpleTest {
  mitreId: string;
  technique: string;
  redAction: string;
  blueDetectionStatus: 'DETECTED' | 'LOGGED_NOT_ALERTED' | 'BLIND_SPOT';
  tuningActionRequired: string;
}

const exerciseResults: PurpleTest[] = [
  {
    mitreId: "T1059.001",
    technique: "PowerShell Encoded Command",
    redAction: "Spawned encoded reverse shell from web directory",
    blueDetectionStatus: "DETECTED",
    tuningActionRequired: "None - EDR auto-quarantined process in 2.1s"
  },
  {
    mitreId: "T1552.001",
    technique: "Credentials in Unsecured Files",
    redAction: "Read .env file in public web directory",
    blueDetectionStatus: "BLIND_SPOT",
    tuningActionRequired: "Add auditd alert on access to .env files outside node user"
  }
];`,
    "Run Purple Team exercises at least quarterly. Testing detections collaboratively against real offensive tools is the fastest way to eliminate SIEM blind spots.",
    ["tabletop", "red-team", "blue-team", "purple-team", "adversary-simulation"]
  ),
  card(
    119,
    cat,
    "Blameless Post-Mortems & Corrective Action Tracking",
    "must-know",
    "beginner",
    "Why is a 'Blameless' culture essential to post-incident reviews, and what are the mandatory sections of a security post-mortem document?",
    "A blameless post-mortem assumes that human engineers act in good faith with the information they had. Blaming individuals creates a culture of fear where employees hide mistakes and conceal security incidents. Focusing on systemic process and architectural failures prevents recurrence.",
    "If an engineer is fired for accidentally committing an API key, the team learns to hide secrets and delay reporting leaks. In a blameless culture, the team asks: 'Why did our pre-commit hook allow the commit? Why was secret scanning missing in CI? Why didn't our cloud provider alert on key usage from an unknown IP?' Mandatory post-mortem sections: 1) Executive Summary; 2) Incident Timeline (UTC); 3) Root Cause Analysis (5 Whys); 4) What Went Well; 5) What Went Wrong; 6) Where We Got Lucky; 7) Corrective Action Items (with assigned owners and strict Jira deadlines).",
    `# Security Post-Mortem Template Structure:
# 1. Overview: Date, Duration, Severity, Customer Impact
# 2. Timeline of Events (all timestamps in UTC):
#    - 14:02 UTC: Attacker initiated credential stuffing on /api/v1/login
#    - 14:15 UTC: Rate limit anomaly alert fired in Slack
#    - 14:28 UTC: Security on-call quarantined target IP range
# 3. Root Cause Analysis (The 5 Whys):
#    - Why did the account get breached? Credential stuffing succeeded.
#    - Why did it succeed? Customer reused password from third-party breach.
#    - Why was MFA not enforced? MFA was optional on standard tier.
# 4. Action Items (Tracked in Jira):
#    - [P0] Mandate MFA on all administrative and billing accounts (Owner: Auth Team)
#    - [P1] Deploy HaveIBeenPwned API check on password creation (Owner: Security)`,
    "A post-mortem without prioritized, tracked Jira action items is meaningless. Every identified root cause must map to an architectural ticket.",
    ["post-mortem", "blameless-culture", "root-cause-analysis", "action-items"]
  ),
  card(
    120,
    cat,
    "Compliance Frameworks: SOC 2, PCI-DSS, ISO 27001 & HIPAA",
    "must-know",
    "intermediate",
    "How do major enterprise security compliance frameworks (SOC 2 Type II, PCI-DSS 4.0, ISO 27001, HIPAA) map to engineering architectures?",
    "Compliance frameworks translate legal and security requirements into auditable technical controls: SOC 2 focuses on Trust Services Criteria (Security, Availability, Confidentiality); PCI-DSS governs credit card handling; ISO 27001 is an international Information Security Management System (ISMS); HIPAA protects Protected Health Information (PHI).",
    "Compliance is not merely paperwork; it dictates architecture: 1) SOC 2 Type II: requires continuous automated evidence collection (via Vanta/Drata) proving that controls (MFA, encrypted disks, code reviews, audit logs) operated effectively over a 6-12 month period; 2) PCI-DSS 4.0: dictates network segmentation to minimize the Cardholder Data Environment (CDE), tokenizing card data via Stripe/Adyen so raw PAN numbers never touch company servers; 3) HIPAA: mandates end-to-end encryption of ePHI, signed Business Associate Agreements (BAAs) with cloud providers, and emergency access procedures.",
    `// Compliance Architectural Requirements Checklist:
// - Encryption in Transit: Mandatory TLS 1.3 across all public and internal endpoints (PCI/SOC2)
// - Encryption at Rest: AES-256 on all DB volumes, S3 buckets, and backup archives (HIPAA/SOC2)
// - Access Control: Enforce SSO with MFA for 100% of internal staff access (SOC2/PCI)
// - Change Management: Branch protection rules requiring >= 1 peer review on all PRs (SOC2)
// - Vulnerability SLA: Critical CVEs remediated within 14 days, High within 30 days (PCI 4.0)
// - Audit Trails: User access to PII/ePHI logged with immutable 1-year retention (HIPAA/PCI)`,
    "Compliance is the baseline floor of security, not the ceiling. Design architectures that are genuinely secure by default, and compliance audits will pass naturally.",
    ["soc2", "pci-dss", "iso27001", "hipaa", "compliance-frameworks"]
  )
];
