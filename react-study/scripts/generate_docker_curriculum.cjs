const fs = require('fs');
const path = require('path');

const catFiles = [
  'cat01_architecture_internals.cjs',
  'cat02_dockerfile_buildkit.cjs',
  'cat03_lifecycle_process_signals.cjs',
  'cat04_storage_volumes_overlay2.cjs',
  'cat05_networking_dns_iptables.cjs',
  'cat06_compose_orchestration.cjs',
  'cat07_security_hardening_isolation.cjs',
  'cat08_image_security_supply_chain.cjs',
  'cat09_logging_monitoring_limits.cjs',
  'cat10_multiarch_buildx_admin.cjs'
];

const dataDir = path.resolve(__dirname, 'data_docker');
const outputTheoryPath = path.resolve(__dirname, '../data/docker.json');
const outputQaPath = path.resolve(__dirname, '../data/docker.qa.json');

const allTheory = [];
const allQa = [];

catFiles.forEach((file, index) => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing category file: ${filePath}`);
  }
  const categoryCards = require(filePath);
  console.log(`Loaded ${file}: ${categoryCards.length} cards`);
  categoryCards.forEach(card => {
    allTheory.push(card.theoryCard);
    allQa.push(card.qaCard);
  });
});

console.log(`Total Theory cards: ${allTheory.length}`);
console.log(`Total QA cards: ${allQa.length}`);

if (allTheory.length !== 120 || allQa.length !== 120) {
  throw new Error(`Expected exactly 120 cards, got Theory: ${allTheory.length}, QA: ${allQa.length}`);
}

// Check uniqueness of IDs
const theoryIds = new Set(allTheory.map(c => c.id));
const qaIds = new Set(allQa.map(c => c.id));
if (theoryIds.size !== 120) throw new Error(`Duplicate theory IDs detected! Unique: ${theoryIds.size}`);
if (qaIds.size !== 120) throw new Error(`Duplicate QA IDs detected! Unique: ${qaIds.size}`);

// Write files
fs.writeFileSync(outputTheoryPath, JSON.stringify(allTheory, null, 2), 'utf-8');
console.log(`Successfully wrote ${allTheory.length} items to ${outputTheoryPath}`);

fs.writeFileSync(outputQaPath, JSON.stringify(allQa, null, 2), 'utf-8');
console.log(`Successfully wrote ${allQa.length} items to ${outputQaPath}`);
