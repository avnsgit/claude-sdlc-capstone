function buildVerificationReport(result) {
  return JSON.stringify(result, null, 2);
}

module.exports = {
  buildVerificationReport,
};
