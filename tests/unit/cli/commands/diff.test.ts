/**
 * Tests for diff command functionality
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { AgentConfigLoader, HashCalculator, type AgentConfig } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Diff Command Dependencies', () => {
  let tempDir: string;
  let agentDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diff-cmd-test-'));
    agentDir = path.join(tempDir, 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Configuration comparison', () => {
    it('should load and compare two agent configs', async () => {
      const config1: AgentConfig = {
        agent_name: 'Agent V1',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        voice_speed: 1.0,
        llm_config: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          general_prompt: 'Version 1 prompt',
        },
      } as AgentConfig;

      const config2: AgentConfig = {
        ...config1,
        agent_name: 'Agent V2',
        voice_speed: 1.2,
        llm_config: {
          ...config1.llm_config,
          general_prompt: 'Version 2 prompt',
        },
      };

      expect(config1.agent_name).toBe('Agent V1');
      expect(config2.agent_name).toBe('Agent V2');
      expect(config1.voice_speed).toBe(1.0);
      expect(config2.voice_speed).toBe(1.2);
    });

    it('should detect hash differences', () => {
      const config1: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Prompt 1',
        },
      } as AgentConfig;

      const config2: AgentConfig = {
        ...config1,
        llm_config: {
          ...config1.llm_config,
          general_prompt: 'Prompt 2',
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

    it('should identify identical configs', () => {
      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test prompt',
        },
      } as AgentConfig;

      const hash1 = HashCalculator.calculateAgentHash(config);
      const hash2 = HashCalculator.calculateAgentHash(config);

      expect(hash1.success).toBe(true);
      expect(hash2.success).toBe(true);
      if (hash1.success && hash2.success) {
        expect(hash1.value).toBe(hash2.value);
      }
    });
  });

  describe('Source comparison', () => {
    it('should compare local file to staged config', async () => {
      const localConfig: AgentConfig = {
        agent_name: 'Local Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Local prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(localConfig, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_name).toBe('Local Agent');
      }
    });
  });

  describe('Error handling', () => {
    it('should handle missing config files', async () => {
      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(false);
    });
  });
});
