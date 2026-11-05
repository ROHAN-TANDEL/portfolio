const fs = require("fs");
const path = require("path");

const catFiles = [
  "./data_ms/cat01_decomposition_ddd.cjs",
  "./data_ms/cat02_inter_service_communication.cjs",
  "./data_ms/cat03_messaging_event_driven.cjs",
  "./data_ms/cat04_transactions_sagas.cjs",
  "./data_ms/cat05_api_gateway_ingress.cjs",
  "./data_ms/cat06_service_discovery_mesh.cjs",
  "./data_ms/cat07_resilience_fault_tolerance.cjs",
  "./data_ms/cat08_distributed_observability.cjs",
  "./data_ms/cat09_security_identity_zerotrust.cjs",
  "./data_ms/cat10_deployment_testing_lifecycle.cjs"
];

let allPairs = [];

for (const f of catFiles) {
  const filePath = path.join(__dirname, f);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing file: ${filePath}`);
    process.exit(1);
  }
  const mod = require(filePath);
  const items = Array.isArray(mod) ? mod : (mod.cards || []);
  if (!items || !Array.isArray(items)) {
    console.error(`Invalid export in: ${filePath}`);
    process.exit(1);
  }
  console.log(`Loaded ${items.length} items from ${f}`);
  allPairs.push(...items);
}

console.log(`Total loaded card pairs: ${allPairs.length}`);

if (allPairs.length !== 120) {
  console.error(`Expected exactly 120 card pairs, got ${allPairs.length}`);
  process.exit(1);
}

const theoryCards = [];
const qaCards = [];

allPairs.forEach((pair, index) => {
  const expectedId = `ms-${String(index + 1).padStart(3, "0")}`;
  const expectedQaId = `ms-qa-${String(index + 1).padStart(3, "0")}`;

  const theory = pair.theoryCard || pair.theory;
  const qa = pair.qaCard || pair.qa;

  if (!theory || !qa) {
    console.error(`Missing theory or qa card at index ${index}:`, pair);
    process.exit(1);
  }

  theory.id = expectedId;
  qa.id = expectedQaId;
  qa.conceptId = expectedId;

  theoryCards.push(theory);
  qaCards.push(qa);
});

const outDir = path.join(__dirname, "../data");

fs.writeFileSync(
  path.join(outDir, "microservices.json"),
  JSON.stringify(theoryCards, null, 2),
  "utf8"
);
console.log(`Successfully wrote ${theoryCards.length} cards to data/microservices.json`);

fs.writeFileSync(
  path.join(outDir, "microservices.qa.json"),
  JSON.stringify(qaCards, null, 2),
  "utf8"
);
console.log(`Successfully wrote ${qaCards.length} cards to data/microservices.qa.json`);
