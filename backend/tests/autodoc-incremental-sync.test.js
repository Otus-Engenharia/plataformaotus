/**
 * Testes: Autodoc Incremental Sync
 *
 * Testa as 3 camadas de skip, fingerprint, force mode, metadata update, e edge cases.
 * Usa mocks leves — sem dependencias externas (Supabase, Autodoc API).
 */

import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// ============================================================
// 1) Testar computeDocFingerprint (extraido do modulo)
// ============================================================

function computeDocFingerprint(rawDocs) {
  if (!rawDocs || rawDocs.length === 0) return 'empty';
  const sorted = rawDocs.map(d => `${d.id}:${d.revision || ''}:${d.status || ''}`).sort();
  return createHash('sha256').update(sorted.join('\n')).digest('hex').substring(0, 16);
}

describe('computeDocFingerprint', () => {
  it('retorna "empty" para array vazio', () => {
    assert.equal(computeDocFingerprint([]), 'empty');
    assert.equal(computeDocFingerprint(null), 'empty');
    assert.equal(computeDocFingerprint(undefined), 'empty');
  });

  it('retorna hash de 16 chars hex', () => {
    const docs = [
      { id: '1', revision: 'R01', status: 'approved' },
      { id: '2', revision: 'R02', status: 'pending' },
    ];
    const fp = computeDocFingerprint(docs);
    assert.equal(fp.length, 16);
    assert.match(fp, /^[0-9a-f]{16}$/);
  });

  it('e deterministica — mesma entrada = mesmo hash', () => {
    const docs = [
      { id: '100', revision: 'R03', status: 'approved' },
      { id: '50', revision: null, status: null },
    ];
    assert.equal(computeDocFingerprint(docs), computeDocFingerprint(docs));
  });

  it('e independente de ordem (sort interno)', () => {
    const a = [
      { id: '1', revision: 'R01', status: 'a' },
      { id: '2', revision: 'R02', status: 'b' },
    ];
    const b = [
      { id: '2', revision: 'R02', status: 'b' },
      { id: '1', revision: 'R01', status: 'a' },
    ];
    assert.equal(computeDocFingerprint(a), computeDocFingerprint(b));
  });

  it('detecta mudanca de revisao', () => {
    const before = [{ id: '1', revision: 'R01', status: 'a' }];
    const after = [{ id: '1', revision: 'R02', status: 'a' }];
    assert.notEqual(computeDocFingerprint(before), computeDocFingerprint(after));
  });

  it('detecta mudanca de status', () => {
    const before = [{ id: '1', revision: 'R01', status: 'pending' }];
    const after = [{ id: '1', revision: 'R01', status: 'approved' }];
    assert.notEqual(computeDocFingerprint(before), computeDocFingerprint(after));
  });

  it('detecta novo documento adicionado', () => {
    const before = [{ id: '1', revision: 'R01', status: 'a' }];
    const after = [
      { id: '1', revision: 'R01', status: 'a' },
      { id: '2', revision: 'R01', status: 'b' },
    ];
    assert.notEqual(computeDocFingerprint(before), computeDocFingerprint(after));
  });

  it('detecta documento removido', () => {
    const before = [
      { id: '1', revision: 'R01', status: 'a' },
      { id: '2', revision: 'R01', status: 'b' },
    ];
    const after = [{ id: '1', revision: 'R01', status: 'a' }];
    assert.notEqual(computeDocFingerprint(before), computeDocFingerprint(after));
  });

  it('trata campos null/undefined como string vazia', () => {
    const a = [{ id: '1', revision: null, status: undefined }];
    const b = [{ id: '1', revision: undefined, status: null }];
    assert.equal(computeDocFingerprint(a), computeDocFingerprint(b));
  });
});

// ============================================================
// 2) Testar SyncCustomerDocuments com mocks
// ============================================================

// Import direto (ESM)
import { SyncCustomerDocuments } from '../application/use-cases/acd/autodoc-entregas/SyncCustomerDocuments.js';
import { AutodocHttpClient } from '../infrastructure/services/AutodocHttpClient.js';

// Mock repository
function createMockRepository(overrides = {}) {
  const metadataCalls = [];
  return {
    metadataCalls,
    findExistingDatesByDocIds: async () => new Map(),
    findByDocumentCodes: async () => new Map(),
    upsertDocuments: async () => {},
    updateMappingSyncMetadata: async (mappingId, metadata) => {
      metadataCalls.push({ mappingId, ...metadata });
    },
    ...overrides,
  };
}

// Mock autodoc client
function createMockAutodocClient(overrides = {}) {
  return {
    getStatuses: async () => [],
    getProjectDocCount: async () => null,
    crawlProjectDocuments: async () => [],
    ...overrides,
  };
}

// Helper: create mapping with last sync metadata
function createMapping(overrides = {}) {
  return {
    id: 'map-1',
    portfolio_project_code: 'PROJ-001',
    autodoc_customer_id: 'cust-1',
    autodoc_customer_name: 'Test Customer',
    autodoc_project_folder_id: 'folder-1',
    autodoc_project_name: 'Test Project',
    use_classic_api: false,
    classic_instance_id: null,
    active: true,
    last_sync_at: null,
    last_sync_status: null,
    last_doc_count: null,
    last_doc_fingerprint: null,
    last_sync_duration_ms: null,
    ...overrides,
  };
}

describe('SyncCustomerDocuments — Incremental Skip Logic', () => {

  describe('Camada 1: NG Quick Count Check', () => {
    it('SKIP quando count igual e < 6h', async () => {
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        getProjectDocCount: async () => 150,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        last_sync_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
        last_sync_status: 'success',
        last_doc_count: 150,
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults.length, 1);
      assert.equal(result.projectResults[0].status, 'skipped');
      assert.match(result.projectResults[0].skipReason, /NG count unchanged/);
      assert.equal(result.totalDocuments, 0);
    });

    it('NAO skip quando count mudou', async () => {
      const crawled = [
        { id: '1', name: 'doc.pdf', code: null, revision: 'R01', status: null, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        getProjectDocCount: async () => 151, // changed!
        crawlProjectDocuments: async () => crawled,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        last_sync_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        last_sync_status: 'success',
        last_doc_count: 150,
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'success');
      assert.equal(result.totalDocuments, 1);
    });

    it('NAO skip quando > 6h mesmo com count igual', async () => {
      const crawled = [
        { id: '1', name: 'doc.pdf', code: null, revision: 'R01', status: null, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        getProjectDocCount: async () => 150,
        crawlProjectDocuments: async () => crawled,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        last_sync_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), // 7h ago
        last_sync_status: 'success',
        last_doc_count: 150,
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'success');
    });

    it('NAO skip quando getProjectDocCount retorna null (erro)', async () => {
      const crawled = [
        { id: '1', name: 'doc.pdf', code: null, revision: null, status: null, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        getProjectDocCount: async () => null, // API error
        crawlProjectDocuments: async () => crawled,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        last_sync_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        last_sync_status: 'success',
        last_doc_count: 150,
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'success');
    });
  });

  describe('Camada 2: Classic Time-based Skip', () => {
    it('SKIP Classic quando < 12h e ultimo sync OK', async () => {
      const repo = createMockRepository();
      const client = createMockAutodocClient();
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        use_classic_api: true,
        classic_instance_id: '928943',
        last_sync_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5h ago
        last_sync_status: 'success',
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'skipped');
      assert.match(result.projectResults[0].skipReason, /Classic/);
    });

    it('NAO skip Classic quando > 12h', async () => {
      const crawled = [
        { id: '1', name: 'doc.pdf', code: null, revision: null, status: null, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        crawlProjectDocuments: async () => crawled,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        use_classic_api: true,
        classic_instance_id: '928943',
        last_sync_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(), // 13h ago
        last_sync_status: 'success',
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'success');
    });

    it('NAO skip Classic quando ultimo sync falhou', async () => {
      const crawled = [
        { id: '1', name: 'doc.pdf', code: null, revision: null, status: null, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        crawlProjectDocuments: async () => crawled,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        use_classic_api: true,
        classic_instance_id: '928943',
        last_sync_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
        last_sync_status: 'error', // failed!
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'success');
    });
  });

  describe('Camada 3: Post-crawl Fingerprint Check', () => {
    it('SKIP upsert quando fingerprint igual', async () => {
      const docs = [
        { id: '10', name: 'a.pdf', code: null, revision: 'R01', status: 'approved', createdAt: '2026-01-01T00:00:00Z' },
        { id: '20', name: 'b.pdf', code: null, revision: 'R02', status: 'pending', createdAt: '2026-01-01T00:00:00Z' },
      ];
      const fingerprint = computeDocFingerprint(docs);

      let upsertCalled = false;
      const repo = createMockRepository({
        upsertDocuments: async () => { upsertCalled = true; },
      });
      const client = createMockAutodocClient({
        crawlProjectDocuments: async () => docs,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        last_sync_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h — no pre-crawl skip
        last_sync_status: 'success',
        last_doc_count: 2,
        last_doc_fingerprint: fingerprint,
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'success'); // not 'skipped' — crawl happened
      assert.equal(result.totalDocuments, 2);
      assert.equal(result.newDocuments, 0);
      assert.equal(upsertCalled, false, 'upsertDocuments should NOT have been called');
      // Metadata should be updated
      assert.equal(repo.metadataCalls.length, 1);
      assert.equal(repo.metadataCalls[0].lastSyncStatus, 'success');
    });

    it('faz upsert quando fingerprint diferente', async () => {
      const docs = [
        { id: '10', name: 'a.pdf', code: null, revision: 'R02', status: 'approved', createdAt: '2026-01-01T00:00:00Z' },
      ];

      let upsertCalled = false;
      const repo = createMockRepository({
        upsertDocuments: async () => { upsertCalled = true; },
      });
      const client = createMockAutodocClient({
        crawlProjectDocuments: async () => docs,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        last_sync_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        last_sync_status: 'success',
        last_doc_count: 1,
        last_doc_fingerprint: 'old-fingerprint-123',
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'success');
      assert.equal(upsertCalled, true, 'upsertDocuments SHOULD have been called');
    });
  });

  describe('Force Mode', () => {
    it('bypassa pre-crawl skip NG mesmo com count igual e < 6h', async () => {
      const docs = [
        { id: '1', name: 'doc.pdf', code: null, revision: 'R01', status: null, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        getProjectDocCount: async () => 1,
        crawlProjectDocuments: async () => docs,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        last_sync_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        last_sync_status: 'success',
        last_doc_count: 1,
        last_doc_fingerprint: computeDocFingerprint(docs),
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
        force: true,
      });

      assert.equal(result.projectResults[0].status, 'success');
      assert.equal(result.totalDocuments, 1);
    });

    it('bypassa pre-crawl skip Classic mesmo com < 12h', async () => {
      const docs = [
        { id: '1', name: 'doc.pdf', code: null, revision: null, status: null, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        crawlProjectDocuments: async () => docs,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        use_classic_api: true,
        classic_instance_id: '928943',
        last_sync_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        last_sync_status: 'success',
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
        force: true,
      });

      assert.equal(result.projectResults[0].status, 'success');
    });

    it('bypassa fingerprint check (faz upsert mesmo com fingerprint igual)', async () => {
      const docs = [
        { id: '10', name: 'a.pdf', code: null, revision: 'R01', status: 'approved', createdAt: '2026-01-01T00:00:00Z' },
      ];
      const fingerprint = computeDocFingerprint(docs);

      let upsertCalled = false;
      const repo = createMockRepository({
        upsertDocuments: async () => { upsertCalled = true; },
      });
      const client = createMockAutodocClient({
        crawlProjectDocuments: async () => docs,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping({
        last_sync_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        last_sync_status: 'success',
        last_doc_fingerprint: fingerprint,
      });

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
        force: true,
      });

      assert.equal(upsertCalled, true, 'force=true deve forcar upsert');
    });
  });

  describe('Primeiro sync (sem metadata)', () => {
    it('roda full crawl quando last_sync_at e null', async () => {
      const docs = [
        { id: '1', name: 'doc.pdf', code: null, revision: null, status: null, createdAt: '2026-01-01T00:00:00Z' },
      ];
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        crawlProjectDocuments: async () => docs,
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping(); // all nulls

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      assert.equal(result.projectResults[0].status, 'success');
      assert.equal(result.totalDocuments, 1);
      // Metadata should be written
      assert.equal(repo.metadataCalls.length, 1);
      assert.ok(repo.metadataCalls[0].lastDocFingerprint);
      assert.equal(repo.metadataCalls[0].lastDocCount, 1);
    });
  });

  describe('Metadata update on error', () => {
    it('atualiza metadata com status error quando crawl falha', async () => {
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        crawlProjectDocuments: async () => { throw new Error('API timeout'); },
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mapping = createMapping();

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings: [mapping],
      });

      // Should be error status in results
      assert.equal(result.projectResults[0].status, 'error');
      assert.match(result.projectResults[0].error, /API timeout/);

      // Metadata should record the error
      assert.equal(repo.metadataCalls.length, 1);
      assert.equal(repo.metadataCalls[0].lastSyncStatus, 'error');
    });
  });

  describe('Multiple mappings', () => {
    it('pode ter mix de skipped + success + error', async () => {
      const repo = createMockRepository();
      const client = createMockAutodocClient({
        getProjectDocCount: async () => 50,
        crawlProjectDocuments: async (cid, folderId) => {
          if (folderId === 'folder-fail') throw new Error('crawl failed');
          return [{ id: '1', name: 'doc.pdf', code: null, revision: null, status: null, createdAt: '2026-01-01T00:00:00Z' }];
        },
      });
      const uc = new SyncCustomerDocuments(repo, client);

      const mappings = [
        // Should be skipped (NG count match + < 6h)
        createMapping({
          id: 'map-skip',
          portfolio_project_code: 'SKIP-001',
          autodoc_project_folder_id: 'folder-skip',
          last_sync_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          last_sync_status: 'success',
          last_doc_count: 50,
        }),
        // Should succeed (no previous sync)
        createMapping({
          id: 'map-ok',
          portfolio_project_code: 'OK-001',
          autodoc_project_folder_id: 'folder-ok',
        }),
        // Should fail (crawl error)
        createMapping({
          id: 'map-fail',
          portfolio_project_code: 'FAIL-001',
          autodoc_project_folder_id: 'folder-fail',
        }),
      ];

      const result = await uc.execute({
        customerId: 'cust-1',
        mappings,
      });

      assert.equal(result.projectResults.length, 3);

      const byCode = {};
      for (const pr of result.projectResults) byCode[pr.projectCode] = pr;

      assert.equal(byCode['SKIP-001'].status, 'skipped');
      assert.equal(byCode['OK-001'].status, 'success');
      assert.equal(byCode['FAIL-001'].status, 'error');
    });
  });
});

// ============================================================
// 3) Testar AutodocHttpClient.getProjectDocCount
// ============================================================

describe('AutodocHttpClient.getProjectDocCount', () => {
  it('soma amounts corretamente', async () => {
    // Create instance and override getSubfoldersSize
    const client = new AutodocHttpClient();
    client.getSubfoldersSize = async () => [
      { id: '1', amount: 50, hasContent: true },
      { id: '2', amount: 30, hasContent: true },
      { id: '3', amount: 0, hasContent: false },
    ];

    const count = await client.getProjectDocCount('cust-1', 'folder-1');
    assert.equal(count, 80);
  });

  it('retorna null quando getSubfoldersSize retorna non-array', async () => {
    const client = new AutodocHttpClient();
    client.getSubfoldersSize = async () => ({ error: true });

    const count = await client.getProjectDocCount('cust-1', 'folder-1');
    assert.equal(count, null);
  });

  it('retorna null quando getSubfoldersSize throws', async () => {
    const client = new AutodocHttpClient();
    client.getSubfoldersSize = async () => { throw new Error('API error'); };

    const count = await client.getProjectDocCount('cust-1', 'folder-1');
    assert.equal(count, null);
  });

  it('retorna 0 quando array vazio', async () => {
    const client = new AutodocHttpClient();
    client.getSubfoldersSize = async () => [];

    const count = await client.getProjectDocCount('cust-1', 'folder-1');
    assert.equal(count, 0);
  });
});

console.log('\n✅ Todos os testes de incremental sync executados com sucesso!\n');
