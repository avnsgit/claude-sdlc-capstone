const { getChangedFiles } = require('./change-detector');
const { generateDocumentSummary } = require('./document-generator');
const { syncToConfluence } = require('./confluence-sync');
const { buildVerificationReport } = require('./verification');
const { writeVerificationResults } = require('./document-writer');

const ROOT_PAGE_TITLE = 'Claude SDLC Capstone';

/**
 * Run the complete documentation sync pipeline
 * @param {Object} config - pipeline configuration
 * @param {Array<string>} config.changedFiles - list of changed file paths
 * @param {Object} config.client - Atlassian API client (optional)
 * @param {string} config.verifyResultsPath - path to write verification report (optional)
 * @returns {Promise<Object>} pipeline execution result
 */
async function runPipeline({ changedFiles = [], client, verifyResultsPath }) {
  console.error(`[INFO] Starting sync pipeline with ${changedFiles.length} files`);

  // Stage 1: Change Detection
  const files = getChangedFiles(changedFiles);

  if (files.length === 0) {
    console.error('[INFO] No changed files supplied. Skipping pipeline.');
    return {
      skipped: true,
      reason: 'No changed files supplied.',
    };
  }

  console.error(`[INFO] Detected ${files.length} changed files`);

  let syncResult;
  try {
    // Stage 2: Document Generation
    console.error('[INFO] Generating document summary');
    const summary = generateDocumentSummary(files);
    console.error(`[INFO] Document generated for ${files.length} files`);

    // Stage 3: Confluence Sync (with error handling)
    try {
      syncResult = await syncToConfluence(client, ROOT_PAGE_TITLE, summary);
      console.error(`[INFO] Sync completed: ${syncResult.action} page ${syncResult.pageTitle}`);
    } catch (syncError) {
      console.error(`[ERROR] Confluence sync failed: ${syncError.message}`);
      throw syncError;
    }

    // Stage 4: Verification Report
    console.error('[INFO] Building verification report');
    const report = buildVerificationReport({
      pageTitle: ROOT_PAGE_TITLE,
      changedFiles: files,
      synced: syncResult.updated,
    });

    // Stage 5: Write Results
    if (verifyResultsPath) {
      try {
        console.error(`[INFO] Writing verification results to ${verifyResultsPath}`);
        writeVerificationResults(verifyResultsPath, report);
      } catch (writeError) {
        console.error(`[ERROR] Failed to write verification results: ${writeError.message}`);
        throw writeError;
      }
    }

    console.error('[INFO] Pipeline completed successfully');
    return {
      skipped: false,
      summary,
      syncResult,
      report,
    };
  } catch (error) {
    // Log error context and re-throw
    console.error(`[ERROR] Pipeline failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  ROOT_PAGE_TITLE,
  runPipeline,
};
