/**
 * Tests for status command functionality
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import {
  MetadataManager,
  HashCalculator,
  type AgentConfig,
  type MetadataFile,
} from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Status Command Dependencies', () => {
  let tempDir: string;
  let agentDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'status-cmd-test-'));
    agentDir = path.join(tempDir, 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Sync status detection', () => {
    it('should detect in-sync configuration', async () => {
      const config: AgentConfig = {
        agent_name: 'Test',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test',
        },
      } as AgentConfig;

      const hashResult = HashCalculator.calculateAgentHash(config);
      expect(hashResult.success).toBe(true);

      if (hashResult.success) {
        const metadata: MetadataFile = {
          workspace: 'staging',
          agent_id: 'agent_123' as never,
          llm_id: 'llm_456' as never,
          kb_id: null,
          last_sync: new Date().toISOString() as never,
          config_hash: hashResult.value as never,
          retell_version: 1,
        };

        await MetadataManager.write(agentDir, metadata);

        const result = await MetadataManager.read(agentDir, 'staging');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.config_hash).toBe(hashResult.value);
        }
      }
    });

    it('should detect out-of-sync configuration', async () => {
      const config1: AgentConfig = {
        agent_name: 'Test',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Version 1',
        },
      } as AgentConfig;

      const config2: AgentConfig = {
        ...config1,
        llm_config: {
          ...config1.llm_config,
          general_prompt: 'Version 2',
        },
      };

      const hash1 = HashCalculator.calculateAgentHash(config1);
      const hash2 = HashCalculator.calculateAgentHash(config2);

      expect(hash1.success).toBe(true);
      expect(hash2.success).toBe(true);
      if (hash1.success && hash2.success) {
        expect(hash1.value).not.toBe(hash2.value);
      }
    });

    it('should detect never synced agent', async () => {
      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: null,
        llm_id: null,
        kb_id: null,
        last_sync: null,
        config_hash: null,
        retell_version: null,
      };

      await MetadataManager.write(agentDir, metadata);

      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBeNull();
      }
    });
  });

  describe('Multi-workspace status', () => {
    it('should show status for both staging and production', async () => {
      const stagingMeta: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_staging_123' as never,
        llm_id: 'llm_staging_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:staging_hash' as never,
        retell_version: 2,
      };

      const prodMeta: MetadataFile = {
        workspace: 'production',
        agent_id: 'agent_prod_123' as never,
        llm_id: 'llm_prod_456' as never,
        kb_id: null,
        last_sync: new Date(Date.now() - 86400000).toISOString() as never,
        config_hash: 'sha256:prod_hash' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, stagingMeta);
      await MetadataManager.write(agentDir, prodMeta);

      const stagingResult = await MetadataManager.read(agentDir, 'staging');
      const prodResult = await MetadataManager.read(agentDir, 'production');

      expect(stagingResult.success).toBe(true);
      expect(prodResult.success).toBe(true);
    });
  });
});
