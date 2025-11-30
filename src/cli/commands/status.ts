/**
 * Status command - Show sync status between local and Retell workspaces.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentConfigLoader, MetadataManager, HashCalculator, WorkspaceConfigService } from '@heya/retell.controllers';
import { handleError } from '../errors/cli-error-handler';

export const statusCommand = new Command('status')
  .description('Show sync status of agents across workspaces')
  .argument('[agent-name]', 'Name of specific agent (optional, shows all if omitted)')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .action(async (agentName: string | undefined, options: StatusOptions) => {
    try {
      await executeStatus(agentName, options);
    } catch (error) {
      handleError(error);
    }
  });

type StatusOptions = {
  path: string;
};

type AgentStatus = {
  name: string;
  localHash: string | null;
  staging: WorkspaceStatus;
  production: ProductionStatus[];
  isMultiProduction: boolean;
};

type WorkspaceStatus = {
  workspaceKey: string;
  agentId: string | null;
  hash: string | null;
  lastSynced: number | null; // Store as number for display
  inSync: boolean;
};

type ProductionStatus = WorkspaceStatus;

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
  // Get orchestration mode
  const modeResult = await WorkspaceConfigService.getMode();
  const mode = modeResult.success ? modeResult.value : 'single-production';
  const isMultiProduction = mode === 'multi-production';

  // Load local config and calculate hash
  const configResult = await AgentConfigLoader.load(agentPath);
  let localHash: string | null = null;
  if (configResult.success) {
    const hashResult = HashCalculator.calculateAgentHash(configResult.value);
    localHash = hashResult.success ? hashResult.value : null;
  }

  // Read staging metadata
  const stagingMetadata = await MetadataManager.read(agentPath, 'staging', mode);
  const stagingHash = stagingMetadata.success ? stagingMetadata.value.config_hash : null;
  const stagingInSync =
    localHash !== null && stagingHash !== null
      ? HashCalculator.compareHashes(localHash as never, stagingHash as never)
      : false;

  const staging: WorkspaceStatus = {
    workspaceKey: 'staging',
    agentId: stagingMetadata.success ? stagingMetadata.value.agent_id : null,
    hash: stagingHash,
    lastSynced:
      stagingMetadata.success && stagingMetadata.value.last_sync !== null
        ? new Date(stagingMetadata.value.last_sync).getTime()
        : null,
    inSync: stagingInSync,
  };

  // Read production metadata
  const production: ProductionStatus[] = [];

  if (isMultiProduction) {
    // Multi-production: read all entries from production.json
    const allProdResult = await MetadataManager.readAllProduction(agentPath);
    if (allProdResult.success && allProdResult.value.length > 0) {
      for (const entry of allProdResult.value) {
        const prodHash = entry.config_hash;
        const prodInSync =
          localHash !== null && prodHash !== null
            ? HashCalculator.compareHashes(localHash as never, prodHash as never)
            : false;

        production.push({
          workspaceKey: entry.workspace,
          agentId: entry.agent_id,
          hash: prodHash,
          lastSynced: entry.last_sync !== null ? new Date(entry.last_sync).getTime() : null,
          inSync: prodInSync,
        });
      }
    }
  } else {
    // Single-production: read single entry
    const productionMetadata = await MetadataManager.read(agentPath, 'production', mode);
    const productionHash = productionMetadata.success ? productionMetadata.value.config_hash : null;
    const productionInSync =
      localHash !== null && productionHash !== null
        ? HashCalculator.compareHashes(localHash as never, productionHash as never)
        : false;

    if (productionMetadata.success && productionMetadata.value.agent_id !== null) {
      production.push({
        workspaceKey: 'production',
        agentId: productionMetadata.value.agent_id,
        hash: productionHash,
        lastSynced:
          productionMetadata.value.last_sync !== null
            ? new Date(productionMetadata.value.last_sync).getTime()
            : null,
        inSync: productionInSync,
      });
    }
  }

  return {
    name,
    localHash,
    staging,
    production,
    isMultiProduction,
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
    if (status.production.length > 0) {
      if (status.isMultiProduction) {
        // Multi-production: show each workspace
        for (const prod of status.production) {
          console.log(`    [${prod.workspaceKey}]`);
          console.log(`      ID: ${prod.agentId}`);
          const prodHashDisplay =
            prod.hash !== null ? prod.hash.substring(0, 12) + '...' : 'unknown';
          console.log(`      Hash: ${prodHashDisplay}`);
          console.log(`      Last Synced: ${formatTimestamp(prod.lastSynced)}`);
          console.log(`      Status: ${prod.inSync ? '✓ IN SYNC' : '✗ OUT OF SYNC'}`);
        }
      } else {
        // Single-production: show single entry
        const prod = status.production[0]!;
        console.log(`    ID: ${prod.agentId}`);
        const prodHashDisplay =
          prod.hash !== null ? prod.hash.substring(0, 12) + '...' : 'unknown';
        console.log(`    Hash: ${prodHashDisplay}`);
        console.log(`    Last Synced: ${formatTimestamp(prod.lastSynced)}`);
        console.log(`    Status: ${prod.inSync ? '✓ IN SYNC' : '✗ OUT OF SYNC'}`);
      }
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
