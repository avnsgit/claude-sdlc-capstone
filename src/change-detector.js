function getChangedFiles(changedFiles) {
  return changedFiles.filter(Boolean);
}

module.exports = {
  getChangedFiles,
};
