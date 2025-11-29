import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { WorkspaceConfigService, WorkspaceController, type RetellError } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceConfigService', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;
  let tempDir: string;

  beforeEach(async () => {
    // Save original env and cwd
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    // Create temp directory and change to it
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    // Restore original env and cwd
    process.env = originalEnv;
    process.chdir(originalCwd);

    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should load workspace configs from workspaces.json file', async () => {
      const workspacesConfig = {
        staging: {
          api_key: 'staging_key_123',
          name: 'Staging',
          base_url: 'https://api.retellai.com',
        },
        production: {
          api_key: 'prod_key_456',
          name: 'Production',
          base_url: 'https://api.retellai.com',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const result = await WorkspaceConfigService.load();

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.value.staging.apiKey).toBe('staging_key_123');
      expect(result.value.mode).toBe('single-production');
      if (result.value.mode === 'single-production') {
        expect(result.value.production.apiKey).toBe('prod_key_456');
      }
    });

    it('should use custom base URL if provided in file', async () => {
      const workspacesConfig = {
        staging: {
          api_key: 'staging_key_123',
          name: 'Staging',
          base_url: 'https://custom.retell.com',
        },
        production: {
          api_key: 'prod_key_456',
          name: 'Production',
          base_url: 'https://custom.retell.com',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const result = await WorkspaceConfigService.load();

      expect(result.success).toBe(true);
      const config = (result as { success: true; value: unknown }).value;
      expect(config).toMatchObject({
        staging: {
          baseUrl: 'https://custom.retell.com',
        },
        production: {
          baseUrl: 'https://custom.retell.com',
        },
      });
    });

    it('should return error if workspaces.json is missing', async () => {
      const result = await WorkspaceConfigService.load();

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: RetellError }).error;
      expect(error.message).toContain('workspaces.json not found');
    });

    it('should return error if staging workspace is missing from file', async () => {
      const workspacesConfig = {
        production: {
          api_key: 'prod_key_456',
          name: 'Production',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const result = await WorkspaceConfigService.load();

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: RetellError }).error;
      expect(error.message).toContain('staging');
    });

    it('should return error if production workspace is missing from file', async () => {
      const workspacesConfig = {
        staging: {
          api_key: 'staging_key_123',
          name: 'Staging',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const result = await WorkspaceConfigService.load();

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: RetellError }).error;
      expect(error.message).toContain('production');
    });

    it('should return error if staging API key is empty', async () => {
      const workspacesConfig = {
        staging: {
          api_key: '',
          name: 'Staging',
        },
        production: {
          api_key: 'prod_key_456',
          name: 'Production',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );

      const result = await WorkspaceConfigService.load();

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: RetellError }).error;
      expect(error.message).toContain('staging');
    });
  });

  describe('getWorkspace', () => {
    beforeEach(async () => {
      const workspacesConfig = {
        staging: {
          api_key: 'staging_key_123',
          name: 'Staging',
        },
        production: {
          api_key: 'prod_key_456',
          name: 'Production',
        },
      };

      await fs.writeFile(
        path.join(tempDir, 'workspaces.json'),
        JSON.stringify(workspacesConfig, null, 2)
      );
    });

    it('should get staging workspace config', async () => {
      const result = await WorkspaceConfigService.getWorkspace('staging');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.name).toBe('Staging');
        expect(result.value.apiKey).toBe('staging_key_123');
      }
    });

    it('should get production workspace config', async () => {
      const result = await WorkspaceConfigService.getWorkspace('production');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.name).toBe('Production');
        expect(result.value.apiKey).toBe('prod_key_456');
      }
    });

    it('should return error when workspaces.json is missing', async () => {
      await fs.unlink(path.join(tempDir, 'workspaces.json'));

      const result = await WorkspaceConfigService.getWorkspace('staging');

      expect(result.success).toBe(false);
      if (result.success === true) {
        throw new Error('Expected result to be failure');
      }
      expect(result.error.message).toContain('workspaces.json not found');
    });
  });

  describe('generateFromEnv', () => {
    it('should generate workspaces.json from environment variables', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_123';
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_456';

      const result = await WorkspaceConfigService.generateFromEnv();

      expect(result.success).toBe(true);

      const fileExists = await WorkspaceConfigService.exists();
      expect(fileExists).toBe(true);

      const loadResult = await WorkspaceConfigService.load();
      expect(loadResult.success).toBe(true);
      if (loadResult.success && loadResult.value.mode === 'single-production') {
        expect(loadResult.value.staging.apiKey).toBe('staging_key_123');
        expect(loadResult.value.production.apiKey).toBe('prod_key_456');
      }
    });

    it('should use custom base URL from env if provided', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_123';
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_456';
      process.env['RETELL_BASE_URL'] = 'https://custom.retell.com';

      const result = await WorkspaceConfigService.generateFromEnv();

      expect(result.success).toBe(true);

      const loadResult = await WorkspaceConfigService.load();
      expect(loadResult.success).toBe(true);
      if (loadResult.success && loadResult.value.mode === 'single-production') {
        expect(loadResult.value.staging.baseUrl).toBe('https://custom.retell.com');
        expect(loadResult.value.production.baseUrl).toBe('https://custom.retell.com');
      }
    });

    it('should return error if staging API key is missing', async () => {
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_456';
      delete process.env['RETELL_STAGING_API_KEY'];

      const result = await WorkspaceConfigService.generateFromEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('RETELL_STAGING_API_KEY');
      }
    });

    it('should return error if production API key is missing', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_123';
      delete process.env['RETELL_PRODUCTION_API_KEY'];

      const result = await WorkspaceConfigService.generateFromEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('RETELL_PRODUCTION_API_KEY');
      }
    });

    it('should return error if workspaces.json already exists', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_123';
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_456';

      await fs.writeFile(path.join(tempDir, 'workspaces.json'), '{}');

      const result = await WorkspaceConfigService.generateFromEnv();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('already exists');
      }
    });

    it('should allow force overwrite when force=true', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_new';
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_new';

      await fs.writeFile(path.join(tempDir, 'workspaces.json'), '{}');

      const result = await WorkspaceConfigService.generateFromEnv(true);

      expect(result.success).toBe(true);

      const loadResult = await WorkspaceConfigService.load();
      expect(loadResult.success).toBe(true);
      if (loadResult.success) {
        expect(loadResult.value.staging.apiKey).toBe('staging_key_new');
      }
    });
  });

  describe('exists', () => {
    it('should return true when workspaces.json exists', async () => {
      await fs.writeFile(path.join(tempDir, 'workspaces.json'), '{}');

      const exists = await WorkspaceConfigService.exists();
      expect(exists).toBe(true);
    });

    it('should return false when workspaces.json does not exist', async () => {
      const exists = await WorkspaceConfigService.exists();
      expect(exists).toBe(false);
    });
  });
});

describe('WorkspaceController', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;
  let tempDir: string;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-ctrl-test-'));
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.env = originalEnv;
    process.chdir(originalCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('getAllWorkspaces', () => {
    it('should return all workspaces with type info', async () => {
      const workspacesConfig = {
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
      const result = await controller.getAllWorkspaces();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.type).toBe('staging');
        expect(result.value[0]?.apiKey).toBe('staging_key');
        expect(result.value[1]?.type).toBe('production');
        expect(result.value[1]?.apiKey).toBe('prod_key');
      }
    });
  });

  describe('getMode', () => {
    it('should return single-production mode', async () => {
      const workspacesConfig = {
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
  });

  describe('list', () => {
    it('should list workspaces for display', async () => {
      const workspacesConfig = {
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
      const result = await controller.list();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.type).toBe('staging');
        expect(result.value[0]?.hasApiKey).toBe(true);
        expect(result.value[1]?.type).toBe('production');
        expect(result.value[1]?.hasApiKey).toBe(true);
      }
    });
  });
});
