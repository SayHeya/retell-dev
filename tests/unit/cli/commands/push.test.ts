/**
 * Tests for push command functionality
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import {
  AgentConfigLoader,
  HashCalculator,
  MetadataManager,
  type AgentConfig,
  type MetadataFile,
} from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Push Command Dependencies', () => {
  let tempDir: string;
  let agentDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-cmd-test-'));
    agentDir = path.join(tempDir, 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Config validation before push', () => {
    it('should validate agent config before pushing', async () => {
      const config: AgentConfig = {
        agent_name: 'Valid Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);
    });

    it('should calculate config hash before push', async () => {
      const config: AgentConfig = {
        agent_name: 'Test',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test',
        },
      } as AgentConfig;

      const result = HashCalculator.calculateAgentHash(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Metadata creation after push', () => {
    it('should create metadata file after successful push', async () => {
      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_new_123' as never,
        llm_id: 'llm_new_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:hash123' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, metadata);

      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBe('agent_new_123');
      }
    });

    it('should update existing metadata on push', async () => {
      const oldMeta: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: new Date(Date.now() - 86400000).toISOString() as never,
        config_hash: 'sha256:old_hash' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, oldMeta);

      const newMeta: MetadataFile = {
        ...oldMeta,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:new_hash' as never,
        retell_version: 2,
      };

      await MetadataManager.write(agentDir, newMeta);

      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.retell_version).toBe(2);
      }
    });
  });

  describe('Knowledge base upload', () => {
    it('should identify KB files to upload', async () => {
      const kbDir = path.join(agentDir, 'knowledge');
      await fs.mkdir(kbDir, { recursive: true });

      await fs.writeFile(path.join(kbDir, 'faq.txt'), 'FAQ content');
      await fs.writeFile(path.join(kbDir, 'guide.md'), 'Guide content');

      const files = await fs.readdir(kbDir);
      const kbFiles = files.filter((f) => !f.startsWith('.'));

      expect(kbFiles).toContain('faq.txt');
      expect(kbFiles).toContain('guide.md');
    });
  });
});
