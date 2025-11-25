/**
 * Update command - Update agent configuration fields via CLI.
 *
 * Allows updating any field in agent.json through the command line,
 * including nested fields like llm_config.temperature.
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AgentConfigLoader, AgentConfigSchema } from '@heya/retell.controllers';
import { handleError } from '../errors/cli-error-handler';

export const updateCommand = new Command('update')
  .description('Update agent configuration fields')
  .argument('<agent-name>', 'Name of the agent to update')
  .argument(
    '<field>',
    'Field to update (supports dot notation for nested fields, e.g., llm_config.temperature)'
  )
  .argument('<value>', 'New value for the field')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .option('--type <type>', 'Type of value (string|number|boolean|json|array)', 'auto')
  .action(async (agentName: string, field: string, value: string, options: UpdateOptions) => {
    try {
      await executeUpdate(agentName, field, value, options);
    } catch (error) {
      handleError(error);
    }
  });

type UpdateOptions = {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array' | 'auto';
};

/**
 * Parse value based on type hint
 */
function parseValue(value: string, type: UpdateOptions['type']): unknown {
  // Auto-detect type if not specified
  if (type === 'auto') {
    // Try boolean
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }

    // Try number
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return Number(value);
    }

    // Try JSON
    if (
      (value.startsWith('{') && value.endsWith('}')) ||
      (value.startsWith('[') && value.endsWith(']'))
    ) {
      try {
        return JSON.parse(value);
      } catch {
        // Fall through to string
      }
    }

    // Default to string
    return value;
  }

  // Explicit type conversion
  switch (type) {
    case 'string':
      return value;
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${value}`);
      }
      return num;
    }
    case 'boolean':
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      throw new Error(`Invalid boolean: ${value}. Use 'true' or 'false'`);
    case 'json':
    case 'array':
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : error}`);
      }
    default:
      return value;
  }
}

/**
 * Set a nested field in an object using dot notation
 */
function setNestedField(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  // Navigate to the parent of the target field
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined) {
      continue;
    }

    if (!(part in current)) {
      current[part] = {};
    }

    const next = current[part];
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      throw new Error(
        `Cannot set field '${path}': '${parts.slice(0, i + 1).join('.')}' is not an object`
      );
    }
    current = next as Record<string, unknown>;
  }

  // Set the final field
  const lastPart = parts[parts.length - 1];
  if (lastPart === undefined) {
    throw new Error(`Invalid field path: ${path}`);
  }
  current[lastPart] = value;
}

/**
 * Get a nested field value from an object using dot notation
 */
function getNestedField(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

async function executeUpdate(
  agentName: string,
  field: string,
  value: string,
  options: UpdateOptions
): Promise<void> {
  console.log(`\nUpdating agent '${agentName}'...\n`);

  const agentPath = path.resolve(options.path, agentName);
  const agentJsonPath = path.join(agentPath, 'agent.json');

  // 1. Load current agent config
  console.log('Loading current configuration...');
  const configResult = await AgentConfigLoader.load(agentPath);
  if (!configResult.success) {
    throw new Error(`Failed to load agent config: ${configResult.error.message}`);
  }
  const currentConfig = configResult.value as Record<string, unknown>;

  // 2. Get current value
  const oldValue = getNestedField(currentConfig, field);
  console.log(`Current value of '${field}':`, JSON.stringify(oldValue, null, 2));

  // 3. Parse new value
  const parsedValue = parseValue(value, options.type);
  console.log(`New value:`, JSON.stringify(parsedValue, null, 2));
  console.log(`Type:`, typeof parsedValue);

  // 4. Update the field
  setNestedField(currentConfig, field, parsedValue);

  // 5. Validate the updated config
  console.log('\nValidating updated configuration...');
  const validationResult = AgentConfigSchema.safeParse(currentConfig);
  if (!validationResult.success) {
    const errors = validationResult.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Validation failed:\n${errors}`);
  }
  console.log('✓ Configuration is valid');

  // 6. Write updated config back to file
  console.log('\nSaving updated configuration...');
  await fs.writeFile(agentJsonPath, JSON.stringify(currentConfig, null, 2) + '\n', 'utf-8');

  console.log(`\n✓ Successfully updated '${field}' in agent '${agentName}'`);
  console.log(`  Old value: ${JSON.stringify(oldValue)}`);
  console.log(`  New value: ${JSON.stringify(parsedValue)}`);
  console.log(`\nNote: Run 'retell push ${agentName}' to sync changes to Retell workspace.`);
}
