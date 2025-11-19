import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { PromptBuilder } from '@core/prompt-builder';
import type { PromptConfig } from '../../../src/types/agent.types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PromptBuilder', () => {
  let tempDir: string;
  let promptsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-test-'));
    promptsDir = path.join(tempDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('build', () => {
    it('should build prompt from single section', async () => {
      // Create prompt section
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/greeting.txt'),
        'You are a helpful assistant for {{company_name}}.'
      );

      const config: PromptConfig = {
        sections: ['base/greeting'],
        variables: {
          company_name: 'Acme Corp',
        },
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toBe('You are a helpful assistant for Acme Corp.');
    });

    it('should build prompt from multiple sections', async () => {
      // Create prompt sections
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(path.join(promptsDir, 'base/greeting.txt'), 'Hello! I am {{agent_name}}.');
      await fs.writeFile(
        path.join(promptsDir, 'base/closing.txt'),
        'Thank you for contacting {{company_name}}!'
      );

      const config: PromptConfig = {
        sections: ['base/greeting', 'base/closing'],
        variables: {
          agent_name: 'Support Bot',
          company_name: 'Acme Corp',
        },
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toContain('Hello! I am Support Bot.');
      expect(prompt).toContain('Thank you for contacting Acme Corp!');
    });

    it('should keep OVERRIDE variables as template tags', async () => {
      // Create prompt section with override variable
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/greeting.txt'),
        'Hello {{user_name}}! Welcome to {{company_name}}.'
      );

      const config: PromptConfig = {
        sections: ['base/greeting'],
        variables: {
          company_name: 'Acme Corp',
          user_name: 'OVERRIDE', // Should keep {{user_name}} in final prompt
        },
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toBe('Hello {{user_name}}! Welcome to Acme Corp.');
    });

    it('should keep dynamic variables as template tags', async () => {
      // Create prompt section with dynamic variable
      await fs.mkdir(path.join(promptsDir, 'customer-service'), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(promptsDir, 'customer-service/order-lookup.txt'),
        'I can help you with order {{order_id}} for {{customer_name}}.'
      );

      const config: PromptConfig = {
        sections: ['customer-service/order-lookup'],
        dynamic_variables: {
          order_id: {
            type: 'string',
            description: 'Order ID',
          },
          customer_name: {
            type: 'string',
            description: 'Customer name',
          },
        },
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toBe('I can help you with order {{order_id}} for {{customer_name}}.');
    });

    it('should keep system variables as template tags', async () => {
      // Create prompt section with system variable
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/time.txt'),
        'The current time is {{current_time_Australia/Sydney}}.'
      );

      const config: PromptConfig = {
        sections: ['base/time'],
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toBe('The current time is {{current_time_Australia/Sydney}}.');
    });

    it('should apply overrides to sections', async () => {
      // Create prompt section
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/greeting.txt'),
        'Default greeting for {{company_name}}.'
      );

      const config: PromptConfig = {
        sections: ['base/greeting'],
        overrides: {
          'base/greeting': 'Custom greeting for {{company_name}}!',
        },
        variables: {
          company_name: 'Acme Corp',
        },
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toBe('Custom greeting for Acme Corp!');
    });

    it('should handle mixed static and OVERRIDE variables', async () => {
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/mixed.txt'),
        'Welcome to {{company_name}}! Your session ID is {{session_id}} and user is {{user_id}}.'
      );

      const config: PromptConfig = {
        sections: ['base/mixed'],
        variables: {
          company_name: 'Acme Corp', // Static - replace
          session_id: 'OVERRIDE', // Override - keep as {{session_id}}
          user_id: 'OVERRIDE', // Override - keep as {{user_id}}
        },
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toBe(
        'Welcome to Acme Corp! Your session ID is {{session_id}} and user is {{user_id}}.'
      );
    });

    it('should handle sections with no variables', async () => {
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(
        path.join(promptsDir, 'base/simple.txt'),
        'This is a simple prompt with no variables.'
      );

      const config: PromptConfig = {
        sections: ['base/simple'],
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toBe('This is a simple prompt with no variables.');
    });

    it('should return error if section file not found', async () => {
      const config: PromptConfig = {
        sections: ['base/nonexistent'],
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: Error }).error;
      expect(error.message).toContain('not found');
    });

    it('should join multiple sections with newlines', async () => {
      await fs.mkdir(path.join(promptsDir, 'base'), { recursive: true });
      await fs.writeFile(path.join(promptsDir, 'base/section1.txt'), 'Part 1');
      await fs.writeFile(path.join(promptsDir, 'base/section2.txt'), 'Part 2');
      await fs.writeFile(path.join(promptsDir, 'base/section3.txt'), 'Part 3');

      const config: PromptConfig = {
        sections: ['base/section1', 'base/section2', 'base/section3'],
      };

      const result = await PromptBuilder.build(promptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toBe('Part 1\n\nPart 2\n\nPart 3');
    });

    it('should load from fixture prompts directory', async () => {
      const fixturePromptsDir = path.join(process.cwd(), 'tests/fixtures/complete-project/prompts');

      const config: PromptConfig = {
        sections: ['base/greeting', 'base/closing'],
        variables: {
          company_name: 'Test Corp',
        },
      };

      const result = await PromptBuilder.build(fixturePromptsDir, config);

      expect(result.success).toBe(true);
      const prompt = (result as { success: true; value: string }).value;
      expect(prompt).toContain('Test Corp');
    });
  });

  describe('extractVariables', () => {
    it('should extract all {{variable}} references from text', () => {
      const text = 'Hello {{user_name}}, welcome to {{company_name}}. Your ID is {{user_id}}.';

      const variables = PromptBuilder.extractVariables(text);

      expect(variables).toEqual(['user_name', 'company_name', 'user_id']);
    });

    it('should extract system variables with special chars', () => {
      const text =
        'The time is {{current_time_Australia/Sydney}} and date is {{current_date_UTC}}.';

      const variables = PromptBuilder.extractVariables(text);

      expect(variables).toEqual(['current_time_Australia/Sydney', 'current_date_UTC']);
    });

    it('should return unique variables only', () => {
      const text = 'Hello {{user_name}}, {{user_name}} is logged in to {{company_name}}.';

      const variables = PromptBuilder.extractVariables(text);

      expect(variables).toEqual(['user_name', 'company_name']);
    });

    it('should return empty array if no variables', () => {
      const text = 'This is a simple text with no variables.';

      const variables = PromptBuilder.extractVariables(text);

      expect(variables).toEqual([]);
    });

    it('should handle empty string', () => {
      const variables = PromptBuilder.extractVariables('');

      expect(variables).toEqual([]);
    });
  });
});
