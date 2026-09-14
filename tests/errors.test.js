const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ConfigurationError,
  RetryableError,
  PipelineError,
  AtlassianApiError,
  isRetryable,
} = require('../src/errors');

test('ConfigurationError is an Error', () => {
  const error = new ConfigurationError('Test config error');
  assert(error instanceof Error);
  assert.equal(error.name, 'ConfigurationError');
  assert.equal(error.message, 'Test config error');
});

test('RetryableError stores original error and retry metadata', () => {
  const original = new Error('Original error');
  const error = new RetryableError('Retry failed', original, 3, 1000);
  assert(error instanceof Error);
  assert.equal(error.name, 'RetryableError');
  assert.equal(error.message, 'Retry failed');
  assert.equal(error.originalError, original);
  assert.equal(error.retryCount, 3);
  assert.equal(error.nextRetryDelay, 1000);
});

test('PipelineError stores context', () => {
  const context = { stage: 'confluence_sync', operation: 'update' };
  const error = new PipelineError('Pipeline failed', context);
  assert(error instanceof Error);
  assert.equal(error.name, 'PipelineError');
  assert.equal(error.message, 'Pipeline failed');
  assert.deepEqual(error.context, context);
});

test('AtlassianApiError stores HTTP details', () => {
  const responseBody = { error: 'Unauthorized' };
  const error = new AtlassianApiError('API error', 401, responseBody);
  assert(error instanceof Error);
  assert.equal(error.name, 'AtlassianApiError');
  assert.equal(error.message, 'API error');
  assert.equal(error.statusCode, 401);
  assert.deepEqual(error.responseBody, responseBody);
});

test('isRetryable returns true for RetryableError', () => {
  const error = new RetryableError('Retryable');
  assert.equal(isRetryable(error), true);
});

test('isRetryable returns true for retryable HTTP status codes', () => {
  assert.equal(isRetryable({ statusCode: 429 }), true);
  assert.equal(isRetryable({ statusCode: 503 }), true);
  assert.equal(isRetryable({ statusCode: 504 }), true);
});

test('isRetryable returns false for non-retryable HTTP status codes', () => {
  assert.equal(isRetryable({ statusCode: 401 }), false);
  assert.equal(isRetryable({ statusCode: 403 }), false);
  assert.equal(isRetryable({ statusCode: 400 }), false);
  assert.equal(isRetryable({ statusCode: 404 }), false);
});

test('isRetryable returns true for network error codes', () => {
  assert.equal(isRetryable({ code: 'ECONNREFUSED' }), true);
  assert.equal(isRetryable({ code: 'ETIMEDOUT' }), true);
  assert.equal(isRetryable({ code: 'EHOSTUNREACH' }), true);
  assert.equal(isRetryable({ code: 'ENOTFOUND' }), true);
});

test('isRetryable returns false for unknown errors', () => {
  assert.equal(isRetryable({ code: 'UNKNOWN' }), false);
  assert.equal(isRetryable(new Error('Unknown')), false);
});
