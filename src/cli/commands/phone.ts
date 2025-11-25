/**
 * Phone number management commands.
 *
 * Provides commands for:
 * - Creating/purchasing phone numbers
 * - Importing numbers via SIP trunk
 * - Listing all phone numbers
 * - Getting phone number details
 * - Updating phone number configuration
 * - Deleting phone numbers
 */

import { Command } from 'commander';
import { RetellClientService, WorkspaceConfigService } from '@heya/retell.controllers';
import type { WorkspaceType } from '@heya/retell.controllers';
import { handleError } from '../errors/cli-error-handler';

// ============================================================================
// Main phone command group
// ============================================================================

export const phoneCommand = new Command('phone').description('Manage phone numbers and SIP trunks');

// ============================================================================
// Subcommand: phone create
// ============================================================================

phoneCommand
  .command('create')
  .description('Purchase a new phone number from Retell')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('--area-code <code>', 'US area code (3 digits, e.g., 415)')
  .option('--country <code>', 'Country code (US or CA)', 'US')
  .option('--provider <provider>', 'Provider (twilio or telnyx)', 'twilio')
  .option('--toll-free', 'Purchase toll-free number', false)
  .option('--inbound-agent <agentId>', 'Agent ID for inbound calls')
  .option('--outbound-agent <agentId>', 'Agent ID for outbound calls')
  .option('--nickname <name>', 'Nickname for the number')
  .option('--webhook <url>', 'Inbound webhook URL')
  .action(async (options: CreatePhoneOptions) => {
    try {
      await executeCreatePhone(options);
    } catch (error) {
      handleError(error);
    }
  });

// ============================================================================
// Subcommand: phone import
// ============================================================================

phoneCommand
  .command('import')
  .description('Import phone number via SIP trunk')
  .argument('<phone-number>', 'Phone number in E.164 format (e.g., +14157774444)')
  .argument('<termination-uri>', 'SIP trunk termination URI (e.g., mytrunk.pstn.twilio.com)')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('--username <username>', 'SIP trunk auth username')
  .option('--password <password>', 'SIP trunk auth password')
  .option('--inbound-agent <agentId>', 'Agent ID for inbound calls')
  .option('--outbound-agent <agentId>', 'Agent ID for outbound calls')
  .option('--inbound-version <version>', 'Inbound agent version')
  .option('--outbound-version <version>', 'Outbound agent version')
  .option('--nickname <name>', 'Nickname for the number')
  .option('--webhook <url>', 'Inbound webhook URL')
  .action(async (phoneNumber: string, terminationUri: string, options: ImportPhoneOptions) => {
    try {
      await executeImportPhone(phoneNumber, terminationUri, options);
    } catch (error) {
      handleError(error);
    }
  });

// ============================================================================
// Subcommand: phone list
// ============================================================================

phoneCommand
  .command('list')
  .description('List all phone numbers in workspace')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('--json', 'Output as JSON', false)
  .action(async (options: ListPhoneOptions) => {
    try {
      await executeListPhones(options);
    } catch (error) {
      handleError(error);
    }
  });

// ============================================================================
// Subcommand: phone get
// ============================================================================

phoneCommand
  .command('get')
  .description('Get phone number details')
  .argument('<phone-number>', 'Phone number in E.164 format')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('--json', 'Output as JSON', false)
  .action(async (phoneNumber: string, options: GetPhoneOptions) => {
    try {
      await executeGetPhone(phoneNumber, options);
    } catch (error) {
      handleError(error);
    }
  });

// ============================================================================
// Subcommand: phone update
// ============================================================================

phoneCommand
  .command('update')
  .description('Update phone number configuration')
  .argument('<phone-number>', 'Phone number in E.164 format')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('--inbound-agent <agentId>', 'Agent ID for inbound calls (use "null" to disable)')
  .option('--outbound-agent <agentId>', 'Agent ID for outbound calls (use "null" to disable)')
  .option('--inbound-version <version>', 'Inbound agent version')
  .option('--outbound-version <version>', 'Outbound agent version')
  .option('--nickname <name>', 'Nickname for the number')
  .option('--webhook <url>', 'Inbound webhook URL')
  .action(async (phoneNumber: string, options: UpdatePhoneOptions) => {
    try {
      await executeUpdatePhone(phoneNumber, options);
    } catch (error) {
      handleError(error);
    }
  });

// ============================================================================
// Subcommand: phone delete
// ============================================================================

phoneCommand
  .command('delete')
  .description('Delete phone number')
  .argument('<phone-number>', 'Phone number in E.164 format')
  .option('-w, --workspace <workspace>', 'Target workspace (staging or production)', 'staging')
  .option('-y, --yes', 'Skip confirmation', false)
  .action(async (phoneNumber: string, options: DeletePhoneOptions) => {
    try {
      await executeDeletePhone(phoneNumber, options);
    } catch (error) {
      handleError(error);
    }
  });

// ============================================================================
// Type Definitions
// ============================================================================

type CreatePhoneOptions = {
  workspace: WorkspaceType;
  areaCode?: string;
  country: string;
  provider: string;
  tollFree: boolean;
  inboundAgent?: string;
  outboundAgent?: string;
  nickname?: string;
  webhook?: string;
};

type ImportPhoneOptions = {
  workspace: WorkspaceType;
  username?: string;
  password?: string;
  inboundAgent?: string;
  outboundAgent?: string;
  inboundVersion?: string;
  outboundVersion?: string;
  nickname?: string;
  webhook?: string;
};

type ListPhoneOptions = {
  workspace: WorkspaceType;
  json: boolean;
};

type GetPhoneOptions = {
  workspace: WorkspaceType;
  json: boolean;
};

type UpdatePhoneOptions = {
  workspace: WorkspaceType;
  inboundAgent?: string;
  outboundAgent?: string;
  inboundVersion?: string;
  outboundVersion?: string;
  nickname?: string;
  webhook?: string;
};

type DeletePhoneOptions = {
  workspace: WorkspaceType;
  yes: boolean;
};

// ============================================================================
// Command Implementations
// ============================================================================

/**
 * Create/purchase a new phone number
 */
async function executeCreatePhone(options: CreatePhoneOptions): Promise<void> {
  console.log(`\nCreating phone number in ${options.workspace}...\n`);

  // Load workspace config
  const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClientService(workspaceConfig);

  // Build request payload
  const createRequest: Record<string, unknown> = {
    country_code: options.country,
    number_provider: options.provider,
    toll_free: options.tollFree,
  };

  if (options.areaCode) {
    createRequest['area_code'] = parseInt(options.areaCode, 10);
  }
  if (options.inboundAgent) {
    createRequest['inbound_agent_id'] = options.inboundAgent;
  }
  if (options.outboundAgent) {
    createRequest['outbound_agent_id'] = options.outboundAgent;
  }
  if (options.nickname) {
    createRequest['nickname'] = options.nickname;
  }
  if (options.webhook) {
    createRequest['inbound_webhook_url'] = options.webhook;
  }

  // Create phone number
  const result = await client.createPhoneNumber(createRequest);
  if (!result.success) {
    throw result.error;
  }

  const phoneNumber = result.value as Record<string, unknown>;

  console.log('✓ Phone number created successfully!\n');
  console.log('Number:', phoneNumber['phone_number']);
  console.log('Pretty:', phoneNumber['phone_number_pretty']);
  console.log('Type:', phoneNumber['phone_number_type']);
  if (phoneNumber['area_code']) {
    console.log('Area Code:', phoneNumber['area_code']);
  }
  if (options.inboundAgent) {
    console.log('Inbound Agent:', options.inboundAgent);
  }
  if (options.outboundAgent) {
    console.log('Outbound Agent:', options.outboundAgent);
  }
  if (options.nickname) {
    console.log('Nickname:', options.nickname);
  }
}

/**
 * Import phone number via SIP trunk
 */
async function executeImportPhone(
  phoneNumber: string,
  terminationUri: string,
  options: ImportPhoneOptions
): Promise<void> {
  console.log(`\nImporting phone number ${phoneNumber} to ${options.workspace}...\n`);

  // Load workspace config
  const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClientService(workspaceConfig);

  // Build request payload
  const importRequest: Record<string, unknown> = {
    phone_number: phoneNumber,
    termination_uri: terminationUri,
  };

  if (options.username) {
    importRequest['sip_trunk_auth_username'] = options.username;
  }
  if (options.password) {
    importRequest['sip_trunk_auth_password'] = options.password;
  }
  if (options.inboundAgent) {
    importRequest['inbound_agent_id'] = options.inboundAgent;
  }
  if (options.outboundAgent) {
    importRequest['outbound_agent_id'] = options.outboundAgent;
  }
  if (options.inboundVersion) {
    importRequest['inbound_agent_version'] = parseInt(options.inboundVersion, 10);
  }
  if (options.outboundVersion) {
    importRequest['outbound_agent_version'] = parseInt(options.outboundVersion, 10);
  }
  if (options.nickname) {
    importRequest['nickname'] = options.nickname;
  }
  if (options.webhook) {
    importRequest['inbound_webhook_url'] = options.webhook;
  }

  // Import phone number
  const result = await client.importPhoneNumber(importRequest);
  if (!result.success) {
    throw result.error;
  }

  const number = result.value as Record<string, unknown>;

  console.log('✓ Phone number imported successfully!\n');
  console.log('Number:', number['phone_number']);
  console.log('Termination URI:', terminationUri);
  if (options.username) {
    console.log('SIP Auth Username:', options.username);
  }
  if (options.inboundAgent) {
    console.log('Inbound Agent:', options.inboundAgent);
  }
  if (options.outboundAgent) {
    console.log('Outbound Agent:', options.outboundAgent);
  }
  if (options.nickname) {
    console.log('Nickname:', options.nickname);
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Configure your SIP trunk provider to point to Retell:');
  console.log('   Origination URI: sip:5t4n6j0wnrl.sip.livekit.cloud');
  console.log('   (or with TCP: sip:5t4n6j0wnrl.sip.livekit.cloud;transport=tcp)');
  console.log(`2. Route inbound calls to: sip:${phoneNumber}@5t4n6j0wnrl.sip.livekit.cloud`);
  console.log('3. Test both inbound and outbound calls');
}

/**
 * List all phone numbers
 */
async function executeListPhones(options: ListPhoneOptions): Promise<void> {
  // Load workspace config
  const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClientService(workspaceConfig);

  // List phone numbers
  const result = await client.listPhoneNumbers();
  if (!result.success) {
    throw result.error;
  }

  const phoneNumbers = result.value as Array<Record<string, unknown>>;

  if (options.json) {
    console.log(JSON.stringify(phoneNumbers, null, 2));
    return;
  }

  console.log(`\nPhone Numbers in ${options.workspace} (${phoneNumbers.length} total):\n`);

  if (phoneNumbers.length === 0) {
    console.log('No phone numbers found.');
    return;
  }

  for (const number of phoneNumbers) {
    console.log('─'.repeat(60));
    console.log('Number:', number['phone_number']);
    console.log('Pretty:', number['phone_number_pretty']);
    console.log('Type:', number['phone_number_type']);
    if (number['nickname']) {
      console.log('Nickname:', number['nickname']);
    }
    if (number['inbound_agent_id']) {
      console.log('Inbound Agent:', number['inbound_agent_id']);
    }
    if (number['outbound_agent_id']) {
      console.log('Outbound Agent:', number['outbound_agent_id']);
    }
    console.log();
  }
}

/**
 * Get phone number details
 */
async function executeGetPhone(phoneNumber: string, options: GetPhoneOptions): Promise<void> {
  // Load workspace config
  const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClientService(workspaceConfig);

  // Get phone number
  const result = await client.getPhoneNumber(phoneNumber);
  if (!result.success) {
    throw result.error;
  }

  const number = result.value as Record<string, unknown>;

  if (options.json) {
    console.log(JSON.stringify(number, null, 2));
    return;
  }

  console.log(`\nPhone Number Details:\n`);
  console.log('Number:', number['phone_number']);
  console.log('Pretty:', number['phone_number_pretty']);
  console.log('Type:', number['phone_number_type']);

  if (number['nickname']) {
    console.log('Nickname:', number['nickname']);
  }
  if (number['area_code']) {
    console.log('Area Code:', number['area_code']);
  }

  console.log('\nAgent Configuration:');
  console.log('  Inbound Agent:', number['inbound_agent_id'] || 'none');
  console.log('  Outbound Agent:', number['outbound_agent_id'] || 'none');
  if (number['inbound_agent_version']) {
    console.log('  Inbound Version:', number['inbound_agent_version']);
  }
  if (number['outbound_agent_version']) {
    console.log('  Outbound Version:', number['outbound_agent_version']);
  }

  if (number['inbound_webhook_url']) {
    console.log('\nWebhook URL:', number['inbound_webhook_url']);
  }

  if (number['last_modification_timestamp']) {
    const date = new Date(number['last_modification_timestamp'] as number);
    console.log('\nLast Modified:', date.toISOString());
  }
}

/**
 * Update phone number configuration
 */
async function executeUpdatePhone(phoneNumber: string, options: UpdatePhoneOptions): Promise<void> {
  console.log(`\nUpdating phone number ${phoneNumber} in ${options.workspace}...\n`);

  // Load workspace config
  const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClientService(workspaceConfig);

  // Build update payload
  const updateRequest: Record<string, unknown> = {};
  let hasChanges = false;

  if (options.inboundAgent !== undefined) {
    updateRequest['inbound_agent_id'] =
      options.inboundAgent === 'null' ? null : options.inboundAgent;
    hasChanges = true;
  }
  if (options.outboundAgent !== undefined) {
    updateRequest['outbound_agent_id'] =
      options.outboundAgent === 'null' ? null : options.outboundAgent;
    hasChanges = true;
  }
  if (options.inboundVersion) {
    updateRequest['inbound_agent_version'] = parseInt(options.inboundVersion, 10);
    hasChanges = true;
  }
  if (options.outboundVersion) {
    updateRequest['outbound_agent_version'] = parseInt(options.outboundVersion, 10);
    hasChanges = true;
  }
  if (options.nickname !== undefined) {
    updateRequest['nickname'] = options.nickname;
    hasChanges = true;
  }
  if (options.webhook !== undefined) {
    updateRequest['inbound_webhook_url'] = options.webhook;
    hasChanges = true;
  }

  if (!hasChanges) {
    console.log('No changes specified. Use --help to see available options.');
    return;
  }

  // Update phone number
  const result = await client.updatePhoneNumber(phoneNumber, updateRequest);
  if (!result.success) {
    throw result.error;
  }

  console.log('✓ Phone number updated successfully!\n');
  console.log('Updated fields:');
  for (const [key, value] of Object.entries(updateRequest)) {
    console.log(`  ${key}: ${value === null ? 'disabled' : value}`);
  }

  console.log('\nNote: To update SIP trunk configuration (termination URI or credentials),');
  console.log('you must delete and re-import the number.');
}

/**
 * Delete phone number
 */
async function executeDeletePhone(phoneNumber: string, options: DeletePhoneOptions): Promise<void> {
  // Confirmation prompt
  if (!options.yes) {
    console.log(`\n⚠️  WARNING: You are about to delete phone number ${phoneNumber}`);
    console.log('This action cannot be undone.\n');

    // In a real CLI, you'd use a proper prompt library here
    // For now, we'll require the --yes flag
    console.log('Use --yes flag to confirm deletion.');
    return;
  }

  console.log(`\nDeleting phone number ${phoneNumber} from ${options.workspace}...\n`);

  // Load workspace config
  const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
  if (!workspaceConfigResult.success) {
    throw workspaceConfigResult.error;
  }
  const workspaceConfig = workspaceConfigResult.value;
  const client = new RetellClientService(workspaceConfig);

  // Delete phone number
  const result = await client.deletePhoneNumber(phoneNumber);
  if (!result.success) {
    throw result.error;
  }

  console.log('✓ Phone number deleted successfully!');
}
