import { describe, expect, it } from '@jest/globals';
import { HashCalculator } from '@core/hash-calculator';
import type { AgentConfig } from '../../../src/types/agent.types';
import type { Hash } from '../../../src/types/common.types';

describe('HashCalculator', () => {
  describe('calculateAgentHash', () => {
    it('should calculate SHA-256 hash from agent config', () => {
      const config: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are a helpful assistant.',
        },
      };

      const result = HashCalculator.calculateAgentHash(config);

      expect(result.success).toBe(true);
      expect((result as { success: true; value: Hash }).value).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should produce same hash for identical configs', () => {
      const config1: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are a helpful assistant.',
        },
      };

      const config2: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are a helpful assistant.',
        },
      };

      const hash1 = HashCalculator.calculateAgentHash(config1);
      const hash2 = HashCalculator.calculateAgentHash(config2);

      expect(hash1.success).toBe(true);
      expect(hash2.success).toBe(true);
      expect((hash1 as { success: true; value: Hash }).value).toBe(
        (hash2 as { success: true; value: Hash }).value
      );
    });

    it('should produce different hash for different configs', () => {
      const config1: AgentConfig = {
        agent_name: 'Test Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are a helpful assistant.',
        },
      };

      const config2: AgentConfig = {
        agent_name: 'Different Agent',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'You are a helpful assistant.',
        },
      };

      const hash1 = HashCalculator.calculateAgentHash(config1);
      const hash2 = HashCalculator.calculateAgentHash(config2);

      expect(hash1.success).toBe(true);
      expect(hash2.success).toBe(true);
      expect((hash1 as { success: true; value: Hash }).value).not.toBe(
        (hash2 as { success: true; value: Hash }).value
      );
    });

    it('should handle complex agent config with all fields', () => {
      const config: AgentConfig = {
        agent_name: 'Customer Service Agent',
        voice_id: '11labs-Kate',
        voice_speed: 1.1,
        voice_temperature: 0.9,
        language: 'en-US',
        enable_backchannel: true,
        webhook_url: 'https://api.example.com/webhook',
        llm_config: {
          model: 'gpt-4o-mini',
          temperature: 0.8,
          prompt_config: {
            sections: ['base/greeting', 'customer-service/order-lookup'],
            variables: {
              company_name: 'Acme Corp',
              user_id: 'OVERRIDE',
            },
            dynamic_variables: {
              customer_name: {
                type: 'string',
                description: 'Customer name',
              },
            },
          },
          begin_message: 'Hello!',
          tools: [],
        },
      };

      const result = HashCalculator.calculateAgentHash(config);

      expect(result.success).toBe(true);
      expect((result as { success: true; value: Hash }).value).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should be sensitive to field order (canonical JSON)', () => {
      // This test verifies that we normalize the JSON before hashing
      const config1: AgentConfig = {
        agent_name: 'Test',
        voice_id: '11labs-Adrian',
        language: 'en-US',
        llm_config: {
          model: 'gpt-4o-mini',
          general_prompt: 'Hello',
        },
      };

      const config2: AgentConfig = {
        language: 'en-US',
        agent_name: 'Test',
        llm_config: {
          general_prompt: 'Hello',
          model: 'gpt-4o-mini',
        },
        voice_id: '11labs-Adrian',
      };

      const hash1 = HashCalculator.calculateAgentHash(config1);
      const hash2 = HashCalculator.calculateAgentHash(config2);

      expect(hash1.success).toBe(true);
      expect(hash2.success).toBe(true);
      // Should be same because we canonicalize before hashing
      expect((hash1 as { success: true; value: Hash }).value).toBe(
        (hash2 as { success: true; value: Hash }).value
      );
    });
  });

  describe('compareHashes', () => {
    it('should return true for matching hashes', () => {
      const hash1 = 'sha256:abc123' as Hash;
      const hash2 = 'sha256:abc123' as Hash;

      const result = HashCalculator.compareHashes(hash1, hash2);

      expect(result).toBe(true);
    });

    it('should return false for different hashes', () => {
      const hash1 = 'sha256:abc123' as Hash;
      const hash2 = 'sha256:def456' as Hash;

      const result = HashCalculator.compareHashes(hash1, hash2);

      expect(result).toBe(false);
    });

    it('should handle null hashes', () => {
      const hash1 = 'sha256:abc123' as Hash;
      const hash2 = null;

      const result1 = HashCalculator.compareHashes(hash1, hash2);
      const result2 = HashCalculator.compareHashes(hash2, hash1);
      const result3 = HashCalculator.compareHashes(null, null);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(true);
    });
  });

  describe('calculateFileHash', () => {
    it('should calculate hash from file content', () => {
      const content = 'This is a test file content.';

      const result = HashCalculator.calculateFileHash(content);

      expect(result.success).toBe(true);
      expect((result as { success: true; value: Hash }).value).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should produce same hash for same content', () => {
      const content = 'Same content';

      const hash1 = HashCalculator.calculateFileHash(content);
      const hash2 = HashCalculator.calculateFileHash(content);

      expect(hash1.success).toBe(true);
      expect(hash2.success).toBe(true);
      expect((hash1 as { success: true; value: Hash }).value).toBe(
        (hash2 as { success: true; value: Hash }).value
      );
    });

    it('should produce different hash for different content', () => {
      const content1 = 'Content A';
      const content2 = 'Content B';

      const hash1 = HashCalculator.calculateFileHash(content1);
      const hash2 = HashCalculator.calculateFileHash(content2);

      expect(hash1.success).toBe(true);
      expect(hash2.success).toBe(true);
      expect((hash1 as { success: true; value: Hash }).value).not.toBe(
        (hash2 as { success: true; value: Hash }).value
      );
    });

    it('should handle empty content', () => {
      const content = '';

      const result = HashCalculator.calculateFileHash(content);

      expect(result.success).toBe(true);
      expect((result as { success: true; value: Hash }).value).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should handle unicode content', () => {
      const content = 'Hello 世界 🌍';

      const result = HashCalculator.calculateFileHash(content);

      expect(result.success).toBe(true);
      expect((result as { success: true; value: Hash }).value).toMatch(/^sha256:[a-f0-9]{64}$/);
    });
  });
});
