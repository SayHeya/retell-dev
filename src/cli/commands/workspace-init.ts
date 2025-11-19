/**
 * Workspace init command - Generate workspaces.json from environment variables
 */

import { Command } from 'commander';
import { WorkspaceConfigLoader } from '../../config/workspace-config';

export const workspaceInitCommand = new Command('init')
  .description('Generate workspaces.json from environment variables')
  .option('-f, --force', 'Overwrite existing workspaces.json', false)
  .action(async (options: WorkspaceInitOptions) => {
    try {
      await executeWorkspaceInit(options);
    } catch (error) {
      console.error('Workspace init failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

type WorkspaceInitOptions = {
  force: boolean;
};

async function executeWorkspaceInit(options: WorkspaceInitOptions): Promise<void> {
  console.log('\n📝 Generating workspaces.json from environment variables...\n');

  // Check if file exists and force not set
  const exists = await WorkspaceConfigLoader.exists();
  if (exists && !options.force) {
    console.error('❌ workspaces.json already exists. Use --force to overwrite.');
    process.exit(1);
  }

  // If force, remove existing file
  if (exists && options.force) {
    console.log('⚠️  Overwriting existing workspaces.json...\n');
    const fs = await import('fs/promises');
    const path = await import('path');
    const workspacesPath = path.resolve(process.cwd(), 'workspaces.json');
    await fs.unlink(workspacesPath);
  }

  // Generate from environment
  const result = await WorkspaceConfigLoader.generateFromEnv();

  if (!result.success) {
    throw result.error;
  }

  console.log('✅ Successfully created workspaces.json');
  console.log('\nWorkspace configuration:');
  console.log('  - staging: Development Workspace');
  console.log('  - production: Production Workspace');
  console.log('\n💡 Tip: Review and customize workspaces.json if needed');
  console.log('');
}
