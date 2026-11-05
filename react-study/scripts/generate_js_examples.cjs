const fs = require("fs");
const path = require("path");

const part1 = require("./examples_js/js_ex_part1.cjs");
const part2 = require("./examples_js/js_ex_part2.cjs");
const part3 = require("./examples_js/js_ex_part3.cjs");
const part4 = require("./examples_js/js_ex_part4.cjs");
const part5 = require("./examples_js/js_ex_part5.cjs");

const allExamples = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5
];

console.log(`Loaded ${allExamples.length} JavaScript code examples.`);

// Validation
const required = [
  "id",
  "title",
  "category",
  "difficulty",
  "whatThisCodeCovers",
  "conceptsCovered",
  "code",
  "breakdown",
  "expectedOutput"
];

for (const [idx, item] of allExamples.entries()) {
  for (const field of required) {
    if (item[field] === undefined || item[field] === null || item[field] === "") {
      console.error(`Item ${idx} (${item.id}) missing field: ${field}`);
    }
  }
  if (!Array.isArray(item.conceptsCovered) || item.conceptsCovered.length === 0) {
    console.error(`Item ${idx} (${item.id}) has invalid conceptsCovered array`);
  }
  if (!Array.isArray(item.breakdown) || item.breakdown.length === 0) {
    console.error(`Item ${idx} (${item.id}) has invalid breakdown array`);
  }
}

const outputPath = path.join(__dirname, "../data/javascript.examples.json");
fs.writeFileSync(outputPath, JSON.stringify(allExamples, null, 2), "utf-8");

console.log(`Successfully generated ${allExamples.length} Applied Code Examples to ${outputPath}`);
