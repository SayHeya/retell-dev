import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { WorkspaceConfigLoader } from '@config/workspace-config';

describe('WorkspaceConfigLoader', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('load', () => {
    it('should load workspace configs from environment variables', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_123';
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_456';

      const result = await WorkspaceConfigLoader.load();

      expect(result.success).toBe(true);
      const config = (result as { success: true; value: unknown }).value;
      expect(config).toMatchObject({
        staging: {
          name: 'staging',
          apiKey: 'staging_key_123',
          baseUrl: 'https://api.retellai.com',
        },
        production: {
          name: 'production',
          apiKey: 'prod_key_456',
          baseUrl: 'https://api.retellai.com',
        },
      });
    });

    it('should use custom base URL if provided', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_123';
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_456';
      process.env['RETELL_BASE_URL'] = 'https://custom.retell.com';

      const result = await WorkspaceConfigLoader.load();

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

    it('should return error if staging API key is missing', async () => {
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_456';
      delete process.env['RETELL_STAGING_API_KEY'];

      const result = await WorkspaceConfigLoader.load();

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: Error }).error;
      expect(error.message).toContain('RETELL_STAGING_API_KEY');
    });

    it('should return error if production API key is missing', async () => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_123';
      delete process.env['RETELL_PRODUCTION_API_KEY'];

      const result = await WorkspaceConfigLoader.load();

      expect(result.success).toBe(false);
      const error = (result as { success: false; error: Error }).error;
      expect(error.message).toContain('RETELL_PRODUCTION_API_KEY');
    });
  });

  describe('getWorkspace', () => {
    beforeEach(() => {
      process.env['RETELL_STAGING_API_KEY'] = 'staging_key_123';
      process.env['RETELL_PRODUCTION_API_KEY'] = 'prod_key_456';
    });

    it('should get staging workspace config', async () => {
      const result = await WorkspaceConfigLoader.getWorkspace('staging');

      expect(result.success).toBe(true);
      const config = (result as { success: true; value: unknown }).value;
      expect(config).toMatchObject({
        name: 'staging',
        apiKey: 'staging_key_123',
      });
    });

    it('should get production workspace config', async () => {
      const result = await WorkspaceConfigLoader.getWorkspace('production');

      expect(result.success).toBe(true);
      const config = (result as { success: true; value: unknown }).value;
      expect(config).toMatchObject({
        name: 'production',
        apiKey: 'prod_key_456',
      });
    });

    it('should return error when env vars are missing', async () => {
      delete process.env['RETELL_STAGING_API_KEY'];
      delete process.env['RETELL_PRODUCTION_API_KEY'];

      const result = await WorkspaceConfigLoader.getWorkspace('staging');

      expect(result.success).toBe(false);

      // Assert result is failure before accessing error
      if (result.success === true) {
        throw new Error('Expected result to be failure');
      }

      expect(result.error.message).toContain('RETELL_STAGING_API_KEY');
    });
  });
});
