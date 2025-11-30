/**
 * Sync command - Reconcile local metadata files with actual workspace state
 *
 * This command queries all configured workspaces to get the actual deployed agents
 * and updates the local metadata files (staging.json, production.json) to match.
 */

import { Command } from 'commander';
import { WorkspaceController } from '@heya/retell.controllers';
import Retell from 'retell-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { handleError } from '../errors/cli-error-handler';

export const syncCommand = new Command('sync')
  .description('Sync local metadata files with actual workspace state')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .option('-a, --agent <name>', 'Sync only a specific agent')
  .option('--dry-run', 'Show what would be changed without making changes', false)
  .action(async (options: SyncOptions) => {
    try {
      await executeSync(options);
    } catch (error) {
      handleError(error);
    }
  });

type SyncOptions = {
  path: string;
  agent?: string;
  dryRun: boolean;
};

type AgentMetadata = {
  workspace: string;
  agent_id: string;
  llm_id: string;
  kb_id: string | null;
  last_sync: string;
  config_hash: string | null;
  retell_version: number | null;
};

type SyncResult = {
  workspaceKey: string;
  workspaceName: string;
  workspaceType: string;
  agentsFound: number;
  metadataUpdated: boolean;
  agents: Array<{
    agent_id: string;
    agent_name: string;
    llm_id?: string;
  }>;
};

async function executeSync(options: SyncOptions): Promise<void> {
  console.log('\n🔄 Syncing metadata with workspaces...\n');

  const controller = new WorkspaceController();

  // Get all workspaces
  const workspacesResult = await controller.getAllWorkspaces();
  if (!workspacesResult.success) {
    throw workspacesResult.error;
  }

  const workspaces = workspacesResult.value;
  const modeResult = await controller.getMode();
  if (!modeResult.success) {
    throw modeResult.error;
  }

  console.log(`Mode: ${modeResult.value}`);
  console.log(`Workspaces: ${workspaces.length}\n`);

  // Get list of agent directories
  const agentsPath = path.resolve(process.cwd(), options.path);
  let agentDirs: string[];

  try {
    const entries = await fs.readdir(agentsPath, { withFileTypes: true });
    agentDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    console.error(`❌ Agents directory not found: ${agentsPath}`);
    process.exit(1);
  }

  if (options.agent) {
    if (!agentDirs.includes(options.agent)) {
      console.error(`❌ Agent not found: ${options.agent}`);
      process.exit(1);
    }
    agentDirs = [options.agent];
  }

  console.log(`Agents to sync: ${agentDirs.join(', ')}\n`);

  // Sync each workspace
  const results: SyncResult[] = [];

  for (const ws of workspaces) {
    console.log(`\n━━━ ${ws.name} (${ws.type}) ━━━`);

    try {
      const client = new Retell({ apiKey: ws.apiKey });
      const agents = await client.agent.list();

      const result: SyncResult = {
        workspaceKey: ws.key || ws.type,
        workspaceName: ws.name,
        workspaceType: ws.type,
        agentsFound: agents.length,
        metadataUpdated: false,
        agents: agents.map((a) => ({
          agent_id: a.agent_id,
          agent_name: a.agent_name || 'Unknown',
          llm_id:
            a.response_engine !== null && a.response_engine !== undefined && 'llm_id' in a.response_engine
              ? a.response_engine.llm_id
              : undefined,
        })),
      };

      console.log(`  Found ${agents.length} agent(s)`);

      // For each local agent, check if it exists in this workspace
      for (const agentDir of agentDirs) {
        const agentPath = path.join(agentsPath, agentDir);
        const agentJsonPath = path.join(agentPath, 'agent.json');

        // Check if agent.json exists
        try {
          await fs.access(agentJsonPath);
        } catch {
          console.log(`  ⚠️  ${agentDir}: No agent.json found, skipping`);
          continue;
        }

        // Read agent.json to get the agent name
        const agentJson = JSON.parse(await fs.readFile(agentJsonPath, 'utf-8'));
        const agentName = agentJson.agent_name || agentDir;

        // Find matching agent in workspace by name
        const matchingAgent = agents.find(
          (a) => a.agent_name === agentName || a.agent_name === agentDir
        );

        if (matchingAgent) {
          console.log(`  ✓ ${agentDir}: Found (${matchingAgent.agent_id})`);

          // Determine metadata file path
          let metadataPath: string;
          if (ws.type === 'staging') {
            metadataPath = path.join(agentPath, 'staging.json');
          } else {
            metadataPath = path.join(agentPath, 'production.json');
          }

          // Build metadata entry
          // For multi-production, use the workspace key (e.g., "prod-1", "prod-2")
          // For staging or single-production, use the type
          const workspaceKey = ws.key || ws.type;

          const entry: AgentMetadata = {
            workspace: workspaceKey,
            agent_id: matchingAgent.agent_id,
            llm_id:
              matchingAgent.response_engine !== null && matchingAgent.response_engine !== undefined && 'llm_id' in matchingAgent.response_engine
                ? matchingAgent.response_engine.llm_id
                : '',
            kb_id: null,
            last_sync: new Date().toISOString(),
            config_hash: null, // Would need to recalculate
            retell_version: matchingAgent.version ?? null,
          };

          if (options.dryRun) {
            console.log(`    Would update ${path.basename(metadataPath)}`);
          } else {
            // For production in multi-production mode, we need to handle the array
            if (ws.type === 'production' && modeResult.value === 'multi-production') {
              // Read existing production.json or create empty array
              let existingEntries: AgentMetadata[] = [];
              try {
                const content = await fs.readFile(metadataPath, 'utf-8');
                existingEntries = JSON.parse(content);
                if (!Array.isArray(existingEntries)) {
                  existingEntries = [existingEntries];
                }
              } catch {
                existingEntries = [];
              }

              // Find and update or add entry for this workspace
              // Look up by workspace key (e.g., "prod-1", "prod-2")
              const existingIdx = existingEntries.findIndex(
                (e) => e.workspace === workspaceKey
              );

              if (existingIdx >= 0) {
                existingEntries[existingIdx] = entry;
              } else {
                existingEntries.push(entry);
              }

              await fs.writeFile(metadataPath, JSON.stringify(existingEntries, null, 2) + '\n');
            } else {
              // Single staging or single-production mode: write single object
              await fs.writeFile(metadataPath, JSON.stringify(entry, null, 2) + '\n');
            }

            console.log(`    Updated ${path.basename(metadataPath)}`);
            result.metadataUpdated = true;
          }
        } else {
          console.log(`  ○ ${agentDir}: Not deployed in this workspace`);

          // If not found, remove the metadata file for this workspace
          let metadataPath: string;
          if (ws.type === 'staging') {
            metadataPath = path.join(agentPath, 'staging.json');
          } else {
            metadataPath = path.join(agentPath, 'production.json');
          }

          try {
            await fs.access(metadataPath);
            if (options.dryRun) {
              console.log(`    Would remove stale ${path.basename(metadataPath)}`);
            } else {
              // For multi-production, remove just this workspace's entry
              if (ws.type === 'production' && modeResult.value === 'multi-production') {
                try {
                  const content = await fs.readFile(metadataPath, 'utf-8');
                  let existingEntries: AgentMetadata[] = JSON.parse(content);
                  if (!Array.isArray(existingEntries)) {
                    existingEntries = [existingEntries];
                  }

                  // Remove entry by workspace key (e.g., "prod-1")
                  const wsKey = ws.key || ws.type;
                  const filtered = existingEntries.filter(
                    (e) => e.workspace !== wsKey
                  );

                  if (filtered.length > 0) {
                    await fs.writeFile(metadataPath, JSON.stringify(filtered, null, 2) + '\n');
                    console.log(`    Removed entry from ${path.basename(metadataPath)}`);
                  } else {
                    await fs.unlink(metadataPath);
                    console.log(`    Removed empty ${path.basename(metadataPath)}`);
                  }
                } catch {
                  // File doesn't exist or can't be parsed, nothing to do
                }
              } else {
                await fs.unlink(metadataPath);
                console.log(`    Removed stale ${path.basename(metadataPath)}`);
              }
              result.metadataUpdated = true;
            }
          } catch {
            // File doesn't exist, nothing to remove
          }
        }
      }

      results.push(result);
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Summary
  console.log('\n━━━ Summary ━━━\n');

  for (const r of results) {
    console.log(`${r.workspaceName}:`);
    console.log(`  Agents in workspace: ${r.agentsFound}`);
    console.log(`  Metadata updated: ${r.metadataUpdated ? 'Yes' : 'No'}`);
  }

  if (options.dryRun) {
    console.log('\n⚠️  Dry run - no changes were made');
  }

  console.log('');
}
