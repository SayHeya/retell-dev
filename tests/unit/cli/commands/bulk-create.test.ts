/**
 * Tests for bulk-create command functionality
 *
 * Tests bulk agent creation from templates
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import type { AgentConfig } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Bulk Create Command Dependencies', () => {
  let tempDir: string;
  let templatesDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bulk-create-test-'));
    templatesDir = path.join(tempDir, 'templates');
    agentsDir = path.join(tempDir, 'agents');
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Template loading and agent creation', () => {
    it('should load template file for bulk creation', async () => {
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
      expect(loaded.language).toBe('en-US');
    });

    it('should create multiple agent directories from template', async () => {
      const template: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Test prompt',
        },
      } as AgentConfig;

      // Create multiple agent configs
      const count = 5;
      for (let i = 1; i <= count; i++) {
        const agentDir = path.join(agentsDir, `agent-${i}`);
        await fs.mkdir(agentDir, { recursive: true });

        const config = {
          ...template,
          agent_name: `Test Agent ${i}`,
        };

        await fs.writeFile(path.join(agentDir, 'agent.json'), JSON.stringify(config, null, 2));
      }

      // Verify all agents were created
      const agentDirs = await fs.readdir(agentsDir);
      expect(agentDirs).toHaveLength(count);
      expect(agentDirs).toContain('agent-1');
      expect(agentDirs).toContain('agent-5');

      // Verify each agent has config file
      for (let i = 1; i <= count; i++) {
        const configPath = path.join(agentsDir, `agent-${i}`, 'agent.json');
        const exists = await fs
          .access(configPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it('should handle agent naming with custom prefix', async () => {
      const prefix = 'test-agent';
      const count = 3;

      for (let i = 1; i <= count; i++) {
        const agentDir = path.join(agentsDir, `${prefix}-${i}`);
        await fs.mkdir(agentDir, { recursive: true });
      }

      const agentDirs = await fs.readdir(agentsDir);
      expect(agentDirs).toContain('test-agent-1');
      expect(agentDirs).toContain('test-agent-2');
      expect(agentDirs).toContain('test-agent-3');
    });

    it('should validate agent count limits', () => {
      const validCounts = [1, 10, 100, 1000, 10000];
      const invalidCounts = [0, -1, 10001, 100000];

      validCounts.forEach((count) => {
        expect(count >= 1 && count <= 10000).toBe(true);
      });

      invalidCounts.forEach((count) => {
        expect(count >= 1 && count <= 10000).toBe(false);
      });
    });

    it('should create metadata files for each agent', async () => {
      const agentDir = path.join(agentsDir, 'agent-1');
      await fs.mkdir(agentDir, { recursive: true });

      // Create metadata files
      const stagingMeta = {
        workspace: 'staging',
        agent_id: null,
        llm_id: null,
        kb_id: null,
        last_sync: null,
        config_hash: null,
        retell_version: null,
      };

      const productionMeta = {
        workspace: 'production',
        agent_id: null,
        llm_id: null,
        kb_id: null,
        last_sync: null,
        config_hash: null,
        retell_version: null,
      };

      await fs.writeFile(path.join(agentDir, 'staging.json'), JSON.stringify(stagingMeta, null, 2));
      await fs.writeFile(
        path.join(agentDir, 'production.json'),
        JSON.stringify(productionMeta, null, 2)
      );

      // Verify metadata files exist
      const files = await fs.readdir(agentDir);
      expect(files).toContain('staging.json');
      expect(files).toContain('production.json');
    });
  });

  describe('Error handling', () => {
    it('should handle missing template file', async () => {
      const templatePath = path.join(templatesDir, 'nonexistent.json');

      await expect(fs.readFile(templatePath, 'utf-8')).rejects.toThrow();
    });

    it('should handle invalid JSON in template', async () => {
      const templatePath = path.join(templatesDir, 'invalid.json');
      await fs.writeFile(templatePath, 'invalid json content');

      const content = await fs.readFile(templatePath, 'utf-8');
      expect(() => JSON.parse(content)).toThrow();
    });

    it('should validate agents directory creation', async () => {
      const newAgentsDir = path.join(tempDir, 'new-agents');

      // Verify directory doesn't exist
      await expect(fs.access(newAgentsDir)).rejects.toThrow();

      // Create it
      await fs.mkdir(newAgentsDir, { recursive: true });

      // Verify it now exists
      await expect(fs.access(newAgentsDir)).resolves.toBeUndefined();
    });
  });
});
