/**
 * List command - List agents from Retell workspace or local.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import Table from 'cli-table3';
import {
  AgentController,
  AgentConfigLoader,
  MetadataManager,
  HashCalculator,
} from '@heya/retell.controllers';
import type { WorkspaceType } from '@heya/retell.controllers';
import { handleError } from '../errors/cli-error-handler';

export const listCommand = new Command('list')
  .description('List agents from workspace or local')
  .option(
    '-w, --workspace <workspace>',
    'Workspace to list from (staging, production, or local)',
    'local'
  )
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .action(async (options: ListOptions) => {
    try {
      await executeList(options);
    } catch (error) {
      handleError(error);
    }
  });

type ListOptions = {
  workspace: WorkspaceType | 'local';
  path: string;
};

type LocalAgentInfo = {
  name: string;
  agentName: string;
  voiceId: string;
  language: string;
  model: string;
  stagingSync: SyncStatus;
  productionSync: SyncStatus;
};

type SyncStatus = 'in-sync' | 'out-of-sync' | 'never-synced' | 'error';

async function executeList(options: ListOptions): Promise<void> {
  const agentsPath = path.resolve(options.path);

  if (options.workspace === 'local') {
    await listLocalAgents(agentsPath);
  } else {
    await listWorkspaceAgents(options.workspace);
  }
}

/**
 * List all local agents with their sync status
 */
async function listLocalAgents(agentsPath: string): Promise<void> {
  console.log('\nScanning local agents...\n');

  // Check if agents directory exists
  try {
    await fs.access(agentsPath);
  } catch {
    console.error(`Agents directory not found: ${agentsPath}`);
    return;
  }

  // Scan for agent directories
  const entries = await fs.readdir(agentsPath, { withFileTypes: true });
  const agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (agentDirs.length === 0) {
    console.log('No agents found in agents/ directory');
    return;
  }

  // Load agent info
  const agents: LocalAgentInfo[] = [];
  for (const agentName of agentDirs) {
    const agentPath = path.join(agentsPath, agentName);
    const agentInfo = await loadLocalAgentInfo(agentPath, agentName);
    if (agentInfo) {
      agents.push(agentInfo);
    }
  }

  if (agents.length === 0) {
    console.log('No valid agents found');
    return;
  }

  // Display table
  const table = new Table({
    head: ['Agent', 'Name', 'Voice', 'Language', 'Model', 'Staging', 'Production'],
    colWidths: [20, 25, 18, 12, 15, 15, 15],
  });

  for (const agent of agents) {
    table.push([
      agent.name,
      agent.agentName,
      agent.voiceId,
      agent.language,
      agent.model,
      formatSyncStatus(agent.stagingSync),
      formatSyncStatus(agent.productionSync),
    ]);
  }

  console.log(table.toString());
  console.log(`\nFound ${agents.length} agent(s)\n`);
}

/**
 * Load information about a local agent
 */
async function loadLocalAgentInfo(
  agentPath: string,
  agentName: string
): Promise<LocalAgentInfo | null> {
  try {
    // Load agent config
    const configResult = await AgentConfigLoader.load(agentPath);
    if (!configResult.success) {
      console.warn(`⚠ Skipping ${agentName}: ${configResult.error.message}`);
      return null;
    }
    const config = configResult.value;

    // Calculate current hash
    const hashResult = HashCalculator.calculateAgentHash(config);
    if (!hashResult.success) {
      return null;
    }
    const currentHash = hashResult.value;

    // Check staging sync
    const stagingSync = await checkSyncStatus(agentPath, 'staging', currentHash);

    // Check production sync
    const productionSync = await checkSyncStatus(agentPath, 'production', currentHash);

    return {
      name: agentName,
      agentName: config.agent_name,
      voiceId: config.voice_id,
      language: config.language,
      model: config.llm_config.model,
      stagingSync,
      productionSync,
    };
  } catch (error) {
    console.warn(
      `⚠ Skipping ${agentName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
}

/**
 * Check sync status for a workspace
 */
async function checkSyncStatus(
  agentPath: string,
  workspace: WorkspaceType,
  currentHash: string
): Promise<SyncStatus> {
  const metadataResult = await MetadataManager.read(agentPath, workspace);

  if (!metadataResult.success) {
    return 'never-synced';
  }

  const metadata = metadataResult.value;

  if (!metadata.config_hash) {
    return 'never-synced';
  }

  const inSync = HashCalculator.compareHashes(currentHash as never, metadata.config_hash as never);

  return inSync ? 'in-sync' : 'out-of-sync';
}

/**
 * Format sync status
 */
function formatSyncStatus(status: SyncStatus): string {
  switch (status) {
    case 'in-sync':
      return '✓ In Sync';
    case 'out-of-sync':
      return '⚠ Modified';
    case 'never-synced':
      return '− Not Pushed';
    case 'error':
      return '✗ Error';
  }
}

/**
 * List agents from a Retell workspace using controller
 */
async function listWorkspaceAgents(workspace: WorkspaceType): Promise<void> {
  console.log(`\nListing agents from ${workspace} workspace...\n`);

  const controller = new AgentController();
  const result = await controller.list({ workspace });

  if (!result.success) {
    throw result.error;
  }

  const agents = result.value;

  if (agents.length === 0) {
    console.log(`No agents found in ${workspace} workspace`);
    return;
  }

  // Display table
  const table = new Table({
    head: ['Agent ID', 'Name', 'Voice', 'LLM ID'],
    colWidths: [35, 30, 20, 35],
  });

  for (const agent of agents) {
    table.push([
      agent.agentId,
      agent.agentName || '(unnamed)',
      '−', // Voice not returned in list
      agent.llmId || '(none)',
    ]);
  }

  console.log(table.toString());
  console.log(`\nFound ${agents.length} agent(s) in ${workspace}\n`);
}
