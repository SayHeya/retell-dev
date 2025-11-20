# GitOps for SaaS Configuration Management

## Overview

This document describes the GitOps methodology implemented by the Retell CLI for version-controlling agent configurations. This approach enables teams to manage configurations for platforms that don't offer native version control, using Git as the single source of truth with automated CI/CD pipelines for deployment.

## What is GitOps?

GitOps is an operational framework that applies DevOps best practices—version control, collaboration, compliance, and CI/CD—to infrastructure and configuration automation.

### Core Principles

1. **Version Control as Source of Truth**: Git repositories serve as the authoritative source for all configurations
2. **Declarative Configuration**: Define desired state, not imperative steps
3. **Automated Reconciliation**: CI/CD pipelines automatically implement changes when code merges
4. **Pull/Merge Requests**: Formal change mechanisms enabling collaboration and audit trails

## The Problem We Solve

Many SaaS platforms store configurations but don't offer:
- Version history
- Change tracking
- Rollback capabilities
- Environment promotion (staging → production)
- Collaboration workflows (PR reviews)

This includes platforms like:
- **Retell AI** - Voice agent configurations
- **Firebase** - Remote Config, Firestore rules
- **Auth0** - Tenant configurations
- **Twilio** - Flow definitions
- **Stripe** - Products, prices, webhooks

## Our Implementation: Push-Based GitOps

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Local     │     │   GitHub    │     │  Retell AI  │
│  Git Repo   │────▶│  Actions    │────▶│    API      │
│             │     │  (CI/CD)    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │                    │
   agent.json         Validates &           Workspaces
   (source of         Deploys              (staging/prod)
    truth)
```

### Push-Based vs Pull-Based

**Our approach (Push-Based):**
```
Git commit → CI/CD pipeline → Push to Retell API
```

**Full GitOps (Pull-Based):**
```
Git commit → Operator polls Git → Reconciles with target system
```

We use push-based because:
- Retell AI doesn't support installing an operator/agent
- Working with third-party APIs, not self-managed infrastructure
- Simpler to implement, debug, and understand
- Sufficient for configuration management use cases

## Three-Tier Sync Model

### Environments

```
Local Files  →  Staging Workspace  →  Production Workspace
   (Git)           (Testing)            (Live)
```

### Branch Strategy

```
development/*  →  staging branch  →  production branch
    (work)         (testing)           (live)
```

### Workflow

1. **Development**: Create feature branch, edit `agent.json` files
2. **PR to Staging**: Create PR to `staging` branch
   - Workflow checks for conflicts with staging workspace
   - If conflicts exist, must resolve before merge
3. **Merge to Staging**: Triggers deployment to staging workspace
   - Only changed agents are deployed
4. **PR to Production**: Create PR from `staging` to `production` branch
   - Workflow checks for conflicts with production workspace
   - If conflicts exist, must resolve before merge
5. **Merge to Production**: Triggers deployment to production workspace
   - Only changed agents are deployed

### Sync State Tracking

Each agent maintains metadata files that track:

```json
// staging.json
{
  "workspace": "staging",
  "agent_id": "agent_staging_abc123",
  "llm_id": "llm_staging_xyz789",
  "config_hash": "sha256:a1b2c3d4...",
  "last_sync": "2025-11-20T10:30:00Z",
  "source_commit": "abc123def",
  "source_branch": "main",
  "deployed_by": "github-actions"
}
```

### Hash-Based Drift Detection

```
IF stored_hash == remote_hash
  → In sync (no drift)
ELSE
  → Drift detected (manual changes via console)
  → Trigger conflict resolution
```

## GitHub Workflow Integration

### Workflow Strategy

The CLI exports workflow templates that implement the branch strategy:

| Workflow | Trigger | Action |
|----------|---------|--------|
| `retell-validate.yml` | PR to staging/production | Check conflicts with target workspace, validate configs |
| `retell-deploy-staging.yml` | Push to staging branch | Deploy changed agents to staging workspace |
| `retell-deploy-production.yml` | Push to production branch | Deploy changed agents to production workspace |
| `retell-drift-detection.yml` | Scheduled (6h) | Check for console modifications |

### Key Features

1. **Conflict Detection on PR**: Before merging, the workflow checks if anyone modified the agents via the Retell Console. If conflicts exist, the PR is blocked until resolved.

2. **Changed-Only Deployment**: Only agents that were modified in the merge are deployed, not all agents.

3. **PR Comments**: The workflow posts comments on PRs showing:
   - Which agents will be deployed
   - Any conflicts that need resolution
   - Resolution instructions

4. **GitOps Annotations**: Each deployment records commit, branch, actor, and timestamp in metadata.

## Proposed Enhancements

### 1. Pre-Merge Validation

Validate configurations before they can be merged:

- Schema validation for all `agent.json` files
- Prompt section existence checks
- Variable definition validation
- Dry-run push to catch API errors early

### 2. Automated Drift Detection

Scheduled workflow to detect if someone modified agents via Retell Console:

- Run every 6 hours (configurable)
- Compare local config hash with remote
- Alert team via Slack/email/GitHub issue
- Optionally auto-create PR to reconcile

### 3. Source Tracking (GitOps Annotations)

Record deployment provenance in metadata:

```json
{
  "source_commit": "abc123def456",
  "source_branch": "main",
  "deployed_by": "github-actions",
  "deployed_at": "2025-11-20T10:00:00Z",
  "workflow_run_id": "12345678"
}
```

Benefits:
- Know exactly which commit is deployed
- Track who/what triggered deployment
- Enable precise rollbacks

### 4. Rollback Capability

Quick recovery from bad deployments:

```bash
retell rollback my-agent --to-commit abc123 --workspace staging
```

Process:
1. Checkout `agent.json` at specified commit
2. Push to target workspace
3. Update metadata with rollback info

### 5. Multi-Agent Operations

Bulk operations for efficiency:

```bash
retell push --all --workspace staging
retell status --all --json
retell validate --all
```

## CLI-Exported Workflows

The CLI will export ready-to-use GitHub workflow templates:

```bash
retell workflows init
```

This creates `.github/workflows/` with:
- `retell-validate.yml`
- `retell-deploy-staging.yml`
- `retell-deploy-production.yml`
- `retell-drift-detection.yml`

Users can customize these for their specific needs.

## Security Considerations

### Secrets Management

| Secret | Storage | Git Status |
|--------|---------|------------|
| API Keys | GitHub Secrets | Never committed |
| `workspaces.json` | Generated in CI | `.gitignore` |
| `.env` | Local only | `.gitignore` |
| Metadata files | Repository | Committed (no secrets) |

### CI/CD Secret Setup

Required GitHub repository secrets:
- `RETELL_STAGING_API_KEY`
- `RETELL_PRODUCTION_API_KEY`

### Access Control

- Use GitHub branch protection rules
- Require PR reviews for main branch
- Restrict who can create releases (production deploys)

## Best Practices

### 1. Never Edit in Console

Once using GitOps, treat Git as the only way to make changes:

```bash
# Good
vim agents/my-agent/agent.json
git commit -m "Update voice speed"
git push

# Bad
# Editing in Retell Console
```

If you must use the console (emergencies), immediately pull changes:

```bash
retell diff my-agent --resolve use-remote
git add agents/my-agent/
git commit -m "Pull emergency console changes"
```

### 2. Use Feature Branches

```bash
git checkout -b feature/update-greeting
vim agents/my-agent/agent.json
git commit -m "Update greeting prompt"
git push -u origin feature/update-greeting
# Create PR, get review, merge
```

### 3. Test in Staging First

Never push directly to production:

```bash
# Push to staging
retell push my-agent -w staging

# Test thoroughly

# Then release to production
retell release my-agent
```

### 4. Atomic Commits

One logical change per commit:

```bash
# Good
git commit -m "Update customer-service agent voice speed to 1.2"

# Bad
git commit -m "Various agent updates"
```

### 5. Meaningful Commit Messages

Follow conventional commits:

```
feat: add order lookup tool to customer-service agent
fix: correct pronunciation dictionary for API terms
chore: update voice speed for all agents
```

## Universal Application

This methodology works for any platform lacking native version control:

### Implementation Pattern

1. **Define local file format**: JSON/YAML configuration schema
2. **Build transform layer**: Convert to platform's API format
3. **Track sync state**: Hash-based change detection
4. **Implement push/pull**: Bidirectional sync with conflict detection
5. **Wrap in CI/CD**: GitHub Actions for automation

### Example: Firebase Remote Config

```
firebase-config/
├── config.json              # Source of truth
├── staging.meta.json        # Staging project metadata
├── production.meta.json     # Production project metadata
└── .github/workflows/
    ├── validate.yml
    ├── deploy-staging.yml
    └── deploy-production.yml
```

### Example: Auth0 Tenant Config

```
auth0-config/
├── tenant.json              # Tenant settings
├── rules/                   # Auth rules
├── connections/             # Identity providers
├── staging.meta.json
├── production.meta.json
└── .github/workflows/
```

## Comparison with Other Tools

### Terraform

- **Terraform**: Infrastructure provisioning (VMs, networks, databases)
- **This approach**: SaaS configuration management

Terraform could potentially manage some SaaS configs via providers, but:
- Not all platforms have Terraform providers
- Overkill for pure configuration management
- State management complexity

### Pulumi

Similar to Terraform, better for teams preferring TypeScript/Python over HCL.

### Platform-Specific CLIs

Many platforms offer CLIs (Firebase CLI, Auth0 Deploy CLI), but they often lack:
- Hash-based drift detection
- Multi-environment promotion
- Conflict resolution
- Integrated GitHub workflow templates

## Future Considerations

### Operator Pattern (Advanced)

For teams wanting full GitOps with reconciliation:

1. Deploy a reconciliation service
2. Service polls Git repository
3. Compares with Retell API state
4. Auto-reconciles drift

This adds complexity but provides:
- Automatic drift correction
- Continuous reconciliation
- Self-healing configurations

### Multi-Tenant Support

For agencies managing multiple clients:

```
clients/
├── client-a/
│   ├── agents/
│   └── workspaces.json
├── client-b/
│   ├── agents/
│   └── workspaces.json
```

### Configuration Inheritance

Share settings across agents:

```json
// base-config.json
{
  "voice_id": "11labs-Adrian",
  "language": "en-US"
}

// agent.json
{
  "extends": "../base-config.json",
  "agent_name": "Customer Service"
}
```

## Conclusion

This GitOps approach provides enterprise-grade version control and deployment automation for Retell AI agent configurations. The methodology is:

- **Proven**: Based on established GitOps principles
- **Practical**: Push-based for simplicity with third-party APIs
- **Portable**: Applicable to any SaaS platform lacking version control
- **Extensible**: Room for advanced features like drift reconciliation

By treating Git as the source of truth and automating deployments via CI/CD, teams gain the same rigor for configuration management that they expect for application code.

## See Also

- [SPECIFICATION.md](SPECIFICATION.md) - CLI command reference
- [CONFLICT_RESOLUTION.md](CONFLICT_RESOLUTION.md) - Handling drift and conflicts
- [TECHNICAL_SPECIFICATION.md](TECHNICAL_SPECIFICATION.md) - Implementation details
