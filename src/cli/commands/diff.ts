/**
 * Diff command - Show differences between local and remote agent configurations.
 *
 * This command:
 * 1. Fetches current config from Retell workspace
 * 2. Compares with local agent.json (after building prompts from sections)
 * 3. Shows field-level conflicts
 * 4. Shows prompt conflicts with text diff
 * 5. Offers resolution strategies
 */

import { Command } from 'commander';
import * as path from 'path';
import type { WorkspaceType } from '@heya/retell.controllers';
import {
  AgentConfigLoader,
  MetadataManager,
  WorkspaceConfigService,
  RetellClientService,
  ConflictDetector,
  ConflictResolver,
} from '@heya/retell.controllers';
import type { ResolutionStrategy } from '@heya/retell.controllers';
import { handleError } from '../errors/cli-error-handler';

export const diffCommand = new Command('diff')
  .description('Show differences between local and remote agent configurations')
  .argument('<agent-name>', 'Name of the agent to check for conflicts')
  .option(
    '-w, --workspace <workspace>',
    'Workspace to compare against (staging or production)',
    'staging'
  )
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .option('--prompts <path>', 'Path to prompts directory', './prompts')
  .option('--full', 'Show full prompts instead of preview', false)
  .option('--resolve <strategy>', 'Auto-resolve conflicts (use-local, use-remote, manual)')
  .action(async (agentName: string, options: DiffOptions) => {
    try {
      await executeDiff(agentName, options);
    } catch (error) {
      handleError(error);
    }
  });

type DiffOptions = {
  workspace: WorkspaceType;
  path: string;
  prompts: string;
  full: boolean;
  resolve?: ResolutionStrategy;
};

async function executeDiff(agentName: string, options: DiffOptions): Promise<void> {
  console.log(`\nChecking for conflicts: '${agentName}' in ${options.workspace}...\n`);

  const agentPath = path.resolve(options.path, agentName);
  const promptsPath = path.resolve(options.prompts);

  // Get orchestration mode
  const modeResult = await WorkspaceConfigService.getMode();
  const mode = modeResult.success ? modeResult.value : 'single-production';

  // 1. Load workspace config
  const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClientService(workspaceConfig);

  // 2. Load local agent config
  console.log('Loading local configuration...');
  const configResult = await AgentConfigLoader.load(agentPath);
  if (!configResult.success) {
    throw new Error(`Failed to load agent config: ${configResult.error.message}`);
  }
  const localConfig = configResult.value;

  // 3. Load metadata to get agent_id and stored hash
  const metadataResult = await MetadataManager.read(agentPath, options.workspace, mode);
  if (!metadataResult.success) {
    throw new Error(
      `Agent not found in ${options.workspace}. Run 'retell push' first.\n` +
        `Error: ${metadataResult.error.message}`
    );
  }
  const metadata = metadataResult.value;

  if (!metadata.agent_id || !metadata.llm_id) {
    throw new Error(
      `Agent metadata incomplete in ${options.workspace}. Run 'retell push' to sync.`
    );
  }

  // 4. Fetch remote agent config
  console.log(`Fetching ${options.workspace} configuration from Retell...`);
  const remoteAgentResult = await client.getAgent(metadata.agent_id);
  if (!remoteAgentResult.success) {
    throw new Error(`Failed to fetch agent from Retell: ${remoteAgentResult.error.message}`);
  }
  const remoteAgentConfig = remoteAgentResult.value;

  // 5. Fetch remote LLM config
  const remoteLlmResult = await client.getLlm(metadata.llm_id);
  if (!remoteLlmResult.success) {
    throw new Error(`Failed to fetch LLM from Retell: ${remoteLlmResult.error.message}`);
  }
  const remoteLlmConfig = remoteLlmResult.value;

  // 6. Detect conflicts
  console.log('Analyzing differences...\n');
  const conflictResult = await ConflictDetector.detect(
    localConfig,
    remoteAgentConfig,
    remoteLlmConfig,
    metadata.config_hash,
    promptsPath
  );

  if (!conflictResult.success) {
    throw new Error(`Failed to detect conflicts: ${conflictResult.error.message}`);
  }

  const detection = conflictResult.value;

  // 7. Display results
  if (!detection.hasConflict) {
    console.log('✅ No conflicts detected.');
    console.log(detection.message);
    console.log(`\nLast synced: ${metadata.last_sync ?? 'Unknown'}`);
    return;
  }

  // Has conflicts - display them
  console.log('⚠️  Conflicts Detected\n');
  console.log(`Local Config Hash:  ${detection.localHash}`);
  console.log(`Remote Config Hash: ${detection.remoteHash}`);
  console.log(`Stored Hash:        ${metadata.config_hash ?? 'None'}\n`);

  // Show field conflicts
  if (detection.fieldConflicts.length > 0) {
    console.log(ConflictResolver.formatFieldConflicts(detection.fieldConflicts));
  }

  // Show prompt conflict
  if (detection.promptConflict) {
    if (options.full) {
      // Show full prompt diff
      console.log(
        ConflictResolver.generatePromptDiff(
          detection.promptConflict.localPrompt,
          detection.promptConflict.remotePrompt
        )
      );
    } else {
      // Show preview
      console.log(ConflictResolver.formatPromptConflict(detection.promptConflict));
    }
  }

  // 8. Resolution options
  if (options.resolve) {
    console.log(`\nApplying resolution strategy: ${options.resolve}\n`);

    const resolutionResult = await ConflictResolver.resolve(
      localConfig,
      remoteAgentConfig,
      remoteLlmConfig,
      options.resolve,
      agentPath
    );

    if (!resolutionResult.success) {
      throw new Error(`Failed to resolve conflicts: ${resolutionResult.error.message}`);
    }

    console.log(resolutionResult.value.message);
  } else {
    // Show resolution instructions
    console.log('\n📝 Resolution Options:\n');
    console.log('  1. Use local changes (force push):');
    console.log(`     retell diff ${agentName} -w ${options.workspace} --resolve use-local`);
    console.log(`     retell push ${agentName} -w ${options.workspace} --force\n`);

    console.log('  2. Use remote changes (pull):');
    console.log(`     retell diff ${agentName} -w ${options.workspace} --resolve use-remote`);
    console.log(`     # Review agent.json, then push to sync\n`);

    console.log('  3. Manually resolve:');
    console.log(`     # Edit agent.json to resolve conflicts`);
    console.log(`     retell push ${agentName} -w ${options.workspace}\n`);
  }
}
