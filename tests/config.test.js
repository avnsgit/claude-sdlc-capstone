const test = require('node:test');
const assert = require('node:assert/strict');

const { loadConfig } = require('../src/config');

test('loadConfig resolves Atlassian values from env', () => {
  const config = loadConfig({
    ATLASSIAN_HOST: 'https://example.atlassian.net',
    ATLASSIAN_EMAIL: 'dev@example.com',
    ATLASSIAN_API_TOKEN: 'token',
    VERIFY_RESULTS_PATH: 'results.json',
  });

  assert.equal(config.atlassianHost, 'https://example.atlassian.net');
  assert.equal(config.email, 'dev@example.com');
  assert.equal(config.apiToken, 'token');
  assert.equal(config.playwrightBaseUrl, 'https://example.atlassian.net');
  assert.equal(config.verifyResultsPath, 'results.json');
});
