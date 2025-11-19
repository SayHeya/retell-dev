#!/usr/bin/env node

/**
 * Retell CLI entry point.
 * Provides commands for managing Retell agents across staging and production workspaces.
 */

// Load environment variables from .env file
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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
import { initCommand } from './commands/init';
import { pushCommand } from './commands/push';
import { pullCommand } from './commands/pull';
import { statusCommand } from './commands/status';
import { listCommand } from './commands/list';
import { workspaceInitCommand } from './commands/workspace-init';
import { bulkCreateCommand } from './commands/bulk-create';
import { updateCommand } from './commands/update';
import { deleteCommand } from './commands/delete';
import { diffCommand } from './commands/diff';
import { phoneCommand } from './commands/phone';

const program = new Command();

program
  .name('retell')
  .description('CLI for managing Retell AI agents across workspaces')
  .version('1.0.0');

// Create workspace command group
const workspaceCommand = new Command('workspace').description('Manage workspace configuration');

workspaceCommand.addCommand(workspaceInitCommand);

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

// Parse arguments
program.parse();
