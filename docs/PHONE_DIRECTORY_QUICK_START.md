# Phone Number Directory - Quick Start Guide

## Overview

The Phone Number Directory provides a centralized view of all your Twilio phone numbers and how they're assigned to Retell agents across staging and production workspaces.

## What Problem Does It Solve?

**Before:**
- Phone numbers scattered across Twilio and Retell
- No easy way to see which agent handles which number
- Manual tracking of SIP configurations
- Difficult to audit number assignments

**After:**
- Single source of truth for all phone numbers
- Instant lookup: number → agent or agent → numbers
- Automated sync with Twilio and Retell
- Easy auditing and reporting

## Directory Structure

```
phone-numbers/
├── directory.json              # Master list (all numbers, all workspaces)
├── staging/
│   ├── numbers.json            # Staging phone numbers
│   └── assignments.json        # Staging agent assignments
├── production/
│   ├── numbers.json            # Production phone numbers
│   └── assignments.json        # Production agent assignments
└── twilio/
    ├── trunks.json             # SIP trunk configs (gitignored)
    └── sync.json               # Sync metadata (gitignored)
```

## Common Commands

### 1. View All Numbers

```bash
retell phone-dir list
```

**Output:**
```
Phone Numbers (15 total):

Staging (15 numbers):
  +14155551234  local       Customer Service Line    → agents/customer-service
  +14155555678  local       Support Line            → agents/support-tier1
  +18885551234  toll-free   Sales Hotline           → agents/sales-agent
  +14159991234  local       No nickname             → unassigned

Production (10 numbers):
  +14155551234  local       Customer Service Line    → agents/customer-service
  +18885551234  toll-free   Sales Hotline           → agents/sales-agent
```

### 2. View Numbers by Workspace

```bash
retell phone-dir list --workspace staging
retell phone-dir list --workspace production
```

### 3. Find Numbers for an Agent

```bash
retell phone-dir agent-numbers agents/customer-service
```

**Output:**
```
Agent: Customer Service Agent
Path: agents/customer-service

Staging Numbers (2):
  +14155551234  (inbound-outbound)  Customer Service Line
  +14155555678  (inbound-only)      Support Line

Production Numbers (1):
  +14155551234  (inbound-outbound)  Customer Service Line
```

### 4. Show Number Details

```bash
retell phone-dir show "+14155551234"
```

**Output:**
```
Phone Number: +14155551234
Pretty: (415) 555-1234
Type: local
Provider: twilio
Area Code: 415

Twilio Configuration:
  Phone Number SID: PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  Trunk SID: TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  Friendly Name: Customer Service Line

SIP Configuration:
  Termination URI: mytrunk.pstn.twilio.com
  Origination URI: sip:5t4n6j0wnrl.sip.livekit.cloud

Workspace Assignments:
  Staging:    agents/customer-service (agent_staging_abc123)
  Production: agents/customer-service (agent_prod_xyz789)
```

### 5. Find Unassigned Numbers

```bash
retell phone-dir unassigned
retell phone-dir unassigned --workspace staging
```

**Output:**
```
Unassigned Numbers in Staging:

+18885551234  toll-free  (888) 555-1234  Sales Hotline
+14159991234  local      (415) 999-1234  Test Number
```

### 6. Sync with Twilio and Retell

```bash
# Sync from both sources
retell phone-dir sync --all

# Sync specific workspace
retell phone-dir sync --workspace staging

# Sync only from Twilio
retell phone-dir sync-twilio --all

# Sync only from Retell
retell phone-dir sync-retell --all
```

### 7. Validate Directory

```bash
retell phone-dir validate
```

**Output:**
```
Validating phone number directory...

✓ All numbers have valid Twilio SIDs
✓ All assigned numbers reference existing agents
⚠ 2 numbers missing in production workspace
✗ 1 orphaned assignment found: agents/old-agent

Errors: 1
Warnings: 1
```

### 8. Generate Report

```bash
retell phone-dir report
retell phone-dir report --format json
retell phone-dir report --format csv --output report.csv
```

## Integration with Existing CLI

The directory **automatically updates** when you use existing phone commands:

### When you import a number:

```bash
retell phone import "+14155551234" "mytrunk.pstn.twilio.com" \
  --workspace staging \
  --username "retell_user" \
  --password "password" \
  --inbound-agent agent_abc123
```

**Automatic updates:**
- ✅ `phone-numbers/staging/numbers.json` - adds number entry
- ✅ `phone-numbers/staging/assignments.json` - creates assignment
- ✅ `phone-numbers/directory.json` - updates master directory

### When you update an assignment:

```bash
retell phone update "+14155551234" \
  --workspace staging \
  --inbound-agent agent_new123
```

**Automatic updates:**
- ✅ `phone-numbers/staging/assignments.json` - updates assignment
- ✅ `phone-numbers/directory.json` - updates master directory

### When you delete a number:

```bash
retell phone delete "+14155551234" --workspace staging --yes
```

**Automatic updates:**
- ✅ Removes from `phone-numbers/staging/numbers.json`
- ✅ Removes from `phone-numbers/staging/assignments.json`
- ✅ Updates `phone-numbers/directory.json`

## Practical Workflows

### Workflow 1: Audit All Numbers

```bash
# Generate full report
retell phone-dir report > phone-inventory.txt

# Find unassigned
retell phone-dir unassigned --all

# Validate integrity
retell phone-dir validate
```

### Workflow 2: Find Which Agent Handles a Number

**Scenario:** Customer calls +1-415-555-1234, you need to know which agent handled it.

```bash
retell phone-dir show "+14155551234"
```

You immediately see:
- Agent path: `agents/customer-service`
- Agent ID: `agent_staging_abc123`
- Assignment type: `inbound-outbound`

### Workflow 3: List All Numbers for an Agent

**Scenario:** Need to know all phone numbers that route to customer service agent.

```bash
retell phone-dir agent-numbers agents/customer-service
```

Shows all numbers across both workspaces.

### Workflow 4: Migrate Numbers to New Agent

**Scenario:** You're replacing an old agent with a new one.

```bash
# 1. See what numbers the old agent has
retell phone-dir agent-numbers agents/old-agent --json > old-numbers.json

# 2. Get new agent ID from staging.json
NEW_AGENT_ID=$(cat agents/new-agent/staging.json | jq -r '.agent_id')

# 3. Reassign each number
cat old-numbers.json | jq -r '.staging[].phone_number' | while read number; do
  retell phone update "$number" \
    --workspace staging \
    --inbound-agent "$NEW_AGENT_ID"
done

# 4. Verify
retell phone-dir agent-numbers agents/new-agent
```

### Workflow 5: Sync After Twilio Changes

**Scenario:** You configured a new SIP trunk in Twilio Console.

```bash
# Sync Twilio data
retell phone-dir sync-twilio --all

# View updated trunk info
cat phone-numbers/twilio/trunks.json | jq

# Check which numbers are on the new trunk
retell phone-dir list --json | jq '.[] | select(.twilio.trunk_sid == "TKnewtrunk...")'
```

### Workflow 6: Prepare Production Release

**Scenario:** You tested numbers in staging, ready to import to production.

```bash
# 1. See what's in staging but not production
retell phone-dir diff staging production

# 2. Import missing numbers to production
retell phone import "+14155551234" "mytrunk.pstn.twilio.com" \
  --workspace production \
  --username "retell_user" \
  --password "$PROD_PASSWORD" \
  --inbound-agent agent_prod_xyz789

# 3. Validate
retell phone-dir validate
```

## Data Flow

### How Directory Stays in Sync

```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│   Twilio    │────────>│  Directory   │<────────│     Retell     │
│   (Source)  │         │              │         │    (Source)    │
└─────────────┘         └──────────────┘         └────────────────┘
      │                        │                          │
      │ sync-twilio            │ sync-retell             │
      │                        │                          │
      v                        v                          v
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│Phone Numbers│         │ directory.   │         │  Assignments   │
│  Trunks     │────────>│   json       │<────────│  Agent Info    │
│  SIP Config │         │              │         │                │
└─────────────┘         └──────────────┘         └────────────────┘
```

### Auto-update on CLI Operations

```
retell phone import/update/delete
           │
           v
     ┌──────────┐
     │ Retell   │
     │ API Call │
     └──────────┘
           │
           v
     ┌──────────────────────┐
     │ Update Directory     │
     │ - numbers.json       │
     │ - assignments.json   │
     │ - directory.json     │
     └──────────────────────┘
```

## File Format Examples

### directory.json Entry

```json
{
  "+14155551234": {
    "phone_number": "+14155551234",
    "phone_number_pretty": "(415) 555-1234",
    "phone_number_type": "local",
    "provider": "twilio",
    "workspaces": {
      "staging": {
        "imported": true,
        "agent_path": "agents/customer-service",
        "agent_id": "agent_staging_abc123",
        "assignment_type": "inbound-outbound"
      }
    }
  }
}
```

### staging/assignments.json Entry

```json
{
  "phone_number": "+14155551234",
  "agent_path": "agents/customer-service",
  "agent_name": "Customer Service Agent",
  "agent_id": "agent_staging_abc123",
  "assignment_type": "inbound-outbound",
  "assigned_date": "2025-11-16T09:00:00Z"
}
```

## Relationship to Agent Files

### Agent Directory Structure

```
agents/customer-service/
├── agent.json           # Agent configuration
├── staging.json         # Contains: agent_id, llm_id, kb_id
└── production.json      # Contains: agent_id, llm_id, kb_id
```

### Linking Phone Numbers to Agents

The directory uses **agent_id** from metadata files to link numbers:

**1. Get agent ID from staging.json:**
```json
{
  "agent_id": "agent_staging_abc123"
}
```

**2. Find numbers assigned to this agent_id:**
```bash
retell phone-dir agent-numbers agents/customer-service
```

**3. Or reverse lookup (number → agent):**
```bash
retell phone-dir show "+14155551234"
# Shows: agent_path: agents/customer-service
```

## Best Practices

### 1. Regular Syncing

Set up automatic sync (cron job):
```bash
# Every hour
0 * * * * cd /path/to/retell-dev && retell phone-dir sync --all
```

### 2. Validate Before Production Releases

```bash
# Before deploying to production
retell phone-dir validate
retell phone-dir diff staging production
```

### 3. Version Control

**Commit these files:**
- ✅ `phone-numbers/directory.json`
- ✅ `phone-numbers/staging/*.json`
- ✅ `phone-numbers/production/*.json`

**Never commit:**
- ❌ `phone-numbers/twilio/trunks.json` (has credential refs)
- ❌ `phone-numbers/twilio/sync.json` (runtime data)

**Add to .gitignore:**
```gitignore
phone-numbers/twilio/trunks.json
phone-numbers/twilio/sync.json
```

### 4. Backup Before Bulk Operations

```bash
# Backup
cp -r phone-numbers phone-numbers.backup.$(date +%Y%m%d)

# Do bulk operation
./scripts/bulk-reassign.sh

# Restore if needed
cp -r phone-numbers.backup.20251119 phone-numbers
```

## Troubleshooting

### "Number not found in directory"

```bash
# Sync from source
retell phone-dir sync --all

# Or add manually
retell phone import "+14155551234" "mytrunk.pstn.twilio.com" --workspace staging
```

### "Orphaned assignment detected"

This means a number is assigned to an agent that doesn't exist.

```bash
# Find the issue
retell phone-dir validate

# Fix by reassigning
retell phone update "+14155551234" --workspace staging --inbound-agent agent_correct123
```

### "Directory out of sync with Retell"

```bash
# Force sync
retell phone-dir sync-retell --all

# Validate
retell phone-dir validate
```

## Migration Guide

### If you already have phone numbers:

```bash
# 1. Initialize directory
retell phone-dir init

# 2. Sync from existing sources
retell phone-dir sync-twilio --all
retell phone-dir sync-retell --all

# 3. Validate
retell phone-dir validate

# 4. Fix any issues
retell phone-dir unassigned  # See what needs assignment

# 5. Commit
git add phone-numbers/
git commit -m "Initialize phone number directory"
```

## Next Steps

1. **Initialize:** `retell phone-dir init`
2. **Sync:** `retell phone-dir sync --all`
3. **Validate:** `retell phone-dir validate`
4. **Explore:** `retell phone-dir list`
5. **Read docs:** [PHONE_NUMBER_DIRECTORY.md](PHONE_NUMBER_DIRECTORY.md)

## Summary

The Phone Number Directory gives you:

- 📋 **Centralized inventory** of all phone numbers
- 🔗 **Agent assignments** across staging and production
- 🔄 **Auto-sync** with Twilio and Retell
- ✅ **Validation** and integrity checking
- 📊 **Reports** and auditing
- 🔍 **Quick lookups** (number → agent or agent → numbers)

All while integrating seamlessly with your existing `retell phone` commands!
