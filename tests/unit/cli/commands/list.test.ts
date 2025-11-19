/**
 * Tests for list command dependencies
 *
 * Since list command functions are private, we test the core components
 * it depends on: AgentConfigLoader, MetadataManager, HashCalculator
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { AgentConfigLoader } from '@core/agent-config-loader';
import { MetadataManager } from '@core/metadata-manager';
import { HashCalculator } from '@core/hash-calculator';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { AgentConfig } from '../../../../src/types/agent.types';

describe('List Command Dependencies', () => {
  let tempDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'list-cmd-test-'));
    agentsDir = path.join(tempDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Listing multiple agents', () => {
    it('should load multiple agent configs from directory', async () => {
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

      // Create agent 2
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

      // Load both agents
      const result1 = await AgentConfigLoader.load(agent1Dir);
      const result2 = await AgentConfigLoader.load(agent2Dir);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Assert results are successful before accessing values
      if (!result1.success || !result2.success) {
        throw new Error('Expected both results to be successful');
      }

      expect(result1.value.agent_name).toBe('Agent One');
      expect(result2.value.agent_name).toBe('Agent Two');
      expect(result1.value.llm_config.model).toBe('gpt-4o-mini');
      expect(result2.value.llm_config.model).toBe('gpt-4o');
    });

    it('should handle mix of valid and invalid agents', async () => {
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

      // Create invalid agent (missing required fields)
      const invalidDir = path.join(agentsDir, 'invalid-agent');
      await fs.mkdir(invalidDir, { recursive: true });
      const invalidConfig = {
        agent_name: 'Invalid Agent',
        // Missing voice_id and language
      };
      await fs.writeFile(
        path.join(invalidDir, 'agent.json'),
        JSON.stringify(invalidConfig, null, 2)
      );

      // Load both
      const validResult = await AgentConfigLoader.load(validDir);
      const invalidResult = await AgentConfigLoader.load(invalidDir);

      expect(validResult.success).toBe(true);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('Sync status checking', () => {
    let agentDir: string;
    let agentConfig: AgentConfig;
    let configHash: string;

    beforeEach(async () => {
      agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      agentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(agentConfig, null, 2));

      const hashResult = HashCalculator.calculateAgentHash(agentConfig);
      if (!hashResult.success) {
        throw new Error('Failed to calculate hash');
      }
      configHash = hashResult.value;
    });

    it('should detect in-sync status when hashes match', async () => {
      // Create metadata with matching hash
      const updateResult = await MetadataManager.update(agentDir, 'staging', {
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        config_hash: configHash as never,
        last_sync: new Date().toISOString() as never,
      });

      expect(updateResult.success).toBe(true);

      // Read metadata
      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);

      // Assert result is successful before accessing value
      if (!readResult.success) {
        throw new Error('Expected readResult to be successful');
      }

      const inSync = HashCalculator.compareHashes(
        configHash as never,
        readResult.value.config_hash as never
      );
      expect(inSync).toBe(true);
    });

    it('should detect out-of-sync status when hashes differ', async () => {
      // Create metadata with different hash
      const oldHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
      const updateResult = await MetadataManager.update(agentDir, 'staging', {
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        config_hash: oldHash as never,
        last_sync: new Date().toISOString() as never,
      });

      expect(updateResult.success).toBe(true);

      // Read metadata
      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);

      // Assert result is successful before accessing value
      if (!readResult.success) {
        throw new Error('Expected readResult to be successful');
      }

      const inSync = HashCalculator.compareHashes(
        configHash as never,
        readResult.value.config_hash as never
      );
      expect(inSync).toBe(false);
    });

    it('should detect never-synced status when metadata does not exist', async () => {
      // Don't create metadata - read should return null metadata
      const readResult = await MetadataManager.read(agentDir, 'staging');
      // MetadataManager returns success: true with null values when file doesn't exist
      expect(readResult.success).toBe(true);

      // Assert result is successful before accessing value
      if (!readResult.success) {
        throw new Error('Expected readResult to be successful');
      }

      expect(readResult.value.config_hash).toBeNull();
    });

    it('should track sync status independently for staging and production', async () => {
      // Create different metadata for staging
      const updateStagingResult = await MetadataManager.update(agentDir, 'staging', {
        agent_id: 'agent_staging' as never,
        llm_id: 'llm_staging' as never,
        config_hash: configHash as never,
        last_sync: new Date().toISOString() as never,
      });

      // Create different metadata for production with old hash
      const oldHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
      const updateProdResult = await MetadataManager.update(agentDir, 'production', {
        agent_id: 'agent_prod' as never,
        llm_id: 'llm_prod' as never,
        config_hash: oldHash as never,
        last_sync: new Date().toISOString() as never,
      });

      expect(updateStagingResult.success).toBe(true);
      expect(updateProdResult.success).toBe(true);

      // Check staging - should be in sync
      const stagingResult = await MetadataManager.read(agentDir, 'staging');
      expect(stagingResult.success).toBe(true);

      // Assert staging result is successful before accessing value
      if (!stagingResult.success) {
        throw new Error('Expected stagingResult to be successful');
      }

      const stagingInSync = HashCalculator.compareHashes(
        configHash as never,
        stagingResult.value.config_hash as never
      );
      expect(stagingInSync).toBe(true);

      // Check production - should be out of sync
      const prodResult = await MetadataManager.read(agentDir, 'production');
      expect(prodResult.success).toBe(true);

      // Assert production result is successful before accessing value
      if (!prodResult.success) {
        throw new Error('Expected prodResult to be successful');
      }

      const prodInSync = HashCalculator.compareHashes(
        configHash as never,
        prodResult.value.config_hash as never
      );
      expect(prodInSync).toBe(false);
    });
  });

  describe('Agent info extraction', () => {
    it('should extract all required fields for list display', async () => {
      const agentDir = path.join(agentsDir, 'display-test');
      await fs.mkdir(agentDir, { recursive: true });

      const config: AgentConfig = {
        agent_name: 'Display Test Agent',
        voice_id: '11labs-Bella',
        language: 'es-ES',
        llm_config: {
          model: 'claude-3.5-sonnet',
          temperature: 0.8,
          general_prompt: 'Test prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);

      // Assert result is successful before accessing value
      if (!result.success) {
        throw new Error('Expected result to be successful');
      }

      // Verify all fields needed for list display
      expect(result.value.agent_name).toBe('Display Test Agent');
      expect(result.value.voice_id).toBe('11labs-Bella');
      expect(result.value.language).toBe('es-ES');
      expect(result.value.llm_config.model).toBe('claude-3.5-sonnet');
    });

    it('should handle optional fields gracefully', async () => {
      const agentDir = path.join(agentsDir, 'minimal-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Minimal config with only required fields
      const config = {
        agent_name: 'Minimal Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Minimal prompt',
        },
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);

      // Assert result is successful before accessing value
      if (!result.success) {
        throw new Error('Expected result to be successful');
      }

      expect(result.value.agent_name).toBe('Minimal Agent');
      expect(result.value.voice_id).toBe('11labs-Adrian');
      expect(result.value.language).toBe('en-US');
      expect(result.value.llm_config.model).toBe('gpt-4o-mini');

      // Optional fields should be undefined
      expect(result.value.voice_speed).toBeUndefined();
      expect(result.value.responsiveness).toBeUndefined();
    });
  });

  describe('Directory scanning', () => {
    it('should identify agent directories correctly', async () => {
      // Create multiple directories
      await fs.mkdir(path.join(agentsDir, 'agent-1'), { recursive: true });
      await fs.mkdir(path.join(agentsDir, 'agent-2'), { recursive: true });
      await fs.mkdir(path.join(agentsDir, '.hidden'), { recursive: true });

      // Create a file (not directory)
      await fs.writeFile(path.join(agentsDir, 'readme.txt'), 'Test file');

      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      const directories = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      expect(directories).toContain('agent-1');
      expect(directories).toContain('agent-2');
      expect(directories).toContain('.hidden');
      expect(directories).not.toContain('readme.txt');
    });

    it('should handle empty agents directory', async () => {
      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      const directories = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      expect(directories).toHaveLength(0);
    });
  });
});
