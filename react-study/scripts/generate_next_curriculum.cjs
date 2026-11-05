const fs = require("fs");
const path = require("path");

const catFiles = [
  "./data_nextjs/cat01_app_router_rsc.cjs",
  "./data_nextjs/cat02_routing_conventions.cjs",
  "./data_nextjs/cat03_parallel_intercepting.cjs",
  "./data_nextjs/cat04_server_client_composition.cjs",
  "./data_nextjs/cat05_server_actions_mutations.cjs",
  "./data_nextjs/cat06_caching_architecture.cjs",
  "./data_nextjs/cat07_rendering_lifecycle_ppr.cjs",
  "./data_nextjs/cat08_middleware_edge_security.cjs",
  "./data_nextjs/cat09_assets_seo_performance.cjs",
  "./data_nextjs/cat10_deployment_troubleshooting.cjs"
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

console.log(`Total loaded Next.js card pairs: ${allPairs.length}`);

if (allPairs.length !== 120) {
  console.error(`Expected exactly 120 card pairs, got ${allPairs.length}`);
  process.exit(1);
}

const theoryCards = [];
const qaCards = [];

allPairs.forEach((pair, index) => {
  const expectedId = `next-${String(index + 1).padStart(3, "0")}`;
  const expectedQaId = `next-qa-${String(index + 1).padStart(3, "0")}`;

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
  path.join(outDir, "nextjs.json"),
  JSON.stringify(theoryCards, null, 2),
  "utf8"
);
console.log(`Successfully wrote ${theoryCards.length} cards to data/nextjs.json`);

fs.writeFileSync(
  path.join(outDir, "nextjs.qa.json"),
  JSON.stringify(qaCards, null, 2),
  "utf8"
);
console.log(`Successfully wrote ${qaCards.length} cards to data/nextjs.qa.json`);
