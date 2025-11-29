/**
 * Tests for version CLI command
 *
 * Tests the version command group which includes:
 * - history: View version history
 * - publish: Publish current version
 * - rollback: Rollback to a previous version
 * - drift: Check for version drift
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { VersionController, MetadataManager } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Version Command Dependencies', () => {
  let originalCwd: string;
  let tempDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'version-cmd-test-'));
    process.chdir(tempDir);

    agentsDir = path.join(tempDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Version history command prerequisites', () => {
    it('should require valid agent with metadata', async () => {
      // Create agent directory with agent.json but no metadata
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify({ agent_name: 'Test Agent' })
      );

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
          staging: {
            api_key: 'test_key',
            name: 'Staging',
            base_url: 'https://api.retellai.com',
          },
          production: {
            api_key: 'prod_key',
            name: 'Production',
            base_url: 'https://api.retellai.com',
          },
        })
      );

      const controller = new VersionController();
      const result = await controller.getVersionHistory('test-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      // Without metadata, should fail
      expect(result.success).toBe(false);
    });

    it('should require agent_id in metadata', async () => {
      // Create agent with metadata but no agent_id
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'staging.json'),
        JSON.stringify({
          workspace: 'staging',
          agent_id: null,
          llm_id: null,
          kb_id: null,
          last_sync: new Date().toISOString(),
          config_hash: 'sha256:test',
        })
      );

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
          staging: {
            api_key: 'test_key',
            name: 'Staging',
            base_url: 'https://api.retellai.com',
          },
          production: {
            api_key: 'prod_key',
            name: 'Production',
            base_url: 'https://api.retellai.com',
          },
        })
      );

      const controller = new VersionController();
      const result = await controller.getVersionHistory('test-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      // With null agent_id, should fail
      expect(result.success).toBe(false);
    });
  });

  describe('Version publish command prerequisites', () => {
    it('should require synced agent to publish', async () => {
      // Create agent without metadata
      const agentDir = path.join(agentsDir, 'publish-test');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify({ agent_name: 'Publish Test' })
      );

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
          staging: {
            api_key: 'test_key',
            name: 'Staging',
            base_url: 'https://api.retellai.com',
          },
          production: {
            api_key: 'prod_key',
            name: 'Production',
            base_url: 'https://api.retellai.com',
          },
        })
      );

      const controller = new VersionController();
      const result = await controller.publish('publish-test', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      // Without metadata (never pushed), should fail
      expect(result.success).toBe(false);
    });
  });

  describe('Version rollback command prerequisites', () => {
    it('should require synced agent to rollback', async () => {
      // Create agent without metadata
      const agentDir = path.join(agentsDir, 'rollback-test');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify({ agent_name: 'Rollback Test' })
      );

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
          staging: {
            api_key: 'test_key',
            name: 'Staging',
            base_url: 'https://api.retellai.com',
          },
          production: {
            api_key: 'prod_key',
            name: 'Production',
            base_url: 'https://api.retellai.com',
          },
        })
      );

      const controller = new VersionController();
      const result = await controller.rollback('rollback-test', {
        workspace: 'staging',
        agentsPath: agentsDir,
        targetVersion: 1,
      });

      // Without metadata (never pushed), should fail
      expect(result.success).toBe(false);
    });

    it('should support dry-run option', async () => {
      // Even without proper setup, dry-run validation should work
      const agentDir = path.join(agentsDir, 'dry-run-test');
      await fs.mkdir(agentDir, { recursive: true });

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
          staging: {
            api_key: 'test_key',
            name: 'Staging',
            base_url: 'https://api.retellai.com',
          },
          production: {
            api_key: 'prod_key',
            name: 'Production',
            base_url: 'https://api.retellai.com',
          },
        })
      );

      const controller = new VersionController();
      const result = await controller.rollback('dry-run-test', {
        workspace: 'staging',
        agentsPath: agentsDir,
        targetVersion: 1,
        dryRun: true, // Should still fail but demonstrates option support
      });

      // Still fails because agent doesn't exist/synced
      expect(result.success).toBe(false);
    });
  });

  describe('Version drift command prerequisites', () => {
    it('should require synced agent for drift detection', async () => {
      // Create agent without metadata
      const agentDir = path.join(agentsDir, 'drift-test');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify({ agent_name: 'Drift Test' })
      );

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
          staging: {
            api_key: 'test_key',
            name: 'Staging',
            base_url: 'https://api.retellai.com',
          },
          production: {
            api_key: 'prod_key',
            name: 'Production',
            base_url: 'https://api.retellai.com',
          },
        })
      );

      const controller = new VersionController();
      const result = await controller.detectVersionDrift('drift-test', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      // Without metadata (never pushed), should fail
      expect(result.success).toBe(false);
    });
  });

  describe('Version validation for push', () => {
    it('should allow push for new agent', async () => {
      // Create agent without metadata
      const agentDir = path.join(agentsDir, 'new-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify({ agent_name: 'New Agent' })
      );

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
          staging: {
            api_key: 'test_key',
            name: 'Staging',
            base_url: 'https://api.retellai.com',
          },
          production: {
            api_key: 'prod_key',
            name: 'Production',
            base_url: 'https://api.retellai.com',
          },
        })
      );

      const controller = new VersionController();
      const result = await controller.validateVersionForPush('new-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      // New agent should be allowed to push
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.canPush).toBe(true);
        expect(result.value.isNewAgent).toBe(true);
      }
    });

    it('should validate existing agent without remote call if no agent_id', async () => {
      // Create agent with metadata but null agent_id (never pushed)
      const agentDir = path.join(agentsDir, 'partial-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify({ agent_name: 'Partial Agent' })
      );
      await fs.writeFile(
        path.join(agentDir, 'staging.json'),
        JSON.stringify({
          workspace: 'staging',
          agent_id: null,
          llm_id: null,
          kb_id: null,
          last_sync: null,
          config_hash: null,
        })
      );

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
          staging: {
            api_key: 'test_key',
            name: 'Staging',
            base_url: 'https://api.retellai.com',
          },
          production: {
            api_key: 'prod_key',
            name: 'Production',
            base_url: 'https://api.retellai.com',
          },
        })
      );

      const controller = new VersionController();
      const result = await controller.validateVersionForPush('partial-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      // Should treat as new agent
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.canPush).toBe(true);
        expect(result.value.isNewAgent).toBe(true);
      }
    });
  });

  describe('Workspace option handling', () => {
    it('should accept staging workspace', async () => {
      const agentDir = path.join(agentsDir, 'ws-test');
      await fs.mkdir(agentDir, { recursive: true });

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
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
        })
      );

      const controller = new VersionController();
      const result = await controller.validateVersionForPush('ws-test', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      // Should succeed (new agent)
      expect(result.success).toBe(true);
    });

    it('should accept production workspace', async () => {
      const agentDir = path.join(agentsDir, 'ws-test-prod');
      await fs.mkdir(agentDir, { recursive: true });

      // Create workspaces.json
      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify({
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
        })
      );

      const controller = new VersionController();
      const result = await controller.validateVersionForPush('ws-test-prod', {
        workspace: 'production',
        agentsPath: agentsDir,
      });

      // Should succeed (new agent)
      expect(result.success).toBe(true);
    });
  });

  describe('Metadata with version tracking', () => {
    it('should read retell_version from metadata', async () => {
      const agentDir = path.join(agentsDir, 'versioned-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const metadata = {
        workspace: 'staging' as const,
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:abc123' as never,
        retell_version: 5,
      };

      await MetadataManager.write(agentDir, metadata);

      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);
      if (readResult.success) {
        expect(readResult.value.retell_version).toBe(5);
      }
    });

    it('should handle metadata with null retell_version', async () => {
      const agentDir = path.join(agentsDir, 'null-version-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const metadata = {
        workspace: 'staging' as const,
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:abc123' as never,
        retell_version: null, // Explicitly null (never synced with version)
      };

      await MetadataManager.write(agentDir, metadata);

      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);
      if (readResult.success) {
        expect(readResult.value.retell_version).toBeNull();
      }
    });
  });
});
