# GitHub Workflow Templates

These workflow templates implement GitOps for Retell AI agent configuration management. They are exported to your project using the `retell workflows init` command.

## Included Workflows

### 1. `retell-validate.yml`

**Trigger:** Pull requests to `staging` or `production` branches

**Purpose:** Validates configs and checks for conflicts with target workspace

**What it does:**
- Detects which agents were changed in the PR
- Validates agent configurations (schema, prompts, variables)
- Checks for conflicts with target workspace (staging or production)
- Posts PR comment with results or conflict details
- Blocks merge if conflicts detected
- Performs dry-run push

### 2. `retell-deploy-staging.yml`

**Trigger:** Push to `staging` branch (or manual dispatch)

**Purpose:** Deploys changed agents to staging workspace

**What it does:**
- Detects which agents changed in the merge
- Deploys only changed agents to staging
- Updates metadata with GitOps annotations (commit, branch, actor)
- Commits metadata updates back to repository
- Generates deployment summary

### 3. `retell-deploy-production.yml`

**Trigger:** Push to `production` branch (or manual with confirmation)

**Purpose:** Deploys changed agents to production workspace

**What it does:**
- Detects which agents changed in the merge
- Verifies all agents have staging deployments first
- Requires "PRODUCTION" confirmation for manual triggers
- Deploys only changed agents to production
- Updates metadata with GitOps annotations
- Generates deployment summary

### 4. `retell-drift-detection.yml`

**Trigger:** Scheduled (every 6 hours) or manual dispatch

**Purpose:** Detects configuration changes made outside of Git

**What it does:**
- Compares Git configurations with Retell API
- Creates/updates GitHub issue when drift is detected
- Provides resolution instructions
- Supports checking staging, production, or both

## Required Secrets

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret | Description |
|--------|-------------|
| `RETELL_STAGING_API_KEY` | API key for staging workspace |
| `RETELL_PRODUCTION_API_KEY` | API key for production workspace |
| `SLACK_WEBHOOK_URL` | (Optional) Slack webhook for notifications |

## Required Environments

For additional protection, create GitHub environments:

### `staging`
- No required reviewers
- Used by: `retell-deploy-staging.yml`

### `production`
- Required reviewers: team leads
- Used by: `retell-deploy-production.yml`

To create environments: Settings → Environments → New environment

## Usage

### Installation

```bash
# Export workflows to your project
retell workflows init

# This creates:
# .github/workflows/retell-validate.yml
# .github/workflows/retell-deploy-staging.yml
# .github/workflows/retell-deploy-production.yml
# .github/workflows/retell-drift-detection.yml
```

### Customization

After export, you can customize the workflows:

#### Change Branch Names

```yaml
# In retell-deploy-staging.yml
on:
  push:
    branches: [develop]  # Change from main to develop
```

#### Add Notifications

```yaml
# In any workflow
- name: Notify Slack
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"Deployment failed!"}' \
      ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### Change Drift Detection Schedule

```yaml
# In retell-drift-detection.yml
on:
  schedule:
    - cron: '0 */12 * * *'  # Every 12 hours instead of 6
```

#### Deploy Specific Agents Only

```yaml
# Modify the deploy step to filter agents
- name: Deploy specific agents
  run: |
    for agent in customer-service sales-agent; do
      retell push "agents/$agent" -w staging --yes
    done
```

## Workflow Sequence

```
                  Development Branch
                         │
                         ▼
┌─────────────────────────────────────┐
│   PR to staging branch              │
│   → retell-validate.yml             │
│   → Checks conflicts with staging   │
│   → Blocks if conflicts found       │
└─────────────────┬───────────────────┘
                  │ PR Merged
                  ▼
┌─────────────────────────────────────┐
│   Push to staging branch            │
│   → retell-deploy-staging.yml       │
│   → Deploys changed agents only     │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│   PR to production branch           │
│   → retell-validate.yml             │
│   → Checks conflicts with production│
│   → Blocks if conflicts found       │
└─────────────────┬───────────────────┘
                  │ PR Merged
                  ▼
┌─────────────────────────────────────┐
│   Push to production branch         │
│   → retell-deploy-production.yml    │
│   → Deploys changed agents only     │
└─────────────────────────────────────┘

        ┌─────────────────────┐
        │ Every 6 hours       │
        │ → drift-detection   │
        │ → Checks for drift  │
        └─────────────────────┘
```

## Best Practices

### 1. Protect Your Staging and Production Branches

```
Repository Settings → Branches → Branch protection rules

For both 'staging' and 'production':
- Require pull request reviews
- Require status checks (retell-validate)
- Require branches to be up to date
- Do not allow bypassing the above settings
```

### 2. Use Environment Protection

For production deployments, require approvals:

```
Repository Settings → Environments → production

- Required reviewers: [team-leads]
- Wait timer: 5 minutes (optional)
```

### 3. Monitor Drift Detection

- Review drift detection issues promptly
- Establish team policy: Git is source of truth
- Document emergency console changes immediately

### 4. Tag Releases Meaningfully

```bash
# Use semantic versioning
git tag v1.2.0
git push origin v1.2.0

# Or descriptive names
git tag 2025-01-release
git push origin 2025-01-release
```

## Troubleshooting

### Workflow Not Triggering

1. Check file paths match your structure
2. Verify branch names are correct
3. Ensure secrets are set in repository settings

### Permission Denied

1. Check API keys are valid
2. Verify secrets are named correctly
3. Check environment protection rules

### Drift Always Detected

1. Ensure metadata files are committed after push
2. Check for whitespace/formatting differences
3. Verify nobody is editing via console

### Metadata Commit Fails

1. Check workflow has write permissions
2. Verify branch protection allows bot commits
3. Add bot to allowed actors in branch rules

## Related Documentation

- [GITOPS_METHODOLOGY.md](../../docs/GITOPS_METHODOLOGY.md) - GitOps approach explanation
- [CONFLICT_RESOLUTION.md](../../docs/CONFLICT_RESOLUTION.md) - Handling drift and conflicts
- [SPECIFICATION.md](../../docs/SPECIFICATION.md) - CLI command reference
