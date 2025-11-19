# Agent Delete Command

## Overview

The `retell delete` command safely removes agents from Retell workspaces and local filesystem. It provides multiple options for controlling deletion scope and includes safety features to prevent accidental data loss.

## Command Syntax

```bash
retell delete <agent-name> [options]
```

## Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `agent-name` | Name of the agent to delete (directory name in `agents/`) | Yes |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-w, --workspace <workspace>` | Delete from specific workspace only (`staging` or `production`) | Both workspaces |
| `-y, --yes` | Skip confirmation prompt | `false` |
| `--remote-only` | Delete only from Retell workspaces, keep local files | `false` |
| `--local-only` | Delete only local files, keep remote agents | `false` |
| `-p, --path <path>` | Path to agents directory | `./agents` |

## Deletion Behavior

### Default Behavior (No Options)

When run without options, the command:
1. ✅ Deletes agent from **staging** workspace (if exists)
2. ✅ Deletes agent from **production** workspace (if exists)
3. ✅ Deletes local agent directory and all files
4. ⚠️ Asks for confirmation before proceeding

**What is NOT deleted:**
- ❌ LLM configurations (may be shared by other agents)
- ❌ Knowledge bases (may be shared by other agents)
- ❌ Phone number assignments (must be removed separately)

### Workspace-Specific Deletion

Delete from only one workspace:

```bash
# Delete only from staging
retell delete my-agent -w staging

# Delete only from production
retell delete my-agent -w production
```

**Behavior:**
- Deletes agent from specified workspace
- Deletes local directory
- Prompts for confirmation

### Remote-Only Deletion

Delete from Retell workspaces but keep local files:

```bash
retell delete my-agent --remote-only
```

**Behavior:**
- ✅ Deletes from staging and production workspaces
- ❌ Keeps local agent directory intact
- Useful for: Re-syncing agent or testing re-deployment

### Local-Only Deletion

Delete local files but keep remote agents:

```bash
retell delete my-agent --local-only
```

**Behavior:**
- ❌ Does NOT delete from Retell workspaces
- ✅ Deletes local agent directory
- Useful for: Cleaning up local workspace, will re-pull later

### Skip Confirmation

Auto-confirm deletion (use with caution):

```bash
retell delete my-agent --yes
retell delete my-agent -y
```

**Warning:** This bypasses the confirmation prompt. Use carefully in scripts.

## Safety Features

### 1. Confirmation Prompt

By default, the command shows a detailed deletion plan and asks for confirmation:

```
📋 Deletion Plan:

STAGING Workspace:
  ✓ Agent: agent_abc123xyz
  ⚠ LLM: llm_def456uvw (will NOT be deleted - may be shared)

PRODUCTION Workspace:
  ⊘ No agent found in production

LOCAL Filesystem:
  ✓ Directory: /path/to/agents/my-agent
  ✓ All files in directory will be permanently deleted

⚠️  This will permanently delete agent 'my-agent' from 1 workspace(s) and local files.
This action CANNOT be undone.

Continue? (yes/no):
```

### 2. Shows What Will Be Deleted

Before deletion, the command displays:
- Which workspaces contain the agent
- Agent IDs in each workspace
- Associated LLM IDs (with warning they won't be deleted)
- Associated KB IDs (with warning they won't be deleted)
- Local directory path

### 3. Prevents Conflicting Options

Cannot specify both `--remote-only` and `--local-only`:

```bash
retell delete my-agent --remote-only --local-only
# Error: Cannot specify both --remote-only and --local-only
```

### 4. Handles Missing Agents Gracefully

If agent doesn't exist:

```
⚠ Nothing to delete. Agent not found in any workspace or locally.
```

## Usage Examples

### Example 1: Complete Deletion

Delete agent from everywhere (staging, production, local):

```bash
retell delete customer-service
```

**Output:**
```
Deleting agent 'customer-service'...

📋 Deletion Plan:

STAGING Workspace:
  ✓ Agent: agent_staging_abc123
  ⚠ LLM: llm_staging_def456 (will NOT be deleted - may be shared)

PRODUCTION Workspace:
  ✓ Agent: agent_prod_xyz789
  ⚠ LLM: llm_prod_uvw012 (will NOT be deleted - may be shared)

LOCAL Filesystem:
  ✓ Directory: /path/to/agents/customer-service
  ✓ All files in directory will be permanently deleted

⚠️  This will permanently delete agent 'customer-service' from 2 workspace(s) and local files.
This action CANNOT be undone.

Continue? (yes/no): yes

Deleting from staging...
  ✓ Deleted agent agent_staging_abc123 from staging
Deleting from production...
  ✓ Deleted agent agent_prod_xyz789 from production
Deleting local directory...
  ✓ Deleted directory: /path/to/agents/customer-service

✅ Deletion complete!

Deleted from 2 workspace(s)
Deleted local agent directory
```

### Example 2: Delete Only From Staging

Keep production and local files:

```bash
retell delete test-agent -w staging
```

**Output:**
```
Deleting agent 'test-agent'...

📋 Deletion Plan:

STAGING Workspace:
  ✓ Agent: agent_staging_test123

LOCAL Filesystem:
  ✓ Directory: /path/to/agents/test-agent
  ✓ All files in directory will be permanently deleted

⚠️  This will permanently delete agent 'test-agent' from 1 workspace(s) and local files.
This action CANNOT be undone.

Continue? (yes/no): yes

Deleting from staging...
  ✓ Deleted agent agent_staging_test123 from staging
Deleting local directory...
  ✓ Deleted directory: /path/to/agents/test-agent

✅ Deletion complete!

Deleted from 1 workspace(s)
Deleted local agent directory
```

### Example 3: Remote-Only Deletion

Delete from workspaces, keep local files for re-deployment:

```bash
retell delete old-agent --remote-only
```

**Use case:** You want to re-push the agent with fresh IDs or test re-deployment.

### Example 4: Local-Only Deletion

Clean up local files, keep remote agents running:

```bash
retell delete temp-test --local-only
```

**Use case:** Cleaning up local workspace, agents still deployed and serving traffic.

### Example 5: Scripted Deletion

Delete without prompting (for scripts/automation):

```bash
retell delete test-agent-001 -y
retell delete test-agent-002 --yes
```

**Warning:** Use carefully! No confirmation prompt.

### Example 6: Bulk Deletion Script

Delete multiple test agents:

```bash
#!/bin/bash
# delete-test-agents.sh

for i in {001..100}; do
  echo "Deleting test-agent-$i..."
  retell delete "test-agent-$i" -y
done

echo "Deleted 100 test agents"
```

## Error Handling

### Agent Not Found

```bash
retell delete nonexistent-agent
```

**Output:**
```
Deleting agent 'nonexistent-agent'...

Agent directory not found: /path/to/agents/nonexistent-agent
Use --remote-only if you only want to delete from Retell workspaces.
```

**Solution:** Use `--remote-only` if you only want to delete from Retell:
```bash
retell delete nonexistent-agent --remote-only
```

### Workspace Config Missing

```bash
retell delete my-agent
```

**Output:**
```
Deleting from staging...
  ✗ Failed to load staging config: workspaces.json not found
```

**Solution:** Initialize workspace configuration:
```bash
retell workspace init
```

### Deletion Failed

```bash
retell delete my-agent
```

**Output:**
```
Deleting from staging...
  ✗ Failed to delete agent: Agent not found (404)
```

**Meaning:** Agent doesn't exist in workspace (already deleted or never pushed).

## Integration with Phone Numbers

**Important:** Deleting an agent does NOT automatically delete associated phone numbers.

### Before Deleting Agent with Phone Numbers

1. **List agent's phone numbers:**
```bash
retell phone-dir agent-numbers agents/my-agent
```

2. **Reassign or delete phone numbers:**
```bash
# Option A: Reassign to different agent
retell phone update "+14155551234" -w staging --inbound-agent agent_new123

# Option B: Delete phone number
retell phone delete "+14155551234" -w staging -y
```

3. **Then delete agent:**
```bash
retell delete my-agent
```

### Check Phone Assignments Before Deletion

```bash
# Check staging
retell phone list -w staging --json | jq '.[] | select(.inbound_agent_id == "agent_abc123")'

# Check production
retell phone list -w production --json | jq '.[] | select(.inbound_agent_id == "agent_xyz789")'
```

## Best Practices

### 1. Always Check Before Deleting

```bash
# Check agent status
retell status my-agent

# Check phone assignments
retell phone-dir agent-numbers agents/my-agent

# Then delete
retell delete my-agent
```

### 2. Test Deletion in Staging First

```bash
# Delete from staging only
retell delete test-agent -w staging

# Verify it worked
retell list -w staging | grep test-agent

# Then delete from production if needed
retell delete test-agent -w production
```

### 3. Keep Local Files During Testing

```bash
# Delete remote but keep local
retell delete my-agent --remote-only

# Make changes to agent.json
vim agents/my-agent/agent.json

# Re-push
retell push my-agent -w staging
```

### 4. Backup Before Bulk Deletion

```bash
# Backup agents directory
tar -czf agents-backup-$(date +%Y%m%d).tar.gz agents/

# Run bulk deletion
./scripts/delete-test-agents.sh

# If needed, restore
tar -xzf agents-backup-20251119.tar.gz
```

### 5. Document Deletions

```bash
# Log deletions
echo "$(date): Deleted agent my-agent (agent_abc123)" >> deletions.log

# Or use git
git commit -m "Delete deprecated agent: my-agent"
```

## Comparison with Other Commands

| Command | Creates Agent | Deletes Agent | Modifies Agent |
|---------|---------------|---------------|----------------|
| `retell init` | Local only | No | No |
| `retell push` | Remote | No | Yes (updates) |
| `retell delete` | No | **Yes** | No |
| `retell update` | No | No | Yes (config) |

## Common Workflows

### Workflow 1: Replace Old Agent with New

```bash
# 1. Create new agent
retell init agents/new-customer-service --template customer-service

# 2. Push to staging
retell push new-customer-service -w staging

# 3. Get new agent ID
NEW_AGENT=$(cat agents/new-customer-service/staging.json | jq -r '.agent_id')

# 4. Reassign phone numbers from old to new
retell phone update "+14155551234" -w staging --inbound-agent "$NEW_AGENT"

# 5. Test new agent
# ... testing ...

# 6. Delete old agent
retell delete old-customer-service -w staging

# 7. Release new agent to production
retell push new-customer-service -w production
```

### Workflow 2: Clean Up Test Agents

```bash
# List test agents
retell list -w staging | grep "test-agent"

# Delete all test agents
for agent in test-agent-{001..100}; do
  retell delete "$agent" -y
done

# Verify cleanup
retell list -w staging | grep "test-agent" || echo "All cleaned up!"
```

### Workflow 3: Reset Agent (Keep Local Config)

```bash
# Delete from workspaces, keep local
retell delete my-agent --remote-only

# Re-push with fresh IDs
retell push my-agent -w staging

# Verify new IDs
cat agents/my-agent/staging.json | jq '.agent_id'
```

## Troubleshooting

### "Cannot delete: directory not found"

```bash
# Check if directory exists
ls agents/my-agent

# If it doesn't exist, use --remote-only
retell delete my-agent --remote-only
```

### "Failed to delete agent: 404"

Agent already deleted from Retell. Just clean up local files:

```bash
retell delete my-agent --local-only
```

### Permission Denied

```bash
# Make sure you have write permissions
ls -la agents/

# If needed, fix permissions
chmod -R u+w agents/my-agent
```

### Deletion Interrupted

If deletion fails partway through:

```bash
# Check what remains
retell status my-agent

# Delete remaining pieces
retell delete my-agent -w staging  # If staging still exists
rm -rf agents/my-agent              # If local files remain
```

## Security Considerations

1. **No Undo:** Deletion is permanent. Agent IDs cannot be recovered.
2. **Shared Resources:** LLMs and KBs are NOT deleted (may be used by other agents).
3. **Phone Numbers:** Must be manually reassigned or deleted.
4. **Confirmation Required:** Always prompts unless `--yes` flag is used.
5. **Audit Trail:** Consider logging deletions for compliance.

## See Also

- [SPECIFICATION.md](SPECIFICATION.md) - Complete CLI specification
- [PHONE_NUMBER_DIRECTORY.md](PHONE_NUMBER_DIRECTORY.md) - Phone number management
- `retell delete --help` - Built-in help
