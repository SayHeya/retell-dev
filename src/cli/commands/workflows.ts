/**
 * Workflows command - Initialize GitHub workflow templates
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const workflowsCommand = new Command('workflows').description(
  'Manage GitHub workflow templates'
);

const initWorkflowsCommand = new Command('init')
  .description('Initialize GitHub workflow templates for Retell CI/CD')
  .option('-f, --force', 'Overwrite existing workflow files')
  .option('-o, --output <dir>', 'Output directory', '.github/workflows')
  .action(async (options: { force?: boolean; output: string }) => {
    const { force, output } = options;

    try {
      // Find templates directory relative to this file
      // In dist: dist/cli/commands/workflows.js -> dist/templates/workflows
      // In src: src/cli/commands/workflows.ts -> src/templates/workflows
      const templatesDir = path.join(__dirname, '..', '..', 'templates', 'workflows');

      if (!fs.existsSync(templatesDir)) {
        console.error('❌ Error: Templates directory not found');
        console.error(`   Expected at: ${templatesDir}`);
        process.exit(1);
      }

      // Get all workflow template files
      const templateFiles = fs.readdirSync(templatesDir).filter((file) => file.endsWith('.yml'));

      if (templateFiles.length === 0) {
        console.error('❌ Error: No workflow templates found');
        process.exit(1);
      }

      // Ensure output directory exists
      const outputDir = path.resolve(process.cwd(), output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 Created directory: ${output}`);
      }

      // Copy each template file
      let copiedCount = 0;
      let skippedCount = 0;

      for (const file of templateFiles) {
        const sourcePath = path.join(templatesDir, file);
        const destPath = path.join(outputDir, file);

        // Check if file already exists
        if (fs.existsSync(destPath) && force !== true) {
          console.log(`⏭️  Skipped: ${file} (already exists, use --force to overwrite)`);
          skippedCount++;
          continue;
        }

        // Copy the file
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ Created: ${path.relative(process.cwd(), destPath)}`);
        copiedCount++;
      }

      // Also copy README if it exists
      const readmePath = path.join(templatesDir, 'README.md');
      if (fs.existsSync(readmePath)) {
        const destReadme = path.join(outputDir, 'RETELL-WORKFLOWS-README.md');
        if (!fs.existsSync(destReadme) || force === true) {
          fs.copyFileSync(readmePath, destReadme);
          console.log(`✅ Created: ${path.relative(process.cwd(), destReadme)}`);
          copiedCount++;
        }
      }

      // Summary
      console.log('');
      if (copiedCount > 0) {
        console.log(`✅ Successfully initialized ${copiedCount} workflow file(s)`);
      }
      if (skippedCount > 0) {
        console.log(`⚠️  Skipped ${skippedCount} existing file(s)`);
      }

      // Next steps
      console.log('');
      console.log('📋 Next steps:');
      console.log(`1. Review the workflow files in ${output}`);
      console.log('2. Add the following secrets to your GitHub repository:');
      console.log('   - RETELL_STAGING_API_KEY');
      console.log('   - RETELL_PRODUCTION_API_KEY');
      console.log('3. Commit and push the workflow files');
    } catch (error) {
      console.error('❌ Error initializing workflows:', error);
      process.exit(1);
    }
  });

// Add list command to see available templates
const listWorkflowsCommand = new Command('list')
  .description('List available workflow templates')
  .action(() => {
    try {
      const templatesDir = path.join(__dirname, '..', '..', 'templates', 'workflows');

      if (!fs.existsSync(templatesDir)) {
        console.error('❌ Error: Templates directory not found');
        process.exit(1);
      }

      const templateFiles = fs.readdirSync(templatesDir).filter((file) => file.endsWith('.yml'));

      console.log('📦 Available workflow templates:');
      console.log('');

      for (const file of templateFiles) {
        const name = file.replace('.yml', '');
        console.log(`  - ${name}`);
      }

      console.log('');
      console.log('Run `retell workflows init` to copy these to your project.');
    } catch (error) {
      console.error('❌ Error listing workflows:', error);
      process.exit(1);
    }
  });

workflowsCommand.addCommand(initWorkflowsCommand);
workflowsCommand.addCommand(listWorkflowsCommand);
