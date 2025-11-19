import { createHash } from 'crypto';
import type { Hash, Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';

/**
 * Hash calculator for Retell's complete agent configuration.
 *
 * This hasher creates a hash of the COMPLETE configuration that exists on Retell's side,
 * combining both the Agent and LLM configurations. This hash should match the config_hash
 * we store in staging.json/production.json after a successful push.
 *
 * The hash includes:
 * - All agent-level fields (voice, language, etc.)
 * - All LLM fields (model, temperature, etc.)
 * - The FINAL prompt string (not the prompt_config sections)
 */
export class RetellConfigHasher {
  /**
   * Calculate hash of complete Retell configuration (Agent + LLM).
   *
   * This creates a hash of the configuration as it exists on Retell's side,
   * which is what we compare against our stored config_hash.
   *
   * @param agentConfig - Retell agent configuration
   * @param llmConfig - Retell LLM configuration
   * @returns Result containing the hash prefixed with "sha256:" or an error
   */
  static calculateRetellConfigHash(agentConfig: unknown, llmConfig: unknown): Result<Hash, Error> {
    try {
      // Build combined config object that represents what's on Retell
      const combinedConfig = {
        // Agent fields
        agent: this.extractAgentFields(agentConfig),
        // LLM fields
        llm: this.extractLlmFields(llmConfig),
      };

      // Create canonical JSON and hash
      const canonical = this.canonicalizeJSON(combinedConfig);
      const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
      return Ok(`sha256:${hash}` as Hash);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error('Failed to calculate Retell config hash')
      );
    }
  }

  /**
   * Calculate hash of just the LLM configuration.
   * Useful for comparing only prompt changes.
   *
   * @param llmConfig - Retell LLM configuration
   * @returns Result containing the hash or an error
   */
  static calculateLlmHash(llmConfig: unknown): Result<Hash, Error> {
    try {
      const llmFields = this.extractLlmFields(llmConfig);
      const canonical = this.canonicalizeJSON(llmFields);
      const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
      return Ok(`sha256:${hash}` as Hash);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to calculate LLM hash'));
    }
  }

  /**
   * Calculate hash of just the prompt string.
   * Used for prompt-specific conflict detection.
   *
   * @param prompt - The prompt string
   * @returns Result containing the hash or an error
   */
  static calculatePromptHash(prompt: string): Result<Hash, Error> {
    try {
      // Normalize whitespace for consistent hashing
      const normalized = this.normalizePrompt(prompt);
      const hash = createHash('sha256').update(normalized, 'utf8').digest('hex');
      return Ok(`sha256:${hash}` as Hash);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to calculate prompt hash'));
    }
  }

  /**
   * Extract relevant agent fields for hashing.
   * Excludes metadata fields that don't affect functionality.
   */
  private static extractAgentFields(agentConfig: unknown): Record<string, unknown> {
    if (typeof agentConfig !== 'object' || agentConfig === null) {
      return {};
    }

    const config = agentConfig as any;

    return {
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
      post_call_analysis_data: config.post_call_analysis_data,
      // Exclude: agent_id, last_modification_timestamp, account_id, etc.
    };
  }

  /**
   * Extract relevant LLM fields for hashing.
   * Excludes metadata fields that don't affect functionality.
   */
  private static extractLlmFields(llmConfig: unknown): Record<string, unknown> {
    if (typeof llmConfig !== 'object' || llmConfig === null) {
      return {};
    }

    const config = llmConfig as any;

    return {
      model: config.model,
      temperature: config.temperature,
      general_prompt: config.general_prompt,
      begin_message: config.begin_message,
      general_tools: config.general_tools,
      start_speaker: config.start_speaker,
      default_dynamic_variables: config.default_dynamic_variables,
      // Exclude: llm_id, last_modification_timestamp, etc.
    };
  }

  /**
   * Normalize prompt for consistent hashing.
   * Handles different line endings and trailing whitespace.
   */
  private static normalizePrompt(prompt: string): string {
    return prompt
      .replace(/\r\n/g, '\n') // Normalize line endings
      .trim(); // Remove leading/trailing whitespace
  }

  /**
   * Convert an object to canonical JSON string.
   * Sorts all keys recursively to ensure consistent hash generation.
   */
  private static canonicalizeJSON(obj: unknown): string {
    if (obj === null) {
      return 'null';
    }

    if (obj === undefined) {
      return 'undefined';
    }

    if (typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      const items = obj.map((item) => this.canonicalizeJSON(item));
      return `[${items.join(',')}]`;
    }

    // Sort object keys and recursively canonicalize values
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((key) => {
      const value = (obj as Record<string, unknown>)[key];
      // Skip undefined values
      if (value === undefined) {
        return null;
      }
      return `"${key}":${this.canonicalizeJSON(value)}`;
    });

    // Filter out null pairs (from undefined values)
    const validPairs = pairs.filter((p) => p !== null);
    return `{${validPairs.join(',')}}`;
  }
}
