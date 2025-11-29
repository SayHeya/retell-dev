/**
 * Tests for ConflictDetector version-aware methods
 *
 * Tests version drift detection and version-aware conflict detection.
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { ConflictDetector } from '@heya/retell.controllers';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ConflictDetector Version-Aware Methods', () => {
  describe('calculateVersionDrift', () => {
    it('should detect no drift when stored version matches remote latest', () => {
      const result = ConflictDetector.calculateVersionDrift({
        storedVersion: 5,
        remoteVersions: [
          { version: 3, is_published: true },
          { version: 4, is_published: false },
          { version: 5, is_published: false },
        ],
      });

      expect(result.hasDrift).toBe(false);
      expect(result.storedVersion).toBe(5);
      expect(result.remoteVersion).toBe(5);
      expect(result.versionsBehind).toBe(0);
      expect(result.message).toContain('matches remote');
    });

    it('should detect drift when stored version is behind remote', () => {
      const result = ConflictDetector.calculateVersionDrift({
        storedVersion: 3,
        remoteVersions: [
          { version: 3, is_published: true },
          { version: 4, is_published: false },
          { version: 5, is_published: false },
        ],
      });

      expect(result.hasDrift).toBe(true);
      expect(result.storedVersion).toBe(3);
      expect(result.remoteVersion).toBe(5);
      expect(result.versionsBehind).toBe(2);
      expect(result.message).toContain('2 version(s) ahead');
    });

    it('should include published version info when published is ahead of stored', () => {
      const result = ConflictDetector.calculateVersionDrift({
        storedVersion: 2,
        remoteVersions: [
          { version: 1, is_published: false },
          { version: 2, is_published: false },
          { version: 3, is_published: true },
          { version: 4, is_published: false },
        ],
      });

      expect(result.hasDrift).toBe(true);
      expect(result.versionsBehind).toBe(2);
      expect(result.message).toContain('published version 3');
    });

    it('should handle null stored version (new agent)', () => {
      const result = ConflictDetector.calculateVersionDrift({
        storedVersion: null,
        remoteVersions: [
          { version: 1, is_published: true },
          { version: 2, is_published: false },
        ],
      });

      expect(result.hasDrift).toBe(false);
      expect(result.storedVersion).toBeNull();
      expect(result.remoteVersion).toBe(2);
      expect(result.versionsBehind).toBe(0);
      expect(result.message).toContain('new agent');
    });

    it('should handle empty remote versions', () => {
      const result = ConflictDetector.calculateVersionDrift({
        storedVersion: 1,
        remoteVersions: [],
      });

      expect(result.hasDrift).toBe(false);
      expect(result.storedVersion).toBe(1);
      expect(result.remoteVersion).toBe(0);
      expect(result.message).toContain('No versions found');
    });

    it('should handle stored version ahead of remote (inconsistency)', () => {
      const result = ConflictDetector.calculateVersionDrift({
        storedVersion: 10,
        remoteVersions: [
          { version: 5, is_published: true },
          { version: 6, is_published: false },
        ],
      });

      expect(result.hasDrift).toBe(true);
      expect(result.storedVersion).toBe(10);
      expect(result.remoteVersion).toBe(6);
      expect(result.versionsBehind).toBe(-4); // Negative indicates stored is ahead
      expect(result.message).toContain('inconsistency');
    });

    it('should find highest version regardless of order', () => {
      const result = ConflictDetector.calculateVersionDrift({
        storedVersion: 3,
        remoteVersions: [
          { version: 2, is_published: false },
          { version: 7, is_published: false },
          { version: 5, is_published: true },
          { version: 3, is_published: false },
        ],
      });

      expect(result.remoteVersion).toBe(7);
      expect(result.versionsBehind).toBe(4);
    });
  });

  describe('hasVersionDrift', () => {
    it('should return true when drift exists', () => {
      const hasDrift = ConflictDetector.hasVersionDrift({
        storedVersion: 1,
        remoteVersions: [
          { version: 1, is_published: true },
          { version: 2, is_published: false },
          { version: 3, is_published: false },
        ],
      });

      expect(hasDrift).toBe(true);
    });

    it('should return false when no drift', () => {
      const hasDrift = ConflictDetector.hasVersionDrift({
        storedVersion: 3,
        remoteVersions: [
          { version: 1, is_published: true },
          { version: 2, is_published: false },
          { version: 3, is_published: false },
        ],
      });

      expect(hasDrift).toBe(false);
    });

    it('should return false for new agent (null stored version)', () => {
      const hasDrift = ConflictDetector.hasVersionDrift({
        storedVersion: null,
        remoteVersions: [{ version: 1, is_published: false }],
      });

      expect(hasDrift).toBe(false);
    });

    it('should return false for empty remote versions', () => {
      const hasDrift = ConflictDetector.hasVersionDrift({
        storedVersion: 5,
        remoteVersions: [],
      });

      expect(hasDrift).toBe(false);
    });
  });
});

describe('ConflictDetector.detectWithVersion', () => {
  let tempDir: string;
  let promptsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'conflict-version-test-'));
    promptsDir = path.join(tempDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should include version drift in conflict result', async () => {
    // Write a test prompt file
    await fs.writeFile(path.join(promptsDir, 'system.md'), '# System Prompt\nYou are helpful.');

    const localConfig = {
      agent_name: 'TestAgent',
      voice_id: 'voice-1',
      language: 'en-US',
      voice_speed: 1.0,
      voice_temperature: 1.0,
      responsiveness: 1.0,
      interruption_sensitivity: 1.0,
      enable_backchannel: true,
      llm_config: {
        model: 'gpt-4',
        temperature: 0.7,
        general_prompt: 'You are helpful.',
      },
    };

    const remoteAgentConfig = {
      agent_name: 'TestAgent',
      voice_id: 'voice-1',
      language: 'en-US',
      voice_speed: 1.0,
      voice_temperature: 1.0,
      responsiveness: 1.0,
      interruption_sensitivity: 1.0,
      enable_backchannel: true,
    };

    const remoteLlmConfig = {
      model: 'gpt-4',
      temperature: 0.7,
      general_prompt: 'You are helpful.',
      start_speaker: 'agent',
    };

    const result = await ConflictDetector.detectWithVersion(
      localConfig as never,
      remoteAgentConfig,
      remoteLlmConfig,
      null, // no stored hash
      promptsDir,
      {
        storedVersion: 2,
        remoteVersions: [
          { version: 2, is_published: true },
          { version: 3, is_published: false },
          { version: 4, is_published: false },
        ],
      }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.versionDrift).toBeDefined();
      expect(result.value.versionDrift?.hasDrift).toBe(true);
      expect(result.value.versionDrift?.versionsBehind).toBe(2);
    }
  });

  it('should include version drift even when no conflict', async () => {
    // Create a prompt that will match
    const prompt = 'You are a helpful assistant.';
    await fs.writeFile(path.join(promptsDir, 'main.md'), prompt);

    const localConfig = {
      agent_name: 'TestAgent',
      voice_id: 'voice-1',
      language: 'en-US',
      voice_speed: 1.0,
      voice_temperature: 1.0,
      responsiveness: 1.0,
      interruption_sensitivity: 1.0,
      enable_backchannel: true,
      llm_config: {
        model: 'gpt-4',
        temperature: 0.7,
        general_prompt: prompt,
      },
    };

    const remoteAgentConfig = {
      agent_name: 'TestAgent',
      voice_id: 'voice-1',
      language: 'en-US',
      voice_speed: 1.0,
      voice_temperature: 1.0,
      responsiveness: 1.0,
      interruption_sensitivity: 1.0,
      enable_backchannel: true,
    };

    const remoteLlmConfig = {
      model: 'gpt-4',
      temperature: 0.7,
      general_prompt: prompt,
      start_speaker: 'agent',
    };

    const result = await ConflictDetector.detectWithVersion(
      localConfig as never,
      remoteAgentConfig,
      remoteLlmConfig,
      null,
      promptsDir,
      {
        storedVersion: 5,
        remoteVersions: [{ version: 5, is_published: true }],
      }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.versionDrift).toBeDefined();
      expect(result.value.versionDrift?.hasDrift).toBe(false);
      expect(result.value.versionDrift?.message).toContain('matches');
    }
  });

  it('should handle new agent with null stored version', async () => {
    const prompt = 'Hello';
    await fs.writeFile(path.join(promptsDir, 'test.md'), prompt);

    const localConfig = {
      agent_name: 'NewAgent',
      voice_id: 'voice-1',
      language: 'en-US',
      voice_speed: 1.0,
      voice_temperature: 1.0,
      responsiveness: 1.0,
      interruption_sensitivity: 1.0,
      enable_backchannel: false,
      llm_config: {
        model: 'gpt-4',
        temperature: 0.5,
        general_prompt: prompt,
      },
    };

    const remoteAgentConfig = {
      agent_name: 'NewAgent',
      voice_id: 'voice-1',
      language: 'en-US',
      voice_speed: 1.0,
      voice_temperature: 1.0,
      responsiveness: 1.0,
      interruption_sensitivity: 1.0,
      enable_backchannel: false,
    };

    const remoteLlmConfig = {
      model: 'gpt-4',
      temperature: 0.5,
      general_prompt: prompt,
      start_speaker: 'agent',
    };

    const result = await ConflictDetector.detectWithVersion(
      localConfig as never,
      remoteAgentConfig,
      remoteLlmConfig,
      null,
      promptsDir,
      {
        storedVersion: null,
        remoteVersions: [{ version: 1, is_published: false }],
      }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.versionDrift).toBeDefined();
      expect(result.value.versionDrift?.storedVersion).toBeNull();
      expect(result.value.versionDrift?.hasDrift).toBe(false);
    }
  });
});
