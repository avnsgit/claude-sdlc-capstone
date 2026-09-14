function loadConfig(env = process.env) {
  return {
    atlassianHost: env.ATLASSIAN_HOST || '',
    email: env.ATLASSIAN_EMAIL || '',
    apiToken: env.ATLASSIAN_API_TOKEN || '',
    playwrightBaseUrl: env.PLAYWRIGHT_BASE_URL || env.ATLASSIAN_HOST || '',
    verifyResultsPath: env.VERIFY_RESULTS_PATH || '',
  };
}

module.exports = {
  loadConfig,
};
