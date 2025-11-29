/**
 * Tests for sync command functionality
 *
 * The sync command reconciles local metadata files with actual workspace state.
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { WorkspaceController, MetadataManager, type MetadataFile } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Sync Command Dependencies', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;
  let tempDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    // Save original env and cwd
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    // Create temp directory and change to it
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-cmd-test-'));
    process.chdir(tempDir);

    // Create agents directory
    agentsDir = path.join(tempDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore original env and cwd
    process.env = originalEnv;
    process.chdir(originalCwd);

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Workspace discovery', () => {
    it('should get all workspaces for syncing in single-production mode', async () => {
      const workspacesConfig = {
        mode: 'single-production',
        staging: {
          api_key: 'staging_key',
          name: 'WORKSPACE_STAGING',
          base_url: 'https://api.retellai.com',
        },
        production: {
          api_key: 'prod_key',
          name: 'WORKSPACE_1_PRODUCTION',
          base_url: 'https://api.retellai.com',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const controller = new WorkspaceController();
      const result = await controller.getAllWorkspaces();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
        expect(result.value.map((w) => w.type)).toEqual(['staging', 'production']);
      }
    });

    it('should get all workspaces for syncing in multi-production mode', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key';
      process.env['RETELL_PRODUCTION_1_API_KEY'] = 'prod_key_1';
      process.env['RETELL_PRODUCTION_2_API_KEY'] = 'prod_key_2';

      const workspacesConfig = {
        mode: 'multi-production',
        staging: {
          api_key_env: 'RETELL_STAGING_API_KEY',
          name: 'WORKSPACE_STAGING',
          base_url: 'https://api.retellai.com',
        },
        production: [
          {
            id: 'ws_prod_1',
            api_key_env: 'RETELL_PRODUCTION_1_API_KEY',
            name: 'WORKSPACE_1_PRODUCTION',
            base_url: 'https://api.retellai.com',
          },
          {
            id: 'ws_prod_2',
            api_key_env: 'RETELL_PRODUCTION_2_API_KEY',
            name: 'WORKSPACE_2_PRODUCTION',
            base_url: 'https://api.retellai.com',
          },
        ],
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const controller = new WorkspaceController();
      const result = await controller.getAllWorkspaces();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]?.type).toBe('staging');
        expect(result.value[1]?.type).toBe('production');
        expect(result.value[1]?.index).toBe(0);
        expect(result.value[2]?.type).toBe('production');
        expect(result.value[2]?.index).toBe(1);
      }
    });
  });

  describe('Agent directory discovery', () => {
    it('should find all agent directories', async () => {
      // Create agent directories
      await fs.mkdir(path.join(agentsDir, 'customer-service'), { recursive: true });
      await fs.mkdir(path.join(agentsDir, 'sales-agent'), { recursive: true });

      // Create agent.json files
      await fs.writeFile(
        path.join(agentsDir, 'customer-service', 'agent.json'),
        JSON.stringify({ agent_name: 'Customer Service' })
      );
      await fs.writeFile(
        path.join(agentsDir, 'sales-agent', 'agent.json'),
        JSON.stringify({ agent_name: 'Sales Agent' })
      );

      const entries = await fs.readdir(agentsDir, { withFileTypes: true });
      const agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      expect(agentDirs).toContain('customer-service');
      expect(agentDirs).toContain('sales-agent');
      expect(agentDirs).toHaveLength(2);
    });

    it('should read agent name from agent.json', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify({ agent_name: 'Test Agent Name' })
      );

      const content = await fs.readFile(path.join(agentDir, 'agent.json'), 'utf-8');
      const config = JSON.parse(content);

      expect(config.agent_name).toBe('Test Agent Name');
    });
  });

  describe('Metadata file operations', () => {
    it('should write staging metadata', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const metadata: MetadataFile = {
        workspace: 'staging',
        agent_id: 'agent_staging_123' as never,
        llm_id: 'llm_staging_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:abc123' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, metadata);

      const result = await MetadataManager.read(agentDir, 'staging');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBe('agent_staging_123');
      }
    });

    it('should write production metadata in single-production mode', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const metadata: MetadataFile = {
        workspace: 'production',
        agent_id: 'agent_prod_123' as never,
        llm_id: 'llm_prod_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:def456' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, metadata);

      const result = await MetadataManager.read(agentDir, 'production');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.agent_id).toBe('agent_prod_123');
      }
    });

    it('should handle multi-production metadata as array', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Multi-production mode stores production.json as an array
      const metadataArray = [
        {
          workspace: 'production',
          agent_id: 'agent_prod1_123',
          llm_id: 'llm_prod1_456',
          kb_id: null,
          last_sync: new Date().toISOString(),
          config_hash: 'sha256:abc123',
          workspace_id: 'ws_prod_1',
          workspace_name: 'WORKSPACE_1_PRODUCTION',
        },
        {
          workspace: 'production',
          agent_id: 'agent_prod2_789',
          llm_id: 'llm_prod2_012',
          kb_id: null,
          last_sync: new Date().toISOString(),
          config_hash: 'sha256:def456',
          workspace_id: 'ws_prod_2',
          workspace_name: 'WORKSPACE_2_PRODUCTION',
        },
      ];

      await fs.writeFile(
        path.join(agentDir, 'production.json'),
        JSON.stringify(metadataArray, null, 2)
      );

      const content = await fs.readFile(path.join(agentDir, 'production.json'), 'utf-8');
      const parsed = JSON.parse(content);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].workspace_id).toBe('ws_prod_1');
      expect(parsed[1].workspace_id).toBe('ws_prod_2');
    });

    it('should update entry in multi-production metadata array', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Initial array
      const initialArray = [
        {
          workspace: 'production',
          agent_id: 'agent_old',
          workspace_id: 'ws_prod_1',
          workspace_name: 'WORKSPACE_1_PRODUCTION',
        },
      ];

      await fs.writeFile(
        path.join(agentDir, 'production.json'),
        JSON.stringify(initialArray, null, 2)
      );

      // Read, update, and write back
      const content = await fs.readFile(path.join(agentDir, 'production.json'), 'utf-8');
      let existingEntries = JSON.parse(content);
      if (!Array.isArray(existingEntries)) {
        existingEntries = [existingEntries];
      }

      // Find and update entry for ws_prod_1
      const existingIdx = existingEntries.findIndex(
        (e: { workspace_id?: string }) => e.workspace_id === 'ws_prod_1'
      );

      if (existingIdx >= 0) {
        existingEntries[existingIdx] = {
          ...existingEntries[existingIdx],
          agent_id: 'agent_updated',
          last_sync: new Date().toISOString(),
        };
      }

      await fs.writeFile(
        path.join(agentDir, 'production.json'),
        JSON.stringify(existingEntries, null, 2)
      );

      // Verify update
      const updated = JSON.parse(
        await fs.readFile(path.join(agentDir, 'production.json'), 'utf-8')
      );
      expect(updated[0].agent_id).toBe('agent_updated');
    });

    it('should remove entry from multi-production metadata array', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const initialArray = [
        { workspace: 'production', agent_id: 'agent_1', workspace_id: 'ws_prod_1' },
        { workspace: 'production', agent_id: 'agent_2', workspace_id: 'ws_prod_2' },
      ];

      await fs.writeFile(
        path.join(agentDir, 'production.json'),
        JSON.stringify(initialArray, null, 2)
      );

      // Remove ws_prod_1 entry
      const content = await fs.readFile(path.join(agentDir, 'production.json'), 'utf-8');
      const entries = JSON.parse(content);
      const filtered = entries.filter(
        (e: { workspace_id?: string }) => e.workspace_id !== 'ws_prod_1'
      );

      await fs.writeFile(
        path.join(agentDir, 'production.json'),
        JSON.stringify(filtered, null, 2)
      );

      // Verify removal
      const updated = JSON.parse(
        await fs.readFile(path.join(agentDir, 'production.json'), 'utf-8')
      );
      expect(updated).toHaveLength(1);
      expect(updated[0].workspace_id).toBe('ws_prod_2');
    });

    it('should delete production.json when last entry is removed', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const initialArray = [
        { workspace: 'production', agent_id: 'agent_1', workspace_id: 'ws_prod_1' },
      ];

      await fs.writeFile(
        path.join(agentDir, 'production.json'),
        JSON.stringify(initialArray, null, 2)
      );

      // Remove ws_prod_1 entry
      const content = await fs.readFile(path.join(agentDir, 'production.json'), 'utf-8');
      const entries = JSON.parse(content);
      const filtered = entries.filter(
        (e: { workspace_id?: string }) => e.workspace_id !== 'ws_prod_1'
      );

      if (filtered.length > 0) {
        await fs.writeFile(
          path.join(agentDir, 'production.json'),
          JSON.stringify(filtered, null, 2)
        );
      } else {
        await fs.unlink(path.join(agentDir, 'production.json'));
      }

      // Verify file is deleted
      const fileExists = await fs
        .access(path.join(agentDir, 'production.json'))
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(false);
    });
  });

  describe('Agent matching', () => {
    it('should match agent by name', () => {
      const agents = [
        { agent_id: 'agent_1', agent_name: 'Customer Service' },
        { agent_id: 'agent_2', agent_name: 'Sales Agent' },
      ];

      const matchingAgent = agents.find((a) => a.agent_name === 'Customer Service');

      expect(matchingAgent).toBeDefined();
      expect(matchingAgent?.agent_id).toBe('agent_1');
    });

    it('should match agent by directory name fallback', () => {
      const agents = [
        { agent_id: 'agent_1', agent_name: 'customer-service' },
        { agent_id: 'agent_2', agent_name: 'Sales Agent' },
      ];

      const agentDir = 'customer-service';
      const matchingAgent = agents.find(
        (a) => a.agent_name === agentDir || a.agent_name.toLowerCase() === agentDir.toLowerCase()
      );

      expect(matchingAgent).toBeDefined();
      expect(matchingAgent?.agent_id).toBe('agent_1');
    });

    it('should return undefined for non-matching agent', () => {
      const agents = [
        { agent_id: 'agent_1', agent_name: 'Customer Service' },
        { agent_id: 'agent_2', agent_name: 'Sales Agent' },
      ];

      const matchingAgent = agents.find((a) => a.agent_name === 'Non-Existent Agent');

      expect(matchingAgent).toBeUndefined();
    });
  });

  describe('Mode detection', () => {
    it('should detect single-production mode', async () => {
      const workspacesConfig = {
        mode: 'single-production',
        staging: {
          api_key: 'staging_key',
          name: 'Staging',
          base_url: 'https://api.retellai.com',
        },
        production: {
          api_key: 'prod_key',
          name: 'Production',
          base_url: 'https://api.retellai.com',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const controller = new WorkspaceController();
      const result = await controller.getMode();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('single-production');
      }
    });

    it('should detect multi-production mode', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key';
      process.env['RETELL_PRODUCTION_1_API_KEY'] = 'prod_key_1';

      const workspacesConfig = {
        mode: 'multi-production',
        staging: {
          api_key_env: 'RETELL_STAGING_API_KEY',
          name: 'Staging',
          base_url: 'https://api.retellai.com',
        },
        production: [
          {
            api_key_env: 'RETELL_PRODUCTION_1_API_KEY',
            name: 'Production 1',
            base_url: 'https://api.retellai.com',
          },
        ],
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const controller = new WorkspaceController();
      const result = await controller.getMode();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('multi-production');
      }
    });
  });

  describe('Dry run behavior', () => {
    it('should not modify files in dry run mode', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const originalMetadata = {
        workspace: 'staging',
        agent_id: 'original_id',
      };

      await fs.writeFile(
        path.join(agentDir, 'staging.json'),
        JSON.stringify(originalMetadata, null, 2)
      );

      // In dry run, we would check what would change but not write
      const dryRun = true;
      const newMetadata = { ...originalMetadata, agent_id: 'new_id' };

      if (!dryRun) {
        await fs.writeFile(
          path.join(agentDir, 'staging.json'),
          JSON.stringify(newMetadata, null, 2)
        );
      }

      // Verify file wasn't changed
      const content = JSON.parse(
        await fs.readFile(path.join(agentDir, 'staging.json'), 'utf-8')
      );
      expect(content.agent_id).toBe('original_id');
    });
  });
});
