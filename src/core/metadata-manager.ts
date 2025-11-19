import * as fs from 'fs/promises';
import * as path from 'path';
import type { MetadataFile, WorkspaceType } from '../types/agent.types';
import type { Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';
import { MetadataSchema } from '../schemas/metadata.schema';
import { ZodError } from 'zod';

/**
 * Manager for reading and writing workspace metadata files (staging.json, production.json).
 * Handles file I/O, validation, and partial updates.
 */
export class MetadataManager {
  /**
   * Read metadata file for a specific workspace.
   * Returns empty metadata (all nulls) if file doesn't exist.
   *
   * @param agentDir - Path to agent directory
   * @param workspace - Workspace type (staging or production)
   * @returns Result containing metadata or error
   */
  static async read(
    agentDir: string,
    workspace: WorkspaceType
  ): Promise<Result<MetadataFile, Error>> {
    try {
      const filePath = this.getFilePath(agentDir, workspace);

      // Check if file exists
      const fileExists = await this.fileExists(filePath);

      if (!fileExists) {
        // Return empty metadata if file doesn't exist
        return Ok(this.createEmptyMetadata(workspace));
      }

      // Read and parse file
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed: unknown = JSON.parse(content);

      // Validate with schema
      const validated = MetadataSchema.parse(parsed);

      return Ok(validated as MetadataFile);
    } catch (error) {
      if (error instanceof ZodError) {
        return Err(
          new Error(`Invalid metadata schema: ${error.errors.map((e) => e.message).join(', ')}`)
        );
      }
      if (error instanceof SyntaxError) {
        return Err(new Error(`Invalid JSON in metadata file: ${error.message}`));
      }
      return Err(error instanceof Error ? error : new Error('Failed to read metadata'));
    }
  }

  /**
   * Write metadata file for a workspace.
   * Creates agent directory if it doesn't exist.
   *
   * @param agentDir - Path to agent directory
   * @param metadata - Metadata to write
   * @returns Result indicating success or error
   */
  static async write(agentDir: string, metadata: MetadataFile): Promise<Result<void, Error>> {
    try {
      // Ensure agent directory exists
      await fs.mkdir(agentDir, { recursive: true });

      const filePath = this.getFilePath(agentDir, metadata.workspace);

      // Write file with pretty formatting
      const content = JSON.stringify(metadata, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');

      return Ok(undefined);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to write metadata'));
    }
  }

  /**
   * Update specific fields in metadata file.
   * Reads existing metadata, merges updates, and writes back.
   * Creates new metadata if file doesn't exist.
   *
   * @param agentDir - Path to agent directory
   * @param workspace - Workspace type
   * @param updates - Partial metadata fields to update
   * @returns Result indicating success or error
   */
  static async update(
    agentDir: string,
    workspace: WorkspaceType,
    updates: Partial<Omit<MetadataFile, 'workspace'>>
  ): Promise<Result<void, Error>> {
    try {
      // Read existing metadata (or get empty metadata)
      const readResult = await this.read(agentDir, workspace);

      if (!readResult.success) {
        return readResult;
      }

      const existing = readResult.value;

      // Merge updates
      const updated: MetadataFile = {
        ...existing,
        ...updates,
        workspace, // Ensure workspace is not changed
      };

      // Write merged metadata
      return await this.write(agentDir, updated);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to update metadata'));
    }
  }

  /**
   * Check if metadata file exists for a workspace.
   *
   * @param agentDir - Path to agent directory
   * @param workspace - Workspace type
   * @returns true if file exists, false otherwise
   */
  static async exists(agentDir: string, workspace: WorkspaceType): Promise<boolean> {
    const filePath = this.getFilePath(agentDir, workspace);
    return await this.fileExists(filePath);
  }

  /**
   * Get file path for workspace metadata.
   *
   * @param agentDir - Path to agent directory
   * @param workspace - Workspace type
   * @returns Full path to metadata file
   */
  private static getFilePath(agentDir: string, workspace: WorkspaceType): string {
    return path.join(agentDir, `${workspace}.json`);
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

  /**
   * Create empty metadata with all fields set to null.
   *
   * @param workspace - Workspace type
   * @returns Empty metadata object
   */
  private static createEmptyMetadata(workspace: WorkspaceType): MetadataFile {
    return {
      workspace,
      agent_id: null,
      llm_id: null,
      kb_id: null,
      last_sync: null,
      config_hash: null,
      retell_version: null,
    };
  }
}
