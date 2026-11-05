// scripts/audit_kubernetes.cjs
const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, '../data');

function checkFile(filename, expectedCount, prefix, padLength) {
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Checking ${filename}... Count: ${data.length} (Expected: ${expectedCount})`);
  if (data.length !== expectedCount) {
    throw new Error(`Count mismatch in ${filename}: got ${data.length}, expected ${expectedCount}`);
  }

  data.forEach((item, index) => {
    const num = String(index + 1).padStart(padLength, '0');
    const expectedId = `${prefix}${num}`;
    if (item.id !== expectedId) {
      throw new Error(`ID mismatch in ${filename} at index ${index}: got ${item.id}, expected ${expectedId}`);
    }
  });
  console.log(` -> PASS: ${filename} (${expectedCount} items verified)`);
}

console.log("=== STARTING KUBERNETES CURRICULUM AUDIT ===");

checkFile('kubernetes.json', 120, 'k8s-', 3);
checkFile('kubernetes.qa.json', 120, 'k8s-qa-', 3);
checkFile('kubernetes.deep.json', 12, 'k8s-deep-', 2);
checkFile('kubernetes.examples.json', 52, 'k8s-ex-', 2);
checkFile('kubernetes.production.json', 14, 'k8s-prod-', 2);

const subjects = JSON.parse(fs.readFileSync(path.join(dataDir, 'subjects.json'), 'utf-8'));
const k8sSubject = subjects.find(s => s.id === 'kubernetes');
if (!k8sSubject) {
  throw new Error("Subject 'kubernetes' not found in subjects.json");
}
console.log(` -> PASS: Subject registered in subjects.json -> ${JSON.stringify(k8sSubject)}`);

console.log("=== ALL KUBERNETES CURRICULUM AUDITS PASSED CLEANLY! ===");
