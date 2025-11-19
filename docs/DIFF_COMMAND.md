# Diff Command - Conflict Detection Guide

## Overview

The `retell diff` command detects and resolves conflicts between your local agent configuration and what's deployed on Retell's servers. This is essential when agents are modified through the Retell Console or by other team members.

## Quick Start

```bash
# Check for conflicts
retell diff my-agent

# Check in production
retell diff my-agent -w production

# Show full prompt comparison
retell diff my-agent --full

# Auto-resolve using local config
retell diff my-agent --resolve use-local

# Auto-resolve using remote config
retell diff my-agent --resolve use-remote
```

## Why You Need This

### Common Scenarios

**Scenario 1: Console Edits**
Someone tweaked voice settings in the Retell Console. Now your local config differs from what's deployed.

**Scenario 2: Team Collaboration**
A teammate pushed changes that conflict with your local work.

**Scenario 3: Production Drift**
Production was hotfixed via Console, but staging still has old config.

Without `retell diff`, you'd:
- ❌ Blindly overwrite remote changes
- ❌ Not know what changed
- ❌ Lose important edits

With `retell diff`, you:
- ✅ See exactly what's different
- ✅ Choose how to resolve conflicts
- ✅ Keep configurations in sync

## Command Syntax

```bash
retell diff <agent-name> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-w, --workspace <workspace>` | Workspace to check (staging or production) | `staging` |
| `-p, --path <path>` | Path to agents directory | `./agents` |
| `--prompts <path>` | Path to prompts directory | `./prompts` |
| `--full` | Show full prompts instead of preview | `false` |
| `--resolve <strategy>` | Auto-resolve conflicts (use-local, use-remote, manual) | None |

## Understanding Conflicts

### What Gets Compared

**Agent-Level Fields:**
- `agent_name`
- `voice_id`, `voice_speed`, `voice_temperature`
- `responsiveness`, `interruption_sensitivity`
- `language`
- `enable_backchannel`, `backchannel_frequency`
- `ambient_sound`
- `boosted_keywords`
- `pronunciation_dictionary`
- `normalize_for_speech`
- `webhook_url`
- `post_call_analysis_data`

**LLM-Level Fields:**
- `model`
- `temperature`
- `begin_message`
- `tools` (general_tools)
- `general_prompt` (handled specially - see below)

### How Prompts Are Compared

**Your Local Config:**
```json
{
  "llm_config": {
    "prompt_config": {
      "sections": ["base/greeting", "sales/intro"],
      "variables": {
        "company_name": "Acme Corp"
      }
    }
  }
}
```

**Build Process:**
1. Load `prompts/base/greeting.txt`
2. Load `prompts/sales/intro.txt`
3. Join sections with `\n\n`
4. Substitute static variables
5. Result: Final prompt string

**What Retell Stores:**
```json
{
  "llm": {
    "general_prompt": "Hello! Welcome to Acme Corp sales..."
  }
}
```

**Comparison:**
```
Local Built Prompt Hash  vs  Remote Prompt Hash
     ↓                             ↓
If different → Show text diff
```

### The Config Hash System

**How It Works:**

1. **After Push:**
   - CLI builds your prompt from sections
   - Creates complete Retell config (Agent + LLM)
   - Hashes the complete config
   - Stores hash in `staging.json`/`production.json`

2. **During Diff:**
   - Fetches current config from Retell
   - Hashes remote config
   - Compares: `stored_hash` vs `remote_hash`
   - If different → Conflicts exist

**Hash Storage (staging.json):**
```json
{
  "workspace": "staging",
  "agent_id": "agent_abc123",
  "llm_id": "llm_def456",
  "config_hash": "sha256:1a2b3c4d...",
  "last_sync": "2025-11-19T15:30:00Z"
}
```

## Output Examples

### No Conflicts

```bash
$ retell diff customer-service

Checking for conflicts: 'customer-service' in staging...

Loading local configuration...
Fetching staging configuration from Retell...
Analyzing differences...

✅ No conflicts detected.
Configuration is in sync with Retell

Last synced: 2025-11-19T15:30:00Z
```

### Field Conflicts Only

```bash
$ retell diff customer-service

⚠️  Conflicts Detected

Local Config Hash:  sha256:abc123def456...
Remote Config Hash: sha256:789xyz012abc...
Stored Hash:        sha256:111222333444...

Field Conflicts:

  agent.voice_speed:
    Local:  1.2
    Remote: 1.0

  llm.temperature:
    Local:  0.7
    Remote: 0.9

  agent.language:
    Local:  "en-US"
    Remote: "en-GB"

📝 Resolution Options:

  1. Use local changes (force push):
     retell diff customer-service -w staging --resolve use-local
     retell push customer-service -w staging --force

  2. Use remote changes (pull):
     retell diff customer-service -w staging --resolve use-remote
     # Review agent.json, then push to sync

  3. Manually resolve:
     # Edit agent.json to resolve conflicts
     retell push customer-service -w staging
```

### Prompt Conflicts

```bash
$ retell diff sales-agent --full

⚠️  Conflicts Detected

Prompt Conflict:

  Local Hash:  sha256:aaa111...
  Remote Hash: sha256:bbb222...

Detailed Prompt Diff:

  LOCAL                                  | REMOTE
  ----------------------------------------|----------------------------------------
> Hello! Welcome to Acme Corp sales...   | Hi there! This is Acme sales...
> We're here to help you find the per... | How can I help you today?...
  Thank you for your interest...         | Thank you for your interest...
> Our team specializes in...             | We specialize in...
```

### Preview Mode (Default)

```bash
$ retell diff sales-agent

Prompt Conflict:

  Local Hash:  sha256:aaa111...
  Remote Hash: sha256:bbb222...

  Local Prompt (preview):
    Hello! Welcome to Acme Corp sales. We're here to help you find
    the perfect solution for your needs. Our team specializes in
    enterprise software solutions and has been serving customers
    since 2020. Whether you're looking for CRM, analytics, or...
    (Showing first 500 characters. Use --full to see complete prompts)

  Remote Prompt (preview):
    Hi there! This is Acme sales. How can I help you today?
    We have great solutions for businesses of all sizes...
    (Showing first 500 characters. Use --full to see complete prompts)
```

## Resolution Strategies

### 1. Use Local (Force Push)

**When to use:**
- You made intentional changes locally
- You want to overwrite what's on Retell
- You're confident local is correct

**Command:**
```bash
retell diff my-agent --resolve use-local
retell push my-agent --force
```

**What happens:**
- ✅ Local config remains unchanged
- ⚠️  Shows message to run `push --force`
- ✅ Next force push overwrites remote with local

**Example:**
```bash
$ retell diff customer-service --resolve use-local

Applying resolution strategy: use-local

Local configuration will be used. Run push command with --force to overwrite remote.

$ retell push customer-service -w staging --force
Pushing agent 'customer-service' to staging...
✓ Push to staging completed successfully!
```

### 2. Use Remote (Pull)

**When to use:**
- Someone updated via Retell Console
- You want to adopt their changes
- Remote is the source of truth

**Command:**
```bash
retell diff my-agent --resolve use-remote
```

**What happens:**
- ✅ Updates local `agent.json` with remote values
- ✅ Preserves `prompt_config` structure (if you use sections)
- ⚠️  Shows message to review changes
- ⚠️  You'll need to push to sync metadata

**Example:**
```bash
$ retell diff customer-service --resolve use-remote

Applying resolution strategy: use-remote

Remote configuration has been pulled and saved to agent.json.
Review the changes and run push to sync.

$ cat agents/customer-service/agent.json
{
  "agent_name": "Customer Service",
  "voice_speed": 1.0,  // ← Updated from remote
  "llm_config": {
    "temperature": 0.9  // ← Updated from remote
  }
}

$ retell push customer-service -w staging
# Push to update metadata
```

**Important for Prompts:**
- If you use `prompt_config` locally, it's **preserved**
- The remote `general_prompt` is **not** broken into sections
- You may need to manually update section files to match

### 3. Manual Resolution

**When to use:**
- Conflicts in multiple fields need different resolutions
- Need to cherry-pick specific changes
- Complex prompt edits require careful merging

**Process:**
```bash
# 1. See full diff
retell diff my-agent --full > conflicts.txt

# 2. Review conflicts
cat conflicts.txt

# 3. Manually edit agent.json
vim agents/my-agent/agent.json

# 4. For prompts: Update section files
vim prompts/base/greeting.txt
vim prompts/sales/intro.txt

# 5. Push resolved config
retell push my-agent -w staging
```

**Example:**
```bash
$ retell diff customer-service --full

Field Conflicts:
  voice_speed: Local 1.2, Remote 1.0
  temperature: Local 0.7, Remote 0.9

Prompt Conflict:
  [shows full diff]

# Decision:
# - voice_speed: Use remote (1.0)
# - temperature: Use local (0.7)
# - prompt: Merge both versions

$ vim agents/customer-service/agent.json
# Edit: voice_speed: 1.0, temperature: 0.7

$ vim prompts/customer-service/greeting.txt
# Manually merge prompt changes

$ retell push customer-service -w staging
```

## Workflows

### Workflow 1: Before Pushing Changes

**Always check for conflicts before pushing:**

```bash
# 1. Check for conflicts
retell diff my-agent -w staging

# 2. If conflicts exist, review them
retell diff my-agent -w staging --full

# 3. Resolve conflicts
retell diff my-agent -w staging --resolve use-local

# 4. Force push
retell push my-agent -w staging --force
```

### Workflow 2: After Console Edits

**Someone edited in Retell Console, pull changes:**

```bash
# 1. Detect what changed
retell diff my-agent -w staging

# 2. Pull remote changes
retell diff my-agent -w staging --resolve use-remote

# 3. Review what changed
git diff agents/my-agent/agent.json

# 4. If good, commit
git add agents/my-agent/agent.json
git commit -m "Pull console changes: adjusted voice speed"

# 5. Push to update metadata
retell push my-agent -w staging
```

### Workflow 3: Pre-Production Release

**Ensure staging and production are in sync:**

```bash
# 1. Check staging
retell diff my-agent -w staging
# Should show no conflicts

# 2. Check production
retell diff my-agent -w production

# 3. If production has drift, resolve
retell diff my-agent -w production --full

# 4. Decide: use-local or use-remote
retell diff my-agent -w production --resolve use-local

# 5. Release to production
retell push my-agent -w production --force
```

### Workflow 4: Team Sync

**Sync after teammate's changes:**

```bash
# 1. Pull code from git
git pull origin main

# 2. Check for remote drift
retell diff my-agent -w staging

# 3. If conflicts, check what teammate changed locally
git log -p agents/my-agent/

# 4. Pull remote to see production state
retell diff my-agent -w staging --resolve use-remote

# 5. Discuss with team, merge manually if needed
vim agents/my-agent/agent.json

# 6. Push merged version
retell push my-agent -w staging
```

### Workflow 5: Bulk Conflict Check

**Check all agents for conflicts:**

```bash
#!/bin/bash
# check-all-conflicts.sh

for agent_dir in agents/*/; do
  agent=$(basename "$agent_dir")

  echo "Checking $agent..."
  retell diff "$agent" -w staging 2>&1 | grep -q "No conflicts"

  if [ $? -eq 0 ]; then
    echo "  ✓ In sync"
  else
    echo "  ⚠️  Has conflicts"
    retell diff "$agent" -w staging
    echo ""
  fi
done
```

## Common Issues

### Issue: "Agent not found in workspace"

```
Error: Agent not found in staging. Run 'retell push' first.
```

**Cause:** Agent hasn't been pushed to the workspace yet.

**Solution:**
```bash
retell push my-agent -w staging
```

### Issue: "Failed to build prompt"

```
Error: Prompt section not found: base/greeting at prompts/base/greeting.txt
```

**Cause:** Referenced prompt section file doesn't exist.

**Solution:**
```bash
# Check what sections are referenced
cat agents/my-agent/agent.json | jq '.llm_config.prompt_config.sections'

# Create missing section
vim prompts/base/greeting.txt
```

### Issue: Hash Always Different

**Cause:** Whitespace or line ending differences.

**Diagnosis:**
```bash
# Check for whitespace issues
retell diff my-agent --full | cat -A

# Check file line endings
file prompts/base/*.txt
```

**Solution:**
```bash
# Normalize line endings
dos2unix prompts/**/*.txt

# Or configure git
git config core.autocrlf input
```

### Issue: Prompt Diff Shows Same Text

**Symptom:** Hashes differ but visible text looks identical.

**Cause:** Hidden whitespace differences.

**Solution:**
```bash
# Compare with whitespace ignored
retell diff my-agent --full | diff -w local.txt remote.txt

# Normalize prompts
vim prompts/base/greeting.txt
# Remove trailing spaces, extra newlines
```

## Best Practices

### 1. Check Before Every Push

```bash
retell diff my-agent -w staging
retell push my-agent -w staging
```

### 2. Use Prompt Sections Consistently

**Good:**
```json
{
  "llm_config": {
    "prompt_config": {
      "sections": ["base/greeting", "sales/intro"]
    }
  }
}
```

**Avoid:**
Mixing `prompt_config` and `general_prompt`.

### 3. Document Console Changes

```bash
# After pulling console changes
retell diff my-agent --resolve use-remote

# Document in git
git add agents/my-agent/agent.json
git commit -m "Pull Retell Console changes: voice_speed 1.0 → 1.2"
```

### 4. Regular Conflict Audits

```bash
# Weekly: Check all agents
./scripts/check-all-conflicts.sh

# Log results
./scripts/check-all-conflicts.sh > conflicts-$(date +%Y%m%d).log
```

### 5. Staging First, Production Second

```bash
# Always sync staging first
retell diff my-agent -w staging --resolve use-local
retell push my-agent -w staging --force

# Then production
retell diff my-agent -w production
retell push my-agent -w production
```

## Integration with Other Commands

### With `retell status`

```bash
# status shows if config_hash matches
retell status my-agent

# If out of sync, use diff for details
retell diff my-agent
```

### With `retell push`

```bash
# After push, config_hash is updated
retell push my-agent -w staging

# Next diff should show no conflicts
retell diff my-agent -w staging
# ✅ No conflicts detected
```

### With `retell pull` (Future)

When `pull` command is implemented:
```bash
# pull = diff --resolve use-remote + automatic metadata update
retell pull my-agent -w staging
```

## Technical Details

### Hash Calculation

**What Gets Hashed:**
```typescript
const configToHash = {
  agent: {
    agent_name, voice_id, voice_speed, voice_temperature,
    responsiveness, interruption_sensitivity, language,
    enable_backchannel, backchannel_frequency, ambient_sound,
    boosted_keywords, pronunciation_dictionary,
    normalize_for_speech, webhook_url, post_call_analysis_data
  },
  llm: {
    model, temperature, general_prompt, begin_message,
    general_tools, start_speaker, default_dynamic_variables
  }
};

const hash = sha256(canonicalJSON(configToHash));
```

**What's Excluded:**
- `agent_id`, `llm_id` (identifiers, not config)
- `last_modification_timestamp` (metadata)
- `account_id` (metadata)
- Any internal Retell tracking fields

### Canonical JSON

Keys are sorted alphabetically before hashing to ensure consistency:
```typescript
{ "b": 2, "a": 1 } → { "a": 1, "b": 2 } → hash
```

This prevents hash mismatches from key ordering differences.

## See Also

- [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md) - Complete conflict resolution system
- [SPECIFICATION.md](SPECIFICATION.md) - CLI specification
- `retell diff --help` - Built-in help
