import { createHash } from 'crypto';
import type { AgentConfig } from '../types/agent.types';
import type { Hash, Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';

/**
 * Utility for calculating SHA-256 hashes of agent configurations and files.
 * Used for change detection and sync state tracking.
 */
export class HashCalculator {
  /**
   * Calculate SHA-256 hash of an agent configuration.
   * Produces a canonical hash by sorting keys before hashing.
   *
   * @param config - The agent configuration to hash
   * @returns Result containing the hash prefixed with "sha256:" or an error
   */
  static calculateAgentHash(config: AgentConfig): Result<Hash, Error> {
    try {
      // Create canonical JSON by sorting keys
      const canonical = this.canonicalizeJSON(config);
      const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
      return Ok(`sha256:${hash}` as Hash);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to calculate agent hash'));
    }
  }

  /**
   * Calculate SHA-256 hash of file content.
   *
   * @param content - The file content to hash
   * @returns Result containing the hash prefixed with "sha256:" or an error
   */
  static calculateFileHash(content: string): Result<Hash, Error> {
    try {
      const hash = createHash('sha256').update(content, 'utf8').digest('hex');
      return Ok(`sha256:${hash}` as Hash);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to calculate file hash'));
    }
  }

  /**
   * Compare two hashes for equality.
   * Handles null values (null === null is true).
   *
   * @param hash1 - First hash to compare
   * @param hash2 - Second hash to compare
   * @returns true if hashes are equal, false otherwise
   */
  static compareHashes(hash1: Hash | null, hash2: Hash | null): boolean {
    if (hash1 === null && hash2 === null) {
      return true;
    }
    if (hash1 === null || hash2 === null) {
      return false;
    }
    return hash1 === hash2;
  }

  /**
   * Convert an object to canonical JSON string.
   * Sorts all keys recursively to ensure consistent hash generation.
   *
   * @param obj - Object to canonicalize
   * @returns Canonical JSON string
   */
  private static canonicalizeJSON(obj: unknown): string {
    if (obj === null) {
      return 'null';
    }

    if (typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      const items = obj.map((item) => this.canonicalizeJSON(item));
      return `[${items.join(',')}]`;
    }

    // Sort object keys and recursively canonicalize values
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((key) => {
      const value = (obj as Record<string, unknown>)[key];
      return `"${key}":${this.canonicalizeJSON(value)}`;
    });
    return `{${pairs.join(',')}}`;
  }
}
