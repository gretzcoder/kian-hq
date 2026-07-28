const { execSync } = require('child_process');
try {
  const output = execSync('npx wrangler d1 execute kian-hq-db --local --command="SELECT * FROM roles;"').toString();
  console.log(output);
} catch (err) {
  console.error(err.message);
}
