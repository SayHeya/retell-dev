/**
 * Bulk create command - Create multiple agents from a template
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentConfig } from '@heya/retell.controllers';
import { WorkspaceConfigService } from '@heya/retell.controllers';
import { handleError } from '../errors/cli-error-handler';

// Dynamic import for inquirer (ESM module)
type InquirerModule = typeof import('inquirer');
let inquirer: Awaited<InquirerModule>['default'] | null = null;
async function getInquirer(): Promise<Awaited<InquirerModule>['default']> {
  if (inquirer === null) {
    inquirer = (await import('inquirer')).default;
  }
  return inquirer;
}

export const bulkCreateCommand = new Command('bulk-create')
  .description('Create multiple agents from a template')
  .option('-c, --count <number>', 'Number of agents to create', '10')
  .option('-t, --template <template>', 'Template to use', 'basic')
  .option('-p, --prefix <prefix>', 'Agent name prefix', 'agent')
  .option('--path <path>', 'Path to agents directory', './agents')
  .option('--templates <path>', 'Path to templates directory', './templates')
  .option('--skip-validation', 'Skip workspace validation', false)
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .action(async (options: BulkCreateOptions) => {
    try {
      await executeBulkCreate(options);
    } catch (error) {
      handleError(error);
    }
  });

type BulkCreateOptions = {
  count: string;
  template: string;
  prefix: string;
  path: string;
  templates: string;
  skipValidation: boolean;
  yes: boolean;
};

async function executeBulkCreate(options: BulkCreateOptions): Promise<void> {
  console.log('\n🚀 Bulk Agent Creation\n');

  // Parse count
  const count = parseInt(options.count, 10);
  if (Number.isNaN(count) || count < 1 || count > 10000) {
    throw new Error('Count must be a number between 1 and 10000');
  }

  // Validate workspace configuration (unless skipped)
  if (!options.skipValidation) {
    console.log('Validating workspace configuration...');
    const workspaceExists = await WorkspaceConfigService.exists();
    if (workspaceExists !== true) {
      throw new Error(
        "workspaces.json not found. Please run 'retell workspace init' first.\n" +
          'Or use --skip-validation to bypass this check.'
      );
    }

    // Validate it can be loaded
    const configResult = await WorkspaceConfigService.load();
    if (configResult.success !== true) {
      throw new Error(
        `Invalid workspace configuration: ${configResult.error.message}\n` +
          "Run 'retell workspace init --force' to regenerate."
      );
    }
    console.log('✓ Workspace configuration validated\n');
  }

  // Resolve paths
  const agentsPath = path.resolve(options.path);
  const templatesPath = path.resolve(options.templates);
  const templateFile = `${options.template}.json`;
  const templatePath = path.join(templatesPath, templateFile);

  // Check if agents directory exists
  try {
    await fs.access(agentsPath);
  } catch {
    console.log(`Creating agents directory: ${agentsPath}`);
    await fs.mkdir(agentsPath, { recursive: true });
  }

  // Load template
  console.log(`Loading template: ${templateFile}`);
  let templateConfig: AgentConfig;
  try {
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    templateConfig = JSON.parse(templateContent) as AgentConfig;
    console.log(`✓ Template loaded: ${templateConfig.agent_name || 'Unnamed'}\n`);
  } catch (error) {
    throw new Error(
      `Failed to load template '${templateFile}' from ${templatesPath}\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Generate agent names and check for conflicts
  const agentNames: string[] = [];
  const conflicts: string[] = [];

  for (let i = 1; i <= count; i++) {
    const agentName = `${options.prefix}-${String(i).padStart(3, '0')}`;
    agentNames.push(agentName);

    // Check if already exists
    const agentDir = path.join(agentsPath, agentName);
    try {
      await fs.access(agentDir);
      conflicts.push(agentName);
    } catch {
      // Good - doesn't exist
    }
  }

  // Show summary
  console.log('📋 Summary:');
  console.log(`   Template: ${options.template}`);
  console.log(`   Count: ${count} agents`);
  console.log(`   Prefix: ${options.prefix}`);
  console.log(`   Output: ${agentsPath}`);
  console.log(`   Names: ${agentNames[0]} ... ${agentNames[agentNames.length - 1]}`);

  if (conflicts.length > 0) {
    console.log(`\n⚠️  Warning: ${conflicts.length} agent(s) already exist and will be skipped:`);
    console.log(
      `   ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? ` ... and ${conflicts.length - 5} more` : ''}`
    );
  }

  // Confirm
  if (!options.yes) {
    const inq = await getInquirer();
    const result = (await inq.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Create ${count - conflicts.length} agent(s)?`,
        default: true,
      },
    ])) as { confirm: boolean };

    if (result.confirm !== true) {
      console.log('\n❌ Cancelled');
      process.exit(0);
    }
  }

  console.log('\n🏗️  Creating agents...\n');

  // Create agents
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ name: string; error: string }> = [];

  for (let i = 0; i < agentNames.length; i++) {
    const agentName = agentNames[i];
    if (agentName === null || agentName === undefined || agentName === '') {
      continue;
    } // Type guard for array access

    const agentNum = i + 1;

    try {
      const agentDir = path.join(agentsPath, agentName);

      // Check if exists (skip)
      try {
        await fs.access(agentDir);
        skipped++;
        if (skipped <= 3 || skipped % 10 === 0) {
          console.log(`[${agentNum}/${count}] ⏭️  Skipped ${agentName} (already exists)`);
        }
        continue;
      } catch {
        // Good - doesn't exist, create it
      }

      // Customize agent config
      const customAgentName = `${templateConfig.agent_name || 'Agent'} ${String(agentNum).padStart(3, '0')}`;

      const agentConfig: AgentConfig = {
        ...templateConfig,
        agent_name: customAgentName,
        llm_config: {
          ...templateConfig.llm_config,
          general_prompt:
            templateConfig.llm_config.general_prompt !== null &&
            templateConfig.llm_config.general_prompt !== undefined &&
            templateConfig.llm_config.general_prompt !== ''
              ? `You are ${customAgentName}. ${templateConfig.llm_config.general_prompt}`
              : templateConfig.llm_config.general_prompt,
        },
      };

      // Create directory structure
      await fs.mkdir(agentDir, { recursive: true });
      await fs.mkdir(path.join(agentDir, 'knowledge'), { recursive: true });

      // Write agent.json
      await fs.writeFile(
        path.join(agentDir, 'agent.json'),
        JSON.stringify(agentConfig, null, 2) + '\n',
        'utf-8'
      );

      // Write metadata stubs
      const emptyMetadata = {
        workspace: 'staging',
        agent_id: null,
        llm_id: null,
        kb_id: null,
        last_sync: null,
        config_hash: null,
        retell_version: null,
      };

      await fs.writeFile(
        path.join(agentDir, 'staging.json'),
        JSON.stringify({ ...emptyMetadata, workspace: 'staging' }, null, 2) + '\n',
        'utf-8'
      );

      await fs.writeFile(
        path.join(agentDir, 'production.json'),
        JSON.stringify({ ...emptyMetadata, workspace: 'production' }, null, 2) + '\n',
        'utf-8'
      );

      created++;

      // Progress updates (show first 3, then every 10)
      if (created <= 3 || created % 10 === 0 || created === count - skipped) {
        console.log(`[${agentNum}/${count}] ✅ Created ${agentName}`);
      }
    } catch (error) {
      failed++;
      errors.push({
        name: agentName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(
        `[${agentNum}/${count}] ❌ Failed ${agentName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Bulk Creation Summary');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${created}/${count}`);
  if (skipped > 0) {
    console.log(`⏭️  Skipped: ${skipped} (already existed)`);
  }
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
  }
  console.log(`📁 Location: ${agentsPath}`);
  console.log('='.repeat(60));

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.slice(0, 5).forEach(({ name, error }) => {
      console.log(`   ${name}: ${error}`);
    });
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more errors`);
    }
  }

  if (created > 0) {
    console.log('\n💡 Next steps:');
    console.log(`   1. Review agent configurations in ${agentsPath}`);
    console.log('   2. Customize agent.json files as needed');
    console.log('   3. Push agents to workspace:');
    console.log(`      retell push ${agentNames[0]} -w staging`);
    console.log('   4. Or push all at once (with rate limiting):');
    console.log(`      for dir in ${agentsPath}/${options.prefix}-*/; do`);
    console.log('        retell push "$(basename "$dir")" -w staging');
    console.log('        sleep 2  # Rate limiting');
    console.log('      done');
  }

  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}
