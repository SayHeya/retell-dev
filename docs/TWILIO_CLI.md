# Twilio CLI Documentation

## Overview

The Twilio CLI is a command-line interface tool that allows developers to manage Twilio resources directly from the terminal. It provides comprehensive functionality for phone number provisioning, SIP trunk configuration, and telephony management without needing to use the Twilio Console web interface.

## Installation

### Prerequisites
- **Node.js**: Version 18+ (LTS)
- **npm**: Installed with Node.js
- **Twilio Account**: Active account with API credentials

### Install Twilio CLI

```bash
npm install -g twilio-cli
```

### Authentication

The CLI supports multiple authentication methods:

**Method 1: Environment Variables (Recommended)**
```bash
export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token_here
```

**Method 2: Interactive Login**
```bash
twilio login
# You'll be prompted for Account SID and Auth Token
```

**Method 3: Profiles**
```bash
twilio profiles:create --profile staging
twilio profiles:create --profile production
twilio profiles:use staging
```

## Core Functionality

### 1. Phone Number Management

#### Search for Available Numbers

**Local Numbers by Area Code:**
```bash
twilio api:core:available-phone-numbers:local:list \
  --area-code 415 \
  --country-code US
```

**Toll-Free Numbers:**
```bash
twilio api:core:available-phone-numbers:toll-free:list \
  --country-code US
```

**Output Format:**
- Returns array of available phone numbers in E.164 format
- Includes capabilities (Voice, SMS, MMS)
- Shows locality information (city, region)

#### Purchase Phone Numbers

**Purchase a Specific Number:**
```bash
twilio api:core:incoming-phone-numbers:create \
  --phone-number "+14155551234"
```

**Purchase with Configuration:**
```bash
twilio api:core:incoming-phone-numbers:create \
  --phone-number "+14155551234" \
  --friendly-name "Customer Service Line" \
  --voice-url "https://example.com/voice" \
  --sms-url "https://example.com/sms"
```

**Response:**
```json
{
  "sid": "PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "phone_number": "+14155551234",
  "phone_number_pretty": "(415) 555-1234",
  "friendly_name": "Customer Service Line",
  "capabilities": {
    "voice": true,
    "sms": true,
    "mms": true,
    "fax": false
  },
  "date_created": "2025-11-19T12:00:00Z"
}
```

#### List All Phone Numbers

**Basic List:**
```bash
twilio api:core:incoming-phone-numbers:list
```

**JSON Output:**
```bash
twilio api:core:incoming-phone-numbers:list -o json
```

**Custom Properties (TSV):**
```bash
twilio api:core:incoming-phone-numbers:list \
  -o tsv \
  --properties "phoneNumber,sid,trunkSid,friendlyName"
```

**Key Properties Returned:**
- `sid` - Phone number SID (PN...)
- `phoneNumber` - E.164 format (+1234567890)
- `phoneNumberPretty` - Formatted number ((123) 456-7890)
- `friendlyName` - Custom name/label
- `trunkSid` - Associated SIP trunk SID (TK...) if configured
- `capabilities` - Object with voice/SMS/MMS/fax booleans
- `voiceUrl` - Webhook URL for incoming calls
- `smsUrl` - Webhook URL for incoming SMS
- `voiceApplicationSid` - TwiML App SID for voice
- `smsApplicationSid` - TwiML App SID for SMS
- `accountSid` - Parent account
- `dateCreated` - Creation timestamp
- `dateUpdated` - Last modification timestamp

#### Get Phone Number Details

```bash
twilio api:core:incoming-phone-numbers:fetch \
  --sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  -o json
```

#### Update Phone Number Configuration

```bash
twilio api:core:incoming-phone-numbers:update \
  --sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --friendly-name "New Name" \
  --voice-url "https://new-url.com/voice"
```

#### Delete Phone Number

```bash
twilio api:core:incoming-phone-numbers:delete \
  --sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. SIP Trunk Management

#### List SIP Domains

```bash
twilio api:core:sip:domains:list -o json
```

**Key Properties:**
- `domainName` - Your SIP domain (e.g., `yourname.sip.twilio.com`)
- `friendlyName` - Custom display name
- `authType` - Authentication method (IP_ACL, CREDENTIAL_LIST)
- `voiceUrl` - Webhook for incoming SIP calls
- `voiceMethod` - HTTP method (GET/POST)
- `sipRegistration` - Enable/disable SIP registration
- `emergencyCallingEnabled` - Emergency call support
- `dateCreated` / `dateUpdated` - Timestamps

#### Create SIP Domain

```bash
twilio api:core:sip:domains:create \
  --domain-name "mycompany.sip.twilio.com" \
  --friendly-name "My Company SIP Domain" \
  --voice-url "https://example.com/voice"
```

#### List Phone Numbers on SIP Trunk

```bash
twilio api:trunking:v1:trunks:phone-numbers:list \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Returns:**
- Phone numbers associated with the trunk
- Capabilities (voice, SMS, MMS)
- SIP trunk configuration

#### Add Phone Number to SIP Trunk

```bash
twilio api:trunking:v1:trunks:phone-numbers:create \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --phone-number-sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. SIP Details and URIs

#### SIP URI Format

When a phone number is associated with a SIP domain or trunk:

**SIP Domain Format:**
```
sip:+14155551234@yourname.sip.twilio.com
```

**SIP Trunk Format:**
```
sip:+14155551234@yourname.sip.{edge}.twilio.com
```

Where `{edge}` is a geographical edge location (e.g., `us1`, `ie1`, `au1`)

#### Get SIP Termination URI

When you provision a number via SIP trunk, Twilio provides a termination URI:
```
yourtrunk.pstn.twilio.com
```

This is where you send outbound calls.

#### Get SIP Origination URI

For inbound calls to reach your infrastructure:
```
sip:yourendpoint@yourserver.com
```

Configure this in your trunk's Origination settings.

### 4. Output Formatting

The Twilio CLI supports multiple output formats:

#### Default (Human-Readable Table)
```bash
twilio api:core:incoming-phone-numbers:list
```

#### JSON Format
```bash
twilio api:core:incoming-phone-numbers:list -o json
```

#### TSV with Specific Properties
```bash
twilio api:core:incoming-phone-numbers:list \
  -o tsv \
  --properties "phoneNumber,sid,trunkSid,capabilities"
```

#### Pagination
```bash
# Limit results
twilio api:core:incoming-phone-numbers:list --page-size 10

# Get specific page
twilio api:core:incoming-phone-numbers:list --page-size 10 --page 2
```

## Advanced Features

### 1. Regulatory Compliance

Many countries require regulatory documentation before provisioning numbers:

```bash
twilio api:core:incoming-phone-numbers:create \
  --phone-number "+14155551234" \
  --address-sid ADxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --bundle-sid BUxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Key Parameters:**
- `--address-sid`: Registered address for the number
- `--bundle-sid`: Regulatory bundle (for hosted numbers)

### 2. Emergency Services Configuration

```bash
twilio api:core:incoming-phone-numbers:update \
  --sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --emergency-address-sid ADxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Voice Configuration

```bash
twilio api:core:incoming-phone-numbers:update \
  --sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --voice-url "https://example.com/voice" \
  --voice-method "POST" \
  --status-callback "https://example.com/status" \
  --status-callback-method "POST"
```

### 4. SMS Configuration

```bash
twilio api:core:incoming-phone-numbers:update \
  --sid PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --sms-url "https://example.com/sms" \
  --sms-method "POST"
```

### 5. SIP Authentication

#### IP Access Control Lists
```bash
twilio api:core:sip:ip-access-control-lists:create \
  --friendly-name "Office IPs"

twilio api:core:sip:ip-access-control-lists:ip-addresses:create \
  --ip-access-control-list-sid ALxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --friendly-name "Office Network" \
  --ip-address "203.0.113.0/24"
```

#### Credential Lists
```bash
twilio api:core:sip:credential-lists:create \
  --friendly-name "SIP Credentials"

twilio api:core:sip:credential-lists:credentials:create \
  --credential-list-sid CLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --username "sipuser" \
  --password "secure_password"
```

## Best Practices

### 1. Use Environment Variables for Authentication
```bash
# In .env file
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token

# Never commit credentials to version control
```

### 2. Test with Staging Numbers First
- Purchase test numbers in development
- Validate webhooks and SIP configuration
- Release to production only after testing

### 3. Monitor API Usage
```bash
# Check account balance
twilio api:core:accounts:fetch --sid ACxxxxxxxxxxxxxxxxxxxxx

# View usage records
twilio api:core:usage:records:list
```

### 4. Handle Rate Limits
- Twilio enforces rate limits on API calls
- Implement exponential backoff for retries
- Batch operations when possible

### 5. E.164 Format is Required
All phone numbers must be in E.164 format:
- Include country code: `+1` for US/Canada
- No formatting characters: `+14155551234` not `(415) 555-1234`
- Use leading `+`: `+14155551234` not `14155551234`

## Troubleshooting

### Common Issues

**1. Authentication Failures**
```bash
# Verify credentials
twilio api:core:accounts:fetch --sid $TWILIO_ACCOUNT_SID

# Re-login
twilio login --force
```

**2. Number Not Available**
```bash
# Search again with different area code
twilio api:core:available-phone-numbers:local:list \
  --area-code 510 \
  --country-code US
```

**3. Regulatory Requirements**
```
Error: Address or Bundle required for this country
```
Solution: Create address/bundle before purchasing:
```bash
twilio api:core:addresses:create \
  --friendly-name "Business Address" \
  --street "123 Main St" \
  --city "San Francisco" \
  --region "CA" \
  --postal-code "94105" \
  --iso-country "US"
```

**4. SIP Trunk Configuration**
```bash
# Verify trunk exists
twilio api:trunking:v1:trunks:fetch \
  --sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Check origination settings
twilio api:trunking:v1:trunks:origination-urls:list \
  --trunk-sid TKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Resources

### Official Documentation
- Twilio CLI: https://www.twilio.com/docs/twilio-cli
- Phone Numbers API: https://www.twilio.com/docs/phone-numbers/api
- SIP Trunking: https://www.twilio.com/docs/sip-trunking

### Command Reference
```bash
# Get help for any command
twilio api:core:incoming-phone-numbers:create --help

# List all available commands
twilio --help

# Get version
twilio --version
```

### API Explorer
- Interactive API testing: https://www.twilio.com/console/runtime/api-explorer

## Summary

The Twilio CLI provides:
- **Phone Number Provisioning**: Search, purchase, configure, and delete
- **SIP Management**: Domains, trunks, authentication
- **Flexible Output**: JSON, TSV, human-readable tables
- **Complete Control**: All Twilio APIs accessible via CLI
- **Automation Ready**: Scriptable for CI/CD and bulk operations

For Retell integration, the key capabilities are:
1. Provisioning phone numbers programmatically
2. Configuring SIP trunks for number import
3. Retrieving SIP URIs and termination details
4. Managing number assignments and webhooks
