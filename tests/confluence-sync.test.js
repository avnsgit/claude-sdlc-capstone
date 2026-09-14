const test = require('node:test');
const assert = require('node:assert/strict');

const { syncToConfluence } = require('../src/confluence-sync');
const { PipelineError } = require('../src/errors');

test('syncToConfluence returns early when client is null', async () => {
  const result = await syncToConfluence(null, 'Test Page', 'Test Content');
  assert.equal(result.updated, false);
  assert.equal(result.reason, 'No Atlassian client configured.');
});

test('syncToConfluence throws when pageTitle is missing', async () => {
  const client = {};
  await assert.rejects(
    syncToConfluence(client, '', 'Test Content'),
    (error) => error instanceof PipelineError && error.message.includes('title')
  );
});

test('syncToConfluence throws when pageTitle is not a string', async () => {
  const client = {};
  await assert.rejects(
    syncToConfluence(client, null, 'Test Content'),
    (error) => error instanceof PipelineError && error.message.includes('title')
  );
});

test('syncToConfluence throws when summary is missing', async () => {
  const client = {};
  await assert.rejects(
    syncToConfluence(client, 'Test Page', ''),
    (error) => error instanceof PipelineError && error.message.includes('summary')
  );
});

test('syncToConfluence throws when summary is not a string', async () => {
  const client = {};
  await assert.rejects(
    syncToConfluence(client, 'Test Page', null),
    (error) => error instanceof PipelineError && error.message.includes('summary')
  );
});

test('syncToConfluence creates page when not found', async () => {
  const calls = [];
  const client = {
    findPageByTitle: async () => null,
    createPage: async (page) => {
      calls.push({ operation: 'create', page });
      return { id: 'page-1', ...page };
    },
  };

  const result = await syncToConfluence(client, 'Test Page', 'Test Content');
  assert.equal(result.updated, true);
  assert.equal(result.action, 'created');
  assert.equal(result.pageTitle, 'Test Page');
  assert.equal(result.pageId, 'page-1');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].page, { title: 'Test Page', body: 'Test Content' });
});

test('syncToConfluence updates page when found', async () => {
  const calls = [];
  const client = {
    findPageByTitle: async () => ({ id: 'page-1', title: 'Test Page' }),
    updatePage: async (pageId, page) => {
      calls.push({ operation: 'update', pageId, page });
      return { id: pageId, ...page };
    },
  };

  const result = await syncToConfluence(client, 'Test Page', 'Updated Content');
  assert.equal(result.updated, true);
  assert.equal(result.action, 'updated');
  assert.equal(result.pageTitle, 'Test Page');
  assert.equal(result.pageId, 'page-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pageId, 'page-1');
  assert.deepEqual(calls[0].page, { title: 'Test Page', body: 'Updated Content' });
});

test('syncToConfluence throws when findPageByTitle fails', async () => {
  const client = {
    findPageByTitle: async () => {
      throw new Error('Network error');
    },
  };

  await assert.rejects(
    syncToConfluence(client, 'Test Page', 'Test Content'),
    (error) => error instanceof PipelineError && error.message.includes('find page')
  );
});

test('syncToConfluence throws when createPage fails', async () => {
  const client = {
    findPageByTitle: async () => null,
    createPage: async () => {
      throw new Error('Permission denied');
    },
  };

  await assert.rejects(
    syncToConfluence(client, 'Test Page', 'Test Content'),
    (error) => error instanceof PipelineError && error.message.includes('create page')
  );
});

test('syncToConfluence throws when updatePage fails', async () => {
  const client = {
    findPageByTitle: async () => ({ id: 'page-1' }),
    updatePage: async () => {
      throw new Error('Conflict');
    },
  };

  await assert.rejects(
    syncToConfluence(client, 'Test Page', 'Test Content'),
    (error) => error instanceof PipelineError && error.message.includes('update page')
  );
});
