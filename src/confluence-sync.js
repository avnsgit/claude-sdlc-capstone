const { PipelineError } = require('./errors');

/**
 * Synchronize documentation to Confluence
 * Validates input, determines if update or create is needed, and executes sync
 * @param {Object} client - Atlassian API client with findPageByTitle, createPage, updatePage methods
 * @param {string} pageTitle - Title of the page to sync
 * @param {string} summary - Page content (body) to sync
 * @returns {Promise<Object>} sync result: { updated: bool, action: string, pageTitle: string }
 */
async function syncToConfluence(client, pageTitle, summary) {
  // Validate inputs
  if (!client) {
    return {
      updated: false,
      reason: 'No Atlassian client configured.',
    };
  }

  if (!pageTitle || typeof pageTitle !== 'string') {
    throw new PipelineError('Page title is required and must be a string', {
      stage: 'confluence_sync',
      field: 'pageTitle',
    });
  }

  if (!summary || typeof summary !== 'string') {
    throw new PipelineError('Page summary is required and must be a string', {
      stage: 'confluence_sync',
      field: 'summary',
    });
  }

  try {
    // Log sync start
    console.error(`[INFO] Syncing to Confluence page: ${pageTitle}`);

    // Check if page exists
    let existingPage;
    try {
      existingPage = await client.findPageByTitle(pageTitle);
    } catch (error) {
      throw new PipelineError(
        `Failed to find page "${pageTitle}": ${error.message}`,
        {
          stage: 'confluence_sync',
          operation: 'findPageByTitle',
          originalError: error.message,
        }
      );
    }

    // Update or create page
    if (existingPage) {
      try {
        console.error(`[INFO] Updating page ${existingPage.id}`);
        await client.updatePage(existingPage.id, {
          title: pageTitle,
          body: summary,
        });

        return {
          updated: true,
          action: 'updated',
          pageTitle,
          pageId: existingPage.id,
        };
      } catch (error) {
        throw new PipelineError(
          `Failed to update page "${pageTitle}": ${error.message}`,
          {
            stage: 'confluence_sync',
            operation: 'updatePage',
            pageId: existingPage.id,
            originalError: error.message,
          }
        );
      }
    }

    // Create new page
    try {
      console.error(`[INFO] Creating new page: ${pageTitle}`);
      const createdPage = await client.createPage({
        title: pageTitle,
        body: summary,
      });

      return {
        updated: true,
        action: 'created',
        pageTitle,
        pageId: createdPage.id,
      };
    } catch (error) {
      throw new PipelineError(
        `Failed to create page "${pageTitle}": ${error.message}`,
        {
          stage: 'confluence_sync',
          operation: 'createPage',
          originalError: error.message,
        }
      );
    }
  } catch (error) {
    // Re-throw if already a PipelineError
    if (error.name === 'PipelineError') {
      throw error;
    }

    // Wrap unexpected errors
    throw new PipelineError(
      `Unexpected error during Confluence sync: ${error.message}`,
      {
        stage: 'confluence_sync',
        originalError: error.message,
      }
    );
  }
}

module.exports = {
  syncToConfluence,
};
