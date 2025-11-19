/**
 * Init command - Create a new agent from a template.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentConfig } from '../../types/agent.types';

// Dynamic import for inquirer (ESM module)
type InquirerModule = Awaited<typeof import('inquirer')>['default'];
let inquirer: InquirerModule | null = null;
async function getInquirer(): Promise<InquirerModule> {
  if (inquirer === null) {
    inquirer = (await import('inquirer')).default;
  }
  return inquirer;
}

export const initCommand = new Command('init')
  .description('Create a new agent from a template')
  .argument('[agent-name]', 'Name of the agent to create')
  .option('-t, --template <template>', 'Template to use (basic, customer-service, sales)')
  .option('-p, --path <path>', 'Path to agents directory', './agents')
  .option('--templates <path>', 'Path to templates directory', './templates')
  .option('--skip-prompts', 'Skip customization prompts', false)
  .action(async (agentName: string | undefined, options: InitOptions) => {
    try {
      await executeInit(agentName, options);
    } catch (error) {
      console.error('Init failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

type InitOptions = {
  template?: string;
  path: string;
  templates: string;
  skipPrompts: boolean;
};

async function executeInit(agentName: string | undefined, options: InitOptions): Promise<void> {
  console.log('\n✨ Creating new Retell agent\n');

  // 1. Get agent name
  let finalAgentName = agentName;
  if (!finalAgentName) {
    const inq = await getInquirer();
    const nameAnswer = await inq.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Agent directory name (lowercase, hyphens):',
        validate: (input: string) => {
          if (!input) {
            return 'Agent name is required';
          }
          if (!/^[a-z0-9-]+$/.test(input)) {
            return 'Agent name must be lowercase letters, numbers, and hyphens only';
          }
          return true;
        },
      },
    ]);
    finalAgentName = nameAnswer.name;
  }

  if (!finalAgentName) {
    console.error('\n❌ Agent name is required');
    process.exit(1);
  }

  // 2. Check if agent already exists
  const agentPath = path.resolve(options.path, finalAgentName);
  try {
    await fs.access(agentPath);
    console.error(`\n❌ Agent '${finalAgentName}' already exists at ${agentPath}`);
    process.exit(1);
  } catch {
    // Good - agent doesn't exist yet
  }

  // 3. List available templates
  const templatesPath = path.resolve(options.templates);
  let templateFiles: string[];
  try {
    const files = await fs.readdir(templatesPath);
    templateFiles = files.filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`\n❌ Templates directory not found: ${templatesPath}`);
    console.error('Make sure you are in the project root directory.');
    process.exit(1);
  }

  if (templateFiles.length === 0) {
    console.error(`\n❌ No templates found in ${templatesPath}`);
    process.exit(1);
  }

  // 4. Select template
  let templateName = options.template;
  if (!templateName) {
    const inq = await getInquirer();
    const templateChoices = templateFiles.map((f) => ({
      name: f.replace('.json', ''),
      value: f.replace('.json', ''),
    }));

    const templateAnswer = await inq.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Select a template:',
        choices: templateChoices,
      },
    ]);
    templateName = templateAnswer.template;
  }

  const templateFile = `${templateName}.json`;
  const templatePath = path.join(templatesPath, templateFile);

  // 5. Load template
  let templateConfig: AgentConfig;
  try {
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    templateConfig = JSON.parse(templateContent) as AgentConfig;
  } catch (error) {
    console.error(`\n❌ Failed to load template: ${templateFile}`);
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  // 6. Customize template (unless skipped)
  let customizedConfig = templateConfig;
  if (!options.skipPrompts) {
    customizedConfig = await customizeTemplate(templateConfig);
  }

  // 7. Create agent directory
  await fs.mkdir(agentPath, { recursive: true });

  // 8. Write agent.json
  const agentJsonPath = path.join(agentPath, 'agent.json');
  await fs.writeFile(agentJsonPath, JSON.stringify(customizedConfig, null, 2) + '\n', 'utf-8');

  // 9. Create knowledge directory (optional)
  const knowledgePath = path.join(agentPath, 'knowledge');
  await fs.mkdir(knowledgePath, { recursive: true });

  console.log(`\n✅ Agent created successfully!`);
  console.log(`   Location: ${agentPath}`);
  console.log(`   Config:   ${agentJsonPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit ${agentJsonPath} to customize your agent`);
  console.log(`  2. Review prompt sections referenced in prompt_config.sections`);
  console.log(`  3. Add knowledge base files to ${knowledgePath}/ (optional)`);
  console.log(`  4. Run: retell push ${finalAgentName} -w staging`);
  console.log('');
}

/**
 * Customize template with user input
 */
async function customizeTemplate(template: AgentConfig): Promise<AgentConfig> {
  console.log('\n📝 Customize your agent (press Enter to keep default)\n');

  const inq = await getInquirer();
  const answers = await inq.prompt([
    {
      type: 'input',
      name: 'agentName',
      message: 'Agent display name:',
      default: template.agent_name,
    },
    {
      type: 'list',
      name: 'voiceId',
      message: 'Voice:',
      default: template.voice_id,
      choices: [
        { name: '11labs-Adrian (Male, American)', value: '11labs-Adrian' },
        { name: '11labs-Alice (Female, British)', value: '11labs-Alice' },
        { name: '11labs-Aria (Female, American)', value: '11labs-Aria' },
        { name: '11labs-Bill (Male, American)', value: '11labs-Bill' },
        { name: 'Other (keep template default)', value: template.voice_id },
      ],
    },
    {
      type: 'list',
      name: 'language',
      message: 'Language:',
      default: template.language,
      choices: [
        { name: 'English (US)', value: 'en-US' },
        { name: 'English (UK)', value: 'en-GB' },
        { name: 'Spanish', value: 'es-ES' },
        { name: 'French', value: 'fr-FR' },
        { name: 'German', value: 'de-DE' },
        { name: 'Other (keep template default)', value: template.language },
      ],
    },
    {
      type: 'list',
      name: 'model',
      message: 'LLM Model:',
      default: template.llm_config.model,
      choices: [
        { name: 'GPT-4o Mini (Fast, Cost-effective)', value: 'gpt-4o-mini' },
        { name: 'GPT-4o (Most capable)', value: 'gpt-4o' },
        { name: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet' },
        { name: 'Other (keep template default)', value: template.llm_config.model },
      ],
    },
    {
      type: 'number',
      name: 'temperature',
      message: 'Temperature (0.0-1.0, higher = more creative):',
      default: template.llm_config.temperature ?? 0.7,
      validate: (input: number) => {
        if (input < 0 || input > 1) {
          return 'Temperature must be between 0 and 1';
        }
        return true;
      },
    },
  ]);

  // Apply customizations
  const customized: AgentConfig = {
    ...template,
    agent_name: answers.agentName,
    voice_id: answers.voiceId,
    language: answers.language,
    llm_config: {
      ...template.llm_config,
      model: answers.model,
      temperature: answers.temperature,
    },
  };

  // Customize variables if using prompt_config
  if (customized.llm_config.prompt_config?.variables) {
    const variableAnswers = await customizeVariables(customized.llm_config.prompt_config.variables);

    // Create new config with updated variables
    const finalConfig: AgentConfig = {
      ...customized,
      llm_config: {
        ...customized.llm_config,
        prompt_config: {
          ...customized.llm_config.prompt_config,
          variables: variableAnswers,
        },
      },
    };
    return finalConfig;
  }

  return customized;
}

/**
 * Customize template variables
 */
async function customizeVariables(
  variables: Readonly<Record<string, string>>
): Promise<Record<string, string>> {
  console.log('\n🔧 Customize template variables:\n');

  const inq = await getInquirer();
  const questions = Object.entries(variables).map(([key, defaultValue]) => ({
    type: 'input',
    name: key,
    message: `${key}:`,
    default: defaultValue,
  }));

  const answers = await inq.prompt(questions);
  return answers;
}
