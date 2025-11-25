# Changelog

All notable changes to the Retell CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Test Migration to Controllers Package
- **Core Tests Moved**: Migrated core logic tests from `tests/unit/core/` to `packages/controllers/`:
  - `variable-resolver.test.ts` - Variable categorization and validation tests
  - `agent-config-loader.test.ts` - Agent config load/save/exists tests
  - `metadata-manager.test.ts` - Metadata read/write/update tests
  - `agent-transformer.test.ts` - Agent transformation tests

- **Test Enhancements**:
  - Added empty content and unicode handling tests to `hash-calculator.test.ts`
  - Added system variable extraction tests to `prompt-builder.test.ts`

- **Controllers Package Tests**: 8 test suites with 113 tests (Vitest)
- **CLI Tests**: 16 test suites with 128 tests (Jest)

### Changed

#### Test Infrastructure Cleanup
- **Removed Duplicate Source Files**:
  - Deleted `src/core/` - 9 duplicate files (now in controllers package)
  - Deleted `src/schemas/` - 2 duplicate files
  - Deleted `src/config/` - 1 duplicate file
  - Deleted `src/types/` - 2 duplicate files

- **Updated Test Imports**: All CLI command tests now import from `@heya/retell.controllers`:
  - `push.test.ts`, `pull.test.ts`, `status.test.ts`, `diff.test.ts`
  - `update.test.ts`, `init.test.ts`, `bulk-create.test.ts`
  - `list.test.ts`, `delete.test.ts`
  - `common.types.test.ts` - Updated to use `createError` with `RetellError`

- **Fixed TS Errors**: Resolved unused variable warnings in `prompt-section-mapper.ts`

#### Monorepo Architecture with @retell/module Package
- **Package Extraction**: Core functionality extracted into `packages/module/` npm package
  - Enables reuse by CLI, API, and other tools
  - Controllers orchestrate business operations (AgentController, WorkspaceController)
  - Services wrap external integrations (RetellClientService, WorkspaceConfigService)
  - Core modules handle business logic (HashCalculator, MetadataManager, etc.)

- **Structured Error Handling**: New `RetellError` system with error codes
  - 40+ error codes covering workspace, agent, sync, API, validation, and file operations
  - CLI maps errors to user-friendly messages with hints
  - API can map errors to HTTP status codes
  - Error details include contextual information and suggestions

- **Controller Layer**: Business logic orchestration
  - `AgentController`: push, list, delete operations
  - `WorkspaceController`: init, list, exists operations
  - All methods return `Result<T, RetellError>` for consistent error handling

- **CLI Error Handler**: Maps module errors to CLI output
  - User-friendly error messages with emojis
  - Contextual hints for resolution
  - Appropriate exit codes

### Changed

- **Project Structure**: Now uses npm workspaces monorepo pattern
  - `packages/module/` contains reusable core functionality
  - `src/cli/` contains CLI-specific code (thin wrappers)
  - Dependencies managed through workspace protocol

- **Import Paths**: Core types and modules now imported from `@retell/module`
  - `import { AgentController, WorkspaceType } from '@retell/module'`

- **Build Process**: Module must be built before CLI
  - `npm run build` now builds module first, then CLI

#### Production Push Protection
- **Staging-First Workflow**: Enforced staging deployment before production
  - Cannot push to production unless agent exists in staging
  - Local version must match staging version (same config hash)
  - Validates staging deployment state before production push
  - Clear error messages with remediation steps
  - `--force` flag available to override (not recommended)

- **Benefits**:
  - Prevents accidental production deployments
  - Ensures all changes are tested in staging first
  - Maintains consistency between environments
  - Reduces production incidents

#### Bulk Agent Creation
- **`bulk-create` Command**: New CLI command to create multiple agents from templates
  - Create 1-1000 agents at once with configurable options
  - Automatic sequential naming (e.g., agent-001, agent-002)
  - Template-based agent generation
  - Workspace validation before creation
  - Conflict detection and skip existing agents
  - Progress tracking and detailed summary
  - Customizable agent names and prompts per agent
  - Options: `--count`, `--template`, `--prefix`, `--path`, `--templates`, `--skip-validation`, `--yes`

- **Template System**: Basic agent template in `templates/basic.json`
  - JSON-based agent configuration templates
  - Support for custom templates
  - Automatic prompt customization per agent

## [1.0.0] - 2025-11-18

### Added

#### Workspace Configuration & Validation
- **Required `workspaces.json`**: All CLI operations now require a `workspaces.json` file
  - Prevents accidental operations without explicit workspace configuration
  - No silent fallback to environment variables
  - Clear error messages guide users to solutions

- **`workspace init` Command**: New command to generate `workspaces.json` from environment variables
  - Reads `RETELL_STAGING_API_KEY` and `RETELL_PRODUCTION_API_KEY` from `.env`
  - Creates properly formatted `workspaces.json` with both staging and production workspaces
  - Supports `--force` flag to overwrite existing configuration
  - Validates environment variables before generation

- **Comprehensive Workspace Validation**:
  - File existence validation
  - JSON format validation
  - Required workspace validation (both staging and production)
  - API key validation (non-empty)
  - Base URL defaults to `https://api.retellai.com`

#### Testing & Documentation
- **Workspace Limit Testing**: Comprehensive testing of Retell AI workspace limits
  - Created and tested 100 agents successfully
  - No hard limit encountered
  - Zero failures or rate limiting issues
  - Results documented in `WORKSPACE_LIMIT_TEST_RESULTS.md`

- **Testing Scripts**:
  - `scripts/create-100-agents.sh`: Generate 100 test agent directories
  - `scripts/create-100-agents.ts`: TypeScript version with error handling
  - `scripts/push-all-100.sh`: Smart push script with rate limiting
  - `scripts/push-agents-with-rate-limit.sh`: Generic rate-limited push script
  - `scripts/README.md`: Complete documentation for all testing scripts

- **Documentation Updates**:
  - Enhanced `README.md` with Quick Start guide and comprehensive documentation
  - Updated `docs/SPECIFICATION.md` with workspace configuration requirements
  - Updated `docs/TECHNICAL_SPECIFICATION.md` with validation implementation details
  - Added `WORKSPACE_VALIDATION.md` for workspace configuration guide
  - Added `WORKSPACE_LIMIT_TEST_RESULTS.md` for testing findings
  - Updated `.gitignore` to include test agent directories

### Changed

#### Breaking Changes
- **`WorkspaceConfigLoader.load()`** is now async (returns `Promise<Result<...>>`)
  - Updated `push` command to use `await`
  - Updated `list` command to use `await`
  - All workspace operations now properly validate before execution

- **Environment Variable Fallback Removed**:
  - Previous behavior: Would silently fall back to environment variables if `workspaces.json` not found
  - New behavior: Requires `workspaces.json` to exist, fails with helpful error message

#### Improvements
- **Error Messages**: All workspace-related errors now include solution instructions
  - Missing file: Suggests running `retell workspace init`
  - Missing workspace: Suggests running `retell workspace init --force`
  - Invalid API key: Suggests checking `.env` and regenerating

- **Type Safety**: All workspace configuration loading is now properly typed and validated

### Fixed
- Metadata schema validation now properly requires `workspace` field to be `'staging'` or `'production'` (not `null`)

### Security
- Reinforced `.gitignore` patterns for sensitive files
- Added explicit documentation about never committing API keys
- Workspace validation prevents operations with incomplete configuration

## [Unreleased]

### Planned Features
- `workspace add` command for interactive workspace addition
- `workspace list` command to show configured workspaces
- `workspace remove` command to remove workspace configuration
- API key validation (test connection to Retell API)
- Workspace ID display in configuration

---

## Version History

### Initial Development (Pre-1.0.0)
- Core CLI structure with Commander.js
- Agent push/pull/status commands
- Composable prompt system
- Hash-based sync tracking
- Metadata management
- Integration with Retell SDK

---

## Upgrade Guide

### Upgrading to 1.0.0

**Required Steps:**

1. **Ensure `.env` file exists** with required environment variables:
   ```env
   RETELL_STAGING_API_KEY=key_xxx
   RETELL_PRODUCTION_API_KEY=key_yyy
   ```

2. **Generate `workspaces.json`**:
   ```bash
   npm run build
   node bin/retell.js workspace init
   ```

3. **Verify configuration**:
   ```bash
   cat workspaces.json
   ```

4. **Test with a command**:
   ```bash
   node bin/retell.js list -w staging
   ```

**Migration Notes:**
- If you were using environment variables directly, they will still be read by `workspace init`
- Existing metadata files (`staging.json`, `production.json`) are compatible
- No changes required to agent configurations

**Rollback:**
If you need to rollback to pre-1.0.0 behavior, checkout the previous commit before the workspace validation changes.

---

## Support

For issues, questions, or contributions:
- GitHub Issues: [Create an issue](https://github.com/your-org/retell-dev/issues)
- Documentation: See `README.md` and `docs/` directory
