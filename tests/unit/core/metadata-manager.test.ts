import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { MetadataManager } from '@core/metadata-manager';
import type { MetadataFile } from '../../../src/types/agent.types';
import type { Hash, Timestamp } from '../../../src/types/common.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('MetadataManager', () => {
  let tempDir: string;
  let agentDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'metadata-test-'));
    agentDir = path.join(tempDir, 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('read', () => {
    it('should read existing staging metadata', async () => {
      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: '2025-11-14T10:00:00.000Z' as Timestamp,
        config_hash: 'sha256:abc123' as Hash,
        retell_version: 5,
      };

      const stagingPath = path.join(agentDir, 'staging.json');
      await fs.writeFile(stagingPath, JSON.stringify(metadata, null, 2));

      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(true);
      const data = (result as { success: true; value: MetadataFile }).value;
      expect(data.workspace).toBe('staging');
      expect(data.agent_id).toBe('agent_123');
      expect(data.llm_id).toBe('llm_456');
    });

    it('should read existing production metadata', async () => {
      const metadata: MetadataFile = {
        workspace: 'production',
        agent_id: 'agent_789' as never,
        llm_id: 'llm_012' as never,
        kb_id: 'kb_345' as never,
        last_sync: '2025-11-13T15:00:00.000Z' as Timestamp,
        config_hash: 'sha256:def456' as Hash,
        retell_version: 7,
      };

      const prodPath = path.join(agentDir, 'production.json');
      await fs.writeFile(prodPath, JSON.stringify(metadata, null, 2));

      const result = await MetadataManager.read(agentDir, 'production');

      expect(result.success).toBe(true);
      const data = (result as { success: true; value: MetadataFile }).value;
      expect(data.workspace).toBe('production');
      expect(data.agent_id).toBe('agent_789');
    });

    it('should return null metadata for non-existent file', async () => {
      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(true);
      const data = (result as { success: true; value: MetadataFile }).value;
      expect(data.workspace).toBe('staging');
      expect(data.agent_id).toBe(null);
      expect(data.llm_id).toBe(null);
      expect(data.kb_id).toBe(null);
      expect(data.last_sync).toBe(null);
      expect(data.config_hash).toBe(null);
      expect(data.retell_version).toBe(null);
    });

    it('should return error for invalid JSON', async () => {
      const stagingPath = path.join(agentDir, 'staging.json');
      await fs.writeFile(stagingPath, '{ invalid json }');

      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(false);
    });

    it('should return error for invalid schema', async () => {
      const invalidData = {
        workspace: 'invalid-workspace',
        agent_id: 'agent_123',
      };

      const stagingPath = path.join(agentDir, 'staging.json');
      await fs.writeFile(stagingPath, JSON.stringify(invalidData));

      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(false);
    });
  });

  describe('write', () => {
    it('should write staging metadata', async () => {
      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_new' as never,
        llm_id: 'llm_new' as never,
        kb_id: null,
        last_sync: '2025-11-14T12:00:00.000Z' as Timestamp,
        config_hash: 'sha256:new123' as Hash,
        retell_version: 10,
      };

      const result = await MetadataManager.write(agentDir, metadata);

      expect(result.success).toBe(true);

      const stagingPath = path.join(agentDir, 'staging.json');
      const content = await fs.readFile(stagingPath, 'utf-8');
      const parsed = JSON.parse(content) as MetadataFile;
      expect(parsed.workspace).toBe('staging');
      expect(parsed.agent_id).toBe('agent_new');
    });

    it('should write production metadata', async () => {
      const metadata: MetadataFile = {
        workspace: 'production',
        agent_id: 'agent_prod' as never,
        llm_id: 'llm_prod' as never,
        kb_id: 'kb_prod' as never,
        last_sync: '2025-11-14T12:00:00.000Z' as Timestamp,
        config_hash: 'sha256:prod123' as Hash,
        retell_version: 8,
      };

      const result = await MetadataManager.write(agentDir, metadata);

      expect(result.success).toBe(true);

      const prodPath = path.join(agentDir, 'production.json');
      const content = await fs.readFile(prodPath, 'utf-8');
      const parsed = JSON.parse(content) as MetadataFile;
      expect(parsed.workspace).toBe('production');
      expect(parsed.agent_id).toBe('agent_prod');
    });

    it('should overwrite existing metadata', async () => {
      const initial: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_old' as never,
        llm_id: 'llm_old' as never,
        kb_id: null,
        last_sync: '2025-11-13T10:00:00.000Z' as Timestamp,
        config_hash: 'sha256:old123' as Hash,
        retell_version: 5,
      };

      await MetadataManager.write(agentDir, initial);

      const updated: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_new' as never,
        llm_id: 'llm_new' as never,
        kb_id: 'kb_new' as never,
        last_sync: '2025-11-14T12:00:00.000Z' as Timestamp,
        config_hash: 'sha256:new456' as Hash,
        retell_version: 10,
      };

      const result = await MetadataManager.write(agentDir, updated);

      expect(result.success).toBe(true);

      const stagingPath = path.join(agentDir, 'staging.json');
      const content = await fs.readFile(stagingPath, 'utf-8');
      const parsed = JSON.parse(content) as MetadataFile;
      expect(parsed.agent_id).toBe('agent_new');
      expect(parsed.kb_id).toBe('kb_new');
    });

    it('should create agent directory if it does not exist', async () => {
      const newAgentDir = path.join(tempDir, 'new-agent');

      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: '2025-11-14T12:00:00.000Z' as Timestamp,
        config_hash: 'sha256:abc123' as Hash,
        retell_version: 5,
      };

      const result = await MetadataManager.write(newAgentDir, metadata);

      expect(result.success).toBe(true);

      const stagingPath = path.join(newAgentDir, 'staging.json');
      const exists = await fs
        .access(stagingPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('update', () => {
    it('should update specific fields in metadata', async () => {
      const initial: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: '2025-11-13T10:00:00.000Z' as Timestamp,
        config_hash: 'sha256:old123' as Hash,
        retell_version: 5,
      };

      await MetadataManager.write(agentDir, initial);

      const result = await MetadataManager.update(agentDir, 'staging', {
        config_hash: 'sha256:new456' as Hash,
        last_sync: '2025-11-14T12:00:00.000Z' as Timestamp,
      });

      expect(result.success).toBe(true);

      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);
      const data = (readResult as { success: true; value: MetadataFile }).value;
      expect(data.agent_id).toBe('agent_123'); // unchanged
      expect(data.config_hash).toBe('sha256:new456'); // updated
      expect(data.last_sync).toBe('2025-11-14T12:00:00.000Z'); // updated
    });

    it('should create new metadata if file does not exist', async () => {
      const result = await MetadataManager.update(agentDir, 'staging', {
        agent_id: 'agent_new' as never,
        llm_id: 'llm_new' as never,
      });

      expect(result.success).toBe(true);

      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);
      const data = (readResult as { success: true; value: MetadataFile }).value;
      expect(data.agent_id).toBe('agent_new');
      expect(data.llm_id).toBe('llm_new');
      expect(data.kb_id).toBe(null); // default value
    });
  });

  describe('exists', () => {
    it('should return true for existing staging file', async () => {
      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: '2025-11-14T10:00:00.000Z' as Timestamp,
        config_hash: 'sha256:abc123' as Hash,
        retell_version: 5,
      };

      await MetadataManager.write(agentDir, metadata);

      const result = await MetadataManager.exists(agentDir, 'staging');

      expect(result).toBe(true);
    });

    it('should return true for existing production file', async () => {
      const metadata: MetadataFile = {
        workspace: 'production',
        agent_id: 'agent_789' as never,
        llm_id: 'llm_012' as never,
        kb_id: null,
        last_sync: '2025-11-14T10:00:00.000Z' as Timestamp,
        config_hash: 'sha256:def456' as Hash,
        retell_version: 7,
      };

      await MetadataManager.write(agentDir, metadata);

      const result = await MetadataManager.exists(agentDir, 'production');

      expect(result).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const result = await MetadataManager.exists(agentDir, 'staging');

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should return error for invalid JSON', async () => {
      const metadataPath = path.join(agentDir, 'staging.json');
      await fs.writeFile(metadataPath, 'invalid json {', 'utf-8');

      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(false);

      // Assert result is failure before accessing error
      if (result.success) {
        throw new Error('Expected result to be failure');
      }

      expect(result.error.message).toContain('Invalid JSON');
    });

    it('should return error for invalid schema', async () => {
      const metadataPath = path.join(agentDir, 'staging.json');
      const invalidData = {
        workspace: 'invalid-workspace', // Should be 'staging' or 'production'
        agent_id: 'agent_123',
        llm_id: 'llm_456',
      };
      await fs.writeFile(metadataPath, JSON.stringify(invalidData), 'utf-8');

      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(false);

      // Assert result is failure before accessing error
      if (result.success) {
        throw new Error('Expected result to be failure');
      }

      expect(result.error.message).toContain('Invalid metadata schema');
    });
  });
});
