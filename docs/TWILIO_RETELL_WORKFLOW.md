# Twilio CLI to Retell CLI Workflow Mapping

## Overview

This document maps the workflow of using Twilio CLI to provision phone numbers and configure SIP trunks with the Retell CLI workflow for importing and assigning numbers to agents.

The complete workflow involves:
1. **Twilio**: Provision and configure phone numbers with SIP trunking
2. **Retell**: Import phone numbers and assign to AI agents

## Prerequisites

### Twilio Setup
```bash
# Install Twilio CLI
npm install -g twilio-cli

# Authenticate
export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token
```

### Retell Setup
```bash
# Ensure workspaces are configured
# workspaces.json should exist with both staging and production

# Verify configuration
cat workspaces.json
```

## Workflow Comparison

### Traditional Twilio Console Workflow

```
1. Login to Twilio Console
2. Buy a phone number
3. Configure SIP trunk
4. Add number to trunk
5. Copy SIP details
6. Login to Retell Console
7. Import number with SIP details
8. Assign to agent
```

### Automated CLI Workflow

```
1. Twilio CLI: Search & purchase number
2. Twilio CLI: Get SIP trunk details
3. Retell CLI: Import number with SIP config
4. Retell CLI: Assign to agent
```

---

## Complete Workflow: Phone Number Provisioning

### Step 1: Search for Available Numbers (Twilio)

**Search by Area Code:**
```bash
twilio api:core:available-phone-numbers:local:list \
  --area-code 415 \
  --country-code US \
  -o json | jq '.[] | .phoneNumber' | head -5
```

**Output:**
```json
"+14155551234"
"+14155555678"
"+14155559012"
```

**Search for Toll-Free:**
```bash
twilio api:core:available-phone-numbers:toll-free:list \
  --country-code US \
  -o json | jq '.[] | .phoneNumber' | head -5
```

### Step 2: Purchase Phone Number (Twilio)

```bash
twilio api:core:incoming-phone-numbers:create \
  --phone-number "+14155551234" \
  --friendly-name "Retell Agent Line" \
  -o json
```

**Response:**
```json
{
  "sid": "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "phone_number": "+14155551234",
  "friendly_name": "Retell Agent Line",
  "capabilities": {
    "voice": true,
    "sms": true,
    "mms": true
  }
}
```

**Save the `sid` for later use.**

### Step 3: Get SIP Trunk Details (Twilio)

#### Option A: Use Existing SIP Trunk

**List your SIP trunks:**
```bash
twilio api:trunking:v1:trunks:list -o json
```

**Get trunk details:**
```bash
twilio api:trunking:v1:trunks:fetch \
  --sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -o json
```

**Response:**
```json
{
  "sid": "TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "friendly_name": "My SIP Trunk",
  "domain_name": "mytrunk.pstn.twilio.com",
  "auth_type": "credential_list",
  "auth_type_set": ["credential_list"]
}
```

**Extract:**
- `domain_name`: This is your **termination URI**
- `auth_type`: Authentication method

#### Option B: Create New SIP Trunk

```bash
# Create trunk
twilio api:trunking:v1:trunks:create \
  --friendly-name "Retell Trunk" \
  -o json

# Create credential list
twilio api:core:sip:credential-lists:create \
  --friendly-name "Retell Credentials" \
  -o json

# Add credentials
twilio api:core:sip:credential-lists:credentials:create \
  --credential-list-sid CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --username "retell_user" \
  --password "secure_password_here"

# Associate credential list with trunk
twilio api:trunking:v1:trunks:credential-lists:create \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --credential-list-sid CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Associate Number with SIP Trunk (Twilio)

```bash
twilio api:trunking:v1:trunks:phone-numbers:create \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --phone-number-sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Verify association:**
```bash
twilio api:core:incoming-phone-numbers:fetch \
  --sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -o json | jq '{phoneNumber, trunkSid}'
```

**Output:**
```json
{
  "phoneNumber": "+14155551234",
  "trunkSid": "TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### Step 5: Get SIP Credentials (Twilio)

If using credential-based authentication:

```bash
# List credential lists on trunk
twilio api:trunking:v1:trunks:credential-lists:list \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -o json

# Get credentials
twilio api:core:sip:credential-lists:credentials:list \
  --credential-list-sid CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -o json
```

**Note:** Password is not retrievable after creation. Store securely during creation.

### Step 6: Import Number to Retell (Retell CLI)

Now that you have:
- ✅ Phone number: `+14155551234`
- ✅ Termination URI: `mytrunk.pstn.twilio.com`
- ✅ Username: `retell_user`
- ✅ Password: `secure_password_here`

**Import to Retell staging workspace:**

```bash
retell phone import \
  "+14155551234" \
  "mytrunk.pstn.twilio.com" \
  --workspace staging \
  --username "retell_user" \
  --password "secure_password_here" \
  --nickname "Customer Service Line"
```

**Response:**
```
Importing phone number +14155551234 to staging...

✓ Phone number imported successfully!

Number: +14155551234
Termination URI: mytrunk.pstn.twilio.com
SIP Auth Username: retell_user
Nickname: Customer Service Line

📋 Next Steps:
1. Configure your SIP trunk provider to point to Retell:
   Origination URI: sip:5t4n6j0wnrl.sip.livekit.cloud
   (or with TCP: sip:5t4n6j0wnrl.sip.livekit.cloud;transport=tcp)
2. Route inbound calls to: sip:+14155551234@5t4n6j0wnrl.sip.livekit.cloud
3. Test both inbound and outbound calls
```

### Step 7: Configure Twilio Origination (Twilio)

Configure Twilio to route inbound calls to Retell:

```bash
# Add origination URL to trunk
twilio api:trunking:v1:trunks:origination-urls:create \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --sip-url "sip:+14155551234@5t4n6j0wnrl.sip.livekit.cloud" \
  --friendly-name "Retell Origination" \
  --priority 1 \
  --weight 1
```

**Verify:**
```bash
twilio api:trunking:v1:trunks:origination-urls:list \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -o json
```

### Step 8: Assign to Retell Agent (Retell CLI)

**Option A: Assign during import**
```bash
retell phone import \
  "+14155551234" \
  "mytrunk.pstn.twilio.com" \
  --workspace staging \
  --username "retell_user" \
  --password "secure_password_here" \
  --inbound-agent "agent_abc123xyz" \
  --outbound-agent "agent_abc123xyz"
```

**Option B: Update after import**
```bash
retell phone update "+14155551234" \
  --workspace staging \
  --inbound-agent "agent_abc123xyz" \
  --outbound-agent "agent_abc123xyz"
```

### Step 9: Verify Configuration (Both CLIs)

**Retell: Get phone number details**
```bash
retell phone get "+14155551234" --workspace staging
```

**Output:**
```
Phone Number Details:

Number: +14155551234
Pretty: (415) 555-1234
Type: imported

Agent Configuration:
  Inbound Agent: agent_abc123xyz
  Outbound Agent: agent_abc123xyz

Last Modified: 2025-11-19T12:00:00Z
```

**Twilio: Verify SIP configuration**
```bash
twilio api:core:incoming-phone-numbers:fetch \
  --sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -o json | jq '{phoneNumber, trunkSid, voiceUrl}'
```

---

## Workflow: List All Numbers and SIP Details

### List All Twilio Numbers with SIP Trunks

```bash
twilio api:core:incoming-phone-numbers:list \
  -o json | jq '.[] | {
    phoneNumber: .phoneNumber,
    sid: .sid,
    trunkSid: .trunkSid,
    friendlyName: .friendlyName
  }'
```

**Output:**
```json
{
  "phoneNumber": "+14155551234",
  "sid": "PNaaa...",
  "trunkSid": "TKbbb...",
  "friendlyName": "Retell Agent Line"
}
{
  "phoneNumber": "+14155555678",
  "sid": "PNccc...",
  "trunkSid": null,
  "friendlyName": "No trunk assigned"
}
```

### Get SIP Details for Each Number

For numbers with `trunkSid`:

```bash
#!/bin/bash
# Script: get-sip-details.sh

# Get all numbers with trunks
twilio api:core:incoming-phone-numbers:list -o json | \
jq -r '.[] | select(.trunkSid != null) | .trunkSid' | \
sort -u | \
while read trunk_sid; do
  echo "Trunk: $trunk_sid"

  # Get trunk details
  twilio api:trunking:v1:trunks:fetch \
    --sid "$trunk_sid" \
    -o json | jq '{
      domainName,
      authType,
      friendlyName
    }'

  # Get origination URLs
  echo "Origination URLs:"
  twilio api:trunking:v1:trunks:origination-urls:list \
    --trunk-sid "$trunk_sid" \
    -o json | jq '.[] | .sipUrl'

  echo "---"
done
```

### List All Retell Numbers

```bash
retell phone list --workspace staging
```

**Output:**
```
Phone Numbers in staging (2 total):

────────────────────────────────────────────────────────
Number: +14155551234
Pretty: (415) 555-1234
Type: imported
Nickname: Customer Service Line
Inbound Agent: agent_abc123xyz
Outbound Agent: agent_abc123xyz

────────────────────────────────────────────────────────
Number: +18885551234
Pretty: (888) 555-1234
Type: toll-free
Inbound Agent: agent_def456uvw
```

---

## Batch Operations

### Import Multiple Numbers from Twilio to Retell

**Script: `import-twilio-numbers.sh`**

```bash
#!/bin/bash

# Configuration
TRUNK_SID="TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TERMINATION_URI="mytrunk.pstn.twilio.com"
USERNAME="retell_user"
PASSWORD="secure_password"
WORKSPACE="staging"
DEFAULT_AGENT="agent_abc123xyz"

# Get all numbers on trunk
echo "Fetching numbers from Twilio trunk..."
NUMBERS=$(twilio api:trunking:v1:trunks:phone-numbers:list \
  --trunk-sid "$TRUNK_SID" \
  -o json | jq -r '.[].phoneNumber')

echo "Found $(echo "$NUMBERS" | wc -l) numbers"

# Import each number to Retell
for number in $NUMBERS; do
  echo "Importing $number..."

  retell phone import \
    "$number" \
    "$TERMINATION_URI" \
    --workspace "$WORKSPACE" \
    --username "$USERNAME" \
    --password "$PASSWORD" \
    --inbound-agent "$DEFAULT_AGENT" \
    --outbound-agent "$DEFAULT_AGENT" \
    --nickname "Imported from Twilio"

  echo "✓ $number imported"
  echo ""
done

echo "All numbers imported!"
```

### Sync Twilio Numbers to Retell

**Script: `sync-numbers.sh`**

```bash
#!/bin/bash

# Get numbers from Twilio
TWILIO_NUMBERS=$(twilio api:core:incoming-phone-numbers:list \
  -o json | jq -r '.[] | .phoneNumber')

# Get numbers from Retell
RETELL_NUMBERS=$(retell phone list --workspace staging --json | \
  jq -r '.[] | .phone_number')

# Find numbers in Twilio but not in Retell
echo "Numbers in Twilio but not in Retell:"
comm -23 \
  <(echo "$TWILIO_NUMBERS" | sort) \
  <(echo "$RETELL_NUMBERS" | sort)
```

---

## Reference: Command Mapping

| Task | Twilio CLI | Retell CLI |
|------|------------|------------|
| **Search Numbers** | `twilio api:core:available-phone-numbers:local:list` | N/A (use Twilio) |
| **Purchase Number** | `twilio api:core:incoming-phone-numbers:create` | `retell phone create` |
| **List Numbers** | `twilio api:core:incoming-phone-numbers:list` | `retell phone list` |
| **Get Number Details** | `twilio api:core:incoming-phone-numbers:fetch` | `retell phone get` |
| **Update Number** | `twilio api:core:incoming-phone-numbers:update` | `retell phone update` |
| **Delete Number** | `twilio api:core:incoming-phone-numbers:delete` | `retell phone delete` |
| **Import via SIP** | Configure trunk + origination | `retell phone import` |
| **List SIP Trunks** | `twilio api:trunking:v1:trunks:list` | N/A |
| **Get SIP Details** | `twilio api:trunking:v1:trunks:fetch` | Included in import |
| **Assign to Agent** | N/A | `retell phone update --inbound-agent` |

---

## Retell CLI Phone Commands Reference

Based on `src/cli/commands/phone.ts`:

### `retell phone create`

Purchase a new phone number directly from Retell (via Twilio or Telnyx provider):

```bash
retell phone create \
  --workspace staging \
  --area-code 415 \
  --country US \
  --provider twilio \
  --inbound-agent agent_abc123xyz \
  --nickname "Direct Purchase"
```

**Options:**
- `--workspace` - Target workspace (staging or production)
- `--area-code` - US area code (3 digits)
- `--country` - Country code (US or CA)
- `--provider` - Provider (twilio or telnyx)
- `--toll-free` - Purchase toll-free number
- `--inbound-agent` - Agent ID for inbound calls
- `--outbound-agent` - Agent ID for outbound calls
- `--nickname` - Nickname for the number
- `--webhook` - Inbound webhook URL

### `retell phone import`

Import existing phone number via SIP trunk:

```bash
retell phone import \
  "+14155551234" \
  "mytrunk.pstn.twilio.com" \
  --workspace staging \
  --username "retell_user" \
  --password "secure_password" \
  --inbound-agent agent_abc123xyz \
  --nickname "Imported Number"
```

**Arguments:**
1. `phone-number` - E.164 format (e.g., +14155551234)
2. `termination-uri` - SIP trunk URI (e.g., mytrunk.pstn.twilio.com)

**Options:**
- `--workspace` - Target workspace
- `--username` - SIP trunk auth username
- `--password` - SIP trunk auth password
- `--inbound-agent` - Agent ID for inbound calls
- `--outbound-agent` - Agent ID for outbound calls
- `--inbound-version` - Inbound agent version
- `--outbound-version` - Outbound agent version
- `--nickname` - Nickname for the number
- `--webhook` - Inbound webhook URL

**Important:** After importing, you must configure Twilio trunk origination to point to Retell:
```
Origination URI: sip:5t4n6j0wnrl.sip.livekit.cloud
```

### `retell phone list`

List all phone numbers in workspace:

```bash
retell phone list --workspace staging
retell phone list --workspace production --json
```

**Options:**
- `--workspace` - Target workspace
- `--json` - Output as JSON

### `retell phone get`

Get phone number details:

```bash
retell phone get "+14155551234" --workspace staging
retell phone get "+14155551234" --json
```

**Arguments:**
1. `phone-number` - E.164 format

**Options:**
- `--workspace` - Target workspace
- `--json` - Output as JSON

### `retell phone update`

Update phone number configuration:

```bash
retell phone update "+14155551234" \
  --workspace staging \
  --inbound-agent agent_new123 \
  --nickname "Updated Name"
```

**Arguments:**
1. `phone-number` - E.164 format

**Options:**
- `--workspace` - Target workspace
- `--inbound-agent` - Agent ID for inbound (use "null" to disable)
- `--outbound-agent` - Agent ID for outbound (use "null" to disable)
- `--inbound-version` - Inbound agent version
- `--outbound-version` - Outbound agent version
- `--nickname` - Nickname
- `--webhook` - Webhook URL

**Note:** Cannot update SIP trunk configuration. Must delete and re-import.

### `retell phone delete`

Delete phone number:

```bash
retell phone delete "+14155551234" --workspace staging --yes
```

**Arguments:**
1. `phone-number` - E.164 format

**Options:**
- `--workspace` - Target workspace
- `--yes` - Skip confirmation prompt

---

## Common Workflows

### Workflow 1: Quick Number Purchase and Assignment

```bash
# Purchase directly through Retell (no SIP config needed)
retell phone create \
  --workspace staging \
  --area-code 415 \
  --provider twilio \
  --inbound-agent agent_abc123xyz \
  --outbound-agent agent_abc123xyz \
  --nickname "Quick Purchase"
```

### Workflow 2: Import Existing Twilio Number

```bash
# 1. Get number from Twilio
PHONE_NUMBER="+14155551234"

# 2. Get trunk details
TRUNK_SID=$(twilio api:core:incoming-phone-numbers:list -o json | \
  jq -r ".[] | select(.phoneNumber == \"$PHONE_NUMBER\") | .trunkSid")

TERMINATION_URI=$(twilio api:trunking:v1:trunks:fetch \
  --sid "$TRUNK_SID" -o json | jq -r '.domainName')

# 3. Import to Retell
retell phone import \
  "$PHONE_NUMBER" \
  "$TERMINATION_URI" \
  --workspace staging \
  --username "retell_user" \
  --password "$SIP_PASSWORD" \
  --inbound-agent agent_abc123xyz

# 4. Configure Twilio origination
twilio api:trunking:v1:trunks:origination-urls:create \
  --trunk-sid "$TRUNK_SID" \
  --sip-url "sip:$PHONE_NUMBER@5t4n6j0wnrl.sip.livekit.cloud" \
  --priority 1 \
  --weight 1
```

### Workflow 3: Bulk Agent Assignment

```bash
# Assign all numbers to a new agent
AGENT_ID="agent_new123xyz"

retell phone list --workspace staging --json | \
jq -r '.[].phone_number' | \
while read number; do
  retell phone update "$number" \
    --workspace staging \
    --inbound-agent "$AGENT_ID" \
    --outbound-agent "$AGENT_ID"
  echo "✓ Updated $number"
done
```

### Workflow 4: Migrate Numbers from Staging to Production

```bash
#!/bin/bash

# Get all numbers from staging
NUMBERS=$(retell phone list --workspace staging --json)

# For each number
echo "$NUMBERS" | jq -r '.[] | @base64' | while read row; do
  _jq() {
    echo "$row" | base64 --decode | jq -r "$1"
  }

  NUMBER=$(_jq '.phone_number')
  NICKNAME=$(_jq '.nickname')
  INBOUND_AGENT=$(_jq '.inbound_agent_id')

  echo "Migrating $NUMBER to production..."

  # Create in production (if using Retell-managed numbers)
  retell phone create \
    --workspace production \
    --phone-number "$NUMBER" \
    --inbound-agent "$INBOUND_AGENT" \
    --nickname "$NICKNAME"
done
```

---

## Troubleshooting

### Issue: Number not receiving calls

**Check Twilio origination:**
```bash
twilio api:trunking:v1:trunks:origination-urls:list \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Verify Retell import:**
```bash
retell phone get "+14155551234" --workspace staging
```

### Issue: Authentication failures

**Verify SIP credentials:**
```bash
twilio api:core:sip:credential-lists:credentials:list \
  --credential-list-sid CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Re-import with correct credentials:**
```bash
retell phone delete "+14155551234" --workspace staging --yes
retell phone import "+14155551234" "mytrunk.pstn.twilio.com" \
  --workspace staging \
  --username "correct_username" \
  --password "correct_password"
```

### Issue: Cannot update SIP trunk settings

**Solution:** Delete and re-import:
```bash
# Delete
retell phone delete "+14155551234" --workspace staging --yes

# Re-import with new settings
retell phone import "+14155551234" "newtrunk.pstn.twilio.com" \
  --workspace staging \
  --username "new_user" \
  --password "new_password"
```

---

## Summary

**Twilio CLI** handles:
- Phone number search and purchase
- SIP trunk creation and configuration
- Credential management
- Origination/termination setup

**Retell CLI** handles:
- Phone number import via SIP
- Agent assignment
- Webhook configuration
- Multi-workspace management

**Integration Flow:**
```
Twilio CLI → Phone Number + SIP Config → Retell CLI → Agent Assignment
```

This separation allows:
- Twilio expertise for telephony infrastructure
- Retell specialization for AI agent management
- Clean integration via SIP trunking
- Independent scaling of each component
