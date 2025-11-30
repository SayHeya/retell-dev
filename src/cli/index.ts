#!/usr/bin/env node

/**
 * Retell CLI entry point.
 * Provides commands for managing Retell agents across staging and production workspaces.
 */

// Load environment variables from .env file
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Get version from package.json
// Navigate from dist/src/cli/ to package.json at root
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../../package.json') as { version: string };
const VERSION = packageJson.version;

// Try to find .env file in current directory or parent directories
const findEnvFile = (): string | undefined => {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    currentDir = path.dirname(currentDir);
  }
  return undefined;
};

const envPath = findEnvFile();
config({ path: envPath });

import { Command } from 'commander';
import { WorkspaceConfigService } from '@heya/retell.controllers';
import { initCommand } from './commands/init';
import { pushCommand } from './commands/push';
import { pullCommand } from './commands/pull';
import { statusCommand } from './commands/status';
import { listCommand } from './commands/list';
import { workspaceInitCommand } from './commands/workspace-init';
import { workspaceListCommand } from './commands/workspace-list';
import { bulkCreateCommand } from './commands/bulk-create';
import { updateCommand } from './commands/update';
import { deleteCommand } from './commands/delete';
import { diffCommand } from './commands/diff';
import { phoneCommand } from './commands/phone';
import { workflowsCommand } from './commands/workflows';
import { auditCommand } from './commands/audit';
import { syncCommand } from './commands/sync';
import { versionCommand } from './commands/version';

/**
 * Check CLI version against workspaces.json requirement
 * Shows warning if version doesn't satisfy the constraint
 */
async function checkCliVersion(): Promise<void> {
  const result = await WorkspaceConfigService.validateCliVersion(VERSION);

  if (!result.success) {
    // No workspaces.json or couldn't load - that's fine, skip check
    return;
  }

  const { valid, required, current, message } = result.value;

  if (!required) {
    // No cli_version specified in workspaces.json - skip check
    return;
  }

  if (!valid) {
    console.error(`\x1b[33m⚠️  CLI Version Mismatch\x1b[0m`);
    console.error(`   Required: ${required}`);
    console.error(`   Current:  ${current}`);
    if (message) {
      console.error(`   ${message}`);
    }
    console.error(`   Run: npm install -g @heya/retell-cli@${required.replace(/^[\^~>=<]+/, '')}\n`);
  }
}

const program = new Command();

program
  .name('retell')
  .description('CLI for managing Retell AI agents across workspaces')
  .version(VERSION)
  .hook('preAction', async () => {
    await checkCliVersion();
  });

// Create workspace command group
const workspaceCommand = new Command('workspace').description('Manage workspace configuration');

workspaceCommand.addCommand(workspaceInitCommand);
workspaceCommand.addCommand(workspaceListCommand);

// Register commands
program.addCommand(initCommand);
program.addCommand(bulkCreateCommand);
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(statusCommand);
program.addCommand(listCommand);
program.addCommand(updateCommand);
program.addCommand(deleteCommand);
program.addCommand(diffCommand);
program.addCommand(phoneCommand);
program.addCommand(workspaceCommand);
program.addCommand(workflowsCommand);
program.addCommand(auditCommand);
program.addCommand(syncCommand);
program.addCommand(versionCommand);

// Parse arguments
program.parse();
