// scripts/audit_security.cjs
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

function checkFile(name, expectedCount, idPrefix) {
  const filePath = path.join(dataDir, name);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing file: ${name}`);
    return false;
  }
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!Array.isArray(content)) {
    console.error(`❌ Content in ${name} is not an array`);
    return false;
  }
  if (content.length !== expectedCount) {
    console.error(`❌ Count mismatch in ${name}: expected ${expectedCount}, got ${content.length}`);
    return false;
  }

  // Check IDs
  const badIds = content.filter((item, idx) => {
    if (!item.id) return true;
    if (idPrefix && !item.id.startsWith(idPrefix)) return true;
    return false;
  });

  if (badIds.length > 0) {
    console.error(`❌ Bad IDs in ${name}: ${badIds.length} items failed prefix check '${idPrefix}'`);
    return false;
  }

  console.log(`✅ ${name}: ${content.length}/${expectedCount} items verified with prefix '${idPrefix}'`);
  return true;
}

console.log('=== AUDITING SECURITY & CRYPTOGRAPHY CURRICULUM ===');

const subjects = JSON.parse(fs.readFileSync(path.join(dataDir, 'subjects.json'), 'utf-8'));
const secSubject = subjects.find(s => s.id === 'security');
if (!secSubject) {
  console.error('❌ security not found in subjects.json');
} else {
  console.log(`✅ subjects.json contains: ${secSubject.name} (${secSubject.id})`);
}

const c1 = checkFile('security.json', 120, 'sec-');
const c2 = checkFile('security.qa.json', 120, 'sec-qa-');
const c3 = checkFile('security.deep.json', 12, 'sec-deep-');
const c4 = checkFile('security.examples.json', 52, 'sec-ex-');
const c5 = checkFile('security.production.json', 14, 'sec-prod-');

if (secSubject && c1 && c2 && c3 && c4 && c5) {
  console.log('\n🎉 ALL 5 PILLARS FOR SECURITY & CRYPTOGRAPHY CURRICULUM AUDITED SUCCESSFULLY WITH 100% PARITY!');
} else {
  console.error('\n❌ AUDIT FAILED');
  process.exit(1);
}
