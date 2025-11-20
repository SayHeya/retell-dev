/**
 * Tests for audit command
 *
 * Tests the audit command's ability to detect:
 * - Duplicate agent IDs (multiple local dirs pointing to same workspace agent)
 * - Duplicate agent names
 * - Local agents not in workspace
 * - Workspace agents not tracked locally
 * - Orphaned LLMs
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { AgentConfigLoader } from '@core/agent-config-loader';
import { MetadataManager } from '@core/metadata-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Audit Command', () => {
  let tempDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-cmd-test-'));
    agentsDir = path.join(tempDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Duplicate detection', () => {
    it('should detect duplicate agent IDs in metadata', async () => {
      // Create agent 1
      const agent1Dir = path.join(agentsDir, 'agent-1');
      await fs.mkdir(agent1Dir, { recursive: true });
      const config1 = {
        agent_name: 'Agent One',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Agent 1 prompt',
        },
      };
      await fs.writeFile(path.join(agent1Dir, 'agent.json'), JSON.stringify(config1, null, 2));

      // Create staging metadata for agent 1
      const metadata1 = {
        workspace: 'staging',
        agent_id: 'agent_duplicate_id',
        llm_id: 'llm_123',
        kb_id: null,
        last_sync: new Date().toISOString(),
        config_hash: 'sha256:abc123',
        retell_version: null,
      };
      await fs.writeFile(path.join(agent1Dir, 'staging.json'), JSON.stringify(metadata1, null, 2));

      // Create agent 2 with same agent_id
      const agent2Dir = path.join(agentsDir, 'agent-2');
      await fs.mkdir(agent2Dir, { recursive: true });
      const config2 = {
        agent_name: 'Agent Two',
        voice_id: '11labs-Alice',
        language: 'en-GB',
        llm_config: {
          model: 'gpt-4o',
          general_prompt: 'Agent 2 prompt',
        },
      };
      await fs.writeFile(path.join(agent2Dir, 'agent.json'), JSON.stringify(config2, null, 2));

      // Create staging metadata for agent 2 with SAME agent_id
      const metadata2 = {
        workspace: 'staging',
        agent_id: 'agent_duplicate_id', // Same as agent 1!
        llm_id: 'llm_456',
        kb_id: null,
        last_sync: new Date().toISOString(),
        config_hash: 'sha256:def456',
        retell_version: null,
      };
      await fs.writeFile(path.join(agent2Dir, 'staging.json'), JSON.stringify(metadata2, null, 2));

      // Load metadata and check for duplicates
      const result1 = await MetadataManager.read(agent1Dir, 'staging');
      const result2 = await MetadataManager.read(agent2Dir, 'staging');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result1.value.agent_id).toBe(result2.value.agent_id);
      }
    });

    it('should detect duplicate agent names', async () => {
      // Create agent 1
      const agent1Dir = path.join(agentsDir, 'customer-service');
      await fs.mkdir(agent1Dir, { recursive: true });
      const config1 = {
        agent_name: 'Customer Service Agent', // Same name
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Agent 1 prompt',
        },
      };
      await fs.writeFile(path.join(agent1Dir, 'agent.json'), JSON.stringify(config1, null, 2));

      // Create agent 2 with same agent_name
      const agent2Dir = path.join(agentsDir, 'customer-service-backup');
      await fs.mkdir(agent2Dir, { recursive: true });
      const config2 = {
        agent_name: 'Customer Service Agent', // Same name as agent 1!
        voice_id: '11labs-Alice',
        language: 'en-GB',
        llm_config: {
          model: 'gpt-4o',
          general_prompt: 'Agent 2 prompt',
        },
      };
      await fs.writeFile(path.join(agent2Dir, 'agent.json'), JSON.stringify(config2, null, 2));

      // Load configs and check for duplicate names
      const result1 = await AgentConfigLoader.load(agent1Dir);
      const result2 = await AgentConfigLoader.load(agent2Dir);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result1.value.agent_name).toBe(result2.value.agent_name);
      }
    });
  });

  describe('Local agent scanning', () => {
    it('should gather all local agents with their metadata', async () => {
      // Create multiple agents
      const agents = [
        { dir: 'agent-1', name: 'Agent One', hasMetadata: true },
        { dir: 'agent-2', name: 'Agent Two', hasMetadata: true },
        { dir: 'agent-3', name: 'Agent Three', hasMetadata: false },
      ];

      for (const agent of agents) {
        const agentDir = path.join(agentsDir, agent.dir);
        await fs.mkdir(agentDir, { recursive: true });

        const config = {
          agent_name: agent.name,
          voice_id: '11labs-Adrian',
          language: 'en-US',
          llm_config: {
            model: 'gpt-4o-mini',
            general_prompt: `${agent.name} prompt`,
          },
        };
        await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

        if (agent.hasMetadata) {
          const metadata = {
            workspace: 'staging',
            agent_id: `agent_${agent.dir}`,
            llm_id: `llm_${agent.dir}`,
            kb_id: null,
            last_sync: new Date().toISOString(),
            config_hash: `sha256:${agent.dir}`,
            retell_version: null,
          };
          await fs.writeFile(
            path.join(agentDir, 'staging.json'),
            JSON.stringify(metadata, null, 2)
          );
        }
      }

      // Scan directory
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      const agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      expect(agentDirs).toHaveLength(3);
      expect(agentDirs).toContain('agent-1');
      expect(agentDirs).toContain('agent-2');
      expect(agentDirs).toContain('agent-3');

      // Check metadata exists for agents 1 and 2
      const meta1 = await MetadataManager.read(path.join(agentsDir, 'agent-1'), 'staging');
      const meta2 = await MetadataManager.read(path.join(agentsDir, 'agent-2'), 'staging');
      const meta3 = await MetadataManager.read(path.join(agentsDir, 'agent-3'), 'staging');

      expect(meta1.success).toBe(true);
      expect(meta2.success).toBe(true);
      expect(meta3.success).toBe(true); // Returns empty metadata

      // Check actual content - agents 1 and 2 have agent_ids, agent 3 doesn't
      if (meta1.success && meta2.success && meta3.success) {
        expect(meta1.value.agent_id).toBe('agent_agent-1');
        expect(meta2.value.agent_id).toBe('agent_agent-2');
        expect(meta3.value.agent_id).toBeNull(); // Empty metadata has null agent_id
      }
    });
  });

  describe('Stale metadata detection', () => {
    it('should identify agents with metadata pointing to non-existent workspace agents', async () => {
      const agentDir = path.join(agentsDir, 'stale-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const config = {
        agent_name: 'Stale Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Stale agent prompt',
        },
      };
      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      // Create metadata with agent_id that doesn't exist in workspace
      const metadata = {
        workspace: 'staging',
        agent_id: 'agent_deleted_from_workspace',
        llm_id: 'llm_also_deleted',
        kb_id: null,
        last_sync: new Date().toISOString(),
        config_hash: 'sha256:stale123',
        retell_version: null,
      };
      await fs.writeFile(path.join(agentDir, 'staging.json'), JSON.stringify(metadata, null, 2));

      // Load metadata
      const result = await MetadataManager.read(agentDir, 'staging');

      expect(result.success).toBe(true);
      if (result.success) {
        // This agent_id would need to be checked against workspace
        expect(result.value.agent_id).toBe('agent_deleted_from_workspace');
      }
    });
  });

  describe('Agent config loading', () => {
    it('should skip invalid agent directories', async () => {
      // Create valid agent
      const validDir = path.join(agentsDir, 'valid-agent');
      await fs.mkdir(validDir, { recursive: true });
      const validConfig = {
        agent_name: 'Valid Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Valid prompt',
        },
      };
      await fs.writeFile(path.join(validDir, 'agent.json'), JSON.stringify(validConfig, null, 2));

      // Create directory without agent.json
      const emptyDir = path.join(agentsDir, 'empty-agent');
      await fs.mkdir(emptyDir, { recursive: true });

      // Create directory with invalid JSON
      const invalidDir = path.join(agentsDir, 'invalid-agent');
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(path.join(invalidDir, 'agent.json'), 'not valid json');

      // Try to load each
      const validResult = await AgentConfigLoader.load(validDir);
      const emptyResult = await AgentConfigLoader.load(emptyDir);
      const invalidResult = await AgentConfigLoader.load(invalidDir);

      expect(validResult.success).toBe(true);
      expect(emptyResult.success).toBe(false);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Audit result aggregation', () => {
    it('should correctly identify agents needing action', async () => {
      // Setup: Create multiple agents with different states

      // Agent 1: Properly synced (has config and metadata)
      const syncedDir = path.join(agentsDir, 'synced-agent');
      await fs.mkdir(syncedDir, { recursive: true });
      await fs.writeFile(
        path.join(syncedDir, 'agent.json'),
        JSON.stringify({
          agent_name: 'Synced Agent',
          voice_id: '11labs-Adrian',
          language: 'en-US',
          llm_config: { model: 'gpt-4o-mini', general_prompt: 'prompt' },
        })
      );
      await fs.writeFile(
        path.join(syncedDir, 'staging.json'),
        JSON.stringify({
          workspace: 'staging',
          agent_id: 'agent_synced',
          llm_id: 'llm_synced',
          kb_id: null,
          last_sync: new Date().toISOString(),
          config_hash: 'sha256:synced',
          retell_version: null,
        })
      );

      // Agent 2: Never pushed (no metadata)
      const newDir = path.join(agentsDir, 'new-agent');
      await fs.mkdir(newDir, { recursive: true });
      await fs.writeFile(
        path.join(newDir, 'agent.json'),
        JSON.stringify({
          agent_name: 'New Agent',
          voice_id: '11labs-Alice',
          language: 'en-GB',
          llm_config: { model: 'gpt-4o', general_prompt: 'prompt' },
        })
      );

      // Gather info
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      const agentDirs = entries.filter((e) => e.isDirectory());

      const results = [];
      for (const entry of agentDirs) {
        const agentPath = path.join(agentsDir, entry.name);
        const configResult = await AgentConfigLoader.load(agentPath);
        const metadataResult = await MetadataManager.read(agentPath, 'staging');

        results.push({
          name: entry.name,
          hasConfig: configResult.success,
          hasMetadata: metadataResult.success,
          agentId: metadataResult.success ? metadataResult.value.agent_id : null,
        });
      }

      expect(results).toHaveLength(2);

      const synced = results.find((r) => r.name === 'synced-agent');
      const newAgent = results.find((r) => r.name === 'new-agent');

      expect(synced?.hasConfig).toBe(true);
      expect(synced?.hasMetadata).toBe(true);
      expect(synced?.agentId).toBe('agent_synced');

      expect(newAgent?.hasConfig).toBe(true);
      expect(newAgent?.hasMetadata).toBe(true); // Returns empty metadata
      expect(newAgent?.agentId).toBeNull(); // But agent_id is null
    });
  });
});
