import type { AgentConfig, LlmId } from '../types/agent.types';
import type { Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';
import { PromptBuilder } from './prompt-builder';
import { VariableResolver } from './variable-resolver';

/**
 * Retell LLM configuration (API format for creating/updating LLM)
 */
export type RetellLlmConfig = {
  readonly start_speaker: 'user' | 'agent';
  readonly model?: string;
  readonly temperature?: number;
  readonly general_prompt?: string;
  readonly begin_message?: string;
  readonly general_tools?: ReadonlyArray<unknown>;
  readonly default_dynamic_variables?: Record<string, string>;
};

/**
 * Retell Agent configuration (API format for creating/updating Agent)
 */
export type RetellAgentConfig = {
  readonly agent_name?: string;
  readonly voice_id: string;
  readonly voice_speed?: number;
  readonly voice_temperature?: number;
  readonly responsiveness?: number;
  readonly interruption_sensitivity?: number;
  readonly language?: string;
  readonly enable_backchannel?: boolean;
  readonly backchannel_frequency?: number;
  readonly ambient_sound?: string;
  readonly boosted_keywords?: ReadonlyArray<string>;
  readonly pronunciation_dictionary?: ReadonlyArray<{
    readonly word: string;
    readonly pronunciation: string;
  }>;
  readonly normalize_for_speech?: boolean;
  readonly webhook_url?: string;
  readonly response_engine: {
    readonly type: 'retell-llm';
    readonly llm_id: string;
  };
  readonly post_call_analysis_data?: ReadonlyArray<{
    readonly name: string;
    readonly type: 'string' | 'number' | 'boolean' | 'json';
    readonly description: string;
  }>;
};

/**
 * Transformer for converting our agent.json format to Retell's API format.
 *
 * NOTE: Retell's API structure separates LLM and Agent:
 * 1. Create/Update LLM (contains model, prompt, temperature, etc.)
 * 2. Create/Update Agent (contains voice, language, references LLM by ID)
 *
 * Responsibilities:
 * - Build final prompt from sections (if using prompt_config)
 * - Substitute static variables only
 * - Validate all variables are accounted for
 * - Split config into LLM and Agent parts
 */
export class AgentTransformer {
  /**
   * Transform our agent configuration to Retell's LLM format.
   *
   * @param config - Our agent configuration
   * @param promptsDir - Directory containing prompt section files
   * @returns Result containing Retell LLM config or error
   */
  static async transformToLlm(
    config: AgentConfig,
    promptsDir: string
  ): Promise<Result<RetellLlmConfig, Error>> {
    try {
      let generalPrompt: string;

      // Build prompt from sections or use general_prompt directly
      if (config.llm_config.prompt_config !== undefined) {
        const promptConfig = config.llm_config.prompt_config;

        // Build prompt with variable substitution
        const buildResult = await PromptBuilder.build(promptsDir, promptConfig);
        if (!buildResult.success) {
          return buildResult;
        }
        generalPrompt = buildResult.value;

        // Validate all variables are accounted for
        const validation = VariableResolver.validate(generalPrompt, promptConfig);
        if (!validation.success) {
          return Err(new Error(`Variable validation failed: ${validation.errors.join(', ')}`));
        }
      } else if (config.llm_config.general_prompt !== undefined) {
        generalPrompt = config.llm_config.general_prompt;
      } else {
        return Err(
          new Error('Either prompt_config or general_prompt must be defined in llm_config')
        );
      }

      // Build Retell LLM config
      const retellLlmConfig: RetellLlmConfig = {
        start_speaker: 'agent', // Default to agent starting
        model: config.llm_config.model,
        temperature: config.llm_config.temperature,
        general_prompt: generalPrompt,
        begin_message: config.llm_config.begin_message,
        general_tools: config.llm_config.tools,
      };

      return Ok(retellLlmConfig);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to transform to LLM config'));
    }
  }

  /**
   * Transform our agent configuration to Retell's Agent format.
   * Requires an LLM ID from a previously created LLM.
   *
   * @param config - Our agent configuration
   * @param llmId - LLM ID from Retell
   * @returns Result containing Retell agent config or error
   */
  static transformToAgent(config: AgentConfig, llmId: LlmId): Result<RetellAgentConfig, Error> {
    try {
      // Build Retell agent config
      const retellAgentConfig: RetellAgentConfig = {
        // Agent-level fields
        agent_name: config.agent_name,
        voice_id: config.voice_id,
        voice_speed: config.voice_speed,
        voice_temperature: config.voice_temperature,
        responsiveness: config.responsiveness,
        interruption_sensitivity: config.interruption_sensitivity,
        language: config.language,
        enable_backchannel: config.enable_backchannel,
        backchannel_frequency: config.backchannel_frequency,
        ambient_sound: config.ambient_sound,
        boosted_keywords: config.boosted_keywords,
        pronunciation_dictionary: config.pronunciation_dictionary,
        normalize_for_speech: config.normalize_for_speech,
        webhook_url: config.webhook_url,

        // Response engine (references the LLM)
        response_engine: {
          type: 'retell-llm',
          llm_id: llmId,
        },

        // Post-call analysis
        post_call_analysis_data: this.transformPostCallAnalysis(config.post_call_analysis_data),
      };

      return Ok(retellAgentConfig);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to transform to agent config'));
    }
  }

  /**
   * Legacy method for backward compatibility.
   * @deprecated Use transformToLlm and transformToAgent instead
   */
  static async transform(
    _config: AgentConfig,
    _promptsDir: string,
    _llmId?: LlmId
  ): Promise<Result<never, Error>> {
    return Err(
      new Error(
        'AgentTransformer.transform() is deprecated. Use transformToLlm() and transformToAgent() instead.'
      )
    );
  }

  /**
   * Transform post-call analysis data to Retell format.
   * Currently identical, but isolated for future changes.
   *
   * @param data - Post-call analysis data from our config
   * @returns Transformed data for Retell
   */
  static transformPostCallAnalysis(
    data:
      | ReadonlyArray<{
          readonly name: string;
          readonly type: 'string' | 'number' | 'boolean' | 'json';
          readonly description: string;
        }>
      | undefined
  ):
    | ReadonlyArray<{
        readonly name: string;
        readonly type: 'string' | 'number' | 'boolean' | 'json';
        readonly description: string;
      }>
    | undefined {
    return data;
  }
}
