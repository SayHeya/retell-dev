import type {
  PromptConfig,
  StaticVariable,
  OverrideVariable,
  DynamicVariable,
  SystemVariable,
} from '../types/agent.types';
import { PromptBuilder } from './prompt-builder';

/**
 * Result of variable categorization.
 */
export type CategorizedVariables = {
  readonly static: ReadonlyArray<StaticVariable>;
  readonly override: ReadonlyArray<OverrideVariable>;
  readonly dynamic: ReadonlyArray<DynamicVariable>;
  readonly system: ReadonlyArray<SystemVariable>;
};

/**
 * Result of variable validation.
 */
export type ValidationResult = {
  readonly success: boolean;
  readonly errors: ReadonlyArray<string>;
};

/**
 * Resolver for categorizing and validating variables in prompts.
 *
 * Categorizes variables into:
 * - Static: Defined in variables config with value != "OVERRIDE"
 * - Override: Defined in variables config with value = "OVERRIDE"
 * - Dynamic: Defined in dynamic_variables config
 * - System: Not defined in config and matches system variable patterns
 */
export class VariableResolver {
  /**
   * Common Retell system variables.
   */
  private static readonly SYSTEM_VARIABLES = new Set([
    'user_number',
    'call_id',
    'agent_id',
    'retell_llm_dynamic_variables',
  ]);

  /**
   * Categorize all variables in a prompt text.
   * Only includes variables that are actually used in the prompt.
   *
   * @param promptText - The composed prompt text with {{variable}} references
   * @param config - Prompt configuration
   * @returns Categorized variables
   */
  static categorize(promptText: string, config: PromptConfig): CategorizedVariables {
    const variables = config.variables ?? {};
    const dynamicVariables = config.dynamic_variables ?? {};

    // Extract all unique variables from prompt
    const usedVariables = PromptBuilder.extractVariables(promptText);

    const staticVars: StaticVariable[] = [];
    const overrideVars: OverrideVariable[] = [];
    const dynamicVars: DynamicVariable[] = [];
    const systemVars: SystemVariable[] = [];

    for (const varName of usedVariables) {
      // Check if it's a static variable
      const varValue = variables[varName];
      if (varValue !== undefined && varValue !== 'OVERRIDE') {
        staticVars.push({
          type: 'static',
          name: varName,
          value: varValue,
        });
        continue;
      }

      // Check if it's an override variable
      if (varValue === 'OVERRIDE') {
        overrideVars.push({
          type: 'override',
          name: varName,
        });
        continue;
      }

      // Check if it's a dynamic variable
      const dynamicConfig = dynamicVariables[varName];
      if (dynamicConfig !== undefined) {
        dynamicVars.push({
          type: 'dynamic',
          name: varName,
          valueType: dynamicConfig.type,
          description: dynamicConfig.description,
        });
        continue;
      }

      // Check if it's a system variable
      if (this.isSystemVariable(varName)) {
        systemVars.push({
          type: 'system',
          name: varName,
        });
        continue;
      }

      // If not defined anywhere, treat as system variable
      // (allows for flexibility with Retell's runtime variables)
      systemVars.push({
        type: 'system',
        name: varName,
      });
    }

    return {
      static: staticVars,
      override: overrideVars,
      dynamic: dynamicVars,
      system: systemVars,
    };
  }

  /**
   * Validate that all variables in prompt are properly defined.
   *
   * Rules:
   * - Static variables must have value in variables config
   * - Override variables must have "OVERRIDE" in variables config
   * - Dynamic variables must be defined in dynamic_variables config
   * - System variables are always valid
   *
   * @param promptText - The composed prompt text
   * @param config - Prompt configuration
   * @returns Validation result with errors if any
   */
  static validate(promptText: string, config: PromptConfig): ValidationResult {
    const errors: string[] = [];
    const unaccounted = this.getUnaccountedVariables(promptText, config);

    for (const varName of unaccounted) {
      errors.push(
        `Variable "${varName}" is used in prompt but not defined in variables or dynamic_variables`
      );
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Get list of variables used in prompt but not defined in config.
   * Excludes system variables.
   *
   * @param promptText - The composed prompt text
   * @param config - Prompt configuration
   * @returns Array of unaccounted variable names
   */
  static getUnaccountedVariables(promptText: string, config: PromptConfig): string[] {
    const variables = config.variables ?? {};
    const dynamicVariables = config.dynamic_variables ?? {};

    const usedVariables = PromptBuilder.extractVariables(promptText);
    const unaccounted: string[] = [];

    for (const varName of usedVariables) {
      const isInVariables = variables[varName] !== undefined;
      const isInDynamic = dynamicVariables[varName] !== undefined;
      const isSystem = this.isSystemVariable(varName);

      if (!isInVariables && !isInDynamic && !isSystem) {
        unaccounted.push(varName);
      }
    }

    return unaccounted;
  }

  /**
   * Check if a variable name matches a known system variable pattern.
   *
   * System variables include:
   * - current_time_* (e.g., current_time_UTC, current_time_America/New_York)
   * - current_date_* (e.g., current_date_UTC)
   * - Retell built-ins (user_number, call_id, agent_id, etc.)
   *
   * @param varName - Variable name to check
   * @returns true if variable is a system variable
   */
  static isSystemVariable(varName: string): boolean {
    // Check known Retell system variables
    if (this.SYSTEM_VARIABLES.has(varName)) {
      return true;
    }

    // Check current_time_* pattern
    if (varName.startsWith('current_time_')) {
      return true;
    }

    // Check current_date_* pattern
    if (varName.startsWith('current_date_')) {
      return true;
    }

    return false;
  }
}
