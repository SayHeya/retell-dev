import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { AgentTransformer } from '@core/agent-transformer';
import type { AgentConfig } from '../../../src/types/agent.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('AgentTransformer', () => {
  let tempDir: string;
  let promptsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transformer-test-'));
    promptsDir = path.join(tempDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('transform', () => {
    it('should transform simple agent with general_prompt', async () => {
      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are a helpful assistant.',
        },
      };

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(true);
      const transformed = (
        result as { success: true; value: { general_prompt?: string; model?: string } }
      ).value;
      expect(transformed.general_prompt).toBe('You are a helpful assistant.');
      expect(transformed.model).toBe('gpt-4o-mini');
    });

    it('should build prompt from sections with static variable substitution', async () => {
      // Create prompt sections
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/greeting.txt'),
        'Welcome to {{company_name}}!'
      );

      const config: AgentConfig = {
        agent_name: 'Customer Service',
        voice_id: '11labs-Kate',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          prompt_config: {
            sections: ['base/greeting'],
            variables: {
              company_name: 'Acme Corp',
            },
          },
        },
      };

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(true);
      const transformed = (result as { success: true; value: { general_prompt: string } }).value;
      expect(transformed.general_prompt).toBe('Welcome to Acme Corp!');
    });

    it('should keep OVERRIDE variables as template tags', async () => {
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/greeting.txt'),
        'Hello {{user_name}} at {{company_name}}!'
      );

      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          prompt_config: {
            sections: ['base/greeting'],
            variables: {
              company_name: 'Acme Corp',
              user_name: 'OVERRIDE',
            },
          },
        },
      };

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(true);
      const transformed = (result as { success: true; value: { general_prompt: string } }).value;
      expect(transformed.general_prompt).toBe('Hello {{user_name}} at Acme Corp!');
    });

    it('should keep dynamic variables as template tags', async () => {
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/greeting.txt'),
        'Customer {{customer_name}} from {{company_name}}.'
      );

      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          prompt_config: {
            sections: ['base/greeting'],
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

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(true);
      const transformed = (result as { success: true; value: { general_prompt: string } }).value;
      expect(transformed.general_prompt).toBe('Customer {{customer_name}} from Acme Corp.');
    });

    it('should include all agent-level fields', () => {
      const config: AgentConfig = {
        agent_name: 'Full Config Agent',
        voice_id: '11labs-Kate',
        voice_speed: 1.2,
        voice_temperature: 0.8,
        responsiveness: 0.9,
        interruption_sensitivity: 0.5,
        language: 'en-US',
        enable_backchannel: true,
        backchannel_frequency: 0.7,
        ambient_sound: 'office',
        boosted_keywords: ['support', 'help'],
        pronunciation_dictionary: [{ word: 'API', pronunciation: 'A P I' }],
        normalize_for_speech: true,
        webhook_url: 'https://api.example.com/webhook',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test prompt',
        },
        post_call_analysis_data: [
          {
            name: 'satisfaction',
            type: 'number',
            description: 'Satisfaction score',
          },
        ],
      };

      const result = AgentTransformer.transformToAgent(config, 'llm_123' as never);

      expect(result.success).toBe(true);
      const transformed = (result as { success: true; value: unknown }).value;
      expect(transformed).toMatchObject({
        agent_name: 'Full Config Agent',
        voice_id: '11labs-Kate',
        voice_speed: 1.2,
        voice_temperature: 0.8,
        responsiveness: 0.9,
        interruption_sensitivity: 0.5,
        language: 'en-US',
        enable_backchannel: true,
        backchannel_frequency: 0.7,
        ambient_sound: 'office',
        boosted_keywords: ['support', 'help'],
        webhook_url: 'https://api.example.com/webhook',
        response_engine: {
          type: 'retell-llm',
          llm_id: 'llm_123',
        },
      });
    });

    it('should include LLM config fields', async () => {
      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          general_prompt: 'Test prompt',
          begin_message: 'Hello!',
          tools: [],
        },
      };

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(true);
      const transformed = (
        result as {
          success: true;
          value: { model: string; temperature: number; begin_message: string };
        }
      ).value;
      expect(transformed.model).toBe('gpt-4o-mini');
      expect(transformed.temperature).toBe(0.7);
      expect(transformed.begin_message).toBe('Hello!');
    });

    it('should validate variables are accounted for', async () => {
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(path.join(promptsDir, 'base/greeting.txt'), 'Hello {{undefined_var}}!');

      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          prompt_config: {
            sections: ['base/greeting'],
            // undefined_var not defined!
          },
        },
      };

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: Error }).error;
      expect(error.message).toContain('undefined_var');
    });

    it('should handle multiple prompt sections', async () => {
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/greeting.txt'),
        'Welcome to {{company_name}}!'
      );
      await fs.writeFile(
        path.join(promptsDir, 'base/closing.txt'),
        'Thank you for contacting {{company_name}}.'
      );

      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          prompt_config: {
            sections: ['base/greeting', 'base/closing'],
            variables: {
              company_name: 'Acme Corp',
            },
          },
        },
      };

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(true);
      const transformed = (result as { success: true; value: { general_prompt?: string } }).value;
      expect(transformed.general_prompt).toContain('Welcome to Acme Corp!');
      expect(transformed.general_prompt).toContain('Thank you for contacting Acme Corp.');
    });

    it('should transform agent from fixture', async () => {
      const fixturePromptsDir = path.join(process.cwd(), 'tests/fixtures/complete-project/prompts');
      const fixtureAgentPath = path.join(
        process.cwd(),
        'tests/fixtures/complete-project/agents/customer-service/agent.json'
      );

      const configContent = await fs.readFile(fixtureAgentPath, 'utf-8');
      const config = JSON.parse(configContent) as AgentConfig;

      const result = await AgentTransformer.transformToLlm(config, fixturePromptsDir);

      expect(result.success).toBe(true);
      const transformed = (result as { success: true; value: { general_prompt?: string } }).value;
      // Static variables should be replaced
      expect(transformed.general_prompt).toContain('Acme Corp'); // company_name static var
      expect(transformed.general_prompt).toContain('9am-5pm EST'); // support_hours static var
      // System variables should be kept as tags
      expect(transformed.general_prompt).toContain('{{current_time_Australia/Sydney}}');
      // Dynamic and override vars defined but not used in prompts - that's OK
    });
  });

  describe('error handling', () => {
    it('should return error when neither prompt_config nor general_prompt is defined', async () => {
      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          // Neither prompt_config nor general_prompt defined
        },
      };

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(false);

      // Assert result is failure before accessing error
      if (result.success) {
        throw new Error('Expected result to be failure');
      }

      expect(result.error.message).toContain('Either prompt_config or general_prompt');
    });

    it('should return error when prompt section file does not exist', async () => {
      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          prompt_config: {
            sections: ['nonexistent/section'],
            variables: {},
          },
        },
      };

      const result = await AgentTransformer.transformToLlm(config, promptsDir);

      expect(result.success).toBe(false);

      // Assert result is failure before accessing error
      if (result.success) {
        throw new Error('Expected result to be failure');
      }

      expect(result.error.message).toContain('not found');
    });
  });

  describe('transformPostCallAnalysis', () => {
    it('should transform post_call_analysis_data if present', () => {
      const postCallData = [
        {
          name: 'satisfaction',
          type: 'number' as const,
          description: 'Customer satisfaction score',
        },
        {
          name: 'issue_resolved',
          type: 'boolean' as const,
          description: 'Was issue resolved',
        },
      ];

      const result = AgentTransformer.transformPostCallAnalysis(postCallData);

      expect(result).toEqual([
        {
          name: 'satisfaction',
          type: 'number',
          description: 'Customer satisfaction score',
        },
        {
          name: 'issue_resolved',
          type: 'boolean',
          description: 'Was issue resolved',
        },
      ]);
    });

    it('should return undefined if not present', () => {
      const result = AgentTransformer.transformPostCallAnalysis(undefined);

      expect(result).toBeUndefined();
    });
  });
});
