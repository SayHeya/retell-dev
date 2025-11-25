/**
 * Tests for delete command functionality
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import {
  MetadataManager,
  type AgentConfig,
  type MetadataFile,
  type Hash,
  type Timestamp,
} from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Delete Command Dependencies', () => {
  let tempDir: string;
  let agentDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delete-cmd-test-'));
    agentDir = path.join(tempDir, 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Agent metadata handling', () => {
    it('should load agent metadata before deletion', async () => {
      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_test_123' as never,
        llm_id: 'llm_test_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as Timestamp,
        config_hash: 'sha256:hash123' as Hash,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, metadata);
      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBe('agent_test_123');
        expect(result.value.llm_id).toBe('llm_test_456');
      }
    });

    it('should verify agent exists before deletion', async () => {
      const agentConfig: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(agentConfig, null, 2));

      const exists = await fs
        .access(path.join(agentDir, 'agent.json'))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle agent without remote IDs', async () => {
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
        expect(result.value.llm_id).toBeNull();
      }
    });
  });

  describe('Local agent deletion', () => {
    it('should remove agent directory', async () => {
      const agentConfig: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(agentConfig, null, 2));

      let exists = await fs
        .access(agentDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      await fs.rm(agentDir, { recursive: true, force: true });

      exists = await fs
        .access(agentDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle nonexistent agent directory', async () => {
      const nonexistentDir = path.join(tempDir, 'nonexistent-agent');
      await expect(fs.access(nonexistentDir)).rejects.toThrow();
    });

    it('should handle missing metadata files', async () => {
      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBeNull();
      }
    });
  });
});
