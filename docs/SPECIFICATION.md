# Retell CLI Specification

## Overview

A file-based CLI tool for managing Retell AI agents with **development workflow and version management** across staging and production environments. This tool enables fast iteration during development while maintaining reliable version control and sync tracking between local files, staging workspace, and production workspace.

## Core Purpose: Development Environment with Version Management

The CLI facilitates a structured development workflow:

1. **Local Development**: Edit agent configurations in version-controlled files
2. **Staging Testing**: Push changes to staging workspace for testing
3. **Production Release**: Promote tested configurations to production
4. **Sync Tracking**: Always know what's in sync between local ↔ staging ↔ production

The three-tier sync model (local files → staging → production) provides:
- **Fast iteration** during development using staging workspace
- **Version control** for all agent configurations via Git
- **Confidence in releases** by knowing exact sync state before promoting to production
- **Drift detection** via hash comparison at each level

### Sync State Tracking

Each agent maintains metadata files (`staging.json` and `production.json`) that track:
- **Agent ID**: The Retell agent ID in each workspace
- **LLM ID**: The associated LLM configuration ID
- **Knowledge Base ID**: The associated knowledge base (if any)
- **Config Hash**: SHA-256 hash of the last synced configuration
- **Last Sync**: Timestamp of the last successful sync
- **Retell Version**: Version number from Retell API

This enables the CLI to:
1. **Detect local changes**: Compare current `agent.json` hash with `staging.json` config_hash
2. **Detect staging changes**: Pull from staging and compare hashes
3. **Detect drift**: Compare `staging.json` hash with `production.json` hash
4. **Show sync status**: Display which environments are in-sync, ahead, or behind

Example sync states:
- ✅ **In Sync**: Local hash = staging hash = production hash
- 🟡 **Staging Ahead**: Staging hash ≠ production hash (ready to release)
- 🔴 **Local Changed**: Local hash ≠ staging hash (need to push)
- ⚠️  **Drift Detected**: Local hash ≠ staging hash ≠ production hash (manual intervention needed)

### Build and Push Process

The CLI uses a **build-then-push** workflow to ensure configurations are valid before syncing to Retell:

**Phase 1: Validation and Composition**
1. **Load agent.json**: Parse and validate the local configuration file
2. **Compose prompts**: Build final prompt by:
   - Reading prompt section files from `prompts/` directory
   - Applying overrides from `prompt_config.overrides`
   - Substituting static variables (e.g., `{{company_name}}`)
   - Identifying dynamic variables (e.g., `{{customer_name}}`)
3. **Extract variables**: Categorize all `{{variable}}` references:
   - **Static variables**: Values defined in `prompt_config.variables` (replaced at build time)
   - **Override variables**: Set to `"OVERRIDE"` in variables config (provided at call initialization)
   - **Dynamic variables**: Defined in `prompt_config.dynamic_variables` (extracted during call)
   - **System variables**: Retell-provided (e.g., `{{current_time_Australia/Sydney}}`)
4. **Validate dynamic variables**: Ensure all dynamic `{{variables}}` in the prompt have corresponding entries in `dynamic_variables` config

**Phase 2: Dependency Resolution**
1. **Check LLM sync**: Verify LLM configuration exists in target workspace or needs creation
2. **Check KB sync**: If knowledge base referenced, verify all files are synced:
   - Compare local file hashes with `.kb-meta.json` for target workspace
   - Identify files that need upload/update/deletion
3. **Resolve dependencies**: Ensure LLM ID and KB ID are available before building final config

**Phase 3: Build Final Configuration**
1. **Transform to Retell protocol**: Convert our agent.json format to Retell's API format:
   - Composed prompt becomes `general_prompt` field
   - Dynamic variables mapped to Retell's `dynamic_variables` structure
   - Override variables included in call initialization data
   - Tools and other configs translated to Retell's schema
2. **Calculate hash**: Generate SHA-256 hash of the final built configuration
3. **Validate with Retell schema**: Ensure built config matches Retell's requirements

**Phase 4: Push to Workspace**
1. **Create/Update LLM**: Push LLM configuration to Retell workspace
2. **Create/Update KB**: Upload knowledge base files if needed
3. **Create/Update Agent**: Push final agent configuration with LLM ID and KB ID
4. **Update metadata**: Write `staging.json` or `production.json` with:
   - Agent ID, LLM ID, KB ID from Retell
   - Config hash of what was pushed
   - Timestamp of sync
   - Retell version number

This build process ensures:
- **Prompts are composed correctly** before sending to Retell
- **All variables are accounted for** (no missing dynamic variable definitions)
- **Dependencies are resolved** (LLM and KB exist before referencing them)
- **Configuration is valid** (matches Retell's schema)
- **Sync state is tracked** (hash and metadata updated after successful push)

## Architecture Principles

1. **Files are the source of truth** - All agent configurations live in version-controlled JSON files
2. **Workspace isolation** - Staging and production workspaces are completely separate Retell workspaces
3. **Build-then-push workflow** - Compose prompts, validate variables, resolve dependencies, then build final config before pushing to Retell
4. **Composable prompts** - Our own prompt composition system with sections, overrides, and variables (transformed to Retell's protocol)
5. **Variable validation** - All `{{variables}}` in prompts must be accounted for as static, override, dynamic, or system variables
6. **Dependency resolution** - LLM and KB must be synced to workspace before agent configuration is pushed
7. **Explicit synchronization** - Nothing syncs automatically; all pushes/pulls/releases are explicit commands
8. **Hash-based change detection** - SHA-256 hashes detect configuration drift between local ↔ staging ↔ production
9. **Atomic operations** - Agent config and knowledge base can be synced independently
10. **Sync state visibility** - Always show sync status: which workspace is ahead/behind/in-sync

## Package Architecture

The project is structured as a **monorepo** with npm workspaces:

```
retell-cli/
├── packages/
│   └── controllers/      # @heya/retell.controllers - reusable core functionality
└── src/                  # CLI package - thin command wrappers
```

### @heya/retell.controllers Package

The `@heya/retell.controllers` package contains all reusable business logic:

- **Controllers**: Orchestrate business operations (AgentController, WorkspaceController)
- **Services**: External integrations (RetellClientService, WorkspaceConfigService)
- **Core**: Business logic modules (HashCalculator, MetadataManager, AgentTransformer)
- **Types**: TypeScript type definitions
- **Schemas**: Zod validation schemas
- **Errors**: Structured error types with error codes

This architecture enables:
- **Reusability**: Controllers can be used by CLI, API, or other tools
- **Testability**: Business logic can be tested without CLI dependencies
- **Type safety**: Consistent types across all consumers

### Using the Module

```typescript
import { AgentController, WorkspaceController } from '@heya/retell.controllers';

// Push an agent
const controller = new AgentController();
const result = await controller.push('my-agent', {
  workspace: 'staging',
  force: false,
});

if (!result.success) {
  console.error(result.error.message);
  // result.error.code contains the error code
  // result.error.details contains additional context
}
```

### Error Handling Architecture

The module returns structured `RetellError` objects that consumers map to their own format:

```typescript
// Module returns structured errors
interface RetellError {
  code: string;        // e.g., 'WORKSPACE_NOT_FOUND'
  message: string;     // Human-readable message
  details?: object;    // Additional context
}

// CLI maps to user-friendly output
if (error.code === 'WORKSPACE_CONFIG_MISSING') {
  console.error(`❌ ${error.message}`);
  console.error(`Hint: Run 'retell workspace init' to create workspaces.json`);
  process.exit(1);
}

// API maps to HTTP responses
if (error.code === 'API_UNAUTHORIZED') {
  return res.status(401).json({ error: error.message });
}
```

Error codes cover all domains:
- **Workspace**: `WORKSPACE_NOT_FOUND`, `WORKSPACE_CONFIG_MISSING`, `WORKSPACE_API_KEY_INVALID`
- **Agent**: `AGENT_NOT_FOUND`, `AGENT_CONFIG_INVALID`, `AGENT_NOT_SYNCED`
- **Sync**: `SYNC_CONFLICT`, `SYNC_STAGING_REQUIRED`, `SYNC_DRIFT_DETECTED`
- **API**: `API_ERROR`, `API_UNAUTHORIZED`, `API_RATE_LIMITED`
- **Validation**: `VALIDATION_ERROR`, `SCHEMA_VALIDATION_ERROR`
- **File**: `FILE_NOT_FOUND`, `FILE_READ_ERROR`, `FILE_WRITE_ERROR`

## Directory Structure

```
project-root/
├── .retellrc.json              # Optional: Global CLI defaults
├── workspaces.json             # Workspace API keys and metadata
├── prompts/                    # Reusable prompt sections
│   ├── base/
│   │   ├── greeting.txt
│   │   ├── tone-professional.txt
│   │   ├── tone-casual.txt
│   │   └── closing.txt
│   ├── customer-service/
│   │   ├── order-lookup.txt
│   │   ├── refund-policy.txt
│   │   └── escalation.txt
│   └── sales/
│       ├── qualification.txt
│       └── objection-handling.txt
├── templates/                  # Full agent templates (for copying)
│   ├── customer-service.json
│   ├── sales-agent.json
│   └── basic-agent.json
├── agents/                     # All agent configurations
│   ├── customer-service/
│   │   ├── agent.json          # Agent configuration (source of truth)
│   │   ├── staging.json        # Staging workspace metadata
│   │   ├── production.json     # Production workspace metadata
│   │   └── knowledge/          # Knowledge base files
│   │       ├── faq.txt
│   │       ├── policies.pdf
│   │       └── .kb-meta.json   # Knowledge base sync metadata
│   └── sales-agent/
│       ├── agent.json
│       ├── staging.json
│       ├── production.json
│       └── knowledge/
│           └── .kb-meta.json
└── docs/
```

## File Schemas

### `workspaces.json`

Stores workspace configuration with references to API keys stored in environment variables.

The CLI supports two orchestration modes:

#### Single-Production Mode (Default)

One staging workspace and one production workspace. The production workspace can have multiple agents deployed.

```json
{
  "mode": "single-production",
  "staging": {
    "api_key_env": "RETELL_STAGING_API_KEY",
    "name": "WORKSPACE_STAGING",
    "base_url": "https://api.retellai.com"
  },
  "production": {
    "api_key_env": "RETELL_PRODUCTION_API_KEY",
    "name": "WORKSPACE_1_PRODUCTION",
    "base_url": "https://api.retellai.com"
  }
}
```

#### Multi-Production Mode

One staging workspace and multiple production workspaces. Each production workspace typically has one agent (for scaling/isolation).

```json
{
  "mode": "multi-production",
  "staging": {
    "api_key_env": "RETELL_STAGING_API_KEY",
    "name": "WORKSPACE_STAGING",
    "base_url": "https://api.retellai.com"
  },
  "production": [
    {
      "id": "ws_prod_1",
      "api_key_env": "RETELL_PRODUCTION_1_API_KEY",
      "name": "WORKSPACE_1_PRODUCTION",
      "base_url": "https://api.retellai.com"
    },
    {
      "id": "ws_prod_2",
      "api_key_env": "RETELL_PRODUCTION_2_API_KEY",
      "name": "WORKSPACE_2_PRODUCTION",
      "base_url": "https://api.retellai.com"
    }
  ]
}
```

#### Legacy Format (Deprecated)

For backwards compatibility, the legacy format with raw API keys is still supported:

```json
{
  "staging": {
    "api_key": "sk_staging_...",
    "workspace_id": "workspace_dev_123",
    "name": "Development Workspace",
    "base_url": "https://api.retellai.com"
  },
  "production": {
    "api_key": "sk_prod_...",
    "workspace_id": "workspace_prod_456",
    "name": "Production Workspace",
    "base_url": "https://api.retellai.com"
  }
}
```

**Security Note**: The new format using `api_key_env` is recommended because:
- `workspaces.json` can be safely committed to git
- API keys remain in `.env` (which stays gitignored)
- CI/CD workflows can inject keys via environment variables

### `agents/{agent-name}/agent.json`

The source of truth for agent configuration. This file is version-controlled.

**Our Protocol** (what we store locally):

```json
{
  "agent_name": "Customer Service Agent",
  "voice_id": "11labs-Adrian",
  "voice_speed": 1.0,
  "voice_temperature": 1.0,
  "interruption_sensitivity": 0.5,
  "responsiveness": 0.8,
  "language": "en-US",
  "enable_backchannel": true,
  "backchannel_frequency": 0.8,
  "ambient_sound": "office",
  "boosted_keywords": ["support", "refund", "cancel"],
  "pronunciation_dictionary": [
    {"word": "API", "pronunciation": "A P I"}
  ],
  "normalize_for_speech": true,
  "webhook_url": "https://api.example.com/webhook",
  "llm_config": {
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "prompt_config": {
      "sections": [
        "base/greeting",
        "base/tone-professional",
        "customer-service/order-lookup",
        "customer-service/refund-policy",
        "base/closing"
      ],
      "overrides": {
        "greeting": "Custom greeting text that overrides base/greeting.txt"
      },
      "variables": {
        "company_name": "Acme Corp",
        "support_hours": "9am-5pm EST"
      }
    },
    "begin_message": "Hello! How can I help you today?",
    "tools": [
      {
        "type": "mcp",
        "name": "lookup_order",
        "description": "Look up customer order information",
        "server_url": "https://api.example.com/mcp",
        "tool_name": "get_order"
      }
    ]
  },
  "post_call_analysis_data": [
    {
      "name": "issue_resolved",
      "type": "boolean",
      "description": "Was the customer's issue resolved?"
    }
  ]
}
```

**Alternative: Simple Prompt** (without composition):

```json
{
  "agent_name": "Simple Agent",
  "llm_config": {
    "model": "gpt-4o-mini",
    "general_prompt": "You are a helpful assistant.\n\nBe professional and courteous.",
    "begin_message": "Hello!"
  }
}
```

**Notes**:
- Our protocol uses `prompt_config` with sections, overrides, and variables
- Alternative: use `general_prompt` as plain string for simple cases
- Contains both agent-level and LLM-level configuration
- Excludes runtime IDs (agent_id, llm_id) - those live in metadata files
- MCP tool configurations are embedded in `llm_config.tools`

### Prompt Composition System

The `prompt_config` object enables composable, reusable prompts:

**`prompt_config.sections`**: Array of prompt section IDs to compose
- References files in `prompts/` directory
- Sections are concatenated in order with double newlines
- Example: `"base/greeting"` → reads `prompts/base/greeting.txt`

**`prompt_config.overrides`**: Object mapping section names to custom text
- Allows agent-specific customization without editing shared sections
- Key is the section name (e.g., `"greeting"` for `base/greeting`)
- Value is the custom text to use instead of the file content

**`prompt_config.variables`**: Template variables for substitution
- Uses `{{variable_name}}` syntax in section files
- Can contain static values (replaced at build time) or `"OVERRIDE"` (kept as template for runtime)
- Example static: `"company_name": "Acme Corp"` → replaces `{{company_name}}` with `"Acme Corp"`
- Example override: `"user_id": "OVERRIDE"` → keeps `{{user_id}}` in final prompt for call-time substitution

### Prompt Section Files

Example `prompts/base/greeting.txt`:

```
You are a helpful customer service agent for {{company_name}}.

Your primary goal is to assist customers with their inquiries and resolve any issues they may have.
```

Example `prompts/customer-service/order-lookup.txt`:

```
When a customer asks about their order, use the lookup_order tool to retrieve order information.

Always verify the customer's identity before sharing order details.
```

### Dynamic Variables System

Our `{{variable}}` references in prompt sections need to be registered as Retell dynamic variables.

**In our agent.json**:
```json
{
  "llm_config": {
    "prompt_config": {
      "sections": ["base/greeting"],
      "variables": {
        "company_name": "Acme Corp",
        "support_hours": "9am-5pm EST",
        "user_id": "OVERRIDE",
        "session_token": "OVERRIDE"
      },
      "dynamic_variables": {
        "customer_name": {
          "type": "string",
          "description": "The customer's full name"
        },
        "phone": {
          "type": "string",
          "description": "Customer's phone number"
        },
        "order_id": {
          "type": "string",
          "description": "Customer's order ID"
        }
      }
    }
  }
}
```

**Variable Types**:

1. **Static variables**: Fixed values replaced at **build time**
   - Defined as: `"company_name": "Acme Corp"` (any value except "OVERRIDE")
   - In prompt: `{{company_name}}`
   - After build: `"Acme Corp"` (template tag replaced)
   - Use for: Company name, support hours, static configuration

2. **Override variables**: Values provided at **call initialization time** by Retell
   - Defined as: `"user_id": "OVERRIDE"` (special keyword)
   - In prompt: `{{user_id}}`
   - After build: `{{user_id}}` (template tag preserved)
   - Retell substitutes when call is initiated
   - Use for: User ID, session tokens, API keys

3. **Dynamic variables**: Values extracted **during the call** via LLM extraction
   - Defined in `dynamic_variables` section with type and description
   - In prompt: `{{customer_name}}`
   - After build: `{{customer_name}}` (template tag preserved)
   - Retell extracts from conversation and substitutes
   - Use for: Customer name, order ID, phone number

4. **System variables**: Retell-provided runtime values
   - Not defined in config (automatically available)
   - In prompt: `{{current_time_Australia/Sydney}}`
   - After build: `{{current_time_Australia/Sydney}}` (template tag preserved)
   - Retell provides at runtime based on timezone/system info
   - Use for: Current time, current date, call metadata

### Variable Substitution Timing

**Build Time** (when running `retell push`):
```
Original prompt sections:
  "Welcome to {{company_name}}! Your session is {{session_id}}.
   Customer {{customer_name}} at {{current_time_UTC}}."

With config:
  variables: {
    "company_name": "Acme Corp",     // Static - replace now
    "session_id": "OVERRIDE"          // Override - keep tag
  }
  dynamic_variables: {
    "customer_name": { ... }          // Dynamic - keep tag
  }

After build (final prompt sent to Retell):
  "Welcome to Acme Corp! Your session is {{session_id}}.
   Customer {{customer_name}} at {{current_time_UTC}}."
```

**Call Initialization Time** (when Retell starts a call):
```
Retell receives override variables from API call:
  {
    "session_id": "sess_abc123xyz"
  }

Prompt becomes:
  "Welcome to Acme Corp! Your session is sess_abc123xyz.
   Customer {{customer_name}} at {{current_time_UTC}}."
```

**During Call** (as conversation progresses):
```
LLM extracts dynamic variables and Retell provides system variables:
  - customer_name extracted: "John Smith"
  - current_time_UTC provided: "2025-11-14 15:30:00 UTC"

Final prompt in LLM context:
  "Welcome to Acme Corp! Your session is sess_abc123xyz.
   Customer John Smith at 2025-11-14 15:30:00 UTC."
```

**Note**: If `dynamic_variables` is not specified, the CLI will auto-detect variables used in prompts and create basic string types with auto-generated descriptions.

**In prompt section** (`prompts/base/greeting.txt`):
```
You are a customer service agent for {{company_name}}.

Support hours: {{support_hours}}
Customer name: {{customer_name}}
```

**Translation to Retell**:

When pushing, the CLI:

1. **Loads and composes prompt sections** into final prompt string
2. **Scans composed prompt** for all `{{variable}}` references
3. **Categorizes each variable**:
   - **Static**: Has value in `variables` config that is NOT "OVERRIDE"
   - **Override**: Has value "OVERRIDE" in `variables` config
   - **Dynamic**: Defined in `dynamic_variables` config
   - **System**: Not in config (auto-detected as Retell system variable)
4. **Substitutes ONLY static variables** at build time:
   ```
   Before: "Welcome to {{company_name}}, {{user_id}}!"
   Config: { company_name: "Acme", user_id: "OVERRIDE" }
   After:  "Welcome to Acme, {{user_id}}!"
   ```
5. **Keeps override/dynamic/system variables as `{{tags}}`** in final prompt
6. **Creates `extract_dynamic_variable` tool** for dynamic variables (mapped to Retell's format)
7. **Sends final prompt to Retell** with preserved template tags for runtime substitution

**Critical Build-Time Behavior**:

✅ **DO substitute** at build time:
- Static variables: `"company_name": "Acme Corp"` → `{{company_name}}` becomes `"Acme Corp"`

❌ **DO NOT substitute** at build time (keep as `{{tag}}`):
- Override variables: `"user_id": "OVERRIDE"` → keep `{{user_id}}`
- Dynamic variables: defined in `dynamic_variables` → keep `{{customer_name}}`
- System variables: not in config → keep `{{current_time_UTC}}`

This ensures Retell can substitute override/dynamic/system variables at the appropriate runtime phase.

5. **Dynamic - MCP Response**: Populated from MCP tool `response_variables`
   - Example: MCP tool returns `{"order_status": "shipped"}` → `{{order_status}}`

### Translation to Retell's Protocol

When running `retell push`, the CLI:

1. **Reads** `agent.json` (our protocol)

2. **Builds final prompt**:
   - Loads each section file from `prompts/`
   - Scans for all `{{variable}}` references
   - Replaces static variables from `prompt_config.variables`
   - Leaves dynamic variable placeholders intact
   - Applies overrides
   - Concatenates sections with `\n\n`

3. **Creates dynamic variable extraction tool**:
   - Detects variables used in prompt but not in `variables` config
   - Generates `extract_dynamic_variable` tool with appropriate fields
   - Adds to `general_tools` array

4. **Transforms to Retell's API format**:

   Agent object:
   ```json
   {
     "agent_name": "Customer Service Agent",
     "voice_id": "11labs-Adrian",
     "response_engine": {
       "type": "retell-llm",
       "llm_id": "llm_xyz789"
     }
   }
   ```

   LLM object:
   ```json
   {
     "llm_id": "llm_xyz789",
     "model": "gpt-4o-mini",
     "general_prompt": "You are a customer service agent for Acme Corp.\n\nSupport hours: 9am-5pm EST\nCustomer name: {{customer_name}}\n\nYour primary goal is to assist customers...",
     "general_tools": [
       {
         "type": "extract_dynamic_variable",
         "name": "extract_variables",
         "description": "Extract dynamic variables",
         "variables": [
           {
             "type": "string",
             "name": "customer_name",
             "description": "Customer's name"
           }
         ]
       }
     ],
     "begin_message": "Hello! How can I help you today?",
     "tools": [...]
   }
   ```

5. **Sends to Retell API**
6. **Stores** `agent_id` and `llm_id` in metadata

When running `retell pull`, the CLI:

1. Fetches agent + LLM from Retell API
2. Detects variables from `extract_dynamic_variable` tools
3. Attempts to reverse-engineer which sections were used (best effort)
4. Stores in our protocol format in `agent.json`
5. If prompt doesn't match any section combinations, stores as `general_prompt` string

### `agents/{agent-name}/staging.json`

Metadata linking local config to staging workspace.

```json
{
  "workspace": "staging",
  "agent_id": "agent_staging_abc123",
  "llm_id": "llm_staging_xyz789",
  "kb_id": "kb_staging_def456",
  "last_sync": "2025-11-14T10:30:00Z",
  "config_hash": "sha256:a1b2c3d4...",
  "retell_version": 5
}
```

**Fields**:
- `workspace`: References key in workspaces.json
- `agent_id`: Retell agent ID in this workspace
- `llm_id`: Retell LLM ID (if using retell-llm)
- `kb_id`: Knowledge base ID (if configured)
- `last_sync`: ISO timestamp of last successful sync
- `config_hash`: SHA-256 of agent.json at last sync
- `retell_version`: Agent version number from Retell

### `agents/{agent-name}/production.json`

Metadata for production workspace(s). Schema varies by orchestration mode.

**Single-Production Mode** - Same schema as staging.json:

```json
{
  "workspace": "production",
  "agent_id": "agent_prod_abc123",
  "llm_id": "llm_prod_xyz789",
  "kb_id": "kb_prod_def456",
  "last_sync": "2025-11-14T10:30:00Z",
  "config_hash": "sha256:a1b2c3d4...",
  "retell_version": 5,
  "workspace_id": "ws_prod_1",
  "workspace_name": "WORKSPACE_1_PRODUCTION"
}
```

**Multi-Production Mode** - Array of metadata entries (one per workspace):

```json
[
  {
    "workspace": "production",
    "agent_id": "agent_prod1_abc123",
    "llm_id": "llm_prod1_xyz789",
    "kb_id": null,
    "last_sync": "2025-11-14T10:30:00Z",
    "config_hash": "sha256:a1b2c3d4...",
    "workspace_id": "ws_prod_1",
    "workspace_name": "WORKSPACE_1_PRODUCTION"
  },
  {
    "workspace": "production",
    "agent_id": "agent_prod2_def456",
    "llm_id": "llm_prod2_uvw321",
    "kb_id": null,
    "last_sync": "2025-11-14T11:00:00Z",
    "config_hash": "sha256:a1b2c3d4...",
    "workspace_id": "ws_prod_2",
    "workspace_name": "WORKSPACE_2_PRODUCTION"
  }
]
```

### `agents/{agent-name}/knowledge/.kb-meta.json`

Tracks knowledge base file synchronization.

```json
{
  "staging": {
    "kb_id": "kb_staging_def456",
    "files": {
      "faq.txt": {
        "file_id": "file_staging_001",
        "hash": "sha256:abc123...",
        "size_bytes": 2048,
        "last_sync": "2025-11-14T10:30:00Z"
      },
      "policies.pdf": {
        "file_id": "file_staging_002",
        "hash": "sha256:def456...",
        "size_bytes": 102400,
        "last_sync": "2025-11-14T10:30:00Z"
      }
    }
  },
  "production": {
    "kb_id": "kb_prod_def456",
    "files": {
      "faq.txt": {
        "file_id": "file_prod_001",
        "hash": "sha256:abc123...",
        "size_bytes": 2048,
        "last_sync": "2025-11-13T15:00:00Z"
      }
    }
  }
}
```

**Notes**:
- Each workspace tracks its own files
- File hash detects local changes
- Missing files in workspace = needs upload
- Missing files locally = deleted (won't auto-delete remote)

## CLI Commands

### Workspace Management

#### `retell workspace add <name> <api-key>`

Adds a new workspace configuration.

```bash
retell workspace add staging sk_staging_abc123
retell workspace add production sk_prod_xyz789
```

**Behavior**:
1. Validates API key by making test request to Retell API
2. Fetches workspace_id from API
3. Adds entry to `workspaces.json`
4. Creates file if it doesn't exist
5. Displays confirmation with workspace details

**Options**:
- `--name <display-name>`: Human-readable workspace name
- `--base-url <url>`: Override API base URL (default: https://api.retellai.com/v2)

#### `retell workspace init [options]`

Generates workspaces.json from environment variables.

```bash
retell workspace init
retell workspace init --mode multi-production
retell workspace init --force
```

**Options**:
- `--mode <mode>`: Orchestration mode: `single-production` (default) or `multi-production`
- `-f, --force`: Overwrite existing workspaces.json

**Behavior**:
1. Reads API keys from environment variables:
   - `RETELL_STAGING_API_KEY` (required)
   - `RETELL_PRODUCTION_API_KEY` (required for single-production)
   - `RETELL_PRODUCTION_*_API_KEY` (for multi-production mode)
2. Creates `workspaces.json` with `api_key_env` references
3. File can be safely committed to git (no secrets)

**Output**:
```
Generating workspaces.json from environment variables...

Mode: single-production

✓ Successfully created workspaces.json

Workspace configuration:
  - Mode: single-production
  - staging: Uses RETELL_STAGING_API_KEY
  - production: Uses RETELL_PRODUCTION_API_KEY

Note: API keys are now referenced by environment variable name.
      The workspaces.json file can be safely committed to git.
```

#### `retell workspace list`

Lists all configured workspaces.

```bash
retell workspace list
```

**Output (single-production mode)**:
```
Mode: single-production

┌───────────────────────────────────┬─────────────┬───────────────────────────────┬───────────┐
│ Name                              │ Type        │ Base URL                      │ API Key   │
├───────────────────────────────────┼─────────────┼───────────────────────────────┼───────────┤
│ WORKSPACE_STAGING                 │ staging     │ https://api.retellai.com      │ ✓         │
│ WORKSPACE_1_PRODUCTION            │ production  │ https://api.retellai.com      │ ✓         │
└───────────────────────────────────┴─────────────┴───────────────────────────────┴───────────┘

Total: 2 workspace(s)
```

**Output (multi-production mode)**:
```
Mode: multi-production

┌───────────────────────────────────┬─────────────┬───────────────────────────────┬───────────┐
│ Name                              │ Type        │ Base URL                      │ API Key   │
├───────────────────────────────────┼─────────────┼───────────────────────────────┼───────────┤
│ WORKSPACE_STAGING                 │ staging     │ https://api.retellai.com      │ ✓         │
│ WORKSPACE_1_PRODUCTION            │ production [0] │ https://api.retellai.com   │ ✓         │
│ WORKSPACE_2_PRODUCTION            │ production [1] │ https://api.retellai.com   │ ✓         │
└───────────────────────────────────┴─────────────┴───────────────────────────────┴───────────┘

Total: 3 workspace(s)
```

#### `retell workspace remove <name>`

Removes workspace configuration.

```bash
retell workspace remove staging
```

**Behavior**:
1. Confirms with user (shows which agents reference this workspace)
2. Removes from `workspaces.json`
3. Does NOT delete any remote resources

### Agent Initialization

#### `retell init <path> [options]`

Initializes a new agent directory structure.

```bash
retell init agents/customer-service --name "Customer Service Agent"
```

**Behavior**:
1. Creates directory structure:
   ```
   agents/customer-service/
   ├── agent.json
   ├── staging.json (stub)
   ├── production.json (stub)
   └── knowledge/
       └── .kb-meta.json (stub)
   ```
2. `agent.json` gets default template or interactive prompts
3. Metadata files are initialized as empty stubs

**Options**:
- `--name <name>`: Agent name (required)
- `--template <template>`: Use template from templates directory
- `--from-staging <agent-id>`: Pull existing agent from staging
- `--from-production <agent-id>`: Pull existing agent from production
- `--interactive`: Interactive setup wizard

**Template Example**:
```bash
retell init agents/sales --template customer-service
# Copies templates/customer-service.json to agents/sales/agent.json
# Template becomes the starting point; agent is now independent
```

**Pull from Retell Example**:
```bash
retell init agents/existing --from-staging agent_abc123
# Creates local files from existing Retell agent
```

### Sync Status

#### `retell status [path] [options]`

Shows synchronization status between local files and workspaces.

```bash
retell status agents/customer-service
retell status --all
```

**Output for single agent**:
```
Agent: customer-service
Path: agents/customer-service

Agent Configuration:
  Local file:           ✅ valid

  Staging sync:         ❌ out of sync
    Local changes:      modified 2 hours ago
    Last sync:          2025-11-14 10:30:00
    Status:            Local is ahead (config modified)

  Production sync:      ❌ out of sync
    Staging vs Prod:    Different configurations
    Status:            Staging has unreleased changes

Knowledge Base:
  Local files:          2 files (faq.txt, policies.pdf)

  Staging sync:         ❌ out of sync
    New files:          1 (policies.pdf)
    Modified files:     0
    Deleted files:      0

  Production sync:      ✅ in sync
    Files:              1 (faq.txt)

Actions:
  → Push to staging:     retell push agents/customer-service --staging
  → Release to prod:     retell release agents/customer-service
```

**Options**:
- `--all`: Show status for all agents
- `--json`: Output in JSON format
- `--workspace <name>`: Only check specific workspace

**Sync Detection Logic**:

Agent Config:
1. Compare `config_hash` in metadata vs current `agent.json` hash
2. If different: "out of sync"
3. If same: "in sync"

Knowledge Base:
1. Compare file hashes in `.kb-meta.json` vs current file hashes
2. List new, modified, deleted files
3. Files only in metadata = deleted locally
4. Files only locally = new files

Staging vs Production:
1. Compare `config_hash` between staging.json and production.json
2. Compare KB file hashes between staging and production in .kb-meta.json
3. If different: show which is ahead

### Push (Local → Workspace)

#### `retell push <path> [options]`

Pushes local configuration to a workspace.

```bash
retell push agents/customer-service --staging
retell push agents/customer-service --production
retell push agents/customer-service --staging --kb-only
retell push agents/customer-service --staging --config-only
```

**Behavior**:

1. **Validation**:
   - Verify workspace exists in workspaces.json
   - Validate agent.json schema
   - Check API connectivity

2. **Agent Config Push**:
   - If agent_id exists in metadata: PATCH update existing agent
   - If no agent_id: POST create new agent
   - If LLM config exists: Create/update retell-llm
   - Update metadata file with new hash, timestamp, IDs

3. **Knowledge Base Push**:
   - Compare local files vs .kb-meta.json
   - Upload new/modified files
   - Update .kb-meta.json with new hashes
   - Does NOT delete remote files (explicit delete command needed)

4. **Confirmation**:
   - Shows diff of what will change
   - Requires confirmation (unless --yes flag)
   - Displays result summary

**Options**:
- `--staging`: Push to staging workspace (default if no flag)
- `--production`: Push to production workspace
- `--config-only`: Only push agent configuration
- `--kb-only`: Only push knowledge base files
- `--yes`, `-y`: Skip confirmation prompt
- `--dry-run`: Show what would change without making changes

**Example Output**:
```
Pushing to staging workspace...

Prompt Composition:
  Sections: 5 (base/greeting, base/tone-professional, ...)
  Final prompt: 1,247 characters

Variables Summary:
  Static variables: 2
    ✓ company_name: "Acme Corp"
    ✓ support_hours: "9am-5pm EST"

  Override variables: 2
    ⚠ user_id: OVERRIDE (must be provided when call is initiated)
    ⚠ session_token: OVERRIDE (must be provided when call is initiated)

  Dynamic variables: 3
    → customer_name (extracted during call)
    → phone (extracted during call)
    → order_id (extracted during call)

  System variables: 1
    → current_time_Australia/Sydney (provided by Retell)

Agent Configuration Changes:
  voice_speed: 1.0 → 1.1
  llm_config.general_prompt: modified (237 chars changed)
  + extract_dynamic_variable tool (3 variables)

Knowledge Base Changes:
  + policies.pdf (new file, 102KB)
  ~ faq.txt (modified, 2KB)

⚠️  Note: 2 override variables must be provided when initiating calls

Continue? (y/n): y

✅ Agent updated: agent_staging_abc123
✅ LLM updated: llm_staging_xyz789
✅ Dynamic variable extractor created (3 variables)
✅ Uploaded: policies.pdf → file_staging_003
✅ Updated: faq.txt → file_staging_001

Metadata updated: agents/customer-service/staging.json
```

### Pull (Workspace → Local)

#### `retell pull <path> [options]`

Pulls configuration from workspace to local files.

```bash
retell pull agents/customer-service --staging
retell pull agents/customer-service --production --kb-only
```

**Behavior**:

1. **Fetch from Retell**:
   - GET agent configuration using agent_id from metadata
   - GET LLM configuration if applicable
   - Download KB files if --kb-only or no flag

2. **Local Update**:
   - Shows diff of what will change locally
   - Requires confirmation
   - Updates agent.json
   - Downloads KB files to knowledge/ directory
   - Updates metadata files

3. **Conflict Detection**:
   - If local has uncommitted changes: warn user
   - If local hash != metadata hash: "local changes will be overwritten"
   - Requires --force to proceed

**Options**:
- `--staging`: Pull from staging (default)
- `--production`: Pull from production
- `--config-only`: Only pull agent config
- `--kb-only`: Only pull knowledge base
- `--force`: Overwrite local changes without confirmation

**Example Output**:
```
Pulling from staging workspace...

⚠️  Warning: Local file has uncommitted changes
    Last modified: 2 hours ago
    Last sync: 2025-11-14 10:30:00

Local Changes:
  agent.json: modified
  knowledge/faq.txt: modified

Remote Changes:
  voice_speed: 1.1 → 1.2
  llm_config.temperature: 0.7 → 0.8

Overwrite local changes? (y/n): n
Aborted.
```

### Release (Staging → Production)

#### `retell release <path> [options]`

Releases staging configuration to production.

```bash
retell release agents/customer-service
retell release agents/customer-service --config-only
```

**Behavior**:

1. **Pre-flight Checks**:
   - Verify staging and production both configured
   - Check staging is in sync with local (warn if not)
   - Show diff between staging and production

2. **Release Process**:
   - Copy staging config to production workspace
   - Copy KB files from staging to production
   - Update production.json metadata
   - Create release record (changelog)

3. **Confirmation**:
   - Shows comprehensive diff
   - Requires explicit confirmation
   - Production releases are logged

**Options**:
- `--config-only`: Only release agent config
- `--kb-only`: Only release knowledge base
- `--yes`: Skip confirmation
- `--message <msg>`: Add release note

**Example Output**:
```
Releasing customer-service: staging → production

Staging Status:
  ✅ In sync with local
  Last sync: 2 hours ago
  Agent: agent_staging_abc123 (version 7)

Production Status:
  ⚠️  Behind staging (version 5)
  Last release: 2 days ago

Variables Summary (Staging):
  Static variables: 2
  Override variables: 2
    ⚠ user_id: OVERRIDE
    ⚠ session_token: OVERRIDE
  Dynamic variables: 3 (customer_name, phone, order_id)
  System variables: 1 (current_time_Australia/Sydney)

Configuration Diff (staging → production):
  voice_speed: 1.0 → 1.1
  llm_config.general_prompt: modified
  llm_config.tools: +1 tool added (lookup_order)

Knowledge Base Diff:
  + policies.pdf (new file)
  ~ faq.txt (updated)

⚠️  Production will have 2 override variables that must be provided when initiating calls

This will update production agent: agent_prod_abc123
Continue? (y/n): y

✅ Production agent updated: agent_prod_abc123
✅ Production LLM updated: llm_prod_xyz789
✅ Knowledge base synced: 2 files

Release logged: releases/customer-service-2025-11-14.json
```

### Diff

#### `retell diff <path> <source> <target>`

Shows differences between configurations.

```bash
retell diff agents/customer-service file staging
retell diff agents/customer-service staging production
retell diff agents/customer-service file production
```

**Source/Target Options**:
- `file`: Local agent.json
- `staging`: Staging workspace
- `production`: Production workspace

**Output**:
```
Diff: file vs staging

Agent Configuration:
  voice_speed
    file:    1.0
    staging: 1.1

  llm_config.general_prompt
    - You are a helpful customer service agent.
    + You are a professional customer service agent.

  llm_config.tools
    + Added: lookup_order (mcp)

Knowledge Base:
  + policies.pdf (only in file)
  ~ faq.txt (modified)
    file:    sha256:abc123... (modified 1 hour ago)
    staging: sha256:def456... (synced 3 hours ago)
```

**Options**:
- `--json`: Output as JSON
- `--config-only`: Only show config diff
- `--kb-only`: Only show KB diff

### Prompt Management

#### `retell prompt build <path>`

Builds the final prompt from sections, showing what will be sent to Retell.

```bash
retell prompt build agents/customer-service
```

**Output**:
```
Building prompt for: customer-service

Sections:
  1. base/greeting
  2. base/tone-professional
  3. customer-service/order-lookup
  4. base/closing

Variables:
  company_name: Acme Corp
  support_hours: 9am-5pm EST

Overrides:
  greeting: Custom greeting applied

Final Prompt (246 chars):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are a helpful customer service agent for Acme Corp.

Your primary goal is to assist customers...

Be professional and courteous in all interactions.

When a customer asks about their order...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Options**:
- `--output <file>`: Save to file instead of stdout
- `--json`: Output as JSON

#### `retell prompt show <path>`

Shows the final compiled prompt for an agent (alias for `build`).

```bash
retell prompt show agents/customer-service
```

#### `retell prompt edit <section-id>`

Opens a prompt section file in your editor.

```bash
retell prompt edit base/greeting
retell prompt edit customer-service/order-lookup
```

**Behavior**:
1. Opens `prompts/{section-id}.txt` in `$EDITOR`
2. After editing, shows which agents use this section
3. Prompts to rebuild affected agents

**Example Output**:
```
Editing: prompts/base/greeting.txt

File saved.

This section is used by:
  - agents/customer-service
  - agents/sales-agent
  - agents/support-tier2

Rebuild prompts? (y/n): y

✅ Rebuilt 3 agent prompts
```

#### `retell prompt usage <section-id>`

Shows which agents use a prompt section.

```bash
retell prompt usage base/greeting
```

**Output**:
```
Section: base/greeting
Path: prompts/base/greeting.txt

Used by:
  agents/customer-service
  agents/sales-agent
  agents/support-tier2

Not used by any agents:
  (none)
```

#### `retell prompt add <path> <section-id>`

Adds a prompt section to an agent.

```bash
retell prompt add agents/customer-service customer-service/escalation
```

**Behavior**:
1. Adds section to `prompt_config.sections` array
2. Shows updated prompt preview
3. Requires confirmation

**Options**:
- `--position <index>`: Insert at specific position (default: append)

#### `retell prompt remove <path> <section-id>`

Removes a prompt section from an agent.

```bash
retell prompt remove agents/customer-service base/closing
```

#### `retell prompt create <section-id>`

Creates a new prompt section file.

```bash
retell prompt create sales/qualification
```

**Behavior**:
1. Creates `prompts/sales/qualification.txt`
2. Opens in editor for initial content
3. Creates directory if needed

#### `retell prompt list [directory]`

Lists all available prompt sections.

```bash
retell prompt list
retell prompt list base
```

**Output**:
```
Available Prompt Sections:

base/
  greeting.txt              (used by 3 agents)
  tone-professional.txt     (used by 2 agents)
  tone-casual.txt           (used by 1 agent)
  closing.txt               (used by 3 agents)

customer-service/
  order-lookup.txt          (used by 1 agent)
  refund-policy.txt         (used by 1 agent)
  escalation.txt            (not used)

sales/
  qualification.txt         (used by 1 agent)
```

#### `retell prompt validate <path>`

Validates that all prompt sections exist and variables are defined.

```bash
retell prompt validate agents/customer-service
retell prompt validate --all
```

**Output**:
```
Validating: customer-service

✅ All sections exist
✅ All variables defined
⚠️  Section "base/greeting" uses undefined variable: {{support_email}}
❌ Section "customer-service/old-policy" not found

Warnings: 1
Errors: 1
```

### Knowledge Base Management

#### `retell kb add <path> <file>`

Adds a file to knowledge base.

```bash
retell kb add agents/customer-service knowledge/new-doc.pdf
retell kb add agents/customer-service ./external/docs/*.txt
```

**Behavior**:
1. Copies file to `agents/{name}/knowledge/`
2. File is not uploaded until `retell push`
3. Updates local .kb-meta.json to track file

#### `retell kb list <path> [workspace]`

Lists knowledge base files.

```bash
retell kb list agents/customer-service
retell kb list agents/customer-service staging
```

**Output**:
```
Knowledge Base: customer-service

Local Files:
  faq.txt          2KB    modified 1 hour ago
  policies.pdf     102KB  modified 2 days ago

Staging Files:
  faq.txt          2KB    synced 3 hours ago

Production Files:
  faq.txt          2KB    synced 2 days ago
```

#### `retell kb remove <path> <file> [workspace]`

Removes file from knowledge base.

```bash
retell kb remove agents/customer-service faq.txt
retell kb remove agents/customer-service faq.txt staging --remote
```

**Options**:
- `--remote`: Also delete from remote workspace (requires confirmation)
- `--local`: Only delete local file

### Sync

#### `retell sync [options]`

Reconciles local metadata files with actual workspace state. Queries all configured workspaces and updates `staging.json` and `production.json` to reflect what's actually deployed.

```bash
retell sync
retell sync --agent customer-service
retell sync --dry-run
retell sync --path ./agents
```

**Options**:
- `-p, --path <path>`: Path to agents directory (default: `./agents`)
- `-a, --agent <name>`: Sync only a specific agent
- `--dry-run`: Show what would be changed without making changes

**Behavior**:
1. Lists all configured workspaces from `workspaces.json`
2. Queries each workspace to get deployed agents
3. For each local agent directory:
   - Matches by agent name
   - If found: Updates metadata file with current agent_id, llm_id, workspace_id
   - If not found: Removes stale metadata file (or entry in multi-production mode)

**Output**:
```
🔄 Syncing metadata with workspaces...

Mode: single-production
Workspaces: 2

Agents to sync: customer-service, sales-agent

━━━ WORKSPACE_STAGING (staging) ━━━
  Found 2 agent(s)
  ✓ customer-service: Found (agent_staging_abc123)
    Updated staging.json
  ✓ sales-agent: Found (agent_staging_def456)
    Updated staging.json

━━━ WORKSPACE_1_PRODUCTION (production) ━━━
  Found 1 agent(s)
  ✓ customer-service: Found (agent_prod_xyz789)
    Updated production.json
  ○ sales-agent: Not deployed in this workspace

━━━ Summary ━━━

WORKSPACE_STAGING:
  Agents in workspace: 2
  Metadata updated: Yes
WORKSPACE_1_PRODUCTION:
  Agents in workspace: 1
  Metadata updated: Yes
```

**Multi-Production Mode**:

In multi-production mode, `production.json` is an array. The sync command:
- Adds entries for workspaces where the agent is deployed
- Removes entries for workspaces where the agent is not found
- Preserves entries for other workspaces not being synced

### Validation

#### `retell validate <path>`

Validates agent configuration.

```bash
retell validate agents/customer-service
retell validate --all
```

**Checks**:
- agent.json schema validation
- Required fields present
- Valid voice_id, language codes
- LLM config structure
- MCP tool configurations
- KB file existence
- Metadata file consistency

**Output**:
```
Validating: customer-service

✅ agent.json valid
✅ staging.json valid
✅ production.json valid
⚠️  knowledge/.kb-meta.json: file "old.txt" referenced but not found
✅ All knowledge base files exist

Warnings: 1
Errors: 0
```

### Logs

#### `retell logs [path]`

Shows sync/release history.

```bash
retell logs agents/customer-service
retell logs --all --limit 10
```

**Output**:
```
Sync History: customer-service

2025-11-14 12:30:00  PUSH     staging     ✅ Config + KB (2 files)
2025-11-14 10:15:00  RELEASE  production  ✅ Version 5 → 6
2025-11-13 16:45:00  PUSH     staging     ✅ Config only
2025-11-13 14:20:00  PULL     staging     ✅ Config + KB
```

## Workflow Examples

### Initial Setup

```bash
# 1. Configure workspaces
retell workspace add staging $STAGING_API_KEY
retell workspace add production $PROD_API_KEY

# 2. Initialize new agent
retell init agents/customer-service --name "Customer Service" --interactive

# 3. Edit configuration
vim agents/customer-service/agent.json

# 4. Add knowledge base files
cp ~/docs/faq.txt agents/customer-service/knowledge/

# 5. Push to staging
retell push agents/customer-service --staging

# 6. Test in staging...

# 7. Release to production
retell release agents/customer-service
```

### Daily Development

```bash
# Check what needs syncing
retell status --all

# Edit agent config
vim agents/customer-service/agent.json

# Push changes to staging
retell push agents/customer-service --staging

# Test in staging, iterate...

# Release when ready
retell release agents/customer-service --message "Added order lookup MCP tool"
```

### Pulling Production Config

```bash
# See what changed in production (manual edits via console?)
retell diff agents/customer-service file production

# Pull production changes to local
retell pull agents/customer-service --production

# Merge changes and push to staging
retell push agents/customer-service --staging
```

### Managing Knowledge Base

```bash
# Add new file
retell kb add agents/customer-service ./new-policy.pdf

# Check status
retell status agents/customer-service

# Push KB only
retell push agents/customer-service --staging --kb-only

# Release KB to production
retell release agents/customer-service --kb-only
```

## Error Handling

The CLI uses a layered error handling system. The `@heya/retell.controllers` package returns structured `RetellError` objects with error codes, which the CLI maps to user-friendly messages with hints.

### Error Code Categories

| Category | Codes | Description |
|----------|-------|-------------|
| Workspace | `WORKSPACE_NOT_FOUND`, `WORKSPACE_CONFIG_MISSING`, `WORKSPACE_API_KEY_INVALID` | Workspace configuration issues |
| Agent | `AGENT_NOT_FOUND`, `AGENT_CONFIG_INVALID`, `AGENT_NOT_SYNCED` | Agent configuration and state issues |
| Sync | `SYNC_CONFLICT`, `SYNC_STAGING_REQUIRED`, `SYNC_DRIFT_DETECTED` | Synchronization conflicts |
| API | `API_ERROR`, `API_UNAUTHORIZED`, `API_RATE_LIMITED`, `API_NOT_FOUND` | Retell API issues |
| Validation | `VALIDATION_ERROR`, `SCHEMA_VALIDATION_ERROR`, `PROMPT_VALIDATION_ERROR` | Configuration validation failures |
| File | `FILE_NOT_FOUND`, `FILE_READ_ERROR`, `FILE_WRITE_ERROR` | File system issues |

### Common Errors

1. **Workspace Configuration Missing**:
   ```
   ❌ workspaces.json not found

   Hint: Run 'retell workspace init' to create workspaces.json from your .env file
   ```

2. **API Key Invalid**:
   ```
   ❌ Authentication failed: Invalid API key for workspace 'staging'

   Hint: Check your API key in workspaces.json or .env file
   ```

3. **Agent Not Found**:
   ```
   ❌ Agent 'customer-service' not found or not synced with staging

   Hint: Check the agent name and ensure it exists in your agents directory
   ```

4. **Sync Conflict (Production Push)**:
   ```
   ❌ Production push blocked: Local changes differ from staging

   Hint: retell push customer-service -w staging
   ```

5. **Schema Validation Failed**:
   ```
   ❌ Validation error: Invalid agent configuration

   Hint: Check your agent.json file for syntax errors or invalid values
   ```

### Programmatic Error Handling

When using `@heya/retell.controllers` directly:

```typescript
import { AgentController } from '@heya/retell.controllers';

const controller = new AgentController();
const result = await controller.push('my-agent', { workspace: 'staging' });

if (!result.success) {
  switch (result.error.code) {
    case 'WORKSPACE_CONFIG_MISSING':
      // Handle missing workspace config
      break;
    case 'SYNC_STAGING_REQUIRED':
      // Handle staging-first requirement
      console.log(result.error.details?.suggestion);
      break;
    default:
      console.error(result.error.message);
  }
}
```

## Configuration

### Workspace Configuration (Required)

As of v1.0.0, the CLI **requires** `workspaces.json` for all operations.

**Setup Steps (Single-Production Mode):**

1. Create `.env` with API keys:
   ```env
   RETELL_STAGING_API_KEY=key_xxx
   RETELL_PRODUCTION_API_KEY=key_yyy
   ```

2. Generate `workspaces.json`:
   ```bash
   retell workspace init
   ```

3. Result:
   ```json
   {
     "mode": "single-production",
     "staging": {
       "api_key_env": "RETELL_STAGING_API_KEY",
       "name": "WORKSPACE_STAGING",
       "base_url": "https://api.retellai.com"
     },
     "production": {
       "api_key_env": "RETELL_PRODUCTION_API_KEY",
       "name": "WORKSPACE_1_PRODUCTION",
       "base_url": "https://api.retellai.com"
     }
   }
   ```

**Setup Steps (Multi-Production Mode):**

1. Create `.env` with API keys:
   ```env
   RETELL_STAGING_API_KEY=key_xxx
   RETELL_PRODUCTION_1_API_KEY=key_yyy
   RETELL_PRODUCTION_2_API_KEY=key_zzz
   ```

2. Generate `workspaces.json`:
   ```bash
   retell workspace init --mode multi-production
   ```

3. Result:
   ```json
   {
     "mode": "multi-production",
     "staging": {
       "api_key_env": "RETELL_STAGING_API_KEY",
       "name": "WORKSPACE_STAGING",
       "base_url": "https://api.retellai.com"
     },
     "production": [
       {
         "id": "ws_prod_1",
         "api_key_env": "RETELL_PRODUCTION_1_API_KEY",
         "name": "WORKSPACE_1_PRODUCTION",
         "base_url": "https://api.retellai.com"
       }
     ]
   }
   ```

**Validation:**
- File existence checked before all operations
- Both `staging` and `production` workspaces required
- API keys referenced via `api_key_env` must be set in environment
- Clear error messages guide users to solutions

**Commands:**
```bash
# Generate from .env (single-production)
retell workspace init

# Generate multi-production mode
retell workspace init --mode multi-production

# Force regenerate
retell workspace init --force

# List configured workspaces
retell workspace list

# Sync metadata with actual workspace state
retell sync
```

### Environment Variables

```bash
# Required in .env for workspace init
RETELL_STAGING_API_KEY=key_staging_...
RETELL_PRODUCTION_API_KEY=key_prod_...

# Optional overrides
RETELL_BASE_URL=https://api.retellai.com

# CI/CD mode (non-interactive)
RETELL_CI=true
```

### `.retellrc.json` (Optional)

Global CLI configuration:

```json
{
  "default_workspace": "staging",
  "auto_confirm": false,
  "log_level": "info",
  "diff_tool": "diff"
}
```

## Security Considerations

1. **API keys in .env MUST be in .gitignore**
   - `.env` contains actual API key values
   - NEVER commit to version control
   - Use environment variables in CI/CD

2. **workspaces.json CAN be committed** (new format)
   - Uses `api_key_env` to reference environment variables
   - Does NOT contain actual API keys
   - Safe to commit when using the new format

3. **Legacy workspaces.json MUST be in .gitignore**
   - Old format with `api_key` contains actual keys
   - Use `retell workspace init` to migrate to new format

4. **Metadata files ARE version controlled**
   - staging.json, production.json
   - Contains agent_id, llm_id, workspace_id but not secrets
   - Safe to commit

5. **Knowledge base files**
   - Version controlled
   - Ensure no sensitive data in committed files

6. **Workspace validation**
   - Prevents operations without explicit configuration
   - API key resolution from environment variables happens at runtime
   - All commands validate workspace config first

## Git Integration

Recommended `.gitignore`:

```gitignore
# Environment files with actual API keys
.env
.env.local
.env.*.local

# Legacy workspaces.json (contains raw API keys)
# Note: New format with api_key_env CAN be committed safely
# workspaces.json  # Uncomment only if using legacy format

# Optional: CLI config if it contains secrets
.retellrc.json
```

Recommended commit workflow:

```bash
# Make changes
vim agents/customer-service/agent.json

# Push to staging
retell push agents/customer-service --staging

# Commit the change + metadata update
git add agents/customer-service/
git commit -m "Update customer service voice speed"

# Release to production
retell release agents/customer-service

# Commit production metadata
git add agents/customer-service/production.json
git commit -m "Release customer service to production"
```

## Templates

Templates are full agent configurations stored in `templates/` that serve as starting points for new agents. They are **not** referenced - they are simply copied when creating a new agent.

### Template Structure

Templates are complete `agent.json` files:

**`templates/customer-service.json`**:
```json
{
  "agent_name": "Customer Service Agent",
  "voice_id": "11labs-Adrian",
  "voice_speed": 1.0,
  "language": "en-US",
  "llm_config": {
    "model": "gpt-4o-mini",
    "prompt_config": {
      "sections": [
        "base/greeting",
        "base/tone-professional",
        "customer-service/order-lookup",
        "base/closing"
      ],
      "variables": {
        "company_name": "Your Company",
        "support_hours": "9am-5pm"
      }
    },
    "begin_message": "Hello! How can I help you today?",
    "tools": []
  }
}
```

### Using Templates

```bash
# Create agent from template
retell init agents/acme-support --template customer-service

# This copies templates/customer-service.json to agents/acme-support/agent.json
# The new agent is completely independent - no ongoing reference to template
```

After creation, edit the agent directly:

```bash
vim agents/acme-support/agent.json
# Update company_name, add tools, modify sections, etc.
```

### Creating Templates

Save a working agent as a template for reuse:

```bash
# Method 1: Manually copy
cp agents/customer-service/agent.json templates/my-template.json

# Method 2: Save template command (future enhancement)
retell template save agents/customer-service my-template
```

### Best Practices

1. **Keep templates generic** - Use placeholder variables
2. **Document template purpose** - Add comments (if JSON5 supported) or README
3. **Version templates** - Consider template versions for major changes
4. **Test templates** - Ensure they work before using as templates

## Future Enhancements

1. **Template commands**: `retell template save/list` for managing templates
2. **Hooks**: Pre-push, post-release hooks for custom automation
3. **Rollback**: Quick rollback to previous version
4. **Multi-agent operations**: Bulk push/release
5. **Agent versioning**: Track versions beyond Retell's version number
6. **Import from Retell**: Discover and import all agents from workspace
7. **Health checks**: Validate agents are functioning properly
8. **Cost tracking**: Monitor API usage per agent

## Open Questions

1. Should we support more than 2 workspaces (e.g., dev, staging, prod)?
2. Should KB file deletes auto-sync or require explicit command?
3. Should we auto-create git commits for metadata updates?
4. Should we support agent-level .env files for workspace-specific webhooks?
5. How to handle LLM sharing (multiple agents using same LLM)?
