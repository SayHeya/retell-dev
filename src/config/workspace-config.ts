import type { WorkspaceType } from '../types/agent.types';
import type { Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Workspace configuration with API credentials
 */
export type WorkspaceConfig = {
  readonly name: WorkspaceType;
  readonly apiKey: string;
  readonly baseUrl: string;
};

/**
 * All workspace configurations
 */
export type WorkspacesConfig = {
  readonly staging: WorkspaceConfig;
  readonly production: WorkspaceConfig;
};

/**
 * Raw workspace config from JSON file
 */
type WorkspaceConfigJson = {
  api_key: string;
  name?: string;
  base_url?: string;
  workspace_id?: string;
};

/**
 * Configuration loader for workspace settings.
 * Reads from workspaces.json file (required) or falls back to environment variables.
 */
export class WorkspaceConfigLoader {
  private static readonly DEFAULT_BASE_URL = 'https://api.retellai.com';
  private static readonly WORKSPACES_FILE = 'workspaces.json';

  /**
   * Load workspace configurations from workspaces.json file.
   * REQUIRED - does not fall back to environment variables.
   *
   * @returns Result containing workspace configs or error
   */
  static async load(): Promise<Result<WorkspacesConfig, Error>> {
    // workspaces.json is REQUIRED
    return await this.loadFromFile();
  }

  /**
   * Load workspace configurations from workspaces.json file.
   *
   * @returns Result containing workspace configs or error
   */
  private static async loadFromFile(): Promise<Result<WorkspacesConfig, Error>> {
    try {
      const workspacesPath = path.resolve(process.cwd(), this.WORKSPACES_FILE);

      // Check if file exists
      try {
        await fs.access(workspacesPath);
      } catch {
        return Err(
          new Error(
            `${this.WORKSPACES_FILE} not found. Please run 'retell workspace init' to create it from your environment variables.`
          )
        );
      }

      // Read and parse file
      const fileContent = await fs.readFile(workspacesPath, 'utf-8');
      let rawConfig: Record<string, WorkspaceConfigJson>;

      try {
        rawConfig = JSON.parse(fileContent);
      } catch (parseError) {
        return Err(
          new Error(
            `Invalid JSON in ${this.WORKSPACES_FILE}: ${parseError instanceof Error ? parseError.message : 'Parse error'}`
          )
        );
      }

      // Validate staging workspace
      if (!rawConfig['staging']) {
        return Err(
          new Error(
            `Missing 'staging' workspace in ${this.WORKSPACES_FILE}. Please regenerate it with 'retell workspace init --force'.`
          )
        );
      }

      // Validate production workspace
      if (!rawConfig['production']) {
        return Err(
          new Error(
            `Missing 'production' workspace in ${this.WORKSPACES_FILE}. Please regenerate it with 'retell workspace init --force'.`
          )
        );
      }

      // Validate API keys
      if (!rawConfig['staging'].api_key || rawConfig['staging'].api_key.trim() === '') {
        return Err(
          new Error(
            `Invalid or missing API key for 'staging' workspace in ${this.WORKSPACES_FILE}.`
          )
        );
      }

      if (!rawConfig['production'].api_key || rawConfig['production'].api_key.trim() === '') {
        return Err(
          new Error(
            `Invalid or missing API key for 'production' workspace in ${this.WORKSPACES_FILE}.`
          )
        );
      }

      const config: WorkspacesConfig = {
        staging: {
          name: 'staging',
          apiKey: rawConfig['staging'].api_key,
          baseUrl: rawConfig['staging'].base_url ?? this.DEFAULT_BASE_URL,
        },
        production: {
          name: 'production',
          apiKey: rawConfig['production'].api_key,
          baseUrl: rawConfig['production'].base_url ?? this.DEFAULT_BASE_URL,
        },
      };

      return Ok(config);
    } catch (error) {
      return Err(
        error instanceof Error
          ? error
          : new Error('Failed to load workspace configuration from file')
      );
    }
  }

  /**
   * Get configuration for a specific workspace.
   *
   * @param workspace - Workspace type (staging or production)
   * @returns Result containing workspace config or error
   */
  static async getWorkspace(workspace: WorkspaceType): Promise<Result<WorkspaceConfig, Error>> {
    const configResult = await this.load();
    if (!configResult.success) {
      return configResult;
    }

    return Ok(configResult.value[workspace]);
  }

  /**
   * Check if workspaces.json file exists.
   *
   * @returns Promise<boolean> true if file exists
   */
  static async exists(): Promise<boolean> {
    try {
      const workspacesPath = path.resolve(process.cwd(), this.WORKSPACES_FILE);
      await fs.access(workspacesPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate workspaces.json file from environment variables.
   * Useful for initial setup or migration from env-based config.
   *
   * Expected environment variables:
   * - RETELL_STAGING_API_KEY (required)
   * - RETELL_PRODUCTION_API_KEY (required)
   * - RETELL_BASE_URL (optional, defaults to https://api.retellai.com)
   *
   * @returns Result indicating success or error
   */
  static async generateFromEnv(): Promise<Result<void, Error>> {
    try {
      const stagingApiKey = process.env['RETELL_STAGING_API_KEY'];
      const productionApiKey = process.env['RETELL_PRODUCTION_API_KEY'];
      const baseUrl = process.env['RETELL_BASE_URL'] ?? this.DEFAULT_BASE_URL;

      if (!stagingApiKey) {
        return Err(
          new Error(
            'RETELL_STAGING_API_KEY environment variable is not set. Please add it to your .env file.'
          )
        );
      }

      if (!productionApiKey) {
        return Err(
          new Error(
            'RETELL_PRODUCTION_API_KEY environment variable is not set. Please add it to your .env file.'
          )
        );
      }

      // Check if file already exists
      if (await this.exists()) {
        return Err(
          new Error(
            `${this.WORKSPACES_FILE} already exists. Remove it first if you want to regenerate it.`
          )
        );
      }

      const workspacesConfig = {
        staging: {
          api_key: stagingApiKey,
          name: 'Development Workspace',
          base_url: baseUrl,
        },
        production: {
          api_key: productionApiKey,
          name: 'Production Workspace',
          base_url: baseUrl,
        },
      };

      const workspacesPath = path.resolve(process.cwd(), this.WORKSPACES_FILE);
      await fs.writeFile(workspacesPath, JSON.stringify(workspacesConfig, null, 2) + '\n', 'utf-8');

      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error
          ? error
          : new Error('Failed to generate workspaces.json from environment variables')
      );
    }
  }
}
