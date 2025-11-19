# Phone Number Directory System

## Overview

The Phone Number Directory is a centralized tracking system that maintains the relationship between Twilio phone numbers and Retell agents across staging and production workspaces. It provides a single source of truth for phone number assignments, SIP configurations, and agent associations.

## Directory Structure

```
project-root/
├── phone-numbers/                    # Phone number directory root
│   ├── directory.json                # Master directory (all numbers)
│   ├── staging/                      # Staging workspace numbers
│   │   ├── numbers.json              # Staging number registry
│   │   └── assignments.json          # Staging agent assignments
│   ├── production/                   # Production workspace numbers
│   │   ├── numbers.json              # Production number registry
│   │   └── assignments.json          # Production agent assignments
│   └── twilio/                       # Twilio-specific metadata
│       ├── trunks.json               # SIP trunk configurations
│       └── sync.json                 # Last sync timestamps
├── agents/                           # Existing agent directories
│   ├── customer-service/
│   │   ├── agent.json
│   │   ├── staging.json              # Contains agent_id
│   │   └── production.json           # Contains agent_id
└── workspaces.json                   # Workspace API keys
```

## Schema Definitions

### `phone-numbers/directory.json`

Master directory containing all phone numbers across all workspaces.

```json
{
  "version": "1.0.0",
  "last_updated": "2025-11-19T12:00:00Z",
  "numbers": {
    "+14155551234": {
      "phone_number": "+14155551234",
      "phone_number_pretty": "(415) 555-1234",
      "phone_number_type": "local",
      "provider": "twilio",
      "area_code": "415",
      "country_code": "US",
      "capabilities": {
        "voice": true,
        "sms": true,
        "mms": true,
        "fax": false
      },
      "twilio": {
        "phone_number_sid": "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "trunk_sid": "TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "friendly_name": "Customer Service Line",
        "date_created": "2025-11-15T10:00:00Z"
      },
      "workspaces": {
        "staging": {
          "imported": true,
          "import_date": "2025-11-16T09:00:00Z",
          "agent_path": "agents/customer-service",
          "agent_id": "agent_staging_abc123",
          "assignment_type": "inbound-outbound"
        },
        "production": {
          "imported": true,
          "import_date": "2025-11-17T14:00:00Z",
          "agent_path": "agents/customer-service",
          "agent_id": "agent_prod_xyz789",
          "assignment_type": "inbound-outbound"
        }
      },
      "sip_config": {
        "termination_uri": "mytrunk.pstn.twilio.com",
        "origination_uri": "sip:5t4n6j0wnrl.sip.livekit.cloud",
        "auth_type": "credential",
        "has_credentials": true
      },
      "notes": "Primary customer service line",
      "tags": ["customer-service", "sales"]
    }
  },
  "metadata": {
    "total_numbers": 15,
    "by_workspace": {
      "staging": 15,
      "production": 10
    },
    "by_type": {
      "local": 12,
      "toll-free": 3
    },
    "by_provider": {
      "twilio": 15
    },
    "assigned": 12,
    "unassigned": 3
  }
}
```

### `phone-numbers/{workspace}/numbers.json`

Workspace-specific phone number registry.

```json
{
  "workspace": "staging",
  "last_sync": "2025-11-19T12:00:00Z",
  "numbers": [
    {
      "phone_number": "+14155551234",
      "phone_number_pretty": "(415) 555-1234",
      "phone_number_type": "local",
      "provider": "twilio",
      "import_method": "sip-trunk",
      "import_date": "2025-11-16T09:00:00Z",
      "termination_uri": "mytrunk.pstn.twilio.com",
      "auth_username": "retell_user",
      "nickname": "Customer Service Line",
      "inbound_webhook_url": null,
      "assigned": true,
      "last_modified": "2025-11-18T15:30:00Z"
    },
    {
      "phone_number": "+18885551234",
      "phone_number_pretty": "(888) 555-1234",
      "phone_number_type": "toll-free",
      "provider": "twilio",
      "import_method": "direct-purchase",
      "import_date": "2025-11-17T10:00:00Z",
      "termination_uri": null,
      "nickname": "Sales Hotline",
      "assigned": false,
      "last_modified": "2025-11-17T10:00:00Z"
    }
  ],
  "summary": {
    "total": 2,
    "assigned": 1,
    "unassigned": 1,
    "import_methods": {
      "sip-trunk": 1,
      "direct-purchase": 1
    }
  }
}
```

### `phone-numbers/{workspace}/assignments.json`

Agent-to-phone-number assignment mapping.

```json
{
  "workspace": "staging",
  "last_updated": "2025-11-19T12:00:00Z",
  "assignments": [
    {
      "phone_number": "+14155551234",
      "agent_path": "agents/customer-service",
      "agent_name": "Customer Service Agent",
      "agent_id": "agent_staging_abc123",
      "assignment_type": "inbound-outbound",
      "inbound_agent_id": "agent_staging_abc123",
      "outbound_agent_id": "agent_staging_abc123",
      "assigned_date": "2025-11-16T09:00:00Z",
      "last_modified": "2025-11-18T15:30:00Z"
    },
    {
      "phone_number": "+14155555678",
      "agent_path": "agents/sales-agent",
      "agent_name": "Sales Agent",
      "agent_id": "agent_staging_def456",
      "assignment_type": "inbound-only",
      "inbound_agent_id": "agent_staging_def456",
      "outbound_agent_id": null,
      "assigned_date": "2025-11-17T11:00:00Z",
      "last_modified": "2025-11-17T11:00:00Z"
    }
  ],
  "by_agent": {
    "agents/customer-service": ["+14155551234"],
    "agents/sales-agent": ["+14155555678"]
  },
  "unassigned": [
    "+18885551234"
  ]
}
```

### `phone-numbers/twilio/trunks.json`

SIP trunk configuration metadata from Twilio.

```json
{
  "last_sync": "2025-11-19T12:00:00Z",
  "trunks": {
    "TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx": {
      "trunk_sid": "TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "friendly_name": "Main Retell Trunk",
      "domain_name": "mytrunk.pstn.twilio.com",
      "auth_type": "credential_list",
      "credential_list_sid": "CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "origination_urls": [
        {
          "sid": "OUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "sip_url": "sip:+14155551234@5t4n6j0wnrl.sip.livekit.cloud",
          "friendly_name": "Retell Origination",
          "priority": 1,
          "weight": 1
        }
      ],
      "phone_numbers": [
        {
          "phone_number_sid": "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "phone_number": "+14155551234"
        },
        {
          "phone_number_sid": "PNyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
          "phone_number": "+14155555678"
        }
      ],
      "date_created": "2025-11-15T10:00:00Z",
      "date_updated": "2025-11-18T15:30:00Z"
    }
  },
  "credentials": {
    "CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx": {
      "credential_list_sid": "CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "friendly_name": "Retell Credentials",
      "usernames": ["retell_user", "retell_backup"],
      "note": "Passwords not stored - retrieve from secure storage"
    }
  }
}
```

### `phone-numbers/twilio/sync.json`

Synchronization tracking for Twilio API data.

```json
{
  "last_full_sync": "2025-11-19T12:00:00Z",
  "last_incremental_sync": "2025-11-19T12:30:00Z",
  "sync_history": [
    {
      "timestamp": "2025-11-19T12:00:00Z",
      "type": "full",
      "numbers_synced": 15,
      "trunks_synced": 2,
      "duration_ms": 3450,
      "status": "success"
    },
    {
      "timestamp": "2025-11-19T11:00:00Z",
      "type": "incremental",
      "numbers_synced": 1,
      "trunks_synced": 0,
      "duration_ms": 850,
      "status": "success"
    }
  ],
  "next_sync": "2025-11-19T13:00:00Z",
  "sync_interval_minutes": 60
}
```

## Data Relationships

### Phone Number → Agent Association

```
Phone Number (+14155551234)
  ├─ Twilio Metadata
  │   ├─ Phone Number SID: PNxxx...
  │   ├─ Trunk SID: TKxxx...
  │   └─ Friendly Name: "Customer Service Line"
  │
  ├─ SIP Configuration
  │   ├─ Termination URI: mytrunk.pstn.twilio.com
  │   ├─ Origination URI: sip:5t4n6j0wnrl.sip.livekit.cloud
  │   └─ Auth Type: credential
  │
  ├─ Staging Workspace
  │   ├─ Agent Path: agents/customer-service
  │   ├─ Agent ID: agent_staging_abc123
  │   └─ Assignment: inbound-outbound
  │
  └─ Production Workspace
      ├─ Agent Path: agents/customer-service
      ├─ Agent ID: agent_prod_xyz789
      └─ Assignment: inbound-outbound
```

### Agent → Phone Numbers

```
Agent: agents/customer-service
  ├─ Agent Config (agent.json)
  │   └─ Agent Name: "Customer Service Agent"
  │
  ├─ Staging Workspace (staging.json)
  │   ├─ Agent ID: agent_staging_abc123
  │   └─ Phone Numbers:
  │       ├─ +14155551234 (inbound-outbound)
  │       └─ +14155555678 (inbound-only)
  │
  └─ Production Workspace (production.json)
      ├─ Agent ID: agent_prod_xyz789
      └─ Phone Numbers:
          └─ +14155551234 (inbound-outbound)
```

## Assignment Types

| Type | Inbound | Outbound | Description |
|------|---------|----------|-------------|
| `inbound-outbound` | ✅ | ✅ | Agent handles both inbound and outbound calls |
| `inbound-only` | ✅ | ❌ | Agent only receives inbound calls |
| `outbound-only` | ❌ | ✅ | Agent only makes outbound calls |
| `unassigned` | ❌ | ❌ | Number not assigned to any agent |

## Directory Operations

### Initialize Directory

```bash
retell phone-dir init
```

Creates the directory structure and initializes empty files.

### Sync from Twilio

```bash
retell phone-dir sync-twilio --workspace staging
retell phone-dir sync-twilio --workspace production
retell phone-dir sync-twilio --all
```

Fetches phone number data from Twilio and updates the directory.

### Sync from Retell

```bash
retell phone-dir sync-retell --workspace staging
retell phone-dir sync-retell --workspace production
retell phone-dir sync-retell --all
```

Fetches phone number assignments from Retell and updates the directory.

### Full Sync (Both Sources)

```bash
retell phone-dir sync --workspace staging
retell phone-dir sync --all
```

Syncs from both Twilio and Retell, reconciling data.

### List Numbers

```bash
# All numbers
retell phone-dir list

# By workspace
retell phone-dir list --workspace staging

# By agent
retell phone-dir list --agent agents/customer-service

# Unassigned only
retell phone-dir list --unassigned

# JSON output
retell phone-dir list --json
```

### Show Number Details

```bash
retell phone-dir show "+14155551234"
retell phone-dir show "+14155551234" --json
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
  Auth Type: credential

Workspace Assignments:

  Staging:
    ✓ Imported: 2025-11-16T09:00:00Z
    Agent Path: agents/customer-service
    Agent ID: agent_staging_abc123
    Agent Name: Customer Service Agent
    Assignment: inbound-outbound

  Production:
    ✓ Imported: 2025-11-17T14:00:00Z
    Agent Path: agents/customer-service
    Agent ID: agent_prod_xyz789
    Agent Name: Customer Service Agent
    Assignment: inbound-outbound
```

### Show Agent Numbers

```bash
retell phone-dir agent-numbers agents/customer-service
retell phone-dir agent-numbers agents/customer-service --workspace staging
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

### Find Unassigned Numbers

```bash
retell phone-dir unassigned
retell phone-dir unassigned --workspace staging
```

**Output:**
```
Unassigned Numbers in Staging:

+18885551234  toll-free  (888) 555-1234  Sales Hotline
+14159991234  local      (415) 999-1234  No nickname
+14159992345  local      (415) 999-2345  Test Number
```

### Search Numbers

```bash
# By area code
retell phone-dir search --area-code 415

# By type
retell phone-dir search --type toll-free

# By tag
retell phone-dir search --tag customer-service

# By agent
retell phone-dir search --agent agents/sales-agent
```

### Validate Directory

```bash
retell phone-dir validate
```

Checks for:
- Missing agent paths
- Invalid agent IDs
- Orphaned assignments
- Mismatched data between workspaces
- Missing SIP configuration

**Output:**
```
Validating phone number directory...

✓ All numbers have valid Twilio SIDs
✓ All assigned numbers reference existing agents
⚠ 2 numbers missing in production workspace
  - +14155555678 (exists in staging only)
  - +18885551234 (exists in staging only)

✗ 1 orphaned assignment found
  - agents/old-agent has numbers but agent directory doesn't exist

Errors: 1
Warnings: 1
```

### Generate Report

```bash
retell phone-dir report
retell phone-dir report --format json
retell phone-dir report --format csv
retell phone-dir report --output report.json
```

**Output:**
```
Phone Number Directory Report
Generated: 2025-11-19T12:00:00Z

Summary:
  Total Numbers: 15
  Assigned: 12
  Unassigned: 3

By Workspace:
  Staging: 15 numbers, 12 assigned
  Production: 10 numbers, 10 assigned

By Type:
  Local: 12
  Toll-Free: 3

By Provider:
  Twilio: 15

Top Agents by Number Count:
  1. agents/customer-service    4 numbers
  2. agents/sales-agent         3 numbers
  3. agents/support-tier1       2 numbers
  4. agents/support-tier2       2 numbers
  5. agents/emergency-line      1 number

Import Methods:
  SIP Trunk: 12
  Direct Purchase: 3

Recent Activity:
  Last Import: +14159999999 (2025-11-18T15:00:00Z)
  Last Assignment: +14155551234 → agents/customer-service (2025-11-18T15:30:00Z)
  Last Twilio Sync: 2025-11-19T12:00:00Z
```

## Integration with Existing System

### During Phone Number Import

When running `retell phone import`:

```bash
retell phone import "+14155551234" "mytrunk.pstn.twilio.com" \
  --workspace staging \
  --username "retell_user" \
  --password "secure_password" \
  --inbound-agent agent_abc123xyz
```

The CLI automatically:
1. Imports number to Retell
2. Updates `phone-numbers/staging/numbers.json`
3. Creates assignment in `phone-numbers/staging/assignments.json`
4. Updates `phone-numbers/directory.json`
5. Finds agent by agent_id and links to agent_path

### During Agent Assignment

When running `retell phone update`:

```bash
retell phone update "+14155551234" \
  --workspace staging \
  --inbound-agent agent_new123
```

The CLI automatically:
1. Updates Retell phone configuration
2. Updates `phone-numbers/staging/assignments.json`
3. Updates `phone-numbers/directory.json`

### Bidirectional Sync

The directory maintains bidirectional references:

**Phone → Agent:**
```json
{
  "phone_number": "+14155551234",
  "agent_path": "agents/customer-service",
  "agent_id": "agent_staging_abc123"
}
```

**Agent → Phone:**
Read from assignments.json by querying agent_path or agent_id.

## Use Cases

### 1. Find all numbers for an agent

```bash
retell phone-dir agent-numbers agents/customer-service
```

### 2. Find which agent is handling a phone number

```bash
retell phone-dir show "+14155551234"
```

### 3. Audit unassigned numbers

```bash
retell phone-dir unassigned --all
```

### 4. Migrate numbers to new agent

```bash
# Get numbers for old agent
OLD_NUMBERS=$(retell phone-dir agent-numbers agents/old-agent --json | jq -r '.[].phone_number')

# Reassign to new agent
for number in $OLD_NUMBERS; do
  retell phone update "$number" \
    --workspace staging \
    --inbound-agent agent_new123
done

# Sync directory
retell phone-dir sync --workspace staging
```

### 5. Sync Twilio trunk changes

```bash
# After making changes in Twilio Console
retell phone-dir sync-twilio --all

# View updated trunk info
retell phone-dir show "+14155551234"
```

### 6. Generate inventory report

```bash
retell phone-dir report --format csv --output inventory.csv
```

### 7. Find all toll-free numbers

```bash
retell phone-dir search --type toll-free
```

### 8. Validate directory integrity

```bash
# Run before production deployment
retell phone-dir validate
```

## Best Practices

### 1. Regular Syncing

```bash
# Set up cron job for hourly sync
0 * * * * cd /path/to/retell-dev && retell phone-dir sync --all
```

### 2. Version Control

**Commit directory files:**
- ✅ `phone-numbers/directory.json`
- ✅ `phone-numbers/staging/numbers.json`
- ✅ `phone-numbers/staging/assignments.json`
- ✅ `phone-numbers/production/numbers.json`
- ✅ `phone-numbers/production/assignments.json`

**DO NOT commit:**
- ❌ `phone-numbers/twilio/trunks.json` (contains credential references)
- ❌ `phone-numbers/twilio/sync.json` (runtime data)

### 3. Validation Before Release

```bash
# Before releasing to production
retell phone-dir validate
retell phone-dir diff staging production
```

### 4. Backup Before Bulk Operations

```bash
# Backup directory
cp -r phone-numbers phone-numbers.backup.$(date +%Y%m%d_%H%M%S)

# Perform bulk operation
./scripts/bulk-reassign.sh

# If something goes wrong, restore
cp -r phone-numbers.backup.20251119_120000 phone-numbers
```

## Security Considerations

1. **Credentials:** Directory contains references to SIP credentials but NOT the actual passwords
2. **Agent IDs:** Agent IDs are safe to commit (they're workspace-specific, not secrets)
3. **Phone Numbers:** Phone numbers are public information (they're callable)
4. **Twilio SIDs:** Twilio resource SIDs are safe to store (not auth tokens)

## Migration from Existing Setup

If you already have phone numbers configured:

```bash
# 1. Initialize directory
retell phone-dir init

# 2. Sync from Twilio
retell phone-dir sync-twilio --all

# 3. Sync from Retell
retell phone-dir sync-retell --all

# 4. Validate
retell phone-dir validate

# 5. Review and fix any issues
retell phone-dir list --unassigned

# 6. Commit to git
git add phone-numbers/
git commit -m "Initialize phone number directory"
```

## Future Enhancements

1. **Auto-sync on import/update:** Automatically update directory when running `retell phone` commands
2. **Webhook integration:** Track call activity and usage statistics
3. **Cost tracking:** Monitor per-number costs from Twilio
4. **Capacity planning:** Alert when running low on available numbers
5. **Bulk operations:** `retell phone-dir bulk-assign`, `retell phone-dir bulk-import`
6. **Change history:** Track all assignment changes over time
7. **Number pooling:** Group numbers by purpose (sales, support, etc.)
