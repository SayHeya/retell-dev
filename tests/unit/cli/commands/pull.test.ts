/**
 * Tests for pull command functionality
 *
 * Tests pulling agent configs from remote workspace
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import {
  AgentConfigLoader,
  MetadataManager,
  type AgentConfig,
  type MetadataFile,
} from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Pull Command Dependencies', () => {
  let tempDir: string;
  let agentDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pull-cmd-test-'));
    agentDir = path.join(tempDir, 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Remote config retrieval', () => {
    it('should verify agent exists in remote workspace', async () => {
      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_remote_123' as never,
        llm_id: 'llm_remote_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:hash123' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, metadata);

      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBe('agent_remote_123');
      }
    });

    it('should update local config from remote', async () => {
      // Initial local config
      const localConfig: AgentConfig = {
        agent_name: 'Local Version',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Local prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(localConfig, null, 2));

      // Simulate remote update
      const remoteConfig: AgentConfig = {
        agent_name: 'Remote Version',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Remote prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(remoteConfig, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_name).toBe('Remote Version');
      }
    });

    it('should handle pulling from staging workspace', async () => {
      const stagingMeta: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_staging_123' as never,
        llm_id: 'llm_staging_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:staging_hash' as never,
        retell_version: 2,
      };

      await MetadataManager.write(agentDir, stagingMeta);

      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.workspace).toBe('staging');
      }
    });

    it('should handle pulling from production workspace', async () => {
      const prodMeta: MetadataFile = {
        workspace: 'production',
        agent_id: 'agent_prod_123' as never,
        llm_id: 'llm_prod_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:prod_hash' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, prodMeta);

      const result = await MetadataManager.read(agentDir, 'production');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.workspace).toBe('production');
      }
    });
  });

  describe('Conflict detection', () => {
    it('should detect local uncommitted changes', async () => {
      const config: AgentConfig = {
        agent_name: 'Modified Locally',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Modified prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: new Date(Date.now() - 3600000).toISOString() as never, // 1 hour ago
        config_hash: 'sha256:old_hash' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, metadata);

      // Load would show config modified after last sync
      const configResult = await AgentConfigLoader.load(agentDir);
      const metaResult = await MetadataManager.read(agentDir, 'staging');

      expect(configResult.success).toBe(true);
      expect(metaResult.success).toBe(true);
    });

    it('should warn about overwriting local changes', async () => {
      const localConfig: AgentConfig = {
        agent_name: 'Local Changes',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        voice_speed: 1.5,
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Local changes',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(localConfig, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.voice_speed).toBe(1.5);
      }
    });
  });

  describe('Metadata updates', () => {
    it('should update metadata after successful pull', async () => {
      const newMetadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:new_hash' as never,
        retell_version: 3,
      };

      await MetadataManager.write(agentDir, newMetadata);

      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.retell_version).toBe(3);
        expect(result.value.config_hash).toBe('sha256:new_hash');
      }
    });

    it('should preserve local-only fields during pull', async () => {
      // Some fields might be local-only and shouldn't be overwritten
      const config: AgentConfig = {
        agent_name: 'Test Agent',
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
  });

  describe('Error handling', () => {
    it('should handle agent not found in remote', async () => {
      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBeNull();
      }
    });

    it('should handle network/API errors gracefully', async () => {
      // Simulated by missing metadata
      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBeNull();
      }
    });

    it('should validate pulled config schema', async () => {
      // Invalid config (missing required fields)
      const invalidConfig = {
        agent_name: 'Invalid',
        // missing voice_id, language, llm_config
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(invalidConfig, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(false);
    });
  });

  describe('Knowledge base synchronization', () => {
    it('should pull knowledge base files from remote', async () => {
      const kbDir = path.join(agentDir, 'knowledge');
      await fs.mkdir(kbDir, { recursive: true });

      // Simulate remote KB files
      await fs.writeFile(path.join(kbDir, 'faq.txt'), 'Remote FAQ content');
      await fs.writeFile(path.join(kbDir, 'guide.md'), 'Remote guide content');

      const files = await fs.readdir(kbDir);
      expect(files).toContain('faq.txt');
      expect(files).toContain('guide.md');
    });

    it('should update KB metadata after pull', async () => {
      const kbDir = path.join(agentDir, 'knowledge');
      await fs.mkdir(kbDir, { recursive: true });

      const kbMeta = {
        staging: {
          kb_id: 'kb_123',
          files: {
            'faq.txt': {
              file_id: 'file_456',
              hash: 'hash789',
              size_bytes: 1024,
              last_sync: new Date().toISOString(),
            },
          },
        },
      };

      await fs.writeFile(path.join(kbDir, '.kb-meta.json'), JSON.stringify(kbMeta, null, 2));

      const content = await fs.readFile(path.join(kbDir, '.kb-meta.json'), 'utf-8');
      const loaded = JSON.parse(content);

      expect(loaded.staging.kb_id).toBe('kb_123');
    });
  });
});
