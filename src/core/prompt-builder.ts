import * as fs from 'fs/promises';
import * as path from 'path';
import type { PromptConfig } from '../types/agent.types';
import type { Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';

/**
 * Builder for composing prompts from sections with variable substitution.
 *
 * Variable substitution rules:
 * - Static variables: Replace {{var}} with actual value at build time
 * - OVERRIDE variables: Keep {{var}} for Retell to substitute at call time
 * - Dynamic variables: Keep {{var}} for extraction during call
 * - System variables: Keep {{var}} for Retell runtime substitution
 */
export class PromptBuilder {
  /**
   * Build final prompt from prompt configuration.
   * Loads section files, applies overrides, and substitutes static variables only.
   *
   * @param promptsDir - Base directory containing prompt section files
   * @param config - Prompt configuration with sections and variables
   * @returns Result containing built prompt string or error
   */
  static async build(promptsDir: string, config: PromptConfig): Promise<Result<string, Error>> {
    try {
      const sections = config.sections ?? [];
      const overrides = config.overrides ?? {};
      const variables = config.variables ?? {};
      const dynamicVariables = config.dynamic_variables ?? {};

      // Build list of sections to compose
      const sectionContents: string[] = [];

      for (const sectionId of sections) {
        let content: string;

        // Check if there's an override for this section
        if (overrides[sectionId] !== undefined) {
          content = overrides[sectionId];
        } else {
          // Load section from file
          const sectionPath = path.join(promptsDir, `${sectionId}.txt`);
          const fileExists = await this.fileExists(sectionPath);

          if (!fileExists) {
            return Err(new Error(`Prompt section not found: ${sectionId} at ${sectionPath}`));
          }

          content = await fs.readFile(sectionPath, 'utf-8');
        }

        sectionContents.push(content);
      }

      // Join sections with double newline
      let prompt = sectionContents.join('\n\n');

      // Substitute only static variables (not OVERRIDE, not dynamic, not system)
      prompt = this.substituteStaticVariables(prompt, variables, dynamicVariables);

      return Ok(prompt);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to build prompt'));
    }
  }

  /**
   * Extract all {{variable}} references from text.
   * Returns unique variable names.
   *
   * @param text - Text containing {{variable}} references
   * @returns Array of unique variable names
   */
  static extractVariables(text: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = text.matchAll(regex);
    const variables = new Set<string>();

    for (const match of matches) {
      if (match[1] !== undefined) {
        variables.add(match[1]);
      }
    }

    return Array.from(variables);
  }

  /**
   * Substitute only static variables in the prompt.
   * Keeps OVERRIDE, dynamic, and system variables as {{var}} tags.
   *
   * @param prompt - Prompt text with {{variable}} references
   * @param variables - Variables config (may contain static values or "OVERRIDE")
   * @param dynamicVariables - Dynamic variables config
   * @returns Prompt with only static variables substituted
   */
  private static substituteStaticVariables(
    prompt: string,
    variables: Readonly<Record<string, string>>,
    dynamicVariables: Readonly<Record<string, unknown>>
  ): string {
    let result = prompt;

    // Extract all variables from prompt
    const allVars = this.extractVariables(prompt);

    for (const varName of allVars) {
      const varValue = variables[varName];

      // Only substitute if:
      // 1. Variable is defined in variables config
      // 2. Value is NOT "OVERRIDE"
      // 3. Variable is NOT in dynamic_variables
      const isDynamic = dynamicVariables[varName] !== undefined;
      const isOverride = varValue === 'OVERRIDE';
      const isStatic = varValue !== undefined && !isOverride && !isDynamic;

      if (isStatic) {
        // Replace all occurrences of {{varName}} with the actual value
        const regex = new RegExp(`\\{\\{${this.escapeRegex(varName)}\\}\\}`, 'g');
        result = result.replace(regex, varValue);
      }
      // Otherwise, keep the {{varName}} tag in the prompt
    }

    return result;
  }

  /**
   * Escape special regex characters in a string.
   *
   * @param str - String to escape
   * @returns Escaped string safe for use in RegExp
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if a file exists.
   *
   * @param filePath - Path to file
   * @returns true if file exists, false otherwise
   */
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
