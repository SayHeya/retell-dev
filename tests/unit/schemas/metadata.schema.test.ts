/**
 * Tests for metadata schema validation
 */

import { MetadataSchema } from '@schemas/metadata.schema';

describe('MetadataSchema', () => {
  describe('valid metadata', () => {
    it('should validate complete staging metadata', () => {
      const metadata = {
        workspace: 'staging',
        agent_id: 'agent_abc123',
        llm_id: 'llm_xyz789',
        kb_id: 'kb_def456',
        last_sync: '2025-11-14T10:30:00.000Z',
        config_hash: 'sha256:abc123def456',
        retell_version: 5,
      };

      const result = MetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });

    it('should validate production metadata', () => {
      const metadata = {
        workspace: 'production',
        agent_id: 'agent_prod_123',
        llm_id: 'llm_prod_456',
        kb_id: null,
        last_sync: '2025-11-14T10:30:00.000Z',
        config_hash: 'sha256:abc123',
        retell_version: 3,
      };

      const result = MetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });

    it('should validate metadata with all nulls (never synced)', () => {
      const metadata = {
        workspace: 'staging',
        agent_id: null,
        llm_id: null,
        kb_id: null,
        last_sync: null,
        config_hash: null,
        retell_version: null,
      };

      const result = MetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid metadata', () => {
    it('should reject empty workspace string', () => {
      const metadata = {
        workspace: '', // Empty string should be rejected
        agent_id: null,
        llm_id: null,
        kb_id: null,
        last_sync: null,
        config_hash: null,
        retell_version: null,
      };

      const result = MetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });

    it('should accept named production workspace', () => {
      const metadata = {
        workspace: 'prod-us-east', // Named workspace for multi-production mode
        agent_id: 'agent_123',
        llm_id: 'llm_456',
        kb_id: null,
        last_sync: '2025-11-14T10:30:00.000Z',
        config_hash: 'sha256:abc123',
        retell_version: 1,
      };

      const result = MetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const metadata = {
        workspace: 'staging',
        agent_id: 'agent_123',
        // Missing other fields
      };

      const result = MetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const metadata = {
        workspace: 'staging',
        agent_id: null,
        llm_id: null,
        kb_id: null,
        last_sync: null,
        config_hash: null,
        retell_version: null,
        extra_field: 'should not be here',
      };

      const result = MetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });

    it('should reject invalid timestamp format', () => {
      const metadata = {
        workspace: 'staging',
        agent_id: 'agent_123',
        llm_id: null,
        kb_id: null,
        last_sync: 'not-a-timestamp',
        config_hash: null,
        retell_version: null,
      };

      const result = MetadataSchema.safeParse(metadata);
      expect(result.success).toBe(false);
    });
  });
});
