# Retell CLI - Technical Specification

## Overview

This document outlines the technical implementation details for the Retell CLI, including project structure, TypeScript configuration, testing strategy, and strict typing requirements.

## Technology Stack

- **Language**: TypeScript 5.x (strict mode)
- **Runtime**: Node.js 18+ (LTS)
- **Package Manager**: npm
- **CLI Framework**: Commander.js
- **Testing**: Jest + ts-jest
- **Linting**: ESLint + TypeScript ESLint
- **Formatting**: Prettier
- **API Client**: retell-sdk (official Retell SDK)
- **Validation**: Zod for runtime schema validation

## Architecture Overview

The project uses a **monorepo structure** with npm workspaces to separate the reusable core functionality from the CLI interface:

```
retell-cli/
├── packages/
│   └── controllers/               # @heya/retell.controllers - reusable controllers
│       ├── src/
│       │   ├── controllers/       # Business logic orchestration
│       │   ├── services/          # External service integrations
│       │   ├── core/              # Core business logic modules
│       │   ├── types/             # TypeScript type definitions
│       │   ├── schemas/           # Zod validation schemas
│       │   ├── errors/            # Structured error types
│       │   └── index.ts           # Package exports
│       └── package.json
└── src/                           # CLI package (thin wrappers)
```

This architecture enables:
- **Reusability**: Controllers can be used by both CLI and API
- **Testability**: Business logic can be tested without CLI
- **Separation of concerns**: CLI handles I/O, module handles logic
- **Independent versioning**: Module can be published separately

## Project Structure

```
retell-cli/
├── packages/
│   └── controllers/           # @heya/retell.controllers package
│       ├── src/
│       │   ├── controllers/   # Business orchestration layer
│       │   │   ├── agent.controller.ts      # push/pull/list/delete
│       │   │   ├── workspace.controller.ts  # init/list workspaces
│       │   │   └── version.controller.ts    # version history/publish/rollback
│       │   ├── services/      # External service wrappers
│       │   │   ├── retell-client.service.ts # Retell API client
│       │   │   └── workspace-config.service.ts
│       │   ├── core/          # Core business logic
│       │   │   ├── agent-config-loader.ts
│       │   │   ├── agent-transformer.ts
│       │   │   ├── conflict-detector.ts
│       │   │   ├── conflict-resolver.ts
│       │   │   ├── hash-calculator.ts
│       │   │   ├── metadata-manager.ts
│       │   │   ├── prompt-builder.ts
│       │   │   ├── prompt-section-mapper.ts
│       │   │   ├── retell-config-hasher.ts
│       │   │   └── variable-resolver.ts
│       │   ├── types/         # TypeScript types
│       │   │   ├── agent.types.ts
│       │   │   ├── common.types.ts
│       │   │   ├── version.types.ts
│       │   │   └── workspace.types.ts
│       │   ├── schemas/       # Zod schemas
│       │   │   ├── agent.schema.ts
│       │   │   ├── metadata.schema.ts
│       │   │   └── workspace.schema.ts
│       │   ├── errors/        # Error types
│       │   │   ├── error-codes.ts
│       │   │   └── retell-error.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── src/
│   ├── cli/
│   │   ├── commands/          # CLI command implementations (thin wrappers)
│   │   │   ├── push.ts
│   │   │   ├── pull.ts
│   │   │   ├── list.ts
│   │   │   └── ...
│   │   ├── errors/            # CLI-specific error handling
│   │   │   └── cli-error-handler.ts
│   │   └── index.ts           # CLI entry point
│   └── index.ts               # Package entry point
├── tests/
│   ├── setup.ts               # Jest setup
│   └── unit/                  # Unit tests
│       ├── cli/
│       │   └── commands/      # CLI command tests
│       │       ├── push.test.ts
│       │       ├── pull.test.ts
│       │       ├── status.test.ts
│       │       ├── diff.test.ts
│       │       ├── list.test.ts
│       │       ├── delete.test.ts
│       │       ├── init.test.ts
│       │       ├── update.test.ts
│       │       ├── sync.test.ts
│       │       ├── version.test.ts
│       │       ├── bulk-create.test.ts
│       │       ├── phone.test.ts
│       │       ├── audit.test.ts
│       │       └── workspace-init.test.ts
│       ├── config/
│       │   └── workspace-config.test.ts
│       ├── controllers/
│       │   └── version.controller.test.ts
│       ├── core/
│       │   └── conflict-detector-version.test.ts
│       ├── schemas/
│       │   ├── agent.schema.test.ts
│       │   └── metadata.schema.test.ts
│       └── types/
│           └── common.types.test.ts
├── bin/
│   └── retell.ts              # Executable entry point
├── docs/
│   ├── SPECIFICATION.md       # User-facing spec
│   ├── TECHNICAL_SPECIFICATION.md  # This file
│   └── examples/
├── .github/
│   └── workflows/
│       ├── ci.yml             # CI pipeline
│       └── release.yml        # Release automation
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
└── README.md
```

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    // Language and Environment
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],

    // Strict Type Checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional Checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,

    // Module Resolution
    "moduleResolution": "node",
    "baseUrl": "./src",
    "paths": {
      "@commands/*": ["commands/*"],
      "@core/*": ["core/*"],
      "@api/*": ["api/*"],
      "@schemas/*": ["schemas/*"],
      "@types/*": ["types/*"],
      "@utils/*": ["utils/*"],
      "@config/*": ["config/*"]
    },
    "resolveJsonModule": true,
    "esModuleInterop": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": true,
    "newLine": "lf",

    // Interop Constraints
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,

    // Skip Lib Check
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### tsconfig.build.json

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "tests", "**/*.test.ts", "**/*.spec.ts"]
}
```

## Type System Design

### Core Type Principles

1. **No `any` types** - All types must be explicitly defined
2. **Strict null checks** - All nullable values must be explicitly typed with `| null | undefined`
3. **Exhaustive pattern matching** - Use discriminated unions with `never` checks
4. **Branded types** - Use nominal typing for IDs and special strings
5. **Type guards** - Implement runtime type validation with type predicates

### Type Definitions

#### Agent Types (src/types/agent.types.ts)

```typescript
import { z } from 'zod';
import { AgentConfigSchema } from '@schemas/agent.schema';

// Branded types for IDs
export type AgentId = string & { readonly __brand: 'AgentId' };
export type LlmId = string & { readonly __brand: 'LlmId' };
export type KnowledgeBaseId = string & { readonly __brand: 'KnowledgeBaseId' };
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };

// Helper to create branded IDs
export const createAgentId = (id: string): AgentId => id as AgentId;
export const createLlmId = (id: string): LlmId => id as LlmId;

// Infer types from Zod schemas
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type LlmConfig = AgentConfig['llm_config'];
export type PromptConfig = NonNullable<LlmConfig['prompt_config']>;

// Variable types
export type StaticVariable = {
  readonly type: 'static';
  readonly name: string;
  readonly value: string;
};

export type OverrideVariable = {
  readonly type: 'override';
  readonly name: string;
};

export type DynamicVariable = {
  readonly type: 'dynamic';
  readonly name: string;
  readonly valueType: 'string' | 'number' | 'boolean' | 'json';
  readonly description: string;
};

export type SystemVariable = {
  readonly type: 'system';
  readonly name: string;
};

export type Variable =
  | StaticVariable
  | OverrideVariable
  | DynamicVariable
  | SystemVariable;

// Discriminated union for variable categorization
export type VariableSummary = {
  readonly static: ReadonlyArray<StaticVariable>;
  readonly override: ReadonlyArray<OverrideVariable>;
  readonly dynamic: ReadonlyArray<DynamicVariable>;
  readonly system: ReadonlyArray<SystemVariable>;
};
```

#### Prompt Types (src/types/prompt.types.ts)

```typescript
export type SectionId = string & { readonly __brand: 'SectionId' };

export type PromptSection = {
  readonly id: SectionId;
  readonly path: string;
  readonly content: string;
};

export type BuiltPrompt = {
  readonly finalPrompt: string;
  readonly sections: ReadonlyArray<PromptSection>;
  readonly variables: VariableSummary;
  readonly characterCount: number;
};

export type PromptBuildResult =
  | { readonly success: true; readonly prompt: BuiltPrompt }
  | { readonly success: false; readonly errors: ReadonlyArray<PromptBuildError> };

export type PromptBuildError =
  | { readonly type: 'missing_section'; readonly sectionId: SectionId }
  | { readonly type: 'missing_variable'; readonly variableName: string; readonly sectionId: SectionId }
  | { readonly type: 'circular_reference'; readonly sectionId: SectionId }
  | { readonly type: 'invalid_syntax'; readonly message: string; readonly sectionId: SectionId };
```

#### Sync Types (src/types/sync.types.ts)

```typescript
export type Hash = string & { readonly __brand: 'Hash' };
export type Timestamp = string & { readonly __brand: 'Timestamp' };

export type SyncStatus =
  | { readonly status: 'in_sync'; readonly lastSync: Timestamp }
  | { readonly status: 'out_of_sync'; readonly reason: OutOfSyncReason }
  | { readonly status: 'never_synced' };

export type OutOfSyncReason =
  | { readonly type: 'local_changes'; readonly hash: Hash; readonly lastModified: Timestamp }
  | { readonly type: 'remote_changes'; readonly hash: Hash }
  | { readonly type: 'both_changed'; readonly localHash: Hash; readonly remoteHash: Hash };

export type WorkspaceType = 'staging' | 'production';

export type MetadataFile = {
  readonly workspace: WorkspaceType;
  readonly agent_id: AgentId | null;
  readonly llm_id: LlmId | null;
  readonly kb_id: KnowledgeBaseId | null;
  readonly last_sync: Timestamp | null;
  readonly config_hash: Hash | null;
  readonly retell_version: number | null;
};
```

### Zod Schemas

All runtime validation uses Zod schemas that generate TypeScript types.

#### src/schemas/agent.schema.ts

```typescript
import { z } from 'zod';

const PromptConfigSchema = z.object({
  sections: z.array(z.string()).optional(),
  overrides: z.record(z.string(), z.string()).optional(),
  variables: z.record(z.string(), z.union([z.string(), z.literal('OVERRIDE')])).optional(),
  dynamic_variables: z.record(
    z.string(),
    z.object({
      type: z.enum(['string', 'number', 'boolean', 'json']),
      description: z.string()
    })
  ).optional()
}).strict();

const LlmConfigSchema = z.object({
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  prompt_config: PromptConfigSchema.optional(),
  general_prompt: z.string().optional(),
  begin_message: z.string().optional(),
  tools: z.array(z.any()).optional() // TODO: Strict tool schema
}).strict();

export const AgentConfigSchema = z.object({
  agent_name: z.string().min(1).max(100),
  voice_id: z.string(),
  voice_speed: z.number().min(0.5).max(2.0).optional(),
  voice_temperature: z.number().min(0).max(2).optional(),
  interruption_sensitivity: z.number().min(0).max(1).optional(),
  responsiveness: z.number().min(0).max(1).optional(),
  language: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/), // e.g., en-US
  enable_backchannel: z.boolean().optional(),
  backchannel_frequency: z.number().min(0).max(1).optional(),
  ambient_sound: z.enum(['office', 'cafe', 'none']).optional(),
  boosted_keywords: z.array(z.string()).optional(),
  pronunciation_dictionary: z.array(
    z.object({
      word: z.string(),
      pronunciation: z.string()
    })
  ).optional(),
  normalize_for_speech: z.boolean().optional(),
  webhook_url: z.string().url().optional(),
  llm_config: LlmConfigSchema,
  post_call_analysis_data: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean']),
      description: z.string()
    })
  ).optional()
}).strict();

// Orchestration mode
export const OrchestrationModeSchema = z.enum(['single-production', 'multi-production']);
export type OrchestrationMode = z.infer<typeof OrchestrationModeSchema>;

// New format workspace config (references env var)
export const WorkspaceConfigJsonSchema = z.object({
  api_key_env: z.string().min(1, 'API key environment variable name is required'),
  id: z.string().optional(),
  name: z.string(),
  base_url: z.string().url(),
});

// Legacy format (raw API key - deprecated)
export const LegacyWorkspaceConfigJsonSchema = z.object({
  api_key: z.string().min(1),
  workspace_id: z.string().optional(),
  name: z.string(),
  base_url: z.string().url().optional(),
});

// Either format
export const AnyWorkspaceConfigJsonSchema = z.union([
  WorkspaceConfigJsonSchema,
  LegacyWorkspaceConfigJsonSchema,
]);

// Single-production mode config
export const SingleProductionConfigSchema = z.object({
  mode: z.literal('single-production'),
  staging: AnyWorkspaceConfigJsonSchema,
  production: AnyWorkspaceConfigJsonSchema,
});

// Multi-production mode config
export const MultiProductionConfigSchema = z.object({
  mode: z.literal('multi-production'),
  staging: AnyWorkspaceConfigJsonSchema,
  production: z.array(AnyWorkspaceConfigJsonSchema).min(1),
});

// Full workspaces.json schema
export const WorkspacesConfigSchema = z.discriminatedUnion('mode', [
  SingleProductionConfigSchema,
  MultiProductionConfigSchema,
]);

export const MetadataSchema = z.object({
  workspace: z.enum(['staging', 'production']),
  agent_id: z.string().nullable(),
  llm_id: z.string().nullable(),
  kb_id: z.string().nullable(),
  last_sync: z.string().nullable(), // ISO timestamp
  config_hash: z.string().nullable(), // SHA-256
  retell_version: z.number().nullable()
}).strict();
```

## Error Handling

The error handling system uses a layered approach:

1. **Module Layer**: Returns structured `RetellError` objects with error codes
2. **CLI Layer**: Maps `RetellError` to user-friendly output with hints
3. **API Layer**: Maps `RetellError` to HTTP status codes and JSON responses

### RetellError (packages/controllers/)

```typescript
// packages/controllers/src/errors/retell-error.ts

export interface RetellError {
  code: RetellErrorCode;          // Programmatic error code
  message: string;                 // Human-readable message
  details?: Record<string, unknown>; // Additional context
  cause?: Error;                   // Original error if wrapped
}

// Error codes for all possible errors
export const RetellErrorCode = {
  // Workspace errors
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_CONFIG_MISSING: 'WORKSPACE_CONFIG_MISSING',
  WORKSPACE_API_KEY_INVALID: 'WORKSPACE_API_KEY_INVALID',

  // Agent errors
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_CONFIG_INVALID: 'AGENT_CONFIG_INVALID',
  AGENT_NOT_SYNCED: 'AGENT_NOT_SYNCED',

  // Sync errors
  SYNC_CONFLICT: 'SYNC_CONFLICT',
  SYNC_STAGING_REQUIRED: 'SYNC_STAGING_REQUIRED',

  // API errors
  API_ERROR: 'API_ERROR',
  API_UNAUTHORIZED: 'API_UNAUTHORIZED',
  API_RATE_LIMITED: 'API_RATE_LIMITED',

  // ... more codes
} as const;
```

### CLI Error Handler (src/cli/errors/)

```typescript
// src/cli/errors/cli-error-handler.ts

import type { RetellError } from '@heya/retell.controllers';

export class CLIError extends Error {
  readonly exitCode: number;
  readonly hint?: string;

  static fromRetellError(error: RetellError): CLIError {
    const mapped = mapRetellErrorToCLI(error);
    return new CLIError(mapped.message, mapped.exitCode, mapped.hint);
  }
}

function mapRetellErrorToCLI(error: RetellError) {
  switch (error.code) {
    case 'WORKSPACE_CONFIG_MISSING':
      return {
        message: error.message,
        hint: "Run 'retell workspace init' to create workspaces.json",
        exitCode: 1,
      };

    case 'API_UNAUTHORIZED':
      return {
        message: `Authentication failed: ${error.message}`,
        hint: 'Check your API key in workspaces.json',
        exitCode: 2,
      };

    // ... more mappings
  }
}

export function handleRetellError(error: RetellError): never {
  const cliError = CLIError.fromRetellError(error);
  console.error(`\\n❌ ${cliError.message}`);
  if (cliError.hint) {
    console.error(`\\n   Hint: ${cliError.hint}`);
  }
  process.exit(cliError.exitCode);
}
```

### Controller Return Types

Controllers return `Result<T, RetellError>`:

```typescript
// packages/controllers/src/controllers/agent.controller.ts

export class AgentController {
  async push(agentName: string, options: PushOptions): Promise<Result<PushResult, RetellError>> {
    // Load workspace config
    const configResult = await WorkspaceConfigService.getWorkspace(options.workspace);
    if (!configResult.success) {
      return configResult; // Return the RetellError
    }

    // ... business logic

    // Return structured error
    if (!stagingInSync) {
      return Err(createError(
        RetellErrorCode.SYNC_CONFLICT,
        'Local changes differ from staging',
        {
          localHash: currentHash,
          stagingHash: stagingMetadata.config_hash,
          suggestion: `retell push ${agentName} -w staging`
        }
      ));
    }

    // Return success
    return Ok({
      agentId,
      llmId,
      configHash: finalHash,
      syncedAt: timestamp,
      created: true,
    });
  }
}
```

### CLI Command Usage

```typescript
// src/cli/commands/push.ts

import { AgentController } from '@heya/retell.controllers';
import { handleRetellError } from '../errors/cli-error-handler';

export const pushCommand = new Command('push')
  .action(async (agentName: string, options: PushOptions) => {
    const controller = new AgentController();
    const result = await controller.push(agentName, options);

    if (!result.success) {
      handleRetellError(result.error); // Maps to CLI output and exits
    }

    // Display success output
    console.log(`✓ Agent pushed successfully!`);
    console.log(`  Agent ID: ${result.value.agentId}`);
  });
```

### Result Type Pattern

Use Result type for operations that can fail:

```typescript
// src/types/common.types.ts

export type Result<T, E = Error> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

export const Ok = <T>(value: T): Result<T, never> => ({
  success: true,
  value
});

export const Err = <E>(error: E): Result<never, E> => ({
  success: false,
  error
});

// Helper functions
export function isOk<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}
```

## Testing Strategy

### Unit Tests

- **Coverage requirement**: 90%+
- **What to test**: Individual functions, classes, and modules in isolation
- **Mocking**: Mock external dependencies (API, file system)
- **Focus**: Business logic, edge cases, error handling

Example:

```typescript
// tests/unit/core/prompt/VariableResolver.test.ts

import { VariableResolver } from '@core/prompt/VariableResolver';
import { PromptConfig } from '@types/agent.types';

describe('VariableResolver', () => {
  let resolver: VariableResolver;

  beforeEach(() => {
    resolver = new VariableResolver();
  });

  describe('categorizeVariables', () => {
    it('should correctly identify static variables', () => {
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
          support_hours: '9am-5pm'
        }
      };

      const usedVariables = new Set(['company_name', 'support_hours', 'customer_name']);
      const result = resolver.categorizeVariables(config, usedVariables);

      expect(result.static).toHaveLength(2);
      expect(result.static[0]?.name).toBe('company_name');
      expect(result.static[0]?.value).toBe('Acme Corp');
    });

    it('should identify OVERRIDE variables', () => {
      const config: PromptConfig = {
        variables: {
          user_id: 'OVERRIDE',
          session_token: 'OVERRIDE'
        }
      };

      const usedVariables = new Set(['user_id', 'session_token']);
      const result = resolver.categorizeVariables(config, usedVariables);

      expect(result.override).toHaveLength(2);
      expect(result.override[0]?.name).toBe('user_id');
    });

    it('should identify dynamic variables', () => {
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme'
        },
        dynamic_variables: {
          customer_name: {
            type: 'string',
            description: 'Customer full name'
          }
        }
      };

      const usedVariables = new Set(['company_name', 'customer_name']);
      const result = resolver.categorizeVariables(config, usedVariables);

      expect(result.dynamic).toHaveLength(1);
      expect(result.dynamic[0]?.name).toBe('customer_name');
      expect(result.dynamic[0]?.description).toBe('Customer full name');
    });

    it('should identify system variables', () => {
      const config: PromptConfig = {};
      const usedVariables = new Set(['current_time_Australia/Sydney', 'user_number']);

      const result = resolver.categorizeVariables(config, usedVariables);

      expect(result.system).toHaveLength(2);
    });

    it('should handle empty configuration', () => {
      const config: PromptConfig = {};
      const usedVariables = new Set<string>();

      const result = resolver.categorizeVariables(config, usedVariables);

      expect(result.static).toHaveLength(0);
      expect(result.override).toHaveLength(0);
      expect(result.dynamic).toHaveLength(0);
      expect(result.system).toHaveLength(0);
    });
  });

  describe('extractVariablesFromPrompt', () => {
    it('should extract all {{variable}} references', () => {
      const prompt = 'Hello {{customer_name}}, your order {{order_id}} is ready.';
      const variables = resolver.extractVariablesFromPrompt(prompt);

      expect(variables).toEqual(new Set(['customer_name', 'order_id']));
    });

    it('should handle duplicate references', () => {
      const prompt = '{{name}} and {{name}} and {{age}}';
      const variables = resolver.extractVariablesFromPrompt(prompt);

      expect(variables).toEqual(new Set(['name', 'age']));
    });

    it('should handle nested braces', () => {
      const prompt = 'JSON: {{data}} and {{nested.value}}';
      const variables = resolver.extractVariablesFromPrompt(prompt);

      expect(variables).toEqual(new Set(['data', 'nested.value']));
    });
  });
});
```

### Integration Tests

- **What to test**: Interaction between multiple modules
- **Focus**: Command execution, API integration, file system operations
- **Environment**: Use test workspaces and temporary directories

Example:

```typescript
// tests/integration/commands/push.integration.test.ts

import { PushCommand } from '@commands/push';
import { WorkspaceManager } from '@core/workspace/WorkspaceManager';
import { MockRetellApi } from '../../helpers/mockRetellApi';
import { createTestWorkspace, cleanupTestWorkspace } from '../../helpers/testFileSystem';
import fs from 'fs/promises';
import path from 'path';

describe('Push Command Integration', () => {
  let testDir: string;
  let mockApi: MockRetellApi;
  let workspaceManager: WorkspaceManager;

  beforeEach(async () => {
    testDir = await createTestWorkspace();
    mockApi = new MockRetellApi();
    workspaceManager = new WorkspaceManager(path.join(testDir, 'workspaces.json'));

    // Setup test workspace
    await workspaceManager.add('staging', 'test_api_key', {
      name: 'Test Staging',
      base_url: mockApi.baseUrl
    });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testDir);
    mockApi.close();
  });

  it('should push agent configuration to staging', async () => {
    // Setup: Create agent config
    const agentDir = path.join(testDir, 'agents', 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });

    const agentConfig = {
      agent_name: 'Test Agent',
      voice_id: 'test-voice',
      language: 'en-US',
      llm_config: {
        model: 'gpt-4o-mini',
        general_prompt: 'Test prompt'
      }
    };

    await fs.writeFile(
      path.join(agentDir, 'agent.json'),
      JSON.stringify(agentConfig, null, 2)
    );

    // Mock API responses
    mockApi.onCreateAgent().reply(200, {
      agent_id: 'agent_test_123',
      ...agentConfig
    });

    mockApi.onCreateLlm().reply(200, {
      llm_id: 'llm_test_456',
      ...agentConfig.llm_config
    });

    // Execute
    const pushCommand = new PushCommand(workspaceManager, mockApi.client);
    const result = await pushCommand.execute(agentDir, { workspace: 'staging' });

    // Assert
    expect(result.success).toBe(true);

    // Verify metadata file was created
    const metadata = JSON.parse(
      await fs.readFile(path.join(agentDir, 'staging.json'), 'utf-8')
    );

    expect(metadata.agent_id).toBe('agent_test_123');
    expect(metadata.llm_id).toBe('llm_test_456');
    expect(metadata.config_hash).toBeDefined();
  });

  it('should display variable summary before pushing', async () => {
    // Setup agent with variables
    const agentDir = path.join(testDir, 'agents', 'test-agent');
    await fs.mkdir(agentDir, { recursive: true });

    const agentConfig = {
      agent_name: 'Test Agent',
      voice_id: 'test-voice',
      language: 'en-US',
      llm_config: {
        model: 'gpt-4o-mini',
        prompt_config: {
          sections: ['base/greeting'],
          variables: {
            company_name: 'Test Corp',
            user_id: 'OVERRIDE'
          },
          dynamic_variables: {
            customer_name: {
              type: 'string',
              description: 'Customer name'
            }
          }
        }
      }
    };

    await fs.writeFile(
      path.join(agentDir, 'agent.json'),
      JSON.stringify(agentConfig, null, 2)
    );

    // Create prompt section
    const promptDir = path.join(testDir, 'prompts', 'base');
    await fs.mkdir(promptDir, { recursive: true });
    await fs.writeFile(
      path.join(promptDir, 'greeting.txt'),
      'Hello from {{company_name}}, {{customer_name}}! Your ID: {{user_id}}'
    );

    const pushCommand = new PushCommand(workspaceManager, mockApi.client);
    const summary = await pushCommand.getVariableSummary(agentConfig);

    expect(summary.static).toHaveLength(1);
    expect(summary.override).toHaveLength(1);
    expect(summary.dynamic).toHaveLength(1);
  });
});
```

### End-to-End Tests

- **What to test**: Complete workflows from user perspective
- **Focus**: Real CLI execution, file system state, API interactions
- **Environment**: Full test environment with real file structure

Example:

```typescript
// tests/e2e/full-workflow.e2e.test.ts

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { createTestEnvironment, cleanupTestEnvironment } from '../helpers/e2eHelpers';

describe('Full Workflow E2E', () => {
  let testEnv: string;
  let cliPath: string;

  beforeAll(async () => {
    testEnv = await createTestEnvironment();
    cliPath = path.join(__dirname, '../../bin/retell.js');
  });

  afterAll(async () => {
    await cleanupTestEnvironment(testEnv);
  });

  it('should complete init -> push -> release workflow', async () => {
    // 1. Add workspace
    execSync(`node ${cliPath} workspace add staging ${process.env.TEST_API_KEY}`, {
      cwd: testEnv
    });

    // 2. Initialize agent
    execSync(`node ${cliPath} init agents/test-agent --name "Test Agent"`, {
      cwd: testEnv
    });

    // 3. Verify agent structure created
    const agentDir = path.join(testEnv, 'agents', 'test-agent');
    const files = await fs.readdir(agentDir);

    expect(files).toContain('agent.json');
    expect(files).toContain('staging.json');
    expect(files).toContain('production.json');

    // 4. Edit agent config
    const agentConfig = JSON.parse(
      await fs.readFile(path.join(agentDir, 'agent.json'), 'utf-8')
    );
    agentConfig.voice_speed = 1.2;
    await fs.writeFile(
      path.join(agentDir, 'agent.json'),
      JSON.stringify(agentConfig, null, 2)
    );

    // 5. Push to staging
    const pushOutput = execSync(
      `node ${cliPath} push agents/test-agent --staging --yes`,
      { cwd: testEnv, encoding: 'utf-8' }
    );

    expect(pushOutput).toContain('Agent updated');
    expect(pushOutput).toContain('Variables Summary');

    // 6. Check status
    const statusOutput = execSync(
      `node ${cliPath} status agents/test-agent`,
      { cwd: testEnv, encoding: 'utf-8' }
    );

    expect(statusOutput).toContain('in sync');

    // 7. Release to production
    execSync(`node ${cliPath} workspace add production ${process.env.TEST_PROD_API_KEY}`, {
      cwd: testEnv
    });

    const releaseOutput = execSync(
      `node ${cliPath} release agents/test-agent --yes`,
      { cwd: testEnv, encoding: 'utf-8' }
    );

    expect(releaseOutput).toContain('Production agent updated');
    expect(releaseOutput).toContain('Variables Summary');
  });
});
```

## Code Quality

### ESLint Configuration

```javascript
// .eslintrc.js

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'jest'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:jest/recommended',
    'prettier'
  ],
  rules: {
    // TypeScript specific
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',

    // General
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  env: {
    node: true,
    jest: true
  }
};
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

## CI/CD Pipeline

### GitHub Actions - CI

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Unit tests
        run: npm run test:unit

      - name: Integration tests
        run: npm run test:integration
        env:
          TEST_API_KEY: ${{ secrets.TEST_API_KEY }}

      - name: E2E tests
        run: npm run test:e2e
        env:
          TEST_API_KEY: ${{ secrets.TEST_API_KEY }}
          TEST_PROD_API_KEY: ${{ secrets.TEST_PROD_API_KEY }}

      - name: Coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
```

## Package.json Scripts

```json
{
  "name": "@retell/cli",
  "version": "1.0.0",
  "description": "CLI tool for managing Retell AI agents",
  "main": "dist/index.js",
  "bin": {
    "retell": "./bin/retell.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "build:watch": "tsc -p tsconfig.build.json --watch",
    "dev": "ts-node src/index.ts",
    "type-check": "tsc --noEmit",
    "lint": "eslint 'src/**/*.ts' 'tests/**/*.ts'",
    "lint:fix": "eslint 'src/**/*.ts' 'tests/**/*.ts' --fix",
    "format": "prettier --write 'src/**/*.ts' 'tests/**/*.ts'",
    "format:check": "prettier --check 'src/**/*.ts' 'tests/**/*.ts'",
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "jest --testPathPattern=tests/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "prepublishOnly": "npm run build",
    "precommit": "npm run lint && npm run type-check && npm run test:unit"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "retell-sdk": "^4.4.0",
    "zod": "^3.22.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.1",
    "inquirer": "^9.2.0",
    "cli-table3": "^0.6.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.5.0",
    "@types/inquirer": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.50.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-jest": "^27.4.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.2.0",
    "prettier": "^3.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Jest Configuration

```javascript
// jest.config.js

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@commands/(.*)$': '<rootDir>/src/commands/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@schemas/(.*)$': '<rootDir>/src/schemas/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000
};
```

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Run type checking
npm run type-check

# Run linter
npm run lint

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Test CLI locally
node dist/index.js --help
```

### Pre-commit Checklist

1. Run `npm run type-check` - No TypeScript errors
2. Run `npm run lint` - No linting errors
3. Run `npm run format:check` - Code is formatted
4. Run `npm run test:unit` - All unit tests pass
5. Run `npm run build` - Build succeeds

### Pull Request Requirements

1. All tests passing (unit, integration, e2e)
2. Code coverage ≥ 90%
3. No TypeScript errors
4. No linting errors
5. Code formatted with Prettier
6. Documentation updated if needed

## Performance Considerations

1. **Lazy Loading**: Load heavy dependencies only when needed
2. **Streaming**: Use streams for large file operations
3. **Caching**: Cache built prompts and API responses when appropriate
4. **Parallel Operations**: Use Promise.all for independent operations
5. **Minimal Dependencies**: Keep bundle size small

## Security Considerations

1. **API Key Storage**: Never commit `workspaces.json`
2. **Input Validation**: Validate all user input with Zod
3. **Path Traversal**: Sanitize all file paths
4. **Dependency Auditing**: Run `npm audit` regularly
5. **Error Messages**: Don't leak sensitive info in error messages

## Workspace Configuration & Validation

### Overview

As of version 1.0.0, the CLI **requires** a `workspaces.json` file for all operations. This prevents accidental operations without explicit configuration.

### Orchestration Modes

The CLI supports two orchestration modes:

#### Single-Production Mode (Default)
- One staging workspace + one production workspace
- Production workspace can have multiple agents
- Best for: Most use cases, simple deployments

#### Multi-Production Mode
- One staging workspace + multiple production workspaces
- Each production workspace typically has one agent
- Best for: High-scale deployments, tenant isolation, geographic distribution

### Configuration Format

**New Format** (Recommended - can be committed to git):
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

**Multi-Production Format**:
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

**Legacy Format** (Deprecated - must NOT be committed):
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

### Configuration Flow

1. **Environment Variables** (`.env`):
   ```env
   RETELL_STAGING_API_KEY=key_xxx
   RETELL_PRODUCTION_API_KEY=key_yyy
   ```

2. **Generate Configuration**:
   ```bash
   retell workspace init                    # Single-production mode
   retell workspace init --mode multi-production  # Multi-production mode
   ```

3. **Result** (`workspaces.json`) - uses `api_key_env` references

### Validation Rules

The `WorkspaceConfigService` validates:

1. **File Existence**: `workspaces.json` must exist in project root
2. **Valid JSON**: File must be properly formatted JSON
3. **Mode Field**: Must be `single-production` or `multi-production` (auto-detected if missing)
4. **Required Workspaces**: Both `staging` and `production` must be present
5. **API Keys**: Environment variables referenced by `api_key_env` must be set
6. **Production Array**: In multi-production mode, must have at least one workspace
7. **Base URL**: Defaults to `https://api.retellai.com` if not specified

### Error Handling

| Error | Message | Solution |
|-------|---------|----------|
| File not found | `workspaces.json not found` | Run `retell workspace init` |
| Missing workspace | `Missing 'staging' workspace` | Run `retell workspace init --force` |
| Missing env var | `Environment variable 'X' is not set` | Set the env var in `.env` |
| Invalid mode | `In 'multi-production' mode, 'production' must be an array` | Fix mode/production format |
| Malformed JSON | `Invalid JSON in workspaces.json` | Regenerate with `--force` |

### Implementation

**Location**: `packages/controllers/src/services/workspace-config.service.ts`

**Key Methods**:
- `load()`: Load and validate workspaces.json (required)
- `getWorkspace(type, index?)`: Get specific workspace configuration
- `getProductionWorkspaces()`: Get all production workspaces (returns array)
- `getAllWorkspaces()`: Get all workspaces with type info
- `getMode()`: Get current orchestration mode
- `generateFromEnv(options)`: Generate workspaces.json from environment variables
- `exists()`: Check if workspaces.json exists

**Usage in Commands**:
```typescript
// All commands must load workspace config first
const workspaceConfigResult = await WorkspaceConfigService.getWorkspace(options.workspace);
if (!workspaceConfigResult.success) {
  throw workspaceConfigResult.error; // Prevents operation
}

// Get all production workspaces (for multi-production mode)
const prodResult = await WorkspaceConfigService.getProductionWorkspaces();
if (prodResult.success) {
  for (const prod of prodResult.value) {
    // Process each production workspace
  }
}

// Get mode
const modeResult = await WorkspaceConfigService.getMode();
// modeResult.value is 'single-production' | 'multi-production'
```

### Security Benefits

1. **API Keys in Environment**: Actual keys stay in `.env` (gitignored)
2. **Config is Committable**: `workspaces.json` with `api_key_env` can be committed
3. **Validation Before Operations**: All API calls validated upfront
4. **Clear Error Messages**: Users know exactly what's missing
5. **CI/CD Compatible**: Environment injection works seamlessly

### Workspace Limits

Testing shows Retell AI workspaces can handle **≥100 agents**:
- No hard limit encountered during testing
- Successfully created 100 agents in ~6 minutes
- No rate limiting or quota issues
- See `WORKSPACE_LIMIT_TEST_RESULTS.md` for details

## Documentation Requirements

1. **JSDoc Comments**: All public functions and classes
2. **README**: Installation, usage, examples
3. **Type Documentation**: Complex types explained
4. **Architecture Diagrams**: For core systems
5. **Migration Guides**: For breaking changes
