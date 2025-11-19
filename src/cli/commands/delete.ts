/**
 * Delete command - Delete agent from Retell workspaces and local filesystem.
 *
 * This command:
 * 1. Deletes agent from staging workspace (if exists)
 * 2. Deletes agent from production workspace (if exists)
 * 3. Deletes local agent directory and all files
 *
 * Safety features:
 * - Requires confirmation before deletion
 * - Shows what will be deleted
 * - Can skip confirmation with --yes flag
 * - Option to delete from specific workspace only
 * - Option to keep local files with --remote-only
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { WorkspaceType } from '../../types/agent.types';
import { MetadataManager } from '../../core/metadata-manager';
import { RetellClient } from '../../api/retell-client';
import { WorkspaceConfigLoader } from '../../config/workspace-config';
import * as readline from 'readline';

export const deleteCommand = new Command('delete')
  .description('Delete agent from Retell workspaces and local filesystem')
  .argument('<agent-name>', 'Name of the agent to delete')
  .option(
    '-w, --workspace <workspace>',
    'Delete from specific workspace only (staging or production). If not specified, deletes from both.'
  )
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .option('--remote-only', 'Delete only from Retell workspaces, keep local files', false)
  .option('--local-only', 'Delete only local files, keep remote agents', false)
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .action(async (agentName: string, options: DeleteOptions) => {
    try {
      await executeDelete(agentName, options);
    } catch (error) {
      console.error('Delete failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

type DeleteOptions = {
  workspace?: WorkspaceType;
  yes: boolean;
  remoteOnly: boolean;
  localOnly: boolean;
  path: string;
};

async function executeDelete(agentName: string, options: DeleteOptions): Promise<void> {
  console.log(`\nDeleting agent '${agentName}'...\n`);

  // Validate conflicting options
  if (options.remoteOnly && options.localOnly) {
    throw new Error('Cannot specify both --remote-only and --local-only');
  }

  const agentPath = path.resolve(options.path, agentName);

  // Check if agent directory exists
  const agentExists = await checkAgentExists(agentPath);
  if (!agentExists && !options.remoteOnly) {
    throw new Error(
      `Agent directory not found: ${agentPath}\n` +
        'Use --remote-only if you only want to delete from Retell workspaces.'
    );
  }

  // Determine which workspaces to delete from
  const workspacesToDelete: WorkspaceType[] = [];
  if (options.workspace) {
    workspacesToDelete.push(options.workspace);
  } else if (!options.localOnly) {
    // Delete from both workspaces by default (unless --local-only)
    workspacesToDelete.push('staging', 'production');
  }

  // Load metadata for each workspace
  const workspaceData: Array<{
    workspace: WorkspaceType;
    agentId: string | null;
    llmId: string | null;
    kbId: string | null;
  }> = [];

  for (const workspace of workspacesToDelete) {
    const metadataResult = await MetadataManager.read(agentPath, workspace);
    if (metadataResult.success) {
      const metadata = metadataResult.value;
      workspaceData.push({
        workspace,
        agentId: metadata.agent_id,
        llmId: metadata.llm_id,
        kbId: metadata.kb_id,
      });
    } else {
      workspaceData.push({
        workspace,
        agentId: null,
        llmId: null,
        kbId: null,
      });
    }
  }

  // Show what will be deleted
  console.log('📋 Deletion Plan:\n');

  if (!options.localOnly) {
    for (const data of workspaceData) {
      console.log(`${data.workspace.toUpperCase()} Workspace:`);
      if (data.agentId !== null && data.agentId !== undefined && data.agentId !== '') {
        console.log(`  ✓ Agent: ${data.agentId}`);
        if (data.llmId !== null && data.llmId !== undefined && data.llmId !== '') {
          console.log(`  ⚠ LLM: ${data.llmId} (will NOT be deleted - may be shared)`);
        }
        if (data.kbId !== null && data.kbId !== undefined && data.kbId !== '') {
          console.log(`  ⚠ Knowledge Base: ${data.kbId} (will NOT be deleted - may be shared)`);
        }
      } else {
        console.log(`  ⊘ No agent found in ${data.workspace}`);
      }
      console.log();
    }
  }

  if (!options.remoteOnly && agentExists) {
    console.log('LOCAL Filesystem:');
    console.log(`  ✓ Directory: ${agentPath}`);
    console.log(`  ✓ All files in directory will be permanently deleted`);
    console.log();
  }

  // Count what will actually be deleted
  const remoteAgentsToDelete = workspaceData.filter((d) => d.agentId !== null);
  const willDeleteLocal = !options.remoteOnly && agentExists;

  if (remoteAgentsToDelete.length === 0 && !willDeleteLocal) {
    console.log('⚠ Nothing to delete. Agent not found in any workspace or locally.');
    return;
  }

  // Confirmation prompt
  if (!options.yes) {
    const confirmed = await confirmDeletion(
      agentName,
      remoteAgentsToDelete.length,
      willDeleteLocal
    );
    if (confirmed !== true) {
      console.log('\n❌ Deletion cancelled.');
      return;
    }
  }

  console.log();

  // Delete from remote workspaces
  if (!options.localOnly) {
    for (const data of workspaceData) {
      if (data.agentId !== null && data.agentId !== undefined && data.agentId !== '') {
        await deleteFromWorkspace(data.workspace, data.agentId);
      }
    }
  }

  // Delete local directory
  if (!options.remoteOnly && agentExists) {
    await deleteLocalAgent(agentPath, agentName);
  }

  console.log('\n✅ Deletion complete!\n');

  // Show summary
  if (remoteAgentsToDelete.length > 0 && !options.localOnly) {
    console.log(`Deleted from ${remoteAgentsToDelete.length} workspace(s)`);
  }
  if (willDeleteLocal) {
    console.log('Deleted local agent directory');
  }
}

/**
 * Check if agent directory exists
 */
async function checkAgentExists(agentPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(agentPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Prompt user for confirmation
 */
async function confirmDeletion(
  agentName: string,
  remoteCount: number,
  willDeleteLocal: boolean
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    let message = `\n⚠️  This will permanently delete agent '${agentName}'`;
    if (remoteCount > 0) {
      message += ` from ${remoteCount} workspace(s)`;
    }
    if (willDeleteLocal) {
      message += remoteCount > 0 ? ' and local files' : ' local files';
    }
    message += '.\nThis action CANNOT be undone.\n\nContinue? (yes/no): ';

    rl.question(message, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'yes' || normalized === 'y');
    });
  });
}

/**
 * Delete agent from a specific workspace
 */
async function deleteFromWorkspace(workspace: WorkspaceType, agentId: string): Promise<void> {
  console.log(`Deleting from ${workspace}...`);

  try {
    // Load workspace config
    const workspaceConfigResult = await WorkspaceConfigLoader.getWorkspace(workspace);
    if (!workspaceConfigResult.success) {
      console.error(
        `  ✗ Failed to load ${workspace} config: ${workspaceConfigResult.error.message}`
      );
      return;
    }

    const workspaceConfig = workspaceConfigResult.value;
    const client = new RetellClient(workspaceConfig);

    // Delete agent from Retell
    const deleteResult = await client.deleteAgent(agentId as never);
    if (!deleteResult.success) {
      console.error(`  ✗ Failed to delete agent: ${deleteResult.error.message}`);
      return;
    }

    console.log(`  ✓ Deleted agent ${agentId} from ${workspace}`);
  } catch (error) {
    console.error(
      `  ✗ Error deleting from ${workspace}:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Delete local agent directory
 */
async function deleteLocalAgent(agentPath: string, agentName: string): Promise<void> {
  console.log(`Deleting local directory...`);

  try {
    await fs.rm(agentPath, { recursive: true, force: true });
    console.log(`  ✓ Deleted directory: ${agentPath}`);
  } catch (error) {
    console.error(
      `  ✗ Failed to delete local directory:`,
      error instanceof Error ? error.message : error
    );
    throw new Error(`Failed to delete local agent directory for ${agentName}`);
  }
}
