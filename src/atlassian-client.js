const https = require('node:https');
const { URL } = require('node:url');
const { isRetryable, RetryableError, AtlassianApiError, ConfigurationError } = require('./errors');

// Configuration with environment variable overrides
const DEFAULT_MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES || '3');
const DEFAULT_INITIAL_DELAY_MS = parseInt(process.env.SYNC_INITIAL_DELAY_MS || '1000');
const DEFAULT_MAX_DELAY_MS = parseInt(process.env.SYNC_MAX_DELAY_MS || '8000');
const JITTER_FACTOR = 0.1; // ±10%

/**
 * Sleep for a specified duration with optional jitter
 * @param {number} ms - milliseconds to sleep
 * @param {number} jitterFactor - jitter percentage (0.1 = ±10%)
 * @returns {Promise<void>}
 */
function sleep(ms, jitterFactor = 0) {
  let delay = ms;
  if (jitterFactor > 0) {
    const jitterAmount = ms * jitterFactor * (Math.random() - 0.5) * 2;
    delay = Math.max(0, ms + jitterAmount);
  }
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Execute an async function with exponential backoff retry logic
 * @param {Function} asyncFn - async function to execute
 * @param {Object} options - retry configuration
 * @param {number} options.maxRetries - maximum retry attempts (default 3)
 * @param {number} options.initialDelay - initial delay in ms (default 1000)
 * @param {number} options.maxDelay - maximum delay cap in ms (default 8000)
 * @returns {Promise<any>}
 */
async function executeWithRetry(asyncFn, options = {}) {
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : DEFAULT_MAX_RETRIES;
  const initialDelay = options.initialDelay !== undefined ? options.initialDelay : DEFAULT_INITIAL_DELAY_MS;
  const maxDelay = options.maxDelay !== undefined ? options.maxDelay : DEFAULT_MAX_DELAY_MS;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error;

      // Don't retry on non-retryable errors
      if (!isRetryable(error)) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === maxRetries) {
        throw new RetryableError(
          `Failed after ${maxRetries} retries: ${error.message}`,
          error,
          maxRetries,
          0
        );
      }

      // Calculate exponential backoff with jitter
      const exponentialDelay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      const delayWithJitter = exponentialDelay * (1 + (Math.random() - 0.5) * 2 * JITTER_FACTOR);
      const delay = Math.max(0, Math.round(delayWithJitter));

      console.error(`[INFO] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms for error: ${error.message}`);

      await sleep(delay);
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('Unknown error in retry loop');
}

/**
 * Make an HTTPS request
 * @private
 */
function makeRequest(baseUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path || '/', baseUrl);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      timeout: 30000, // 30 second timeout
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const responseBody = data ? JSON.parse(data) : null;
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody,
          };

          // Non-2xx status codes are errors
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const error = new AtlassianApiError(
              `HTTP ${res.statusCode}: ${res.statusMessage}`,
              res.statusCode,
              responseBody
            );
            reject(error);
          } else {
            resolve(response);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Create an Atlassian client with retry-capable API methods
 * @param {Object} config - client configuration
 * @param {string} config.baseUrl - Confluence instance URL (must be https://)
 * @param {string} config.email - API user email
 * @param {string} config.apiToken - API authentication token
 * @param {string} config.spaceKey - Confluence space key (default: 'DocSync')
 * @returns {Object} Atlassian API client
 */
function createAtlassianClient({ baseUrl = '', email = '', apiToken = '', spaceKey = 'DocSync' } = {}) {
  // Validate configuration
  if (!baseUrl) {
    throw new ConfigurationError('ATLASSIAN_HOST environment variable is required');
  }
  if (!email) {
    throw new ConfigurationError('ATLASSIAN_EMAIL environment variable is required');
  }
  if (!apiToken) {
    throw new ConfigurationError('ATLASSIAN_API_TOKEN environment variable is required');
  }

  // Validate HTTPS
  if (!baseUrl.startsWith('https://')) {
    throw new ConfigurationError('ATLASSIAN_HOST must start with https://');
  }

  // Create authorization header (Basic auth: base64(email:token))
  const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const authHeader = `Basic ${credentials}`;

  return {
    /**
     * Find a page by title in the space
     * @param {string} title - page title to find
     * @returns {Promise<Object|null>} page object or null if not found
     */
    findPageByTitle: async (title) => {
      return executeWithRetry(async () => {
        const response = await makeRequest(baseUrl, {
          method: 'GET',
          path: `/rest/api/v3/pages?title=${encodeURIComponent(title)}&space-key=${spaceKey}`,
          headers: {
            'Authorization': authHeader,
          },
        });

        // Response format: { results: [...] }
        if (response.body && response.body.results && response.body.results.length > 0) {
          return response.body.results[0];
        }
        return null;
      });
    },

    /**
     * Create a new page in the space
     * @param {Object} page - page data
     * @param {string} page.title - page title
     * @param {string} page.body - page body (HTML)
     * @returns {Promise<Object>} created page object
     */
    createPage: async (page) => {
      return executeWithRetry(async () => {
        const payload = {
          spaceId: spaceKey,
          title: page.title,
          type: 'page',
          body: {
            representation: 'storage',
            value: page.body,
          },
        };

        const response = await makeRequest(baseUrl, {
          method: 'POST',
          path: '/rest/api/v3/pages',
          headers: {
            'Authorization': authHeader,
          },
          body: payload,
        });

        return response.body;
      });
    },

    /**
     * Update an existing page
     * @param {string} pageId - page ID to update
     * @param {Object} page - page data
     * @param {string} page.title - page title
     * @param {string} page.body - page body (HTML)
     * @returns {Promise<Object>} updated page object
     */
    updatePage: async (pageId, page) => {
      return executeWithRetry(async () => {
        const payload = {
          title: page.title,
          type: 'page',
          body: {
            representation: 'storage',
            value: page.body,
          },
        };

        const response = await makeRequest(baseUrl, {
          method: 'PUT',
          path: `/rest/api/v3/pages/${pageId}`,
          headers: {
            'Authorization': authHeader,
          },
          body: payload,
        });

        return response.body;
      });
    },
  };
}

module.exports = {
  createAtlassianClient,
  executeWithRetry,
  sleep,
};
