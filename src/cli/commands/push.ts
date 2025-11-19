/**
 * Push command - Push local agent configs to Retell workspace.
 *
 * New API structure:
 * 1. Create/Update LLM (contains model, prompt, temperature)
 * 2. Create/Update Agent (contains voice, language, references LLM by ID)
 */

import { Command } from 'commander';
import * as path from 'path';
import type { WorkspaceType } from '../../types/agent.types';
import { AgentConfigLoader } from '../../core/agent-config-loader';
import { MetadataManager } from '../../core/metadata-manager';
import { HashCalculator } from '../../core/hash-calculator';
import { AgentTransformer } from '../../core/agent-transformer';
import { RetellClient } from '../../api/retell-client';
import { WorkspaceConfigLoader } from '../../config/workspace-config';

export const pushCommand = new Command('push')
  .description('Push local agent configuration to Retell workspace')
  .argument('<agent-name>', 'Name of the agent to push')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('-f, --force', 'Force push even if already in sync', false)
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .option('--prompts <path>', 'Path to prompts directory', './prompts')
  .action(async (agentName: string, options: PushOptions) => {
    try {
      await executePush(agentName, options);
    } catch (error) {
      console.error('Push failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

type PushOptions = {
  workspace: WorkspaceType;
  force: boolean;
  path: string;
  prompts: string;
};

async function executePush(agentName: string, options: PushOptions): Promise<void> {
  console.log(`\nPushing agent '${agentName}' to ${options.workspace}...\n`);

  const agentPath = path.resolve(options.path, agentName);
  const promptsPath = path.resolve(options.prompts);

  // 1. Load workspace config
  const workspaceConfigResult = await WorkspaceConfigLoader.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClient(workspaceConfig);

  // 2. Load local agent config
  console.log('Loading local configuration...');
  const configResult = await AgentConfigLoader.load(agentPath);
  if (!configResult.success) {
    throw new Error(`Failed to load agent config: ${configResult.error.message}`);
  }
  const localConfig = configResult.value;

  // 3. Calculate current hash
  const hashResult = HashCalculator.calculateAgentHash(localConfig);
  if (!hashResult.success) {
    throw new Error(`Failed to calculate hash: ${hashResult.error.message}`);
  }
  const currentHash = hashResult.value;
  console.log(`Local config hash: ${currentHash.substring(0, 16)}...`);

  // 4. Read existing metadata
  const metadataResult = await MetadataManager.read(agentPath, options.workspace);
  const existingMetadata = metadataResult.success ? metadataResult.value : null;

  // 4a. Production push protection - Must push to staging first
  if (options.workspace === 'production') {
    console.log('Validating staging deployment...');
    const stagingMetadataResult = await MetadataManager.read(agentPath, 'staging');

    if (!stagingMetadataResult.success) {
      throw new Error(
        '❌ Cannot push to production: Agent has not been pushed to staging.\n' +
          '   Please push to staging first:\n' +
          `   retell push ${agentName} -w staging`
      );
    }

    const stagingMetadata = stagingMetadataResult.value;

    // Check if staging is synced
    if (!stagingMetadata.agent_id || !stagingMetadata.config_hash) {
      throw new Error(
        '❌ Cannot push to production: Staging agent is not properly synced.\n' +
          '   Please push to staging first:\n' +
          `   retell push ${agentName} -w staging`
      );
    }

    // Check if staging is on the same version as local
    const stagingInSync = HashCalculator.compareHashes(
      currentHash as never,
      stagingMetadata.config_hash as never
    );

    if (!stagingInSync && !options.force) {
      throw new Error(
        '❌ Cannot push to production: Local changes differ from staging.\n' +
          '   Current local hash:  ' +
          currentHash.substring(0, 16) +
          '...\n' +
          '   Staging hash:        ' +
          (stagingMetadata.config_hash.substring(0, 16) || 'none') +
          '...\n' +
          '   \n' +
          '   You must push to staging first:\n' +
          `   retell push ${agentName} -w staging\n` +
          '   \n' +
          '   Or use --force to push anyway (not recommended).'
      );
    }

    console.log('✓ Staging validation passed');
    console.log(`  Staging agent ID: ${stagingMetadata.agent_id}`);
    console.log(`  Staging hash: ${stagingMetadata.config_hash.substring(0, 16)}...`);
  }

  // 5. Check if already in sync (unless --force)
  if (!options.force && existingMetadata !== null && existingMetadata.config_hash !== null) {
    const inSync = HashCalculator.compareHashes(
      currentHash as never,
      existingMetadata.config_hash as never
    );
    if (inSync) {
      console.log(`\n✓ Agent is already in sync with ${options.workspace}`);
      console.log(`  Agent ID: ${existingMetadata.agent_id}`);
      console.log(`  LLM ID: ${existingMetadata.llm_id}`);
      console.log(`  Last synced: ${existingMetadata.last_sync}`);
      return;
    }
  }

  // 6. Transform config to Retell LLM format
  console.log('Transforming LLM configuration...');
  const llmTransformResult = await AgentTransformer.transformToLlm(localConfig, promptsPath);
  if (!llmTransformResult.success) {
    throw new Error(`Failed to transform LLM config: ${llmTransformResult.error.message}`);
  }
  const retellLlmConfig = llmTransformResult.value;

  // 7. Create or Update LLM
  let llmId: string;

  if (existingMetadata?.llm_id !== null && existingMetadata?.llm_id !== undefined) {
    // Update existing LLM
    console.log(`Updating LLM ${existingMetadata.llm_id}...`);
    const updateLlmResult = await client.updateLlm(existingMetadata.llm_id, retellLlmConfig);
    if (!updateLlmResult.success) {
      throw new Error(`Failed to update LLM: ${updateLlmResult.error.message}`);
    }
    llmId = updateLlmResult.value.llm_id;
    console.log(`✓ LLM updated successfully`);
  } else {
    // Create new LLM
    console.log('Creating new LLM...');
    const createLlmResult = await client.createLlm(retellLlmConfig);
    if (!createLlmResult.success) {
      throw new Error(`Failed to create LLM: ${createLlmResult.error.message}`);
    }
    llmId = createLlmResult.value.llm_id;
    console.log(`✓ LLM created successfully (ID: ${llmId})`);
  }

  // 8. Transform config to Retell Agent format (with LLM ID)
  console.log('Transforming Agent configuration...');
  const agentTransformResult = AgentTransformer.transformToAgent(localConfig, llmId as never);
  if (!agentTransformResult.success) {
    throw new Error(`Failed to transform agent config: ${agentTransformResult.error.message}`);
  }
  const retellAgentConfig = agentTransformResult.value;

  // 9. Create or Update Agent
  let agentId: string;

  if (existingMetadata?.agent_id !== null && existingMetadata?.agent_id !== undefined) {
    // Update existing agent
    console.log(`Updating agent ${existingMetadata.agent_id}...`);
    const updateAgentResult = await client.updateAgent(
      existingMetadata.agent_id,
      retellAgentConfig
    );
    if (!updateAgentResult.success) {
      throw new Error(`Failed to update agent: ${updateAgentResult.error.message}`);
    }
    agentId = updateAgentResult.value.agent_id;
    console.log(`✓ Agent updated successfully`);
  } else {
    // Create new agent
    console.log('Creating new agent...');
    const createAgentResult = await client.createAgent(retellAgentConfig);
    if (!createAgentResult.success) {
      throw new Error(`Failed to create agent: ${createAgentResult.error.message}`);
    }
    agentId = createAgentResult.value.agent_id;
    console.log(`✓ Agent created successfully (ID: ${agentId})`);
  }

  // 10. Calculate hash of what we just sent to Retell
  // This is the hash we'll compare against when checking for conflicts
  const { RetellConfigHasher } = await import('../../core/retell-config-hasher');
  const retellHashResult = RetellConfigHasher.calculateRetellConfigHash(
    retellAgentConfig,
    retellLlmConfig
  );
  if (!retellHashResult.success) {
    console.warn('Warning: Failed to calculate Retell config hash. Using local hash instead.');
  }
  const finalHash = retellHashResult.success ? retellHashResult.value : currentHash;

  // 11. Update metadata
  console.log('Updating metadata...');
  const timestamp = new Date().toISOString() as never;
  const updateMetadataResult = await MetadataManager.update(agentPath, options.workspace, {
    agent_id: agentId as never,
    llm_id: llmId as never,
    config_hash: finalHash as never,
    last_sync: timestamp,
  });

  if (!updateMetadataResult.success) {
    throw new Error(`Failed to update metadata: ${updateMetadataResult.error.message}`);
  }

  console.log(`\n✓ Push to ${options.workspace} completed successfully!`);
  console.log(`  Agent ID: ${agentId}`);
  console.log(`  LLM ID: ${llmId}`);
  console.log(`  Config hash: ${finalHash.substring(0, 16)}...`);
  console.log(`  Synced at: ${timestamp}`);
}
