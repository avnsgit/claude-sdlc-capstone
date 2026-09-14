function generateDocumentSummary(changedFiles) {
  return [
    'Changed files:',
    ...changedFiles.map((file) => `- ${file}`),
  ].join('\n');
}

module.exports = {
  generateDocumentSummary,
};
