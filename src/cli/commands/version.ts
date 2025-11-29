/**
 * Version command group - Manage Retell agent versions.
 * Provides commands for viewing version history, publishing, and rollback.
 */

import { Command } from 'commander';
import { VersionController } from '@heya/retell.controllers';
import type { WorkspaceType } from '@heya/retell.controllers';
import { handleError } from '../errors/cli-error-handler';

// ============================================================================
// Version History Command
// ============================================================================

type HistoryOptions = {
  workspace: WorkspaceType;
  path: string;
};

const historyCommand = new Command('history')
  .description('Show version history for an agent')
  .argument('<agent-name>', 'Name of the agent')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .action(async (agentName: string, options: HistoryOptions) => {
    try {
      await executeHistory(agentName, options);
    } catch (error) {
      handleError(error);
    }
  });

async function executeHistory(agentName: string, options: HistoryOptions): Promise<void> {
  console.log(`\nFetching version history for '${agentName}' in ${options.workspace}...\n`);

  const controller = new VersionController();
  const result = await controller.getVersionHistory(agentName, {
    workspace: options.workspace,
    agentsPath: options.path,
  });

  if (!result.success) {
    throw result.error;
  }

  const { agentId, currentVersion, publishedVersion, draftVersion, versions, totalVersions } =
    result.value;

  console.log(`Agent: ${agentName}`);
  console.log(`Agent ID: ${agentId}`);
  console.log(`Total versions: ${totalVersions}`);
  console.log(`Current version: ${currentVersion}`);
  console.log(`Published version: ${publishedVersion ?? 'none'}`);
  console.log(`Draft version: ${draftVersion ?? 'none'}`);
  console.log('\nVersion History:');
  console.log('─'.repeat(60));

  // Sort versions by version number descending
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  for (const version of sortedVersions) {
    const status = version.isPublished ? '[published]' : '[draft]';
    const date = version.lastModified.toISOString().split('T')[0];
    console.log(`  v${version.version} ${status.padEnd(12)} ${date}  ${version.agentName ?? ''}`);
  }
}

// ============================================================================
// Version Publish Command
// ============================================================================

type PublishOptions = {
  workspace: WorkspaceType;
  path: string;
};

const publishCommand = new Command('publish')
  .description('Publish current agent version (creates immutable snapshot)')
  .argument('<agent-name>', 'Name of the agent')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .action(async (agentName: string, options: PublishOptions) => {
    try {
      await executePublish(agentName, options);
    } catch (error) {
      handleError(error);
    }
  });

async function executePublish(agentName: string, options: PublishOptions): Promise<void> {
  console.log(`\nPublishing agent '${agentName}' in ${options.workspace}...\n`);

  const controller = new VersionController();
  const result = await controller.publish(agentName, {
    workspace: options.workspace,
    agentsPath: options.path,
  });

  if (!result.success) {
    throw result.error;
  }

  const { agentId, publishedVersion, newDraftVersion, timestamp } = result.value;

  console.log(`✓ Published successfully!`);
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  Published version: ${publishedVersion}`);
  console.log(`  New draft version: ${newDraftVersion}`);
  console.log(`  Timestamp: ${timestamp.toISOString()}`);
}

// ============================================================================
// Version Rollback Command
// ============================================================================

type RollbackOptions = {
  workspace: WorkspaceType;
  path: string;
  dryRun: boolean;
  publish: boolean;
};

const rollbackCommand = new Command('rollback')
  .description('Rollback agent to a previous version')
  .argument('<agent-name>', 'Name of the agent')
  .argument('<version>', 'Target version number to rollback to')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .option('--dry-run', 'Preview rollback without making changes', false)
  .option('--publish', 'Publish immediately after rollback', false)
  .action(async (agentName: string, version: string, options: RollbackOptions) => {
    try {
      await executeRollback(agentName, parseInt(version, 10), options);
    } catch (error) {
      handleError(error);
    }
  });

async function executeRollback(
  agentName: string,
  targetVersion: number,
  options: RollbackOptions
): Promise<void> {
  const action = options.dryRun ? 'Previewing rollback' : 'Rolling back';
  console.log(`\n${action} '${agentName}' to version ${targetVersion} in ${options.workspace}...\n`);

  const controller = new VersionController();
  const result = await controller.rollback(agentName, {
    workspace: options.workspace,
    agentsPath: options.path,
    targetVersion,
    dryRun: options.dryRun,
    publish: options.publish,
  });

  if (!result.success) {
    throw result.error;
  }

  const { agentId, llmId, previousVersion, restoredToVersion, newVersion, dryRun, responseEngineSkipped } = result.value;

  if (dryRun) {
    console.log(`Dry run - no changes made.`);
    console.log(`\nWould rollback:`);
    console.log(`  Agent ID: ${agentId}`);
    if (llmId) console.log(`  LLM ID: ${llmId}`);
    console.log(`  From version: ${previousVersion}`);
    console.log(`  To version: ${restoredToVersion}`);
    if (options.publish) {
      console.log(`  Would publish after rollback`);
    }
  } else {
    console.log(`✓ Rollback completed successfully!`);
    console.log(`  Agent ID: ${agentId}`);
    if (llmId) console.log(`  LLM ID: ${llmId}`);
    console.log(`  Previous version: ${previousVersion}`);
    console.log(`  Restored to version: ${restoredToVersion}`);
    if (newVersion !== null) {
      console.log(`  New published version: ${newVersion}`);
    }
    if (responseEngineSkipped) {
      console.log(`\n⚠ Note: response_engine was not restored (Retell API does not allow`);
      console.log(`  updating response_engine on published agents). The LLM configuration`);
      console.log(`  was still restored if present.`);
    }
  }
}

// ============================================================================
// Version Drift Command
// ============================================================================

type DriftOptions = {
  workspace: WorkspaceType;
  path: string;
};

const driftCommand = new Command('drift')
  .description('Check for version drift between local and remote')
  .argument('<agent-name>', 'Name of the agent')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .action(async (agentName: string, options: DriftOptions) => {
    try {
      await executeDrift(agentName, options);
    } catch (error) {
      handleError(error);
    }
  });

async function executeDrift(agentName: string, options: DriftOptions): Promise<void> {
  console.log(`\nChecking version drift for '${agentName}' in ${options.workspace}...\n`);

  const controller = new VersionController();
  const result = await controller.detectVersionDrift(agentName, {
    workspace: options.workspace,
    agentsPath: options.path,
  });

  if (!result.success) {
    throw result.error;
  }

  const { hasDrift, storedVersion, remoteVersion, versionsBehind, message } = result.value;

  if (hasDrift) {
    console.log(`⚠ Version drift detected!`);
    console.log(`  ${message}`);
    console.log(`\n  Local version: ${storedVersion ?? 'not tracked'}`);
    console.log(`  Remote version: ${remoteVersion}`);
    console.log(`  Versions behind: ${versionsBehind}`);
    console.log(`\n  Run 'retell version history ${agentName}' to see version details.`);
  } else {
    console.log(`✓ No version drift detected.`);
    console.log(`  ${message}`);
  }
}

// ============================================================================
// Export Version Command Group
// ============================================================================

export const versionCommand = new Command('version')
  .description('Manage agent version control')
  .addCommand(historyCommand)
  .addCommand(publishCommand)
  .addCommand(rollbackCommand)
  .addCommand(driftCommand);
