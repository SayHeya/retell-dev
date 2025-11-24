/**
 * Zod schema for metadata files (staging.json, production.json)
 */

import { z } from 'zod';

/**
 * Schema for metadata files
 * These files track the sync state between local config and Retell workspaces
 */
export const MetadataSchema = z
  .object({
    workspace: z.enum(['staging', 'production']),
    agent_id: z.string().nullable(),
    llm_id: z.string().nullable(),
    kb_id: z.string().nullable(),
    last_sync: z.string().datetime().nullable(),
    config_hash: z.string().nullable(),
    retell_version: z.number().int().nonnegative().nullable(),
    // GitOps tracking fields (optional)
    source_commit: z.string().optional(),
    source_branch: z.string().optional(),
    deployed_by: z.string().optional(),
    workflow_run_id: z.string().optional(),
    deployed_at: z.string().optional(),
  })
  .strict();

/**
 * Infer TypeScript type from schema
 */
export type MetadataSchemaType = z.infer<typeof MetadataSchema>;
