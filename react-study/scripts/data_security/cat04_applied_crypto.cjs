// scripts/data_security/cat04_applied_crypto.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "Applied Cryptography & Key Management";

module.exports = [
  card(
    37,
    cat,
    "Symmetric vs Asymmetric Cryptography",
    "must-know",
    "intermediate",
    "What are the mathematical and operational tradeoffs between Symmetric and Asymmetric cryptography, and how are they combined in hybrid cryptosystems?",
    "Symmetric cryptography (AES, ChaCha20) uses a single shared secret key for encryption and decryption, offering extreme speed and high throughput. Asymmetric cryptography (RSA, ECC) uses a mathematically linked public/private key pair, solving the key distribution problem at the cost of 100x-1000x slower performance.",
    "Because asymmetric algorithms require heavy modular exponentiation or elliptic curve point multiplication, encrypting large files or video streams directly with RSA is computationally prohibitive. Real-world systems use Hybrid Encryption (e.g. in TLS, PGP, and Envelope Encryption): 1) The client generates an ephemeral, high-entropy symmetric Data Encryption Key (DEK); 2) The heavy data payload is encrypted using the fast symmetric DEK (AES-GCM); 3) The small DEK (32 bytes) is encrypted using the recipient's asymmetric public Key Encryption Key (KEK); 4) The recipient uses their private key to decrypt the DEK, then decrypts the payload.",
    `// Conceptual Hybrid Encryption Flow
import crypto from 'crypto';

export function hybridEncrypt(plaintext: Buffer, recipientRsaPublicKey: string) {
  // 1. Fast symmetric key generation (AES-256)
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  // 2. Encrypt bulk data symmetrically
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // 3. Encrypt symmetric DEK asymmetrically with RSA-OAEP
  const encryptedDek = crypto.publicEncrypt(
    { key: recipientRsaPublicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
    dek
  );

  return { ciphertext, iv, tag, encryptedDek };
}`,
    "Always use hybrid encryption for large payloads. Symmetrically encrypt data with AES-256-GCM; asymmetrically protect the AES key with RSA or ECC.",
    ["symmetric-crypto", "asymmetric-crypto", "hybrid-encryption", "aes-gcm", "rsa"]
  ),
  card(
    38,
    cat,
    "AES-GCM Authenticated Encryption & The Nonce Reuse Catastrophe",
    "must-know",
    "intermediate",
    "How does AES-GCM provide both Confidentiality and Integrity (AEAD), and why does reusing an IV/Nonce completely destroy its security?",
    "AES-GCM is an Authenticated Encryption with Associated Data (AEAD) mode that combines counter-mode encryption (CTR) with a Galois field MAC (GHASH) authentication tag. Reusing an IV/Nonce with the same key allows an adversary to recover the authentication key (H) and forge valid ciphertexts.",
    "Legacy modes like AES-CBC encrypt data but do not guarantee integrity; attackers modify ciphertexts via bit-flipping attacks. AES-GCM generates a 16-byte authentication tag that cryptographically verifies that the ciphertext and any Additional Authenticated Data (AAD) have not been tampered with. However, AES-GCM requires a unique Initialization Vector (IV/Nonce) for every encryption operation under a given key. If a 96-bit IV is repeated with the same key, subtracting the two GHASH equations reveals the internal GHASH key H, breaking both confidentiality and authenticity completely.",
    `import crypto from 'crypto';

export function encryptAesGcm(plaintext: Buffer, key: Buffer, aad?: Buffer) {
  // CRITICAL: NEVER hardcode or reuse IV! Generate 12 bytes of fresh CSPRNG randomness
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  if (aad) {
    cipher.setAAD(aad); // Authenticates metadata without encrypting it
  }

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16-byte authentication tag

  return { ciphertext, iv, tag };
}`,
    "In AES-GCM, the IV does not need to be secret, but it MUST be unique per encryption pass. Never encrypt more than 2^32 messages under the same random 96-bit IV key.",
    ["aes-gcm", "aead", "nonce-reuse", "initialization-vector", "cryptographic-catastrophe"]
  ),
  card(
    39,
    cat,
    "Elliptic Curve Cryptography (ECC) vs RSA",
    "must-know",
    "intermediate",
    "Why has Elliptic Curve Cryptography (Ed25519 / ECDSA) largely superseded RSA in modern security architectures?",
    "ECC provides equivalent cryptographic strength to RSA at significantly smaller key sizes and vastly lower compute/memory overhead (e.g. a 256-bit ECC key offers the same security level as a 3072-bit RSA key).",
    "RSA security relies on the difficulty of prime factorization, requiring massive key lengths (3072 to 4096 bits) to withstand modern factoring algorithms (General Number Field Sieve). Large RSA keys inflate network payloads in TLS handshakes and consume heavy CPU during signature generation. ECC relies on the discrete logarithm problem over elliptic curve points. Modern curves like Ed25519 (for digital signatures) and X25519 (for key exchange) offer: 1) Tiny 32-byte public keys; 2) Microsecond signature verification; 3) Immunity to timing side-channel attacks by operating in constant time; 4) Resistance to invalid-curve attacks.",
    `// Ed25519 Key Generation & Signing in Node.js
import crypto from 'crypto';

// 1. Generate Ed25519 Keypair (Ultra-compact, constant-time)
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

const message = Buffer.from("CRITICAL FINANCIAL TRANSACTION #4881");

// 2. Sign message using Ed25519
const signature = crypto.sign(null, message, privateKey);

// 3. Verify signature using public key (sub-millisecond speed)
const isValid = crypto.verify(null, message, publicKey, signature);
console.log('Signature Verified:', isValid); // true`,
    "For all new systems: prefer Ed25519 for signatures and X25519 for key exchange over legacy RSA-2048/4096.",
    ["ecc", "ed25519", "x25519", "rsa", "elliptic-curves"]
  ),
  card(
    40,
    cat,
    "Cryptographic Hash Functions: SHA-2, SHA-3 & BLAKE3",
    "must-know",
    "intermediate",
    "What defines a cryptographically secure hash function and how do SHA-256, SHA-3, and BLAKE3 compare?",
    "A cryptographic hash function maps arbitrary data to a fixed-size digest and must guarantee three properties: Preimage Resistance (one-way), Second Preimage Resistance (weak collision resistance), and Collision Resistance (finding any two identical outputs is infeasible).",
    "MD5 and SHA-1 are broken due to practical collision attacks. Modern standards include: 1) SHA-2 (SHA-256, SHA-512): Merkle-Damgård construction; highly standardized and hardware-accelerated on modern CPUs; vulnerable to length-extension attacks if not used via HMAC; 2) SHA-3 (Keccak): Sponge construction; immune to length-extension attacks; acts as an independent cryptographic fallback to SHA-2; 3) BLAKE3: Tree-hashing based algorithm that achieves 10x-15x faster throughput than SHA-256 by utilizing SIMD parallelism and multi-core architectures while maintaining 128-bit security.",
    `import crypto from 'crypto';

// Fast deterministic file hashing using SHA-256
export function calculateChecksum(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// SHA-512/256: Immune to length-extension attacks while leveraging 64-bit CPU registers
export function calculateSha512Truncated(data: Buffer): string {
  return crypto.createHash('sha512-256').update(data).digest('hex');
}`,
    "Never use raw SHA-256 for message authentication (use HMAC-SHA256) or password storage (use Argon2id). Cryptographic hashes are designed for integrity and fingerprints.",
    ["sha256", "sha3", "blake3", "hash-functions", "collision-resistance"]
  ),
  card(
    41,
    cat,
    "HMAC & Constant-Time Comparison Timing Attacks",
    "must-know",
    "intermediate",
    "What is an HMAC, why can't simple concatenation hash(key + message) be used, and how do timing attacks exploit standard string equality checks?",
    "An HMAC (Hash-Based Message Authentication Code) uses a nested hashing construct to authenticate message integrity. Simple concatenation hash(secret + message) is vulnerable to Length Extension Attacks in Merkle-Damgård hashes. Comparing HMACs with '===' leaks secret information through execution timing variations.",
    "In Merkle-Damgård hashes (SHA-1, SHA-256), the internal state is exposed in the output hash. An attacker who knows hash(secret || message) and the message length can append new malicious data (|| evil_extension) and compute a valid signature without knowing the secret! HMAC neutralizes this via nested hashing: H((K' ⊕ opad) || H((K' ⊕ ipad) || message)). Furthermore, comparing signatures with 'a === b' terminates on the first mismatched byte; attackers measure nanosecond response differentials to brute-force valid signatures byte-by-byte. Systems must use crypto.timingSafeEqual().",
    `import crypto from 'crypto';

export function verifyWebhookSignature(payload: string, signatureHex: string, secret: string): boolean {
  // 1. Compute expected HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest();

  const providedSignature = Buffer.from(signatureHex, 'hex');

  // 2. Prevent timing side-channel attack using Constant-Time comparison!
  if (expectedSignature.length !== providedSignature.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedSignature, providedSignature);
}`,
    "Always use crypto.timingSafeEqual() for API keys, tokens, and HMAC signatures. A standard '===' equality check leaks secret bytes over network latency measurements.",
    ["hmac", "timing-attacks", "constant-time", "length-extension", "timing-safe-equal"]
  ),
  card(
    42,
    cat,
    "Envelope Encryption & Key Management Services (KMS)",
    "must-know",
    "intermediate",
    "What is Envelope Encryption and how does it optimize security and latency when interacting with cloud Key Management Services (AWS KMS / Vault)?",
    "Envelope Encryption encrypts plaintext data using a local Data Encryption Key (DEK), and then encrypts the DEK using a master Key Encryption Key (KEK) managed by a centralized KMS, storing the encrypted DEK alongside the ciphertext.",
    "Calling AWS KMS to encrypt every 5MB document or database row creates massive network latency, high financial cost ($0.03 per 10,000 requests), and exposes the application to KMS API rate-limiting throttling (10,000 req/sec quota). Envelope Encryption solves this: 1) Application calls KMS GenerateDataKey; 2) KMS returns a plaintext DEK and a KMS-encrypted ciphertext DEK; 3) The application encrypts millions of records in local memory with the fast plaintext DEK (AES-256); 4) The application zeroes the plaintext DEK from memory; 5) The encrypted DEK is saved alongside the encrypted data. To read, the application calls KMS Decrypt only on the 32-byte DEK.",
    `// AWS KMS Envelope Encryption Pattern
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import crypto from 'crypto';

const kms = new KMSClient({ region: 'us-east-1' });

export async function envelopeEncrypt(data: Buffer, kmsKeyId: string) {
  // 1. Request new Data Encryption Key (DEK) from AWS KMS
  const { Plaintext: plainDek, CiphertextBlob: encryptedDek } = await kms.send(
    new GenerateDataKeyCommand({ KeyId: kmsKeyId, KeySpec: 'AES_256' })
  );

  // 2. Symmetrically encrypt data locally in container memory
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', plainDek!, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  // 3. ZERO OUT plaintext DEK from memory immediately!
  plainDek!.fill(0);

  return { ciphertext, iv, tag, encryptedDek };
}`,
    "Envelope encryption ensures the master root key (KEK) never leaves the certified Hardware Security Module (HSM), while local data encryption runs at memory speed.",
    ["envelope-encryption", "kms", "dek", "kek", "hsm"]
  ),
  card(
    43,
    cat,
    "Cryptographic Key Erasure (Crypto-Shredding)",
    "advanced",
    "advanced",
    "What is Crypto-Shredding and how does it satisfy GDPR 'Right to be Forgotten' requirements in immutable backups and distributed data lakes?",
    "Crypto-Shredding is the practice of rendering sensitive data permanently unrecoverable by intentionally destroying or deleting the specific cryptographic key used to encrypt it, without needing to rewrite immutable backup disks or distributed logs.",
    "Under GDPR Article 17, users have the right to request deletion of personal data. However, modern architectures store data in immutable append-only storage: distributed Kafka topics, WORM (Write Once Read Many) S3 Glacier backups, and replicated data lakes where deleting an individual customer row is technically impossible without rebuilding petabytes of archives. With Crypto-Shredding: every customer/tenant is assigned a unique Data Encryption Key (DEK). To fulfill a GDPR erasure request, the system permanently purges the user's DEK from the KMS. All historical backups and Kafka logs containing the user's data are rendered mathematically unreadable noise.",
    `// Conceptual Crypto-Shredding Tenant Purge
export async function fulfillGdprErasureRequest(tenantId: string) {
  // 1. Delete tenant encryption key from Vault / KMS
  await vaultClient.deleteSecret(\`secret/keys/tenants/\${tenantId}\`);

  // 2. Audit log the key destruction
  console.log(\`[GDPR Crypto-Shred] Master DEK for tenant \${tenantId} destroyed. All immutable logs unrecoverable.\`);
}`,
    "Crypto-Shredding satisfies legal erasure compliance on immutable storage (Kafka, tape backups, blockchain) where data cannot be overwritten physically.",
    ["crypto-shredding", "gdpr", "right-to-be-forgotten", "key-lifecycle"]
  ),
  card(
    44,
    cat,
    "TLS 1.3 Handshake Protocol & Forward Secrecy (PFS)",
    "must-know",
    "intermediate",
    "How does TLS 1.3 improve upon TLS 1.2 in latency and security, and what provides Perfect Forward Secrecy (PFS)?",
    "TLS 1.3 reduces connection handshake latency from 2 Round Trip Times (2-RTT) to 1-RTT (or 0-RTT via early data resumption) and eliminates vulnerable legacy cryptographic primitives (RSA key exchange, CBC ciphers, RC4, MD5, SHA-1).",
    "In TLS 1.2, if an adversary records encrypted network traffic for months and later compromises the server's long-term RSA private key, they can retroactively decrypt all past recorded sessions. TLS 1.3 enforces Perfect Forward Secrecy (PFS) by mandating Ephemeral Diffie-Hellman (ECDHE) for all key exchanges. Both client and server generate ephemeral public/private key pairs per session; once the session terminates, the ephemeral keys are discarded. Compromising the server's long-term identity certificate only allows impersonating future connections, never decrypting historical traffic.",
    `// TLS 1.3 Handshake Sequence:
// Client -> ClientHello (Offers ciphers: TLS_AES_256_GCM_SHA384, sends Client Ephemeral Public Key)
// Server -> ServerHello (Selects cipher, sends Server Ephemeral Public Key)
// [Both derive Shared Master Secret instantly - 1-RTT!]
// Server -> EncryptedExtensions, Certificate, CertificateVerify, Finished
// Client -> Finished
// [Application Data Transmitted over AES-GCM / ChaCha20-Poly1305]`,
    "TLS 1.3 completely banned static RSA key transport. PFS is non-negotiable in modern zero-trust enterprise network architectures.",
    ["tls1.3", "pfs", "forward-secrecy", "ecdhe", "1-rtt"]
  ),
  card(
    45,
    cat,
    "Mutual TLS (mTLS) Zero-Trust Inter-Service Mesh",
    "must-know",
    "intermediate",
    "How does Mutual TLS (mTLS) provide bidirectional cryptographic authentication and encryption in service mesh architectures (Istio / Linkerd)?",
    "In standard TLS, only the server presents a certificate to prove its identity to the client. In Mutual TLS (mTLS), both the client and the server present X.509 certificates issued by a trusted internal Certificate Authority, proving mutual identity before establishing the connection.",
    "In microservice architectures, IP-based firewalls are brittle because IP addresses change dynamically during pod autoscaling. With mTLS (orchestrated via Envoy sidecars and SPIFFE/SPIRE IDs): 1) Every microservice receives an X.509 SVID certificate containing its cryptographic identity (e.g., spiffe://cluster.local/ns/prod/sa/order-service); 2) Service A connects to Service B; 3) Service B validates that Service A's certificate is signed by the internal CA; 4) Service A validates Service B's certificate; 5) Envoy proxies enforce fine-grained authorization rules based on authenticated SPIFFE identities.",
    `// Node.js mTLS Server Configuration with Strict Client Certificate Validation
import https from 'https';
import fs from 'fs';

const serverOptions = {
  key: fs.readFileSync('server-private-key.pem'),
  cert: fs.readFileSync('server-certificate.pem'),
  ca: [fs.readFileSync('internal-ca-cert.pem')], // Trusted Internal Certificate Authority
  requestCert: true,        // MANDATORY: Request client certificate
  rejectUnauthorized: true, // REJECT connection if client cert is missing or invalid!
};

https.createServer(serverOptions, (req, res) => {
  const clientCert = (req.socket as any).getPeerCertificate();
  console.log('Authenticated Microservice Client Subject:', clientCert.subject.CN);
  res.writeHead(200);
  res.end('mTLS Handshake Succeeded');
}).listen(8443);`,
    "mTLS eliminates the need for shared API secret tokens between internal microservices; the TLS handshake itself provides cryptographic authentication and encryption.",
    ["mtls", "zero-trust", "spiffe", "service-mesh", "x509"]
  ),
  card(
    46,
    cat,
    "Public Key Infrastructure (PKI) & Certificate Transparency",
    "advanced",
    "advanced",
    "How does Certificate Transparency (RFC 6962) prevent rogue or compromised Certificate Authorities from issuing fraudulent SSL/TLS certificates?",
    "Certificate Transparency (CT) mandates that Certificate Authorities publicly log every issued X.509 certificate to publicly verifiable, append-only, tamper-evident cryptographic Merkle Tree logs before browsers will trust the certificate.",
    "Historically, if a rogue or compromised CA (e.g. DigiNotar in 2011) issued an unauthorized wildcard certificate for *.google.com, attackers could perform Man-in-the-Middle (MitM) attacks undetectable to browsers. CT requires CAs to submit certificates to multiple independent public logs. The log returns a Signed Certificate Timestamp (SCT). Browsers (like Chrome and Safari) verify that valid SCTs are embedded in the TLS handshake. Furthermore, domain owners monitor CT logs in real-time; if an unauthorized certificate is issued for enterprise.com, automated security alerts fire within minutes.",
    `// Monitoring Certificate Transparency Logs via crt.sh API
async function monitorCertIssuance(domain: string) {
  const res = await fetch(\`https://crt.sh/?q=%.\${domain}&output=json\`);
  const certs = await res.json();
  
  for (const cert of certs) {
    console.log(\`Logged Certificate: \${cert.name_value} | Issuer: \${cert.issuer_name}\`);
    // Flag any unexpected CAs issuing certificates for your domain!
  }
}`,
    "Certificate Transparency turned TLS issuance from a private, opaque trust model into an audited, publicly verifiable cryptographic ledger.",
    ["pki", "certificate-transparency", "merkle-tree", "ca-compromise", "sct"]
  ),
  card(
    47,
    cat,
    "Post-Quantum Cryptography (PQC) & NIST Standards",
    "advanced",
    "advanced",
    "How does Shor's Algorithm threaten current public-key cryptography and what post-quantum algorithms (ML-KEM / ML-DSA) did NIST standardize?",
    "Shor's Algorithm on a cryptographically relevant quantum computer (CRQC) can solve prime factorization and discrete logarithms in polynomial time, completely breaking RSA, ECC, Diffie-Hellman, and ECDSA.",
    "While symmetric cryptography (AES-256) remains secure against quantum attacks (Grover's algorithm only reduces 256-bit entropy to an effective 128-bit brute-force barrier, which remains computationally infeasible), all modern public-key infrastructure will collapse. Adversaries are currently executing 'Harvest Now, Decrypt Later' attacks (recording encrypted enterprise TLS traffic today to decrypt once quantum hardware arrives). In 2024, NIST finalized initial post-quantum standards: 1) ML-KEM (Kyber) for post-quantum key encapsulation; 2) ML-DSA (Dilithium) for general digital signatures; 3) SLH-DSA (SPHINCS+) for stateless hash-based signatures.",
    `// Post-Quantum Hybrid TLS 1.3 Key Exchange:
// Modern browsers (Chrome, Cloudflare) use Hybrid X25519Kyber768:
// 1. Classical X25519 key exchange executes normally
// 2. Post-Quantum ML-KEM (Kyber768) key exchange executes concurrently
// 3. Shared secret derived from BOTH algorithms:
//    Secret = KDF(ClassicalSecret || PostQuantumSecret)
// Guarantees security: An adversary must break BOTH algorithms to compromise the session!`,
    "Implement hybrid classical + post-quantum algorithms (like X25519Kyber768) today to defend against 'Harvest Now, Decrypt Later' threat models.",
    ["post-quantum", "pqc", "kyber", "dilithium", "shor-algorithm"]
  ),
  card(
    48,
    cat,
    "CSPRNG vs Pseudo-Random Number Generators",
    "must-know",
    "beginner",
    "Why must Math.random() never be used for security purposes and how do Cryptographically Secure Pseudo-Random Number Generators (CSPRNG) guarantee unpredictability?",
    "Math.random() uses PRNG algorithms (like xorshift128+) designed strictly for statistical distribution and performance, not cryptographic unpredictability. An attacker observing a few outputs can deduce the internal state and predict all past and future numbers.",
    "Generating session tokens, password reset tokens, salt values, or cryptographic keys requires a CSPRNG (e.g. /dev/urandom, crypto.randomBytes, crypto.getRandomValues). CSPRNGs seed their state from high-entropy physical environmental noise (CPU hardware thermal fluctuations, interrupt timings, keystroke latency, hardware RNG chips RDRAND). CSPRNGs guarantee the Next-Bit Test (given the first k bits, no polynomial-time algorithm can predict bit k+1 with probability > 50%) and State Compromise Extension Resistance (compromising current state does not reveal previously generated keys).",
    `import crypto from 'crypto';

// VULNERABLE (Predictable PRNG - Token can be calculated by attacker!):
// const resetToken = Math.random().toString(36).substring(2);

// PRODUCTION SECURE (CSPRNG):
export function generateSecureToken(bytes: number = 32): string {
  // Uses /dev/urandom / Windows CryptGenRandom
  return crypto.randomBytes(bytes).toString('hex');
}

// In Web Browsers / Edge Runtime:
export function generateBrowserToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}`,
    "Never use Math.random() for tokens, OTPs, salts, or passwords. Always use crypto.randomBytes() or crypto.getRandomValues().",
    ["csprng", "math-random-vulnerability", "entropy", "randomness"]
  )
];
