# Retell CLI

[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/suisuss-heya/a32f943eba9c91d240ffdc9c02c8872c/raw/retell-cli-coverage.json)](https://github.com/anthropics/claude-code)
[![Tests](https://img.shields.io/badge/tests-216%20passed-brightgreen)](https://github.com/anthropics/claude-code)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/anthropics/claude-code)

A TypeScript CLI tool for managing Retell AI agents across workspaces with composable prompts and file-based configuration.

## Features

- 🔄 **Workspace Management**: Manage staging and production environments separately
- 📝 **Composable Prompts**: Build complex prompts from reusable sections
- 🔐 **Secure Configuration**: API keys stored in `workspaces.json` (gitignored)
- ✅ **Configuration Validation**: Required workspace setup prevents accidental operations
- 🚀 **Push/Pull**: Sync agents between local and Retell workspace
- 📊 **Status Tracking**: View sync status and detect configuration drift
- 🧪 **Tested**: Comprehensive test suite with 93.37% coverage (216 tests passing)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file with your Retell API keys:

```env
RETELL_STAGING_API_KEY=key_your_staging_key_here
RETELL_PRODUCTION_API_KEY=key_your_production_key_here
```

### 3. Initialize Workspace Configuration

Generate `workspaces.json` from your environment variables:

```bash
npm run build
node bin/retell.js workspace init
```

This creates a `workspaces.json` file with your workspace configuration.

### 4. Create Your First Agent

```bash
# Create an agent from a template
node bin/retell.js init my-first-agent

# Push to staging workspace
node bin/retell.js push my-first-agent -w staging

# List agents in workspace
node bin/retell.js list -w staging
```

## Commands

### Workspace Management

```bash
# Initialize workspace configuration from .env
retell workspace init

# Force regenerate workspaces.json
retell workspace init --force
```

### Agent Management

```bash
# Create new agent from template
retell init <agent-name> [--template <template>]

# Create multiple agents from a template (local only)
retell bulk-create [options]

# Update agent configuration field
retell update <agent-name> <field> <value> [--type <type>]

# Push agent to workspace (staging first, then production)
retell push <agent-name> [-w staging|production]

# Pull agent from workspace
retell pull <agent-name> [-w staging|production]

# Check sync status
retell status <agent-name> [-w staging|production]

# List all agents in workspace
retell list [-w staging|production]
```

### Phone Number Management

```bash
# Purchase a new phone number
retell phone create [--area-code <code>] [--country US|CA] [--provider twilio|telnyx]

# Import number via SIP trunk (bring your own number)
retell phone import <phone-number> <termination-uri> [options]

# List all phone numbers
retell phone list [-w staging|production] [--json]

# Get phone number details
retell phone get <phone-number> [-w staging|production]

# Update phone number configuration
retell phone update <phone-number> [--inbound-agent <id>] [--outbound-agent <id>]

# Delete phone number
retell phone delete <phone-number> [-w staging|production] --yes
```

**Important Workflow:**
1. Use `bulk-create` or `init` to create agents locally
2. Push to `staging` first: `retell push <agent> -w staging`
3. Test in staging environment
4. Push to `production`: `retell push <agent> -w production`

**Production Push Protection:**
- Cannot push to production unless the agent exists in staging
- Local version must match staging version (same hash)
- Use `--force` to override (not recommended)

#### Bulk Create Command

The `bulk-create` command allows you to create multiple agents at once from a template. This is useful for testing, load testing, or setting up multiple similar agents.

**Options:**
- `-c, --count <number>` - Number of agents to create (1-1000, default: 10)
- `-t, --template <template>` - Template name to use (default: "basic")
- `-p, --prefix <prefix>` - Agent name prefix (default: "agent")
- `--path <path>` - Path to agents directory (default: "./agents")
- `--templates <path>` - Path to templates directory (default: "./templates")
- `--skip-validation` - Skip workspace validation (not recommended)
- `-y, --yes` - Skip confirmation prompt

**Examples:**

```bash
# Create 10 agents with default settings
retell bulk-create

# Create 50 agents with custom prefix
retell bulk-create --count 50 --prefix test-agent

# Create 5 agents from custom template
retell bulk-create --count 5 --template advanced --prefix prod

# Skip confirmation (useful for scripts)
retell bulk-create --count 20 --yes
```

**Features:**
- Validates workspace configuration before creating agents
- Automatically names agents sequentially (e.g., agent-001, agent-002)
- Detects and skips existing agents
- Creates proper directory structure with knowledge/ folder
- Generates metadata files (staging.json, production.json)
- Customizes agent names and prompts for each agent
- Shows progress and detailed summary

#### Update Command

The `update` command allows you to modify any field in an agent's `agent.json` configuration via the CLI, including nested fields.

**Usage:**
```bash
retell update <agent-name> <field> <value> [options]
```

**Options:**
- `-p, --path <path>` - Path to agents directory (default: "./agents")
- `--type <type>` - Type of value (string|number|boolean|json|array|auto) (default: "auto")

**Examples:**

```bash
# Update a number field
retell update my-agent voice_speed 1.2

# Update a boolean field
retell update my-agent enable_backchannel false

# Update a string field
retell update my-agent agent_name "New Agent Name"

# Update a nested field using dot notation
retell update my-agent llm_config.temperature 0.8
retell update my-agent llm_config.model "gpt-4o"

# Update an array field with JSON
retell update my-agent boosted_keywords '["support","help","question"]' --type json

# Update a complex object field
retell update my-agent pronunciation_dictionary '[{"word":"API","pronunciation":"A P I"}]' --type json
```

**Supported Fields:**

All agent configuration fields can be updated, including:
- **Agent-level:** `agent_name`, `voice_id`, `voice_speed`, `voice_temperature`, `interruption_sensitivity`, `responsiveness`, `language`, `enable_backchannel`, `backchannel_frequency`, `ambient_sound`, `boosted_keywords`, `pronunciation_dictionary`, `normalize_for_speech`, `webhook_url`, `post_call_analysis_data`
- **LLM config:** `llm_config.model`, `llm_config.temperature`, `llm_config.general_prompt`, `llm_config.begin_message`, `llm_config.tools`
- **Prompt config:** `llm_config.prompt_config.sections`, `llm_config.prompt_config.overrides`, `llm_config.prompt_config.variables`, `llm_config.prompt_config.dynamic_variables`

**Features:**
- Auto-detects value types (number, boolean, string, JSON)
- Validates configuration against schema before saving
- Supports dot notation for nested fields (e.g., `llm_config.temperature`)
- Shows both old and new values
- Reminds you to push changes to sync with Retell workspace

#### Phone Number Management

The `phone` command group provides comprehensive phone number and SIP trunk management capabilities.

**Phone Create** - Purchase numbers from Retell's providers:
```bash
# Purchase with auto-selected area code
retell phone create -w staging

# Purchase with specific area code and configuration
retell phone create \
  --area-code 415 \
  --country US \
  --provider twilio \
  --inbound-agent agent_customer_service \
  --outbound-agent agent_sales \
  --nickname "Main Support Line"
```

**Phone Import** - Import your own numbers via SIP trunk:
```bash
# Basic import with SIP trunk
retell phone import +14157774444 mytrunk.pstn.twilio.com \
  --username myuser \
  --password mypass \
  --inbound-agent agent_support \
  --nickname "Support Hotline"

# Import with all options
retell phone import +14157774444 trunk.example.com \
  -w staging \
  --username sip_user \
  --password sip_pass \
  --inbound-agent agent_inbound \
  --outbound-agent agent_outbound \
  --inbound-version 2 \
  --outbound-version 3 \
  --nickname "VIP Line" \
  --webhook https://example.com/webhook
```

After importing, configure your SIP provider:
- **Origination URI:** `sip:5t4n6j0wnrl.sip.livekit.cloud`
- **Inbound routing:** `sip:+14157774444@5t4n6j0wnrl.sip.livekit.cloud`
- **Authentication:** Use username/password (recommended) or IP whitelisting

**Phone List** - View all numbers:
```bash
# List all numbers in staging
retell phone list -w staging

# List with JSON output
retell phone list -w production --json
```

**Phone Get** - Get number details:
```bash
# Get detailed information
retell phone get +14157774444 -w staging

# Get as JSON
retell phone get +14157774444 --json
```

**Phone Update** - Update number configuration:
```bash
# Assign different agents
retell phone update +14157774444 \
  --inbound-agent agent_new_support \
  --outbound-agent agent_new_sales

# Update nickname and webhook
retell phone update +14157774444 \
  --nickname "Updated Support" \
  --webhook https://new.example.com/webhook

# Disable inbound/outbound
retell phone update +14157774444 \
  --inbound-agent null \
  --outbound-agent null
```

**Note:** To update SIP trunk configuration (termination URI or credentials), you must delete and re-import the number.

**Phone Delete** - Remove number:
```bash
# Delete with confirmation
retell phone delete +14157774444 -w staging --yes
```

**SIP Trunk Integration:**

Retell supports two SIP integration methods:

1. **Elastic SIP Trunking** (Recommended):
   - Full feature support including call transfer
   - Numbers appear in dashboard
   - Use `phone import` command

2. **Dial to SIP Endpoint**:
   - For providers without elastic SIP support
   - Requires custom integration code
   - See API documentation for details

**Template Structure:**

Templates are JSON files in the `templates/` directory. Example `basic.json`:

```json
{
  "agent_name": "Basic Agent",
  "voice_id": "11labs-Adrian",
  "language": "en-US",
  "llm_config": {
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "general_prompt": "You are a helpful AI assistant."
  }
}
```

## Project Structure

```
retell-dev/
├── src/
│   ├── cli/              # CLI commands
│   │   └── commands/     # Individual command implementations
│   ├── core/             # Core business logic
│   ├── api/              # Retell API client
│   ├── config/           # Configuration management
│   ├── schemas/          # Zod validation schemas
│   └── types/            # TypeScript type definitions
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   ├── e2e/              # End-to-end tests
│   └── fixtures/         # Test fixtures and templates
├── scripts/              # Utility scripts
├── docs/                 # Documentation
├── .env                  # Environment variables (gitignored)
└── workspaces.json       # Workspace configuration (gitignored)
```

## Configuration

### Required Files

**`.env`** - Contains API keys (automatically loaded):
```env
RETELL_STAGING_API_KEY=key_xxx
RETELL_PRODUCTION_API_KEY=key_yyy
```

**`workspaces.json`** - Generated from `.env`, contains workspace configuration:
```json
{
  "staging": {
    "api_key": "key_xxx",
    "name": "Development Workspace",
    "base_url": "https://api.retellai.com"
  },
  "production": {
    "api_key": "key_yyy",
    "name": "Production Workspace",
    "base_url": "https://api.retellai.com"
  }
}
```

### Security Notes

- Add `.env` and `workspaces.json` to `.gitignore`
- Never commit API keys to version control
- Use environment-specific keys for staging vs production

## Development

```bash
# Install dependencies
npm install

# Build the CLI
npm run build

# Run type checking
npm run type-check

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Run tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # E2E tests only

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Testing

The project uses a comprehensive testing strategy:

- **Unit Tests** (`tests/unit/`): Test individual modules in isolation
- **Integration Tests** (`tests/integration/`): Test module interactions
- **E2E Tests** (`tests/e2e/`): Test complete workflows
- **CLI Tests** (`tests/cli-test.sh`): Test CLI commands

### Running Tests

```bash
# All tests
npm test

# Specific suite
npm run test:unit

# With coverage
npm run test:coverage

# CI pipeline
npm run test:ci
```

## Documentation

- [Technical Specification](./docs/TECHNICAL_SPECIFICATION.md) - Detailed technical documentation
- [Workspace Validation](./WORKSPACE_VALIDATION.md) - Workspace configuration guide
- [Workspace Limit Testing](./WORKSPACE_LIMIT_TEST_RESULTS.md) - Testing results for workspace limits
- [Scripts Documentation](./scripts/README.md) - Utility scripts documentation

## Workspace Limits

Testing shows that Retell AI workspaces can handle **at least 100 agents** without issues. See [WORKSPACE_LIMIT_TEST_RESULTS.md](./WORKSPACE_LIMIT_TEST_RESULTS.md) for detailed findings.

## Troubleshooting

### "workspaces.json not found"

Run `retell workspace init` to generate the configuration file from your `.env`:

```bash
node bin/retell.js workspace init
```

### "Missing API key"

Ensure your `.env` file contains:
```env
RETELL_STAGING_API_KEY=key_xxx
RETELL_PRODUCTION_API_KEY=key_yyy
```

Then regenerate:
```bash
node bin/retell.js workspace init --force
```

### "Agent already in sync"

This is normal - the agent is already up-to-date. Use `--force` to push anyway:

```bash
retell push my-agent -w staging --force
```

### "Cannot push to production: Agent has not been pushed to staging"

You must push to staging before production:

```bash
# First push to staging
retell push my-agent -w staging

# Then push to production
retell push my-agent -w production
```

### "Cannot push to production: Local changes differ from staging"

Your local changes don't match what's in staging. Push to staging first:

```bash
# Update staging with local changes
retell push my-agent -w staging

# Then push to production
retell push my-agent -w production
```

**Note:** This protection ensures you test changes in staging before deploying to production. Use `--force` only if you understand the risks.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm run test:all`
6. Submit a pull request

## License

MIT
