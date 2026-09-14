const fs = require('node:fs');
const path = require('node:path');

function writeVerificationResults(filePath, content) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

module.exports = {
  writeVerificationResults,
};
