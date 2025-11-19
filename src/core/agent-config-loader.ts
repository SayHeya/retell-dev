import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentConfig } from '../types/agent.types';
import type { Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';
import { AgentConfigSchema } from '../schemas/agent.schema';
import { ZodError } from 'zod';

/**
 * Loader for reading and writing agent.json configuration files.
 * Handles file I/O, validation, and parsing.
 */
export class AgentConfigLoader {
  private static readonly AGENT_CONFIG_FILENAME = 'agent.json';

  /**
   * Load agent configuration from agent.json file.
   *
   * @param agentDir - Path to agent directory
   * @returns Result containing agent config or error
   */
  static async load(agentDir: string): Promise<Result<AgentConfig, Error>> {
    try {
      const filePath = this.getFilePath(agentDir);

      // Check if file exists
      const fileExists = await this.fileExists(filePath);

      if (!fileExists) {
        return Err(new Error(`agent.json not found in ${agentDir}`));
      }

      // Read and parse file
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed: unknown = JSON.parse(content);

      // Validate with schema
      const validated = AgentConfigSchema.parse(parsed);

      return Ok(validated as AgentConfig);
    } catch (error) {
      if (error instanceof ZodError) {
        return Err(
          new Error(
            `Agent config validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          )
        );
      }
      if (error instanceof SyntaxError) {
        return Err(new Error(`Invalid JSON in agent.json: ${error.message}`));
      }
      return Err(error instanceof Error ? error : new Error('Failed to load agent config'));
    }
  }

  /**
   * Save agent configuration to agent.json file.
   * Creates agent directory if it doesn't exist.
   * Validates config before writing.
   *
   * @param agentDir - Path to agent directory
   * @param config - Agent configuration to save
   * @returns Result indicating success or error
   */
  static async save(agentDir: string, config: unknown): Promise<Result<void, Error>> {
    try {
      // Validate config first
      const validated = AgentConfigSchema.parse(config);

      // Ensure agent directory exists
      await fs.mkdir(agentDir, { recursive: true });

      const filePath = this.getFilePath(agentDir);

      // Write file with pretty formatting
      const content = JSON.stringify(validated, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');

      return Ok(undefined);
    } catch (error) {
      if (error instanceof ZodError) {
        return Err(
          new Error(
            `Agent config validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          )
        );
      }
      return Err(error instanceof Error ? error : new Error('Failed to save agent config'));
    }
  }

  /**
   * Check if agent.json exists in the specified directory.
   *
   * @param agentDir - Path to agent directory
   * @returns true if agent.json exists, false otherwise
   */
  static async exists(agentDir: string): Promise<boolean> {
    const filePath = this.getFilePath(agentDir);
    return await this.fileExists(filePath);
  }

  /**
   * Get full path to agent.json file.
   *
   * @param agentDir - Path to agent directory
   * @returns Full path to agent.json
   */
  private static getFilePath(agentDir: string): string {
    return path.join(agentDir, this.AGENT_CONFIG_FILENAME);
  }

  /**
   * Check if a file exists.
   *
   * @param filePath - Path to file
   * @returns true if file exists, false otherwise
   */
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
