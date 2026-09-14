require('dotenv').config();

const { createAtlassianClient } = require('./atlassian-client');
const { runPipeline, ROOT_PAGE_TITLE } = require('./pipeline');
const { ConfigurationError, RetryableError } = require('./errors');

async function main() {
  try {
    // Validate environment
    if (!process.env.ATLASSIAN_HOST) {
      throw new ConfigurationError('Missing ATLASSIAN_HOST environment variable');
    }
    if (!process.env.ATLASSIAN_EMAIL) {
      throw new ConfigurationError('Missing ATLASSIAN_EMAIL environment variable');
    }
    if (!process.env.ATLASSIAN_API_TOKEN) {
      throw new ConfigurationError('Missing ATLASSIAN_API_TOKEN environment variable');
    }

    console.error('[INFO] Starting documentation sync pipeline');

    let atlassianClient;
    try {
      atlassianClient = createAtlassianClient({
        baseUrl: process.env.ATLASSIAN_HOST,
        email: process.env.ATLASSIAN_EMAIL,
        apiToken: process.env.ATLASSIAN_API_TOKEN,
      });
    } catch (clientError) {
      if (clientError instanceof ConfigurationError) {
        throw clientError;
      }
      throw new ConfigurationError(`Failed to create Atlassian client: ${clientError.message}`);
    }

    const client = {
      findPageByTitle: atlassianClient.findPageByTitle,
      createPage: atlassianClient.createPage,
      updatePage: atlassianClient.updatePage,
    };

    const result = await runPipeline({
      env: process.env,
      changedFiles: process.argv.slice(2),
      client,
      verifyResultsPath: process.env.VERIFY_RESULTS_PATH,
    });

    if (result.skipped) {
      console.log(result.reason);
      process.exitCode = 0;
      return;
    }

    console.log(`Completed sync for ${ROOT_PAGE_TITLE}`);
    process.exitCode = 0;
  } catch (error) {
    // Handle different error types with appropriate messaging
    if (error instanceof ConfigurationError) {
      console.error(`[ERROR] Configuration error: ${error.message}`);
      console.error('[ERROR] Please check your environment variables.');
      process.exitCode = 2;
    } else if (error instanceof RetryableError) {
      console.error(`[ERROR] Transient error after retries: ${error.message}`);
      console.error('[ERROR] The pipeline may succeed on retry. Consider running the command again.');
      process.exitCode = 1;
    } else {
      console.error(`[ERROR] Pipeline failed: ${error.message}`);
      if (process.env.DEBUG_SYNC_PIPELINE) {
        console.error(error.stack);
      }
      process.exitCode = 1;
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[FATAL] Uncaught error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
};
