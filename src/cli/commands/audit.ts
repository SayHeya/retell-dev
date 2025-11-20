/**
 * Audit command - Detect duplicates, orphaned resources, and sync issues.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import Table from 'cli-table3';
import type { WorkspaceType, LlmId } from '../../types/agent.types';
import { AgentConfigLoader } from '../../core/agent-config-loader';
import { MetadataManager } from '../../core/metadata-manager';
import { RetellClient } from '../../api/retell-client';
import { WorkspaceConfigLoader } from '../../config/workspace-config';

export const auditCommand = new Command('audit')
  .description('Audit agents for duplicates, orphaned resources, and sync issues')
  .option('-w, --workspace <workspace>', 'Workspace to audit (staging or production)', 'staging')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .option('--fix', 'Attempt to fix issues (removes orphaned resources)', false)
  .action(async (options: AuditOptions) => {
    try {
      await executeAudit(options);
    } catch (error) {
      console.error('Audit failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

type AuditOptions = {
  workspace: WorkspaceType;
  path: string;
  fix: boolean;
};

type LocalAgentData = {
  dirName: string;
  agentName: string;
  agentId: string | null;
  llmId: string | null;
  configPath: string;
};

type WorkspaceAgent = {
  agent_id: string;
  agent_name?: string;
  llm_id?: string;
};

type AuditResults = {
  duplicateAgentIds: Map<string, string[]>;
  duplicateAgentNames: Map<string, string[]>;
  localNotInWorkspace: LocalAgentData[];
  workspaceNotLocal: WorkspaceAgent[];
  orphanedLlms: string[];
  issues: string[];
};

async function executeAudit(options: AuditOptions): Promise<void> {
  const agentsPath = path.resolve(options.path);
  const workspace = options.workspace as WorkspaceType;

  console.log(`\nAuditing agents against ${workspace} workspace...\n`);

  // Load workspace config
  const workspaceConfigResult = await WorkspaceConfigLoader.getWorkspace(workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClient(workspaceConfig);

  // Gather local agents data
  const localAgents = await gatherLocalAgents(agentsPath, workspace);

  // Fetch workspace agents
  const workspaceAgents = await fetchWorkspaceAgents(client);

  // Fetch all LLMs in workspace
  const workspaceLlms = await fetchWorkspaceLlms(client);

  // Perform audit
  const results = performAudit(localAgents, workspaceAgents, workspaceLlms);

  // Display results
  displayResults(results, workspace);

  // Fix issues if requested
  if (options.fix && results.orphanedLlms.length > 0) {
    await fixOrphanedLlms(client, results.orphanedLlms);
  }

  // Exit with error if issues found
  const totalIssues =
    results.duplicateAgentIds.size +
    results.duplicateAgentNames.size +
    results.localNotInWorkspace.length +
    results.workspaceNotLocal.length +
    results.orphanedLlms.length;

  if (totalIssues > 0) {
    console.log(`\n⚠ Found ${totalIssues} issue(s)\n`);
    process.exit(1);
  } else {
    console.log('\n✓ No issues found\n');
  }
}

/**
 * Gather information about all local agents
 */
async function gatherLocalAgents(
  agentsPath: string,
  workspace: WorkspaceType
): Promise<LocalAgentData[]> {
  const localAgents: LocalAgentData[] = [];

  // Check if agents directory exists
  try {
    await fs.access(agentsPath);
  } catch {
    console.warn(`Agents directory not found: ${agentsPath}`);
    return localAgents;
  }

  // Scan for agent directories
  const entries = await fs.readdir(agentsPath, { withFileTypes: true });
  const agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  for (const dirName of agentDirs) {
    const agentPath = path.join(agentsPath, dirName);

    // Load agent config
    const configResult = await AgentConfigLoader.load(agentPath);
    if (!configResult.success) {
      console.warn(`⚠ Skipping ${dirName}: ${configResult.error.message}`);
      continue;
    }

    // Load metadata for workspace
    const metadataResult = await MetadataManager.read(agentPath, workspace);
    const agentId = metadataResult.success ? metadataResult.value.agent_id : null;
    const llmId = metadataResult.success ? metadataResult.value.llm_id : null;

    localAgents.push({
      dirName,
      agentName: configResult.value.agent_name,
      agentId,
      llmId,
      configPath: agentPath,
    });
  }

  return localAgents;
}

/**
 * Fetch all agents from workspace
 */
async function fetchWorkspaceAgents(client: RetellClient): Promise<WorkspaceAgent[]> {
  const listResult = await client.listAgents();
  if (!listResult.success) {
    throw new Error(`Failed to list agents: ${listResult.error.message}`);
  }

  return (
    listResult.value as Array<{
      agent_id: string;
      agent_name?: string;
      response_engine?: {
        llm_id?: string;
      };
    }>
  ).map((agent) => ({
    agent_id: agent.agent_id,
    agent_name: agent.agent_name,
    llm_id: agent.response_engine?.llm_id,
  }));
}

/**
 * Fetch all LLMs from workspace
 */
async function fetchWorkspaceLlms(client: RetellClient): Promise<string[]> {
  const listResult = await client.listLlms();
  if (!listResult.success) {
    throw new Error(`Failed to list LLMs: ${listResult.error.message}`);
  }

  return (listResult.value as Array<{ llm_id: string }>).map((llm) => llm.llm_id);
}

/**
 * Perform the audit analysis
 */
function performAudit(
  localAgents: LocalAgentData[],
  workspaceAgents: WorkspaceAgent[],
  workspaceLlms: string[]
): AuditResults {
  const results: AuditResults = {
    duplicateAgentIds: new Map(),
    duplicateAgentNames: new Map(),
    localNotInWorkspace: [],
    workspaceNotLocal: [],
    orphanedLlms: [],
    issues: [],
  };

  // Check for duplicate agent IDs locally
  const agentIdMap = new Map<string, string[]>();
  for (const agent of localAgents) {
    if (agent.agentId) {
      const existing = agentIdMap.get(agent.agentId) || [];
      existing.push(agent.dirName);
      agentIdMap.set(agent.agentId, existing);
    }
  }
  for (const [agentId, dirs] of agentIdMap) {
    if (dirs.length > 1) {
      results.duplicateAgentIds.set(agentId, dirs);
    }
  }

  // Check for duplicate agent names locally
  const agentNameMap = new Map<string, string[]>();
  for (const agent of localAgents) {
    const existing = agentNameMap.get(agent.agentName) || [];
    existing.push(agent.dirName);
    agentNameMap.set(agent.agentName, existing);
  }
  for (const [name, dirs] of agentNameMap) {
    if (dirs.length > 1) {
      results.duplicateAgentNames.set(name, dirs);
    }
  }

  // Check for local agents not in workspace
  const workspaceAgentIds = new Set(workspaceAgents.map((a) => a.agent_id));
  for (const agent of localAgents) {
    if (agent.agentId && !workspaceAgentIds.has(agent.agentId)) {
      results.localNotInWorkspace.push(agent);
    }
  }

  // Check for workspace agents not tracked locally
  const localAgentIds = new Set(localAgents.map((a) => a.agentId).filter(Boolean));
  for (const agent of workspaceAgents) {
    if (!localAgentIds.has(agent.agent_id)) {
      results.workspaceNotLocal.push(agent);
    }
  }

  // Check for orphaned LLMs (LLMs not attached to any agent)
  const usedLlmIds = new Set(workspaceAgents.map((a) => a.llm_id).filter(Boolean));
  for (const llmId of workspaceLlms) {
    if (!usedLlmIds.has(llmId)) {
      results.orphanedLlms.push(llmId);
    }
  }

  return results;
}

/**
 * Display audit results
 */
function displayResults(results: AuditResults, workspace: WorkspaceType): void {
  let hasIssues = false;

  // Duplicate Agent IDs
  if (results.duplicateAgentIds.size > 0) {
    hasIssues = true;
    console.log('❌ Duplicate Agent IDs (multiple local dirs pointing to same workspace agent):\n');
    const table = new Table({
      head: ['Agent ID', 'Local Directories'],
      colWidths: [40, 50],
    });
    for (const [agentId, dirs] of results.duplicateAgentIds) {
      table.push([agentId, dirs.join(', ')]);
    }
    console.log(table.toString());
    console.log('\nFix: Remove duplicate directories or update their metadata.\n');
  }

  // Duplicate Agent Names
  if (results.duplicateAgentNames.size > 0) {
    hasIssues = true;
    console.log('⚠ Duplicate Agent Names (same agent_name in multiple local configs):\n');
    const table = new Table({
      head: ['Agent Name', 'Local Directories'],
      colWidths: [40, 50],
    });
    for (const [name, dirs] of results.duplicateAgentNames) {
      table.push([name, dirs.join(', ')]);
    }
    console.log(table.toString());
    console.log('\nFix: Rename agents to have unique names.\n');
  }

  // Local agents not in workspace
  if (results.localNotInWorkspace.length > 0) {
    hasIssues = true;
    console.log(`❌ Local agents with ${workspace} metadata but not in workspace:\n`);
    const table = new Table({
      head: ['Directory', 'Agent Name', 'Agent ID'],
      colWidths: [25, 30, 40],
    });
    for (const agent of results.localNotInWorkspace) {
      table.push([agent.dirName, agent.agentName, agent.agentId || '(none)']);
    }
    console.log(table.toString());
    console.log('\nFix: Delete stale metadata or re-push the agent.\n');
  }

  // Workspace agents not tracked locally
  if (results.workspaceNotLocal.length > 0) {
    hasIssues = true;
    console.log(`⚠ Agents in ${workspace} workspace not tracked locally:\n`);
    const table = new Table({
      head: ['Agent ID', 'Agent Name'],
      colWidths: [40, 40],
    });
    for (const agent of results.workspaceNotLocal) {
      table.push([agent.agent_id, agent.agent_name || '(unnamed)']);
    }
    console.log(table.toString());
    console.log('\nFix: Run `retell pull` to import these agents or delete them from workspace.\n');
  }

  // Orphaned LLMs
  if (results.orphanedLlms.length > 0) {
    hasIssues = true;
    console.log(`🗑 Orphaned LLMs in ${workspace} (not attached to any agent):\n`);
    const table = new Table({
      head: ['LLM ID'],
      colWidths: [50],
    });
    for (const llmId of results.orphanedLlms) {
      table.push([llmId]);
    }
    console.log(table.toString());
    console.log('\nFix: Run with --fix to delete orphaned LLMs.\n');
  }

  if (!hasIssues) {
    console.log('✓ All checks passed');
  }
}

/**
 * Delete orphaned LLMs
 */
async function fixOrphanedLlms(client: RetellClient, llmIds: string[]): Promise<void> {
  console.log(`\nDeleting ${llmIds.length} orphaned LLM(s)...\n`);

  for (const llmId of llmIds) {
    try {
      const result = await client.deleteLlm(llmId as LlmId);
      if (result.success) {
        console.log(`✓ Deleted LLM: ${llmId}`);
      } else {
        console.error(`✗ Failed to delete LLM ${llmId}: ${result.error.message}`);
      }
    } catch (error) {
      console.error(
        `✗ Failed to delete LLM ${llmId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
