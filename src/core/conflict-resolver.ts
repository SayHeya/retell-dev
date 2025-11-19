import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentConfig } from '../types/agent.types';
import type { Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';
import type { FieldConflict, PromptConflict } from './conflict-detector';

/**
 * Resolution strategy for conflicts
 */
export type ResolutionStrategy =
  | 'use-local' // Overwrite remote with local (force push)
  | 'use-remote' // Overwrite local with remote (pull)
  | 'manual'; // User will resolve manually

/**
 * Result of conflict resolution
 */
export type ResolutionResult = {
  readonly strategy: ResolutionStrategy;
  readonly resolvedConfig?: AgentConfig;
  readonly message: string;
};

/**
 * Resolves conflicts between local and remote agent configurations.
 *
 * Resolution strategies:
 * - use-local: Force push local changes to remote (overwrites remote)
 * - use-remote: Pull remote changes to local (overwrites local)
 * - manual: Display conflicts and let user manually edit
 */
export class ConflictResolver {
  /**
   * Resolve conflicts using a specific strategy.
   *
   * @param localConfig - Local agent configuration
   * @param remoteAgentConfig - Remote agent configuration from Retell
   * @param remoteLlmConfig - Remote LLM configuration from Retell
   * @param strategy - Resolution strategy to use
   * @param agentPath - Path to agent directory (for writing resolved config)
   * @returns Result containing resolution result or error
   */
  static async resolve(
    localConfig: AgentConfig,
    remoteAgentConfig: unknown,
    remoteLlmConfig: unknown,
    strategy: ResolutionStrategy,
    agentPath: string
  ): Promise<Result<ResolutionResult, Error>> {
    try {
      switch (strategy) {
        case 'use-local':
          return this.resolveUseLocal(localConfig);

        case 'use-remote':
          return await this.resolveUseRemote(
            localConfig,
            remoteAgentConfig,
            remoteLlmConfig,
            agentPath
          );

        case 'manual':
          return this.resolveManual();

        default: {
          const exhaustiveCheck: never = strategy;
          return Err(new Error(`Unknown resolution strategy: ${exhaustiveCheck}`));
        }
      }
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to resolve conflict'));
    }
  }

  /**
   * Resolve using local configuration (force push).
   * No changes to local config - will force push to remote.
   */
  private static resolveUseLocal(localConfig: AgentConfig): Result<ResolutionResult, Error> {
    return Ok({
      strategy: 'use-local',
      resolvedConfig: localConfig,
      message:
        'Local configuration will be used. Run push command with --force to overwrite remote.',
    });
  }

  /**
   * Resolve using remote configuration (pull).
   * Updates local agent.json with remote values.
   */
  private static async resolveUseRemote(
    localConfig: AgentConfig,
    remoteAgentConfig: unknown,
    remoteLlmConfig: unknown,
    agentPath: string
  ): Promise<Result<ResolutionResult, Error>> {
    try {
      const remoteAgent = remoteAgentConfig as any;
      const remoteLlm = remoteLlmConfig as any;

      // Build merged config with remote values
      const resolvedConfig: AgentConfig = {
        // Agent-level fields from remote
        agent_name: (remoteAgent.agent_name as string) ?? localConfig.agent_name,
        voice_id: (remoteAgent.voice_id as string) ?? localConfig.voice_id,
        voice_speed: (remoteAgent.voice_speed as number) ?? localConfig.voice_speed,
        voice_temperature:
          (remoteAgent.voice_temperature as number) ?? localConfig.voice_temperature,
        responsiveness: (remoteAgent.responsiveness as number) ?? localConfig.responsiveness,
        interruption_sensitivity:
          (remoteAgent.interruption_sensitivity as number) ?? localConfig.interruption_sensitivity,
        language: (remoteAgent.language as string) ?? localConfig.language,
        enable_backchannel:
          (remoteAgent.enable_backchannel as boolean) ?? localConfig.enable_backchannel,
        backchannel_frequency:
          (remoteAgent.backchannel_frequency as number) ?? localConfig.backchannel_frequency,
        ambient_sound: remoteAgent.ambient_sound as 'office' | 'cafe' | 'none' | undefined,
        boosted_keywords: remoteAgent.boosted_keywords as string[] | undefined,
        pronunciation_dictionary: remoteAgent.pronunciation_dictionary as
          | Array<{ word: string; pronunciation: string }>
          | undefined,
        normalize_for_speech:
          (remoteAgent.normalize_for_speech as boolean) ?? localConfig.normalize_for_speech,
        webhook_url: (remoteAgent.webhook_url as string) ?? localConfig.webhook_url,
        post_call_analysis_data: remoteAgent.post_call_analysis_data as
          | Array<{
              name: string;
              type: 'string' | 'number' | 'boolean';
              description: string;
            }>
          | undefined,

        // LLM config from remote
        llm_config: {
          model: (remoteLlm.model as string) ?? localConfig.llm_config.model,
          temperature: (remoteLlm.temperature as number) ?? localConfig.llm_config.temperature,
          begin_message:
            (remoteLlm.begin_message as string) ?? localConfig.llm_config.begin_message,
          tools: (remoteLlm.general_tools as unknown[]) ?? localConfig.llm_config.tools,

          // For prompt: keep prompt_config if it exists locally, otherwise use general_prompt
          prompt_config: localConfig.llm_config.prompt_config,
          general_prompt: localConfig.llm_config.prompt_config
            ? undefined
            : ((remoteLlm.general_prompt as string) ?? localConfig.llm_config.general_prompt),
        },
      };

      // Write resolved config to agent.json
      const configPath = path.join(agentPath, 'agent.json');
      await fs.writeFile(configPath, JSON.stringify(resolvedConfig, null, 2), 'utf-8');

      return Ok({
        strategy: 'use-remote',
        resolvedConfig,
        message:
          'Remote configuration has been pulled and saved to agent.json. Review the changes and run push to sync.',
      });
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error('Failed to resolve using remote config')
      );
    }
  }

  /**
   * Manual resolution - just inform user to resolve manually.
   */
  private static resolveManual(): Result<ResolutionResult, Error> {
    return Ok({
      strategy: 'manual',
      message:
        'Conflicts detected. Please review the differences and manually edit agent.json, then run push.',
    });
  }

  /**
   * Format field conflicts for display.
   */
  static formatFieldConflicts(conflicts: ReadonlyArray<FieldConflict>): string {
    const lines: string[] = [];

    lines.push('Field Conflicts:\n');

    for (const conflict of conflicts) {
      lines.push(`  ${conflict.path}:`);
      lines.push(`    Local:  ${this.formatValue(conflict.localValue)}`);
      lines.push(`    Remote: ${this.formatValue(conflict.remoteValue)}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format prompt conflict for display with text diff preview.
   */
  static formatPromptConflict(conflict: PromptConflict): string {
    const lines: string[] = [];

    lines.push('Prompt Conflict:\n');
    lines.push(`  Local Hash:  ${conflict.localHash}`);
    lines.push(`  Remote Hash: ${conflict.remoteHash}`);
    lines.push('');

    // Show first 500 characters of each prompt for preview
    const localPreview = this.truncatePrompt(conflict.localPrompt, 500);
    const remotePreview = this.truncatePrompt(conflict.remotePrompt, 500);

    lines.push('  Local Prompt (preview):');
    lines.push(this.indent(localPreview, 4));
    lines.push('');
    lines.push('  Remote Prompt (preview):');
    lines.push(this.indent(remotePreview, 4));
    lines.push('');

    if (conflict.localPrompt.length > 500 || conflict.remotePrompt.length > 500) {
      lines.push('  (Showing first 500 characters. Use --full to see complete prompts)');
    }

    return lines.join('\n');
  }

  /**
   * Generate a detailed diff view between prompts.
   * Shows line-by-line comparison.
   */
  static generatePromptDiff(localPrompt: string, remotePrompt: string): string {
    const localLines = localPrompt.split('\n');
    const remoteLines = remotePrompt.split('\n');
    const maxLines = Math.max(localLines.length, remoteLines.length);

    const lines: string[] = [];
    lines.push('Detailed Prompt Diff:\n');
    lines.push('  LOCAL                                  | REMOTE');
    lines.push('  ' + '-'.repeat(80));

    for (let i = 0; i < maxLines; i++) {
      const localLine = localLines[i] ?? '';
      const remoteLine = remoteLines[i] ?? '';

      // Highlight different lines
      const marker = localLine === remoteLine ? '  ' : '> ';

      lines.push(
        `${marker}${this.padRight(this.truncate(localLine, 35), 40)}| ${this.truncate(remoteLine, 35)}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Format a value for display.
   */
  private static formatValue(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Truncate prompt to specified length with ellipsis.
   */
  private static truncatePrompt(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }
    return prompt.substring(0, maxLength) + '\n... (truncated)';
  }

  /**
   * Truncate string to max length with ellipsis.
   */
  private static truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Indent text by specified spaces.
   */
  private static indent(text: string, spaces: number): string {
    const indent = ' '.repeat(spaces);
    return text
      .split('\n')
      .map((line) => indent + line)
      .join('\n');
  }

  /**
   * Pad string to right with spaces.
   */
  private static padRight(str: string, length: number): string {
    if (str.length >= length) {
      return str;
    }
    return str + ' '.repeat(length - str.length);
  }
}
