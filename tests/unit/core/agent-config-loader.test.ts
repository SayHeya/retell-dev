import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { AgentConfigLoader } from '@core/agent-config-loader';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('AgentConfigLoader', () => {
  let tempDir: string;
  let agentDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-config-test-'));
    agentDir = path.join(tempDir, 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should load valid agent config with general_prompt', async () => {
      const config = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are a helpful assistant.',
        },
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      const result = await AgentConfigLoader.load(agentDir);

      expect(result.success).toBe(true);
      const data = (result as { success: true; value: unknown }).value;
      expect(data).toMatchObject({
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
      });
    });

    it('should load valid agent config with composable prompts', async () => {
      const config = {
        agent_name: 'Composable Agent',
        voice_id: '11labs-Kate',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          prompt_config: {
            sections: ['base/greeting', 'base/closing'],
            variables: {
              company_name: 'Acme Corp',
            },
            dynamic_variables: {
              customer_name: {
                type: 'string',
                description: 'Customer name',
              },
            },
          },
        },
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      const result = await AgentConfigLoader.load(agentDir);

      expect(result.success).toBe(true);
      const data = (result as { success: true; value: unknown }).value;
      expect(data).toMatchObject({
        agent_name: 'Composable Agent',
      });
    });

    it('should return error if agent.json does not exist', async () => {
      const result = await AgentConfigLoader.load(agentDir);

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: Error }).error;
      expect(error.message).toContain('not found');
    });

    it('should return error for invalid JSON', async () => {
      await fs.writeFile(path.join(agentDir, 'agent.json'), '{ invalid json }');

      const result = await AgentConfigLoader.load(agentDir);

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: Error }).error;
      expect(error.message).toContain('Invalid JSON');
    });

    it('should return error for invalid schema', async () => {
      const invalidConfig = {
        agent_name: 'Test',
        // missing required fields
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(invalidConfig));

      const result = await AgentConfigLoader.load(agentDir);

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: Error }).error;
      expect(error.message).toContain('validation');
    });

    it('should load config with all optional fields', async () => {
      const config = {
        agent_name: 'Full Config Agent',
        voice_id: '11labs-Kate',
        voice_speed: 1.2,
        voice_temperature: 0.8,
        language: 'en-US',
        enable_backchannel: true,
        backchannel_frequency: 0.9,
        webhook_url: 'https://example.com/webhook',
        llm_config: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          general_prompt: 'Test prompt',
          begin_message: 'Hello!',
          tools: [],
        },
        post_call_analysis_data: [
          {
            name: 'satisfaction',
            type: 'number',
            description: 'Customer satisfaction score',
          },
        ],
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));

      const result = await AgentConfigLoader.load(agentDir);

      expect(result.success).toBe(true);
      const data = (result as { success: true; value: unknown }).value;
      expect(data).toMatchObject({
        agent_name: 'Full Config Agent',
        voice_speed: 1.2,
        enable_backchannel: true,
      });
    });
  });

  describe('loadFromFixture', () => {
    it('should load customer-service agent from fixture', async () => {
      const fixturePath = path.join(
        process.cwd(),
        'tests/fixtures/complete-project/agents/customer-service'
      );

      const result = await AgentConfigLoader.load(fixturePath);

      expect(result.success).toBe(true);
      const data = (result as { success: true; value: unknown }).value;
      expect(data).toMatchObject({
        agent_name: 'Acme Customer Service',
        voice_id: '11labs-Adrian',
        language: 'en-US',
      });
    });

    it('should load sales-agent from fixture', async () => {
      const fixturePath = path.join(
        process.cwd(),
        'tests/fixtures/complete-project/agents/sales-agent'
      );

      const result = await AgentConfigLoader.load(fixturePath);

      expect(result.success).toBe(true);
      const data = (result as { success: true; value: unknown }).value;
      expect(data).toMatchObject({
        agent_name: 'Acme Sales Agent',
        voice_id: '11labs-Kate',
        language: 'en-US',
      });
    });
  });

  describe('save', () => {
    it('should save agent config with pretty formatting', async () => {
      const config = {
        agent_name: 'New Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are helpful.',
        },
      };

      const result = await AgentConfigLoader.save(agentDir, config);

      expect(result.success).toBe(true);

      // Verify file was created
      const filePath = path.join(agentDir, 'agent.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as { agent_name: string };
      expect(parsed.agent_name).toBe('New Agent');
    });

    it('should create agent directory if it does not exist', async () => {
      const newAgentDir = path.join(tempDir, 'new-agent');

      const config = {
        agent_name: 'New Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are helpful.',
        },
      };

      const result = await AgentConfigLoader.save(newAgentDir, config);

      expect(result.success).toBe(true);

      const filePath = path.join(newAgentDir, 'agent.json');
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should overwrite existing agent.json', async () => {
      const initial = {
        agent_name: 'Old Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Old prompt.',
        },
      };

      await AgentConfigLoader.save(agentDir, initial);

      const updated = {
        agent_name: 'New Agent',
        voice_id: '11labs-Kate',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'New prompt.',
        },
      };

      const result = await AgentConfigLoader.save(agentDir, updated);

      expect(result.success).toBe(true);

      const filePath = path.join(agentDir, 'agent.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as { agent_name: string };
      expect(parsed.agent_name).toBe('New Agent');
    });

    it('should validate config before saving', async () => {
      const invalidConfig = {
        agent_name: 'Test',
        // missing required fields
      };

      const result = await AgentConfigLoader.save(agentDir, invalidConfig);

      expect(result.success).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true if agent.json exists', async () => {
      const config = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test.',
        },
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config));

      const result = await AgentConfigLoader.exists(agentDir);

      expect(result).toBe(true);
    });

    it('should return false if agent.json does not exist', async () => {
      const result = await AgentConfigLoader.exists(agentDir);

      expect(result).toBe(false);
    });
  });
});
