/**
 * Status command - Show sync status between local and Retell workspaces.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentConfigLoader } from '../../core/agent-config-loader';
import { MetadataManager } from '../../core/metadata-manager';
import { HashCalculator } from '../../core/hash-calculator';

export const statusCommand = new Command('status')
  .description('Show sync status of agents across workspaces')
  .argument('[agent-name]', 'Name of specific agent (optional, shows all if omitted)')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .action(async (agentName: string | undefined, options: StatusOptions) => {
    try {
      await executeStatus(agentName, options);
    } catch (error) {
      console.error('Status check failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

type StatusOptions = {
  path: string;
};

type AgentStatus = {
  name: string;
  localHash: string | null;
  staging: WorkspaceStatus;
  production: WorkspaceStatus;
};

type WorkspaceStatus = {
  agentId: string | null;
  hash: string | null;
  lastSynced: number | null; // Store as number for display
  inSync: boolean;
};

async function executeStatus(agentName: string | undefined, options: StatusOptions): Promise<void> {
  const agentsDir = path.resolve(options.path);

  // Find agents to check
  const agentNames = agentName !== undefined ? [agentName] : await findAllAgents(agentsDir);

  if (agentNames.length === 0) {
    console.log('No agents found.');
    return;
  }

  // Collect status for each agent
  const statuses: AgentStatus[] = [];
  for (const name of agentNames) {
    const agentPath = path.join(agentsDir, name);
    const status = await getAgentStatus(agentPath, name);
    statuses.push(status);
  }

  // Display results
  displayStatus(statuses);
}

async function findAllAgents(agentsDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    const agentDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    // Filter to only directories with agent.json
    const validAgents: string[] = [];
    for (const dir of agentDirs) {
      const agentJsonPath = path.join(agentsDir, dir, 'agent.json');
      try {
        await fs.access(agentJsonPath);
        validAgents.push(dir);
      } catch {
        // Skip directories without agent.json
      }
    }

    return validAgents;
  } catch {
    return [];
  }
}

async function getAgentStatus(agentPath: string, name: string): Promise<AgentStatus> {
  // Load local config and calculate hash
  const configResult = await AgentConfigLoader.load(agentPath);
  let localHash: string | null = null;
  if (configResult.success) {
    const hashResult = HashCalculator.calculateAgentHash(configResult.value);
    localHash = hashResult.success ? hashResult.value : null;
  }

  // Read staging metadata
  const stagingMetadata = await MetadataManager.read(agentPath, 'staging');
  const stagingHash = stagingMetadata.success ? stagingMetadata.value.config_hash : null;
  const stagingInSync =
    localHash !== null && stagingHash !== null
      ? HashCalculator.compareHashes(localHash as never, stagingHash as never)
      : false;

  const staging: WorkspaceStatus = {
    agentId: stagingMetadata.success ? stagingMetadata.value.agent_id : null,
    hash: stagingHash,
    lastSynced:
      stagingMetadata.success && stagingMetadata.value.last_sync !== null
        ? new Date(stagingMetadata.value.last_sync).getTime()
        : null,
    inSync: stagingInSync,
  };

  // Read production metadata
  const productionMetadata = await MetadataManager.read(agentPath, 'production');
  const productionHash = productionMetadata.success ? productionMetadata.value.config_hash : null;
  const productionInSync =
    localHash !== null && productionHash !== null
      ? HashCalculator.compareHashes(localHash as never, productionHash as never)
      : false;

  const production: WorkspaceStatus = {
    agentId: productionMetadata.success ? productionMetadata.value.agent_id : null,
    hash: productionHash,
    lastSynced:
      productionMetadata.success && productionMetadata.value.last_sync !== null
        ? new Date(productionMetadata.value.last_sync).getTime()
        : null,
    inSync: productionInSync,
  };

  return {
    name,
    localHash,
    staging,
    production,
  };
}

function displayStatus(statuses: AgentStatus[]): void {
  console.log('\nAgent Sync Status:\n');

  for (const status of statuses) {
    console.log(`Agent: ${status.name}`);
    console.log(
      `  Local: ${status.localHash ? status.localHash.substring(0, 12) + '...' : 'ERROR'}`
    );

    console.log(`  Staging:`);
    if (status.staging.agentId !== null) {
      console.log(`    ID: ${status.staging.agentId}`);
      const stagingHashDisplay =
        status.staging.hash !== null ? status.staging.hash.substring(0, 12) + '...' : 'unknown';
      console.log(`    Hash: ${stagingHashDisplay}`);
      console.log(`    Last Synced: ${formatTimestamp(status.staging.lastSynced)}`);
      console.log(`    Status: ${status.staging.inSync ? '✓ IN SYNC' : '✗ OUT OF SYNC'}`);
    } else {
      console.log(`    Status: NOT SYNCED`);
    }

    console.log(`  Production:`);
    if (status.production.agentId !== null) {
      console.log(`    ID: ${status.production.agentId}`);
      const prodHashDisplay =
        status.production.hash !== null
          ? status.production.hash.substring(0, 12) + '...'
          : 'unknown';
      console.log(`    Hash: ${prodHashDisplay}`);
      console.log(`    Last Synced: ${formatTimestamp(status.production.lastSynced)}`);
      console.log(`    Status: ${status.production.inSync ? '✓ IN SYNC' : '✗ OUT OF SYNC'}`);
    } else {
      console.log(`    Status: NOT SYNCED`);
    }

    console.log('');
  }
}

function formatTimestamp(timestamp: number | null): string {
  if (timestamp === null) {
    return 'never';
  }
  const date = new Date(timestamp);
  return date.toISOString();
}
