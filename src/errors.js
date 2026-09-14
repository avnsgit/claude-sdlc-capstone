class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class RetryableError extends Error {
  constructor(message, originalError = null, retryCount = 0, nextRetryDelay = 0) {
    super(message);
    this.name = 'RetryableError';
    this.originalError = originalError;
    this.retryCount = retryCount;
    this.nextRetryDelay = nextRetryDelay;
  }
}

class PipelineError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'PipelineError';
    this.context = context;
  }
}

class AtlassianApiError extends Error {
  constructor(message, statusCode = null, responseBody = null) {
    super(message);
    this.name = 'AtlassianApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

function isRetryable(error) {
  if (error instanceof RetryableError) {
    return true;
  }

  // Check HTTP status codes that are retryable
  if (error.statusCode !== undefined) {
    // Retry on 429 (Too Many Requests), 503 (Service Unavailable), 504 (Gateway Timeout)
    return [429, 503, 504].includes(error.statusCode);
  }

  // Check for network error codes
  if (error.code) {
    const networkErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND'];
    return networkErrors.includes(error.code);
  }

  return false;
}

module.exports = {
  ConfigurationError,
  RetryableError,
  PipelineError,
  AtlassianApiError,
  isRetryable,
};
