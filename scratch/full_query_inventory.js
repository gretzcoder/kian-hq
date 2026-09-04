const fs = require('fs');
const path = require('path');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const srcDir = path.join(__dirname, '..', 'src');
const files = getAllFiles(srcDir);

const prepareRegex = /\.prepare\(\s*[`'"]([\s\S]*?)[`'"]\s*\)/g;
const prepareBacktickRegex = /\.prepare\(\s*`([\s\S]*?)`\s*\)/g;

const queries = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  
  // Find all db.prepare calls
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('db.prepare(') || line.includes('.prepare(')) {
      // capture snippet around this line
      const snippet = lines.slice(idx, idx + 25).join('\n');
      const prepareMatch = snippet.match(/\.prepare\(\s*(`[\s\S]*?`|'[\s\S]*?'|"[\s\S]*?")\s*\)/);
      if (prepareMatch) {
        const rawSql = prepareMatch[1].slice(1, -1).trim().replace(/\s+/g, ' ');
        const relPath = path.relative(path.join(__dirname, '..'), file);
        queries.push({
          file: relPath,
          line: idx + 1,
          sql: rawSql
        });
      }
    }
  });
}

// Remove exact duplicates by sql & file
const unique = [];
const seen = new Set();
for (const q of queries) {
  const key = `${q.file}:${q.sql}`;
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(q);
  }
}

console.log(`Found ${unique.length} distinct db.prepare queries in codebase.`);
fs.writeFileSync(path.join(__dirname, 'query_inventory.json'), JSON.stringify(unique, null, 2));
console.log('Saved query inventory to scratch/query_inventory.json');
