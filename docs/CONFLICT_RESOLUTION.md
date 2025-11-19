# Conflict Resolution System

## Overview

The Retell CLI includes a comprehensive conflict detection and resolution system that detects when local agent configurations diverge from what's deployed on Retell's servers. This is essential for teams where agents might be modified through the Retell Console or by other developers.

## How It Works

### The Config Hash System

**Stored Hash (`config_hash` in staging.json/production.json):**
- Hash of the **complete configuration we sent to Retell** during last push
- Includes the **final constructed prompt** (not the prompt_config sections)
- Stored after successful push operation

**Remote Hash:**
- Hash of the **current configuration on Retell's servers**
- Calculated from Agent config + LLM config fetched from Retell API
- Includes the prompt string as stored on Retell

**Comparison Logic:**
```
IF stored_hash == remote_hash
  → No conflicts (in sync)
ELSE
  → Conflicts detected, perform detailed comparison
```

### Prompt Section System

**Our Side (agent.json):**
```json
{
  "llm_config": {
    "prompt_config": {
      "sections": ["base/greeting", "customer-service/intro"],
      "variables": { "company_name": "Acme Corp" }
    }
  }
}
```

**Build Process:**
1. Load `prompts/base/greeting.txt`
2. Load `prompts/customer-service/intro.txt`
3. Concatenate with `\n\n`
4. Substitute static variables
5. Result: Final prompt string

**Retell's Side:**
- Stores only the **final prompt string**
- No knowledge of prompt sections or construction process

**Conflict Detection:**
1. Build prompt from local sections → Hash it
2. Fetch prompt from Retell → Hash it
3. Compare hashes
4. If different → Show text diff

## Commands

### `retell diff` - Detect Conflicts

Check for conflicts between local and remote configurations.

**Basic Usage:**
```bash
retell diff <agent-name>
```

**Options:**
```bash
retell diff my-agent
retell diff my-agent -w production
retell diff my-agent --full           # Show full prompts
retell diff my-agent --resolve use-local
```

**Output:**
```
Checking for conflicts: 'my-agent' in staging...

Loading local configuration...
Fetching staging configuration from Retell...
Analyzing differences...

⚠️  Conflicts Detected

Local Config Hash:  sha256:abc123...
Remote Config Hash: sha256:def456...
Stored Hash:        sha256:xyz789...

Field Conflicts:

  agent.voice_speed:
    Local:  1.2
    Remote: 1.0

  llm.temperature:
    Local:  0.7
    Remote: 0.9

Prompt Conflict:

  Local Hash:  sha256:111...
  Remote Hash: sha256:222...

  Local Prompt (preview):
    You are a helpful customer service agent for Acme Corp.
    You should be professional and courteous...
    (Showing first 500 characters. Use --full to see complete prompts)

  Remote Prompt (preview):
    You are a customer service agent.
    Be helpful and friendly...
    (Showing first 500 characters. Use --full to see complete prompts)

📝 Resolution Options:

  1. Use local changes (force push):
     retell diff my-agent -w staging --resolve use-local
     retell push my-agent -w staging --force

  2. Use remote changes (pull):
     retell diff my-agent -w staging --resolve use-remote
     # Review agent.json, then push to sync

  3. Manually resolve:
     # Edit agent.json to resolve conflicts
     retell push my-agent -w staging
```

### Resolution Strategies

#### 1. Use Local (Force Push)

**When to use:**
- You made intentional local changes
- You want to overwrite what's on Retell
- You're sure local is correct

**Command:**
```bash
retell diff my-agent --resolve use-local
retell push my-agent --force
```

**What happens:**
- Local config unchanged
- Next push with `--force` overwrites remote
- `config_hash` updated after push

#### 2. Use Remote (Pull)

**When to use:**
- Someone updated via Retell Console
- You want to adopt remote changes
- Remote is the source of truth

**Command:**
```bash
retell diff my-agent --resolve use-remote
```

**What happens:**
- Updates local `agent.json` with remote values
- Preserves `prompt_config` structure (doesn't convert to `general_prompt`)
- Shows message to review and push

**Important:** For prompts, if you use `prompt_config` locally:
- The remote prompt is **not** broken down into sections
- Your `prompt_config.sections` array is preserved
- But the prompt might be out of sync
- You'll need to manually update prompt sections to match

#### 3. Manual Resolution

**When to use:**
- Conflicts in multiple fields
- Need to cherry-pick changes
- Complex prompt edits

**Process:**
1. Run `retell diff my-agent --full` to see all diffs
2. Manually edit `agent.json` with desired values
3. For prompts: Update prompt section files in `prompts/`
4. Run `retell push my-agent`

## Conflict Scenarios

### Scenario 1: Voice Settings Changed in Console

**What happened:**
Someone changed voice_speed from 1.0 to 1.2 in Retell Console.

**Detection:**
```bash
retell diff my-agent
```

**Output:**
```
Field Conflicts:

  agent.voice_speed:
    Local:  1.0
    Remote: 1.2
```

**Resolution:**
```bash
# Option A: Keep remote change
retell diff my-agent --resolve use-remote
# Now agent.json has voice_speed: 1.2

# Option B: Revert to local
retell push my-agent --force
```

### Scenario 2: Prompt Edited in Console

**What happened:**
Someone edited the prompt directly in Retell Console.

**Local:**
```
prompt_config:
  sections: ["base/greeting", "support/intro"]
```

Built prompt: "Hello! Welcome to Acme Corp support..."

**Remote:**
"Hi there! This is Acme customer service..."

**Detection:**
```bash
retell diff my-agent --full
```

**Output:**
```
Prompt Conflict:

Detailed Prompt Diff:

  LOCAL                                  | REMOTE
  ----------------------------------------|----------------------------------------
> Hello! Welcome to Acme Corp support... | Hi there! This is Acme customer ser...
> We're here to help with any issues...  | How can I help you today?...
  ...                                     | ...
```

**Resolution Options:**

**A. Use Remote (Copy to Local):**
```bash
# Pull remote prompt
retell diff my-agent --resolve use-remote

# Now agent.json has:
# "general_prompt": "Hi there! This is Acme customer service..."
# (prompt_config is removed in favor of general_prompt)
```

**B. Use Local (Overwrite Remote):**
```bash
# Keep prompt sections
retell push my-agent --force
# Remote now has the built prompt from sections
```

**C. Manual (Update Sections):**
```bash
# Edit prompt section files to match desired prompt
vim prompts/base/greeting.txt
vim prompts/support/intro.txt

# Push updated sections
retell push my-agent
```

### Scenario 3: Multiple Field Changes

**What happened:**
Multiple fields changed: voice_speed, temperature, and prompt.

**Detection:**
```bash
retell diff my-agent
```

**Shows:**
- 2 field conflicts
- 1 prompt conflict

**Resolution:**
```bash
# Review all changes
retell diff my-agent --full > conflicts.txt

# Edit agent.json manually
vim agents/my-agent/agent.json

# Cherry-pick desired changes
# - voice_speed: use remote (1.2)
# - temperature: use local (0.7)
# - prompt: update sections to match remote intent

# Push resolved config
retell push my-agent
```

### Scenario 4: No Conflicts (In Sync)

**Detection:**
```bash
retell diff my-agent
```

**Output:**
```
✅ No conflicts detected.
Configuration is in sync with Retell

Last synced: 2025-11-19T15:30:00Z
```

## Integration with Other Commands

### `retell status` - Quick Conflict Check

```bash
retell status my-agent
```

Shows if config_hash matches, indicating potential conflicts.

### `retell push` - Updates config_hash

After successful push:
1. Builds prompt from sections
2. Sends complete config to Retell
3. Calculates hash of what was sent
4. Stores hash in staging.json/production.json

### `retell pull` - Fetch Remote Config

**Not yet implemented**, but would:
1. Fetch from Retell
2. Update local agent.json
3. Update metadata

## Best Practices

### 1. Check for Conflicts Before Pushing

```bash
# Always check first
retell diff my-agent -w staging

# If conflicts, resolve
retell diff my-agent -w staging --resolve use-local

# Then push
retell push my-agent -w staging --force
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
Switching between `prompt_config` and `general_prompt`.

### 3. Document Console Changes

If you must edit in Retell Console:
```bash
# After console edit, pull changes
retell diff my-agent --resolve use-remote

# Document what changed
git add agents/my-agent/agent.json
git commit -m "Pull prompt changes from Retell Console: improved greeting"
```

### 4. Regular Conflict Checks

```bash
# Check all agents for conflicts
for agent in agents/*/; do
  echo "Checking $(basename $agent)..."
  retell diff $(basename $agent) -w staging
done
```

### 5. Staging First, Then Production

```bash
# Check staging
retell diff my-agent -w staging

# Resolve conflicts
retell push my-agent -w staging --force

# Then check production
retell diff my-agent -w production

# Release to production
retell push my-agent -w production
```

## Technical Details

### Hash Calculation

**Local Config Hash:**
```typescript
// Build prompt from sections
const prompt = await PromptBuilder.build(promptsDir, prompt_config);

// Simulate what we'd send to Retell
const retellConfig = {
  agent: { voice_id, voice_speed, ... },
  llm: { model, temperature, general_prompt: prompt, ... }
};

// Hash it
const hash = calculateRetellConfigHash(retellConfig);
```

**Remote Config Hash:**
```typescript
// Fetch from Retell
const agent = await retell.agent.get(agent_id);
const llm = await retell.llm.get(llm_id);

// Hash what Retell has
const hash = calculateRetellConfigHash(agent, llm);
```

**Comparison:**
```typescript
if (stored_hash === remote_hash) {
  // In sync
} else {
  // Conflicts - do field-by-field comparison
}
```

### Prompt Hash Calculation

**Separate from config hash**, used for prompt-specific diffs:

```typescript
// Local
const localPrompt = await PromptBuilder.build(...);
const localHash = calculatePromptHash(localPrompt);

// Remote
const remotePrompt = llm.general_prompt;
const remoteHash = calculatePromptHash(remotePrompt);

if (localHash !== remoteHash) {
  // Show prompt diff
  showPromptDiff(localPrompt, remotePrompt);
}
```

### Fields Compared

**Agent Fields:**
- agent_name
- voice_id, voice_speed, voice_temperature
- responsiveness, interruption_sensitivity
- language
- enable_backchannel, backchannel_frequency
- ambient_sound
- boosted_keywords
- pronunciation_dictionary
- normalize_for_speech
- webhook_url
- post_call_analysis_data

**LLM Fields:**
- model
- temperature
- begin_message
- general_tools
- general_prompt (handled separately)

**Excluded (Metadata):**
- agent_id, llm_id
- last_modification_timestamp
- account_id
- creation timestamps

## Troubleshooting

### "Agent not found in workspace"

```bash
retell diff my-agent
# Error: Agent not found in staging. Run 'retell push' first.
```

**Solution:**
```bash
retell push my-agent -w staging
```

### "Failed to build prompt"

```bash
retell diff my-agent
# Error: Prompt section not found: base/greeting at prompts/base/greeting.txt
```

**Solution:**
Check that all prompt sections exist:
```bash
ls prompts/base/greeting.txt
```

### Hash Always Different

If hash is always different despite no changes:
- Check for whitespace differences in prompts
- Ensure consistent line endings (LF vs CRLF)
- Verify prompt sections haven't changed

### Prompt Diff Shows Same Text

Hashes differ but text looks the same:
- Likely whitespace/line ending differences
- Use `diff -w` to ignore whitespace
- Normalize prompts before comparing

## See Also

- [SPECIFICATION.md](SPECIFICATION.md) - CLI specification
- [AGENT_DELETE_COMMAND.md](AGENT_DELETE_COMMAND.md) - Agent deletion
- `retell diff --help` - Built-in help
