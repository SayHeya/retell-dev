/**
 * Pull command - Pull agent configs from Retell workspace to local.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { WorkspaceType, AgentConfig } from '@heya/retell.controllers';
import {
  MetadataManager,
  WorkspaceConfigService,
  RetellClientService,
  HashCalculator,
  now,
} from '@heya/retell.controllers';
import { handleError } from '../errors/cli-error-handler';

export const pullCommand = new Command('pull')
  .description('Pull agent configuration from Retell workspace to local')
  .argument('<agent-name>', 'Name of the agent to pull')
  .option('-w, --workspace <workspace>', 'Source workspace (staging or production)', 'staging')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .option('-f, --force', 'Force pull even if local has changes', false)
  .action(async (agentName: string, options: PullOptions) => {
    try {
      await executePull(agentName, options);
    } catch (error) {
      handleError(error);
    }
  });

type PullOptions = {
  workspace: WorkspaceType;
  path: string;
  force: boolean;
};

async function executePull(agentName: string, options: PullOptions): Promise<void> {
  console.log(`\nPulling agent '${agentName}' from ${options.workspace}...\n`);

  const agentPath = path.resolve(options.path, agentName);

  // 1. Load workspace config
  const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClientService(workspaceConfig);

  // 2. Read metadata to get agent_id
  const metadataResult = await MetadataManager.read(agentPath, options.workspace);
  if (!metadataResult.success) {
    throw new Error(
      `Agent '${agentName}' not found in ${options.workspace}.\n` +
        `Run 'retell push ${agentName} -w ${options.workspace}' first to create the agent.`
    );
  }
  const metadata = metadataResult.value;

  if (!metadata.agent_id || !metadata.llm_id) {
    throw new Error(
      `Agent metadata incomplete in ${options.workspace}. Run 'retell push' to sync.`
    );
  }

  // 3. Fetch agent config from Retell
  console.log('Fetching agent from Retell...');
  const agentResult = await client.getAgent(metadata.agent_id);
  if (!agentResult.success) {
    throw new Error(`Failed to fetch agent: ${agentResult.error.message}`);
  }
  const remoteAgent = agentResult.value as Record<string, unknown>;

  // 4. Fetch LLM config from Retell
  console.log('Fetching LLM config from Retell...');
  const llmResult = await client.getLlm(metadata.llm_id);
  if (!llmResult.success) {
    throw new Error(`Failed to fetch LLM: ${llmResult.error.message}`);
  }
  const remoteLlm = llmResult.value as Record<string, unknown>;

  // 5. Transform Retell format back to our format
  const localConfig = transformRetellToLocal(remoteAgent, remoteLlm);

  // 6. Check if local has changes (unless --force)
  if (!options.force) {
    const agentJsonPath = path.join(agentPath, 'agent.json');
    try {
      await fs.access(agentJsonPath);
      const existingContent = await fs.readFile(agentJsonPath, 'utf-8');
      const existingConfig = JSON.parse(existingContent) as AgentConfig;
      const existingHashResult = HashCalculator.calculateAgentHash(existingConfig);

      if (existingHashResult.success && metadata.config_hash) {
        if (
          !HashCalculator.compareHashes(
            existingHashResult.value as never,
            metadata.config_hash as never
          )
        ) {
          throw new Error(
            `Local agent '${agentName}' has unsaved changes.\n` +
              `Use --force to overwrite local changes, or push changes first.`
          );
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
      // Agent doesn't exist locally yet, that's fine
    }
  }

  // 7. Ensure agent directory exists
  await fs.mkdir(agentPath, { recursive: true });

  // 8. Save to local
  const agentJsonPath = path.join(agentPath, 'agent.json');
  await fs.writeFile(agentJsonPath, JSON.stringify(localConfig, null, 2) + '\n', 'utf-8');
  console.log(`✓ Saved agent config to ${agentJsonPath}`);

  // 9. Update metadata with new hash
  const newHashResult = HashCalculator.calculateAgentHash(localConfig as AgentConfig);
  if (newHashResult.success) {
    await MetadataManager.update(agentPath, options.workspace, {
      config_hash: newHashResult.value,
      last_sync: now(),
    });
    console.log(`✓ Updated ${options.workspace} metadata`);
  }

  console.log(`\n✓ Successfully pulled agent '${agentName}' from ${options.workspace}\n`);
}

/**
 * Transform Retell API format back to our local agent.json format.
 */
function transformRetellToLocal(
  agent: Record<string, unknown>,
  llm: Record<string, unknown>
): Record<string, unknown> {
  // Extract agent-level fields
  const localConfig: Record<string, unknown> = {
    agent_name: agent['agent_name'],
    voice_id: agent['voice_id'],
    language: agent['language'],
  };

  // Add optional agent fields
  if (agent['voice_temperature'] !== undefined) {
    localConfig['voice_temperature'] = agent['voice_temperature'];
  }
  if (agent['voice_speed'] !== undefined) {
    localConfig['voice_speed'] = agent['voice_speed'];
  }
  if (agent['responsiveness'] !== undefined) {
    localConfig['responsiveness'] = agent['responsiveness'];
  }
  if (agent['interruption_sensitivity'] !== undefined) {
    localConfig['interruption_sensitivity'] = agent['interruption_sensitivity'];
  }
  if (agent['enable_backchannel'] !== undefined) {
    localConfig['enable_backchannel'] = agent['enable_backchannel'];
  }
  if (agent['backchannel_frequency'] !== undefined) {
    localConfig['backchannel_frequency'] = agent['backchannel_frequency'];
  }
  if (agent['backchannel_words'] !== undefined) {
    localConfig['backchannel_words'] = agent['backchannel_words'];
  }
  if (agent['reminder_trigger_ms'] !== undefined) {
    localConfig['reminder_trigger_ms'] = agent['reminder_trigger_ms'];
  }
  if (agent['reminder_max_count'] !== undefined) {
    localConfig['reminder_max_count'] = agent['reminder_max_count'];
  }
  if (agent['ambient_sound'] !== undefined) {
    localConfig['ambient_sound'] = agent['ambient_sound'];
  }
  if (agent['ambient_sound_volume'] !== undefined) {
    localConfig['ambient_sound_volume'] = agent['ambient_sound_volume'];
  }
  if (agent['pronunciation_dictionary'] !== undefined) {
    localConfig['pronunciation_dictionary'] = agent['pronunciation_dictionary'];
  }
  if (agent['normalize_for_speech'] !== undefined) {
    localConfig['normalize_for_speech'] = agent['normalize_for_speech'];
  }
  if (agent['end_call_after_silence_ms'] !== undefined) {
    localConfig['end_call_after_silence_ms'] = agent['end_call_after_silence_ms'];
  }
  if (agent['max_call_duration_ms'] !== undefined) {
    localConfig['max_call_duration_ms'] = agent['max_call_duration_ms'];
  }
  if (agent['enable_voicemail_detection'] !== undefined) {
    localConfig['enable_voicemail_detection'] = agent['enable_voicemail_detection'];
  }
  if (agent['voicemail_message'] !== undefined) {
    localConfig['voicemail_message'] = agent['voicemail_message'];
  }
  if (agent['voicemail_detection_timeout_ms'] !== undefined) {
    localConfig['voicemail_detection_timeout_ms'] = agent['voicemail_detection_timeout_ms'];
  }
  if (agent['post_call_analysis_data'] !== undefined) {
    localConfig['post_call_analysis_data'] = agent['post_call_analysis_data'];
  }
  if (agent['webhook_url'] !== undefined) {
    localConfig['webhook_url'] = agent['webhook_url'];
  }

  // Build llm_config from LLM response
  const llmConfig: Record<string, unknown> = {
    model: llm['model'],
  };

  if (llm['model_temperature'] !== undefined) {
    llmConfig['temperature'] = llm['model_temperature'];
  }
  if (llm['general_prompt'] !== undefined) {
    llmConfig['general_prompt'] = llm['general_prompt'];
  }
  if (llm['begin_message'] !== undefined) {
    llmConfig['begin_message'] = llm['begin_message'];
  }
  if (llm['general_tools'] !== undefined) {
    llmConfig['general_tools'] = llm['general_tools'];
  }
  if (llm['states'] !== undefined) {
    llmConfig['states'] = llm['states'];
  }
  if (llm['starting_state'] !== undefined) {
    llmConfig['starting_state'] = llm['starting_state'];
  }
  if (llm['inbound_dynamic_variables_webhook_url'] !== undefined) {
    llmConfig['inbound_dynamic_variables_webhook_url'] =
      llm['inbound_dynamic_variables_webhook_url'];
  }
  if (llm['knowledge_base_ids'] !== undefined) {
    llmConfig['knowledge_base_ids'] = llm['knowledge_base_ids'];
  }

  localConfig['llm_config'] = llmConfig;

  return localConfig;
}
