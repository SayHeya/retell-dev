# Workflows Command

## Overview

The `retell workflows` command helps you set up GitHub Actions workflows for GitOps-based agent configuration management. These workflows automate validation, deployment, and drift detection for your Retell AI agents.

## Commands

### `retell workflows init`

Initializes GitHub workflow templates in your project.

```bash
retell workflows init [options]
```

**Options:**
- `--force`, `-f`: Overwrite existing workflow files

**What it does:**
1. Creates `.github/workflows/` directory if it doesn't exist
2. Copies workflow templates to the directory
3. Creates a README with setup instructions

**Example:**
```bash
# Initialize workflows in current directory
retell workflows init

# Force overwrite existing workflows
retell workflows init --force
```

**Output:**
```
📁 Created directory: .github/workflows
✅ Created: .github/workflows/retell-deploy-production.yml
✅ Created: .github/workflows/retell-deploy-staging.yml
✅ Created: .github/workflows/retell-drift-detection.yml
✅ Created: .github/workflows/retell-release.yml
✅ Created: .github/workflows/retell-validate.yml
✅ Created: .github/workflows/RETELL-WORKFLOWS-README.md

✅ Successfully initialized 6 workflow file(s)

📋 Next steps:
1. Review the workflow files in .github/workflows
2. Add the following secrets to your GitHub repository:
   - RETELL_STAGING_API_KEY
   - RETELL_PRODUCTION_API_KEY
3. Commit and push the workflow files
```

### `retell workflows list`

Lists available workflow templates.

```bash
retell workflows list
```

**Example output:**
```
Available workflow templates:
  - retell-validate.yml
  - retell-deploy-staging.yml
  - retell-deploy-production.yml
  - retell-drift-detection.yml
  - retell-release.yml
```

## Workflow Files

### `retell-validate.yml`

**Trigger:** Pull requests to `staging` or `production` branches

**Purpose:** Validates configurations and checks for conflicts before merge

**Features:**
- Detects which agents were changed in the PR
- Validates agent configurations (schema, prompts, variables)
- Checks for conflicts with target workspace
- Posts PR comment with results or conflict details
- Blocks merge if conflicts are detected
- Performs dry-run push

### `retell-deploy-staging.yml`

**Trigger:** Push to `staging` branch

**Purpose:** Deploys changed agents to staging workspace

**Features:**
- Detects which agents changed in the merge
- Deploys only changed agents (not all)
- Updates metadata with GitOps annotations
- Commits metadata updates back to repository
- Supports manual dispatch with options

### `retell-deploy-production.yml`

**Trigger:** Push to `production` branch

**Purpose:** Deploys changed agents to production workspace

**Features:**
- Detects which agents changed in the merge
- Verifies all agents have staging deployments first
- Deploys only changed agents
- Requires "PRODUCTION" confirmation for manual triggers
- Updates metadata with GitOps annotations

### `retell-drift-detection.yml`

**Trigger:** Scheduled (every 6 hours) or manual dispatch

**Purpose:** Detects configuration changes made outside of Git

**Features:**
- Compares Git configurations with Retell API
- Creates/updates GitHub issue when drift is detected
- Provides resolution instructions
- Supports checking staging, production, or both

### `retell-release.yml`

**Trigger:** GitHub release published

**Purpose:** Publishes the CLI package to npm

**Features:**
- Runs tests before publishing
- Builds the package
- Publishes to npm with provenance

## Branch Strategy

The workflows implement a three-branch GitOps strategy:

```
development/*  →  staging branch  →  production branch
    (work)         (testing)           (live)
```

### Workflow

1. **Development**: Create feature branch, edit agent configurations
2. **PR to Staging**:
   - Workflow checks for conflicts with staging workspace
   - If conflicts exist, must resolve before merge
3. **Merge to Staging**:
   - Triggers deployment to staging workspace
   - Only changed agents are deployed
4. **PR to Production**:
   - Workflow checks for conflicts with production workspace
   - If conflicts exist, must resolve before merge
5. **Merge to Production**:
   - Triggers deployment to production workspace
   - Only changed agents are deployed

## Setup Instructions

### 1. Initialize Workflows

```bash
cd your-project
retell workflows init
```

### 2. Create Branches

```bash
# Create and push staging branch
git checkout -b staging
git push -u origin staging

# Create and push production branch
git checkout -b production
git push -u origin production

# Return to main
git checkout main
```

### 3. Add GitHub Secrets

Go to your repository **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|--------|-------------|
| `RETELL_STAGING_API_KEY` | API key for staging workspace |
| `RETELL_PRODUCTION_API_KEY` | API key for production workspace |
| `NPM_TOKEN` | (Optional) For npm publishing |

### 4. Set Up Branch Protection

Go to **Settings → Branches → Branch protection rules**:

**For `staging` branch:**
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass (select `Validate & Check Conflicts`)
- ✅ Require branches to be up to date before merging

**For `production` branch:**
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass
- ✅ Require branches to be up to date before merging
- ✅ Require approvals (recommend 2+)

### 5. Create GitHub Environments (Optional)

Go to **Settings → Environments**:

**`staging` environment:**
- No required reviewers
- No wait timer

**`production` environment:**
- Required reviewers: team leads
- Wait timer: 5 minutes (optional)

### 6. Commit and Push Workflows

```bash
git add .github/workflows
git commit -m "feat: add GitOps workflows for Retell agent management"
git push
```

## Usage Examples

### Deploy a New Agent

```bash
# Create feature branch
git checkout -b feature/add-sales-agent

# Create agent configuration
mkdir -p agents/sales-agent
cat > agents/sales-agent/agent.json << 'EOF'
{
  "agent_name": "Sales Agent",
  "voice_id": "11labs-Adrian",
  "language": "en-US",
  "llm_config": {
    "model": "gpt-4o-mini",
    "general_prompt": "You are a helpful sales assistant."
  }
}
EOF

# Commit and push
git add agents/sales-agent
git commit -m "feat: add sales agent"
git push -u origin feature/add-sales-agent

# Create PR to staging branch on GitHub
# After review and merge, agent deploys to staging
```

### Update an Existing Agent

```bash
# Create feature branch
git checkout -b feature/update-voice-speed

# Edit agent configuration
vim agents/customer-service/agent.json

# Commit and push
git add agents/customer-service
git commit -m "feat: increase voice speed to 1.2"
git push -u origin feature/update-voice-speed

# Create PR to staging
```

### Promote to Production

```bash
# After testing in staging, create PR from staging to production
# On GitHub: staging → production

# After merge, changed agents deploy to production
```

### Handle Conflicts

If the PR check finds conflicts (someone edited via Retell Console):

```bash
# Option 1: Keep your changes
retell diff agents/my-agent -w staging --resolve use-local
git push

# Option 2: Accept remote changes
retell diff agents/my-agent -w staging --resolve use-remote
git add agents/my-agent
git commit -m "Pull remote changes from staging"
git push
```

### Manual Deployment

```bash
# Trigger via GitHub Actions UI
# Go to Actions → Deploy to Staging → Run workflow
# Options:
#   - agent: specific agent name (optional)
#   - deploy_all: true to deploy all agents
```

## Customization

### Change Drift Detection Schedule

Edit `.github/workflows/retell-drift-detection.yml`:

```yaml
on:
  schedule:
    - cron: '0 */12 * * *'  # Every 12 hours instead of 6
```

### Add Slack Notifications

Add to any workflow's failure step:

```yaml
- name: Notify Slack
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"Deployment failed! Check GitHub Actions."}' \
      ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Deploy Specific Agents Only

Modify the deploy step to filter:

```yaml
- name: Deploy specific agents
  run: |
    for agent in customer-service sales-agent; do
      retell push "agents/$agent" -w staging --yes
    done
```

### Skip CI for Documentation Changes

Add path filters:

```yaml
on:
  push:
    branches: [staging]
    paths:
      - 'agents/**'
      - 'prompts/**'
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

## Troubleshooting

### Workflow Not Triggering

1. Check branch names match exactly (`staging`, `production`)
2. Verify file paths are correct (`agents/**`, `prompts/**`)
3. Ensure secrets are set in repository settings

### Permission Denied Errors

1. Verify API keys are valid and not expired
2. Check secrets are named correctly
3. Ensure environment protection rules allow the actor

### Conflicts Always Detected

1. Make sure metadata files are committed after each push
2. Check for whitespace/line ending differences
3. Verify nobody is editing agents via Retell Console

### Metadata Commit Fails

1. Check workflow has write permissions to repository
2. Verify branch protection allows bot commits
3. Add `github-actions[bot]` to allowed actors in branch rules

## Related Documentation

- [GITOPS_METHODOLOGY.md](GITOPS_METHODOLOGY.md) - GitOps approach and principles
- [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md) - Handling drift and conflicts
- [SPECIFICATION.md](SPECIFICATION.md) - CLI command reference
- [DIFF_COMMAND.md](DIFF_COMMAND.md) - Diff command details
