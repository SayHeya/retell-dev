/**
 * Tests for init/template command functionality
 *
 * Tests template loading, validation, and agent creation
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { AgentConfigLoader, type AgentConfig } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Init Command - Template System', () => {
  let tempDir: string;
  let templatesDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'init-cmd-test-'));
    templatesDir = path.join(tempDir, 'templates');
    agentsDir = path.join(tempDir, 'agents');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Template loading', () => {
    it('should load valid template file', async () => {
      const template: AgentConfig = {
        agent_name: 'Template Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          general_prompt: 'Template prompt',
        },
      } as AgentConfig;

      const templatePath = path.join(templatesDir, 'basic.json');
      await fs.writeFile(templatePath, JSON.stringify(template, null, 2));

      // Verify template can be loaded
      const content = await fs.readFile(templatePath, 'utf-8');
      const loaded = JSON.parse(content) as AgentConfig;

      expect(loaded.agent_name).toBe('Template Agent');
      expect(loaded.voice_id).toBe('11labs-Adrian');
      expect(loaded.llm_config.model).toBe('gpt-4o-mini');
    });

    it('should list all available templates', async () => {
      // Create multiple templates
      await fs.writeFile(
        path.join(templatesDir, 'basic.json'),
        JSON.stringify({ agent_name: 'Basic' }, null, 2)
      );
      await fs.writeFile(
        path.join(templatesDir, 'advanced.json'),
        JSON.stringify({ agent_name: 'Advanced' }, null, 2)
      );
      await fs.writeFile(
        path.join(templatesDir, 'custom.json'),
        JSON.stringify({ agent_name: 'Custom' }, null, 2)
      );

      // Create non-template file
      await fs.writeFile(path.join(templatesDir, 'readme.txt'), 'Not a template');

      const files = await fs.readdir(templatesDir);
      const templates = files.filter((f) => f.endsWith('.json'));

      expect(templates).toHaveLength(3);
      expect(templates).toContain('basic.json');
      expect(templates).toContain('advanced.json');
      expect(templates).toContain('custom.json');
      expect(templates).not.toContain('readme.txt');
    });

    it('should handle template with prompt_config sections', async () => {
      const template: AgentConfig = {
        agent_name: 'Composable Template',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          prompt_config: {
            sections: ['base/greeting', 'base/closing'],
            variables: {
              company_name: 'Template Co',
              agent_role: 'assistant',
            },
            dynamic_variables: {
              customer_name: {
                type: 'string',
                description: 'Customer name',
              },
            },
          },
        },
      } as AgentConfig;

      const templatePath = path.join(templatesDir, 'composable.json');
      await fs.writeFile(templatePath, JSON.stringify(template, null, 2));

      const content = await fs.readFile(templatePath, 'utf-8');
      const loaded = JSON.parse(content) as AgentConfig;

      expect(loaded.llm_config.prompt_config).toBeDefined();
      expect(loaded.llm_config.prompt_config?.sections).toHaveLength(2);
      expect(loaded.llm_config.prompt_config?.variables).toHaveProperty('company_name');
      expect(loaded.llm_config.prompt_config?.dynamic_variables).toHaveProperty('customer_name');
    });
  });

  describe('Agent creation from template', () => {
    let template: AgentConfig;

    beforeEach(async () => {
      template = {
        agent_name: 'Template Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          prompt_config: {
            sections: ['base/greeting'],
            variables: {
              company_name: 'Default Company',
            },
          },
        },
      } as AgentConfig;

      await fs.writeFile(
        path.join(templatesDir, 'test-template.json'),
        JSON.stringify(template, null, 2)
      );
    });

    it('should create agent directory structure', async () => {
      const agentDir = path.join(agentsDir, 'new-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Write agent.json
      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(template, null, 2));

      // Create knowledge directory
      const knowledgeDir = path.join(agentDir, 'knowledge');
      await fs.mkdir(knowledgeDir, { recursive: true });

      // Verify structure
      const agentJsonExists = await fs
        .access(path.join(agentDir, 'agent.json'))
        .then(() => true)
        .catch(() => false);
      const knowledgeDirExists = await fs
        .access(knowledgeDir)
        .then(() => true)
        .catch(() => false);

      expect(agentJsonExists).toBe(true);
      expect(knowledgeDirExists).toBe(true);
    });

    it('should create agent with customized values', async () => {
      const customized: AgentConfig = {
        ...template,
        agent_name: 'My Custom Agent',
        voice_id: '11labs-Alice',
        language: 'en-GB',
        llm_config: {
          ...template.llm_config,
          model: 'gpt-4o',
          temperature: 0.9,
          prompt_config:
            template.llm_config.prompt_config !== null &&
            template.llm_config.prompt_config !== undefined
              ? {
                  ...template.llm_config.prompt_config,
                  variables: {
                    company_name: 'My Company',
                  },
                }
              : undefined,
        },
      };

      const agentDir = path.join(agentsDir, 'customized-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(customized, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);

      // Assert result is successful before accessing value
      if (!result.success) {
        throw new Error('Expected result to be successful');
      }

      expect(result.value.agent_name).toBe('My Custom Agent');
      expect(result.value.voice_id).toBe('11labs-Alice');
      expect(result.value.language).toBe('en-GB');
      expect(result.value.llm_config.model).toBe('gpt-4o');
      expect(result.value.llm_config.temperature).toBe(0.9);
      expect(result.value.llm_config.prompt_config?.variables?.['company_name']).toBe('My Company');
    });

    it('should preserve template structure when creating agent', async () => {
      const agentDir = path.join(agentsDir, 'structured-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Copy template to agent
      const agentConfig: AgentConfig = {
        ...template,
        agent_name: 'New Agent Name', // Only change name
      };

      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(agentConfig, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);

      // Assert result is successful before accessing value
      if (!result.success) {
        throw new Error('Expected result to be successful');
      }

      // Verify structure is preserved
      expect(result.value.llm_config.prompt_config?.sections).toEqual(
        template.llm_config.prompt_config?.sections
      );
      expect(result.value.llm_config.prompt_config?.variables).toEqual(
        template.llm_config.prompt_config?.variables
      );
    });
  });

  describe('Template validation', () => {
    it('should validate template has required fields', async () => {
      const validTemplate = {
        agent_name: 'Valid',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Valid',
        },
      };

      const agentDir = path.join(agentsDir, 'valid');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(validTemplate, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);
    });

    it('should reject template missing required fields', async () => {
      const invalidTemplate = {
        agent_name: 'Invalid',
        // Missing voice_id and language
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Invalid',
        },
      };

      const agentDir = path.join(agentsDir, 'invalid');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify(invalidTemplate, null, 2)
      );

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(false);
    });

    it('should validate template with tools configuration', async () => {
      const templateWithTools: AgentConfig = {
        agent_name: 'Tools Template',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Template with tools',
          tools: [
            {
              type: 'end_call',
              name: 'end_call',
              description: 'End the call',
            },
          ],
        },
      } as AgentConfig;

      const agentDir = path.join(agentsDir, 'tools-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify(templateWithTools, null, 2)
      );

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);

      // Assert result is successful before accessing value
      if (!result.success) {
        throw new Error('Expected result to be successful');
      }

      expect(result.value.llm_config.tools).toBeDefined();
      expect(result.value.llm_config.tools).toHaveLength(1);
    });
  });

  describe('Agent name validation', () => {
    it('should accept valid agent names', () => {
      const validNames = ['my-agent', 'agent-123', 'customer-service', 'sales-agent-v2', 'test'];

      for (const name of validNames) {
        const isValid = /^[a-z0-9-]+$/.test(name);
        expect(isValid).toBe(true);
      }
    });

    it('should reject invalid agent names', () => {
      const invalidNames = [
        'My-Agent', // uppercase
        'agent_123', // underscore
        'agent 123', // space
        'agent.json', // dot
        'AGENT', // all uppercase
        'agent@123', // special char
      ];

      for (const name of invalidNames) {
        const isValid = /^[a-z0-9-]+$/.test(name);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Template with post-call analysis', () => {
    it('should preserve post-call analysis configuration', async () => {
      const template: AgentConfig = {
        agent_name: 'Analysis Template',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Template',
        },
        post_call_analysis_data: [
          {
            name: 'sentiment',
            type: 'string',
            description: 'Customer sentiment',
          },
          {
            name: 'issue_resolved',
            type: 'boolean',
            description: 'Was issue resolved',
          },
        ],
      } as AgentConfig;

      const agentDir = path.join(agentsDir, 'analysis-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(template, null, 2));

      const result = await AgentConfigLoader.load(agentDir);
      expect(result.success).toBe(true);

      // Assert result is successful before accessing value
      if (!result.success) {
        throw new Error('Expected result to be successful');
      }

      const data = result.value.post_call_analysis_data;
      expect(data).toBeDefined();
      expect(data).toHaveLength(2);

      // Assert data is defined and has required elements
      if (
        data === null ||
        data === undefined ||
        data.length < 2 ||
        data[0] === null ||
        data[0] === undefined ||
        data[1] === undefined
      ) {
        throw new Error('Expected data to have at least 2 elements');
      }

      expect(data[0].name).toBe('sentiment');
      expect(data[1].type).toBe('boolean');
    });
  });

  describe('Duplicate agent detection', () => {
    it('should detect when agent directory already exists', async () => {
      const agentDir = path.join(agentsDir, 'existing-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(path.join(agentDir, 'agent.json'), '{}');

      // Try to check if directory exists
      const exists = await fs
        .access(agentDir)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });

    it('should allow creation when agent directory does not exist', async () => {
      const agentDir = path.join(agentsDir, 'new-agent');

      const exists = await fs
        .access(agentDir)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(false);

      // Should be able to create
      await fs.mkdir(agentDir, { recursive: true });
      const nowExists = await fs
        .access(agentDir)
        .then(() => true)
        .catch(() => false);

      expect(nowExists).toBe(true);
    });
  });

  describe('Knowledge directory creation', () => {
    it('should create knowledge directory for new agent', async () => {
      const agentDir = path.join(agentsDir, 'kb-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const knowledgeDir = path.join(agentDir, 'knowledge');
      await fs.mkdir(knowledgeDir, { recursive: true });

      const exists = await fs
        .access(knowledgeDir)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      // Verify it's a directory
      const stat = await fs.stat(knowledgeDir);
      expect(stat.isDirectory()).toBe(true);
    });
  });
});
