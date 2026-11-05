const fs = require("fs");
const path = require("path");

const part1 = require("./deep_ms/part1_chapters_1_to_6.cjs");
const part2 = require("./deep_ms/part2_chapters_7_to_12.cjs");

const allDeep = [...part1.chapters, ...part2.chapters];

console.log(`Loaded ${allDeep.length} deep dive chapters.`);

if (allDeep.length !== 12) {
  console.error(`Expected exactly 12 chapters, got ${allDeep.length}`);
  process.exit(1);
}

// Verify ids
allDeep.forEach((item, index) => {
  const expectedId = `ms-deep-${String(index + 1).padStart(2, "0")}`;
  if (item.id !== expectedId) {
    console.warn(`Fixing ID: ${item.id} -> ${expectedId}`);
    item.id = expectedId;
  }
});

const outFile = path.join(__dirname, "../data/microservices.deep.json");
fs.writeFileSync(outFile, JSON.stringify(allDeep, null, 2), "utf8");
console.log(`Successfully wrote 12 deep dive chapters to ${outFile}`);
