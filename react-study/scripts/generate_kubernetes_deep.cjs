// scripts/generate_kubernetes_deep.cjs
const fs = require('fs');
const path = require('path');

const part1 = require('./deep_kubernetes/part1_chapters_1_to_6.cjs');
const part2 = require('./deep_kubernetes/part2_chapters_7_to_12.cjs');

const allChapters = [...part1, ...part2];

console.log(`Processing Kubernetes Deep Dives... Total chapters: ${allChapters.length}`);

allChapters.forEach((ch, idx) => {
  const expectedId = `k8s-deep-${String(idx + 1).padStart(2, '0')}`;
  if (ch.id !== expectedId) {
    console.warn(`Mismatch in chapter id at ${idx}: got ${ch.id}, expected ${expectedId}`);
  }
});

const outputPath = path.join(__dirname, '../data/kubernetes.deep.json');
fs.writeFileSync(outputPath, JSON.stringify(allChapters, null, 2), 'utf-8');
console.log(`Successfully generated ${outputPath} with ${allChapters.length} chapters.`);
