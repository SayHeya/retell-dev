/**
 * Tests for VersionController
 *
 * Tests version control operations including:
 * - Version history retrieval
 * - Publishing versions
 * - Version validation before push
 * - Version drift detection
 * - Rollback operations
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { VersionController, MetadataManager } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('VersionController', () => {
  let originalCwd: string;
  let tempDir: string;
  let agentsDir: string;
  let controller: VersionController;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'version-ctrl-test-'));
    process.chdir(tempDir);

    agentsDir = path.join(tempDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });

    controller = new VersionController();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('validateVersionForPush', () => {
    it('should return canPush=true for new agent without metadata', async () => {
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

      const result = await controller.validateVersionForPush('new-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.canPush).toBe(true);
        expect(result.value.isNewAgent).toBe(true);
        expect(result.value.storedVersion).toBeNull();
      }
    });

    it('should return canPush=true for agent without agent_id in metadata', async () => {
      const agentDir = path.join(agentsDir, 'partial-agent');
      await fs.mkdir(agentDir, { recursive: true });
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify({ agent_name: 'Partial Agent' })
      );

      // Create staging.json without agent_id (never pushed)
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

      const result = await controller.validateVersionForPush('partial-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.canPush).toBe(true);
        expect(result.value.isNewAgent).toBe(true);
      }
    });

    it('should return error when workspace config is missing', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const result = await controller.validateVersionForPush('test-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getVersionHistory', () => {
    it('should return error for agent without metadata', async () => {
      const agentDir = path.join(agentsDir, 'no-meta-agent');
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

      const result = await controller.getVersionHistory('no-meta-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // When metadata is missing, it returns "not been pushed" error
        expect(result.error.message).toContain('not been pushed');
      }
    });

    it('should return error for agent without agent_id', async () => {
      const agentDir = path.join(agentsDir, 'no-id-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Create staging.json without agent_id
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

      const result = await controller.getVersionHistory('no-id-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // When metadata exists but agent_id is null, "not found or not synced"
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return error when workspace config is missing', async () => {
      const agentDir = path.join(agentsDir, 'test-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const result = await controller.getVersionHistory('test-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('detectVersionDrift', () => {
    it('should return error for agent without metadata', async () => {
      const agentDir = path.join(agentsDir, 'no-meta-agent');
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

      const result = await controller.detectVersionDrift('no-meta-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not been pushed');
      }
    });

    it('should return error for agent without agent_id', async () => {
      const agentDir = path.join(agentsDir, 'no-id-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Create staging.json without agent_id
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

      const result = await controller.detectVersionDrift('no-id-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
  });

  describe('publish', () => {
    it('should return error for agent without metadata', async () => {
      const agentDir = path.join(agentsDir, 'no-meta-agent');
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

      const result = await controller.publish('no-meta-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not been pushed');
      }
    });

    it('should return error for agent without agent_id', async () => {
      const agentDir = path.join(agentsDir, 'no-id-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Create staging.json without agent_id
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

      const result = await controller.publish('no-id-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
  });

  describe('rollback', () => {
    it('should return error for agent without metadata', async () => {
      const agentDir = path.join(agentsDir, 'no-meta-agent');
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

      const result = await controller.rollback('no-meta-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
        targetVersion: 1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not been pushed');
      }
    });

    it('should return error for agent without agent_id', async () => {
      const agentDir = path.join(agentsDir, 'no-id-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Create staging.json without agent_id
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

      const result = await controller.rollback('no-id-agent', {
        workspace: 'staging',
        agentsPath: agentsDir,
        targetVersion: 1,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not found');
      }
    });
  });
});

describe('VersionController integration helpers', () => {
  let originalCwd: string;
  let tempDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'version-helper-test-'));
    process.chdir(tempDir);

    agentsDir = path.join(tempDir, 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('MetadataManager version tracking', () => {
    it('should store retell_version in metadata', async () => {
      const agentDir = path.join(agentsDir, 'versioned-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const metadata = {
        workspace: 'staging' as const,
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:abc123' as never,
        retell_version: 3,
      };

      await MetadataManager.write(agentDir, metadata);

      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);
      if (readResult.success) {
        expect(readResult.value.retell_version).toBe(3);
      }
    });

    it('should update retell_version via MetadataManager.update', async () => {
      const agentDir = path.join(agentsDir, 'update-version-agent');
      await fs.mkdir(agentDir, { recursive: true });

      // Initial metadata without version
      const metadata = {
        workspace: 'staging' as const,
        agent_id: 'agent_123' as never,
        llm_id: 'llm_456' as never,
        kb_id: null,
        last_sync: new Date().toISOString() as never,
        config_hash: 'sha256:abc123' as never,
        retell_version: null,
      };

      await MetadataManager.write(agentDir, metadata);

      // Update with version
      await MetadataManager.update(agentDir, 'staging', {
        retell_version: 5,
      });

      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);
      if (readResult.success) {
        expect(readResult.value.retell_version).toBe(5);
      }
    });

    it('should preserve other metadata fields when updating version', async () => {
      const agentDir = path.join(agentsDir, 'preserve-fields-agent');
      await fs.mkdir(agentDir, { recursive: true });

      const originalSync = new Date().toISOString();
      const metadata = {
        workspace: 'staging' as const,
        agent_id: 'agent_preserve' as never,
        llm_id: 'llm_preserve' as never,
        kb_id: 'kb_preserve' as never,
        last_sync: originalSync as never,
        config_hash: 'sha256:preserve' as never,
        retell_version: 1,
      };

      await MetadataManager.write(agentDir, metadata);

      // Update only version
      await MetadataManager.update(agentDir, 'staging', {
        retell_version: 2,
      });

      const readResult = await MetadataManager.read(agentDir, 'staging');
      expect(readResult.success).toBe(true);
      if (readResult.success) {
        expect(readResult.value.agent_id).toBe('agent_preserve');
        expect(readResult.value.llm_id).toBe('llm_preserve');
        expect(readResult.value.kb_id).toBe('kb_preserve');
        expect(readResult.value.config_hash).toBe('sha256:preserve');
        expect(readResult.value.retell_version).toBe(2);
      }
    });
  });
});
