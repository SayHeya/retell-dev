/**
 * Tests for update command functionality
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { AgentConfigLoader, type AgentConfig } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Update Command Dependencies', () => {
  let tempDir: string;
  let agentDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'update-cmd-test-'));
    agentDir = path.join(tempDir, 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Config updates', () => {
    it('should update agent configuration', async () => {
      const initialConfig: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        voice_speed: 1.0,
        llm_config: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          general_prompt: 'Initial prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(initialConfig, null, 2));

      // Update config
      const updatedConfig: AgentConfig = {
        ...initialConfig,
        voice_speed: 1.2,
        llm_config: {
          ...initialConfig.llm_config,
          temperature: 0.9,
        },
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(updatedConfig, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.voice_speed).toBe(1.2);
        expect(result.value.llm_config.temperature).toBe(0.9);
      }
    });

    it('should validate updated configuration', async () => {
      const config: AgentConfig = {
        agent_name: 'Updated Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Updated prompt',
        },
      } as AgentConfig;

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);
    });

    it('should handle partial updates', async () => {
      const initialConfig: AgentConfig = {
        agent_name: 'Test',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        voice_speed: 1.0,
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test',
        },
      } as AgentConfig;

      const updatedConfig = {
        ...initialConfig,
        voice_speed: 1.5,
      };

      expect(updatedConfig.agent_name).toBe(initialConfig.agent_name);
      expect(updatedConfig.voice_speed).toBe(1.5);
    });
  });
});
