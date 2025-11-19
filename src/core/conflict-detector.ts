import type { AgentConfig } from '../types/agent.types';
import type { Hash, Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';
import { PromptBuilder } from './prompt-builder';
import { RetellConfigHasher } from './retell-config-hasher';
import { HashCalculator } from './hash-calculator';

/**
 * Type representing a field-level conflict
 */
export type FieldConflict = {
  readonly field: string;
  readonly localValue: unknown;
  readonly remoteValue: unknown;
  readonly path: string; // e.g., "agent.voice_speed" or "llm.temperature"
};

/**
 * Type representing a prompt conflict with actual text diff
 */
export type PromptConflict = {
  readonly field: 'prompt';
  readonly localPrompt: string;
  readonly remotePrompt: string;
  readonly localHash: Hash;
  readonly remoteHash: Hash;
};

/**
 * Result of conflict detection
 */
export type ConflictDetectionResult =
  | {
      readonly hasConflict: false;
      readonly message: string;
    }
  | {
      readonly hasConflict: true;
      readonly localHash: Hash;
      readonly remoteHash: Hash;
      readonly fieldConflicts: ReadonlyArray<FieldConflict>;
      readonly promptConflict?: PromptConflict;
    };

/**
 * Detects conflicts between local agent configuration and remote Retell configuration.
 *
 * Conflict detection process:
 * 1. Compare config_hash from metadata with hash of remote config
 * 2. If different, perform detailed field-by-field comparison
 * 3. For prompts: Build local prompt from sections and compare with remote prompt text
 */
export class ConflictDetector {
  /**
   * Detect conflicts between local and remote configurations.
   *
   * @param localConfig - Our local agent configuration
   * @param remoteAgentConfig - Agent config from Retell
   * @param remoteLlmConfig - LLM config from Retell
   * @param storedHash - The config_hash from staging.json/production.json
   * @param promptsDir - Directory containing prompt sections
   * @returns Result containing conflict detection results or error
   */
  static async detect(
    localConfig: AgentConfig,
    remoteAgentConfig: unknown,
    remoteLlmConfig: unknown,
    storedHash: Hash | null,
    promptsDir: string
  ): Promise<Result<ConflictDetectionResult, Error>> {
    try {
      // Calculate hash of remote configuration
      const remoteHashResult = RetellConfigHasher.calculateRetellConfigHash(
        remoteAgentConfig,
        remoteLlmConfig
      );
      if (!remoteHashResult.success) {
        return remoteHashResult;
      }
      const remoteHash = remoteHashResult.value;

      // Calculate hash of local configuration (what we would send to Retell)
      const localHashResult = await this.calculateLocalRetellHash(localConfig, promptsDir);
      if (!localHashResult.success) {
        return localHashResult;
      }
      const localHash = localHashResult.value;

      // Compare stored hash with remote hash
      if (storedHash && HashCalculator.compareHashes(storedHash, remoteHash)) {
        return Ok({
          hasConflict: false,
          message: 'Configuration is in sync with Retell',
        });
      }

      // Hashes differ - perform detailed comparison
      const fieldConflicts = this.compareFields(localConfig, remoteAgentConfig, remoteLlmConfig);

      // Check for prompt conflicts specifically
      const promptConflictResult = await this.detectPromptConflict(
        localConfig,
        remoteLlmConfig,
        promptsDir
      );
      if (!promptConflictResult.success) {
        return promptConflictResult;
      }

      const promptConflict = promptConflictResult.value;

      return Ok({
        hasConflict: true,
        localHash,
        remoteHash,
        fieldConflicts,
        promptConflict,
      });
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to detect conflicts'));
    }
  }

  /**
   * Calculate hash of local config as it would be sent to Retell.
   * This includes building the prompt from sections.
   */
  private static async calculateLocalRetellHash(
    localConfig: AgentConfig,
    promptsDir: string
  ): Promise<Result<Hash, Error>> {
    try {
      // Build the prompt that would be sent to Retell
      let generalPrompt: string;

      if (localConfig.llm_config.prompt_config !== undefined) {
        const buildResult = await PromptBuilder.build(
          promptsDir,
          localConfig.llm_config.prompt_config
        );
        if (!buildResult.success) {
          return buildResult;
        }
        generalPrompt = buildResult.value;
      } else if (localConfig.llm_config.general_prompt !== undefined) {
        generalPrompt = localConfig.llm_config.general_prompt;
      } else {
        return Err(new Error('No prompt configuration found'));
      }

      // Build simulated Retell config with the built prompt
      const simulatedLlmConfig = {
        model: localConfig.llm_config.model,
        temperature: localConfig.llm_config.temperature,
        general_prompt: generalPrompt,
        begin_message: localConfig.llm_config.begin_message,
        general_tools: localConfig.llm_config.tools,
        start_speaker: 'agent',
      };

      const simulatedAgentConfig = {
        agent_name: localConfig.agent_name,
        voice_id: localConfig.voice_id,
        voice_speed: localConfig.voice_speed,
        voice_temperature: localConfig.voice_temperature,
        responsiveness: localConfig.responsiveness,
        interruption_sensitivity: localConfig.interruption_sensitivity,
        language: localConfig.language,
        enable_backchannel: localConfig.enable_backchannel,
        backchannel_frequency: localConfig.backchannel_frequency,
        ambient_sound: localConfig.ambient_sound,
        boosted_keywords: localConfig.boosted_keywords,
        pronunciation_dictionary: localConfig.pronunciation_dictionary,
        normalize_for_speech: localConfig.normalize_for_speech,
        webhook_url: localConfig.webhook_url,
        post_call_analysis_data: localConfig.post_call_analysis_data,
      };

      return RetellConfigHasher.calculateRetellConfigHash(simulatedAgentConfig, simulatedLlmConfig);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error('Failed to calculate local Retell hash')
      );
    }
  }

  /**
   * Compare individual fields between local and remote configs.
   */
  private static compareFields(
    localConfig: AgentConfig,
    remoteAgentConfig: unknown,
    remoteLlmConfig: unknown
  ): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    const remoteAgent = remoteAgentConfig as any;
    const remoteLlm = remoteLlmConfig as any;

    // Agent-level fields
    this.compareField(
      conflicts,
      'agent.agent_name',
      localConfig.agent_name,
      remoteAgent.agent_name
    );
    this.compareField(conflicts, 'agent.voice_id', localConfig.voice_id, remoteAgent.voice_id);
    this.compareField(
      conflicts,
      'agent.voice_speed',
      localConfig.voice_speed,
      remoteAgent.voice_speed
    );
    this.compareField(
      conflicts,
      'agent.voice_temperature',
      localConfig.voice_temperature,
      remoteAgent.voice_temperature
    );
    this.compareField(
      conflicts,
      'agent.responsiveness',
      localConfig.responsiveness,
      remoteAgent.responsiveness
    );
    this.compareField(
      conflicts,
      'agent.interruption_sensitivity',
      localConfig.interruption_sensitivity,
      remoteAgent.interruption_sensitivity
    );
    this.compareField(conflicts, 'agent.language', localConfig.language, remoteAgent.language);
    this.compareField(
      conflicts,
      'agent.enable_backchannel',
      localConfig.enable_backchannel,
      remoteAgent.enable_backchannel
    );
    this.compareField(
      conflicts,
      'agent.backchannel_frequency',
      localConfig.backchannel_frequency,
      remoteAgent.backchannel_frequency
    );
    this.compareField(
      conflicts,
      'agent.ambient_sound',
      localConfig.ambient_sound,
      remoteAgent.ambient_sound
    );
    this.compareField(
      conflicts,
      'agent.normalize_for_speech',
      localConfig.normalize_for_speech,
      remoteAgent.normalize_for_speech
    );
    this.compareField(
      conflicts,
      'agent.webhook_url',
      localConfig.webhook_url,
      remoteAgent.webhook_url
    );

    // LLM-level fields (excluding prompt - handled separately)
    this.compareField(conflicts, 'llm.model', localConfig.llm_config.model, remoteLlm.model);
    this.compareField(
      conflicts,
      'llm.temperature',
      localConfig.llm_config.temperature,
      remoteLlm.temperature
    );
    this.compareField(
      conflicts,
      'llm.begin_message',
      localConfig.llm_config.begin_message,
      remoteLlm.begin_message
    );

    // Compare arrays/objects as JSON strings for simplicity
    this.compareField(
      conflicts,
      'agent.boosted_keywords',
      JSON.stringify(localConfig.boosted_keywords ?? []),
      JSON.stringify(remoteAgent.boosted_keywords ?? [])
    );
    this.compareField(
      conflicts,
      'agent.pronunciation_dictionary',
      JSON.stringify(localConfig.pronunciation_dictionary ?? []),
      JSON.stringify(remoteAgent.pronunciation_dictionary ?? [])
    );
    this.compareField(
      conflicts,
      'llm.tools',
      JSON.stringify(localConfig.llm_config.tools ?? []),
      JSON.stringify(remoteLlm.general_tools ?? [])
    );

    return conflicts;
  }

  /**
   * Helper to compare a single field and add to conflicts if different.
   */
  private static compareField(
    conflicts: FieldConflict[],
    path: string,
    localValue: unknown,
    remoteValue: unknown
  ): void {
    // Normalize undefined to null for comparison
    const local = localValue === undefined ? null : localValue;
    const remote = remoteValue === undefined ? null : remoteValue;

    if (JSON.stringify(local) !== JSON.stringify(remote)) {
      conflicts.push({
        field: path.split('.')[1] ?? path,
        localValue: local,
        remoteValue: remote,
        path,
      });
    }
  }

  /**
   * Detect prompt-specific conflicts.
   * Builds local prompt from sections and compares with remote prompt.
   */
  private static async detectPromptConflict(
    localConfig: AgentConfig,
    remoteLlmConfig: unknown,
    promptsDir: string
  ): Promise<Result<PromptConflict | undefined, Error>> {
    try {
      const remoteLlm = remoteLlmConfig as any;
      const remotePrompt = (remoteLlm.general_prompt as string) ?? '';

      // Build local prompt
      let localPrompt: string;
      if (localConfig.llm_config.prompt_config !== undefined) {
        const buildResult = await PromptBuilder.build(
          promptsDir,
          localConfig.llm_config.prompt_config
        );
        if (!buildResult.success) {
          return buildResult;
        }
        localPrompt = buildResult.value;
      } else if (localConfig.llm_config.general_prompt !== undefined) {
        localPrompt = localConfig.llm_config.general_prompt;
      } else {
        return Ok(undefined);
      }

      // Hash both prompts
      const localHashResult = RetellConfigHasher.calculatePromptHash(localPrompt);
      const remoteHashResult = RetellConfigHasher.calculatePromptHash(remotePrompt);

      if (!localHashResult.success) {
        return localHashResult;
      }
      if (!remoteHashResult.success) {
        return remoteHashResult;
      }

      const localHash = localHashResult.value;
      const remoteHash = remoteHashResult.value;

      // If prompts differ, return conflict details
      if (!HashCalculator.compareHashes(localHash, remoteHash)) {
        return Ok({
          field: 'prompt',
          localPrompt,
          remotePrompt,
          localHash,
          remoteHash,
        });
      }

      return Ok(undefined);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to detect prompt conflict'));
    }
  }
}
