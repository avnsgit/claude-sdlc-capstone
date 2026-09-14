const test = require('node:test');
const assert = require('node:assert/strict');

const { runPipeline } = require('../src/pipeline');
const { PipelineError } = require('../src/errors');

test('runPipeline skips when there are no changed files', async () => {
  const result = await runPipeline({
    changedFiles: [],
    client: null,
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'No changed files supplied.');
});

test('runPipeline writes a verification report for changed files', async () => {
  const calls = [];
  const client = {
    findPageByTitle: async () => null,
    createPage: async (page) => {
      calls.push(page);
      return { id: 'page-1', ...page };
    },
    updatePage: async () => {
      throw new Error('update should not be called');
    },
  };

  const result = await runPipeline({
    changedFiles: ['src/index.js', 'README.md'],
    client,
  });

  assert.equal(result.skipped, false);
  assert.match(result.summary, /src\/index.js/);
  assert.equal(calls.length, 1);
});

test('runPipeline handles no client gracefully', async () => {
  const result = await runPipeline({
    changedFiles: ['src/index.js'],
    client: null,
  });

  assert.equal(result.skipped, false);
  assert.equal(result.syncResult.updated, false);
  assert.equal(result.syncResult.reason, 'No Atlassian client configured.');
});

test('runPipeline propagates sync errors', async () => {
  const client = {
    findPageByTitle: async () => {
      throw new Error('Network timeout');
    },
  };

  await assert.rejects(
    runPipeline({
      changedFiles: ['src/index.js'],
      client,
    }),
    (error) => error instanceof PipelineError || error.message.includes('Network')
  );
});

test('runPipeline updates existing page', async () => {
  const calls = [];
  const client = {
    findPageByTitle: async () => ({
      id: 'page-123',
      title: 'Claude SDLC Capstone',
    }),
    updatePage: async (pageId, page) => {
      calls.push({ pageId, page });
      return { id: pageId, ...page };
    },
  };

  const result = await runPipeline({
    changedFiles: ['src/index.js'],
    client,
  });

  assert.equal(result.skipped, false);
  assert.equal(result.syncResult.action, 'updated');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pageId, 'page-123');
});

