import { describe, expect, it } from '@jest/globals';
import {
  Ok,
  Err,
  isOk,
  isErr,
  unwrap,
  createError,
  RetellErrorCode,
} from '@heya/retell.controllers';

describe('Common Types', () => {
  describe('Ok', () => {
    it('should create successful result', () => {
      const result = Ok('success value');

      expect(result.success).toBe(true);

      // Assert result is successful before accessing value
      if (!result.success) {
        throw new Error('Expected result to be successful');
      }

      expect(result.value).toBe('success value');
    });
  });

  describe('Err', () => {
    it('should create error result', () => {
      const error = createError(RetellErrorCode.UNKNOWN_ERROR, 'failure');
      const result = Err(error);

      expect(result.success).toBe(false);

      // Assert result is failure before accessing error
      if (result.success) {
        throw new Error('Expected result to be failure');
      }

      expect(result.error).toBe(error);
    });
  });

  describe('isOk', () => {
    it('should return true for Ok result', () => {
      const result = Ok('value');
      expect(isOk(result)).toBe(true);
    });

    it('should return false for Err result', () => {
      const result = Err(createError(RetellErrorCode.UNKNOWN_ERROR, 'error'));
      expect(isOk(result)).toBe(false);
    });
  });

  describe('isErr', () => {
    it('should return true for Err result', () => {
      const result = Err(createError(RetellErrorCode.UNKNOWN_ERROR, 'error'));
      expect(isErr(result)).toBe(true);
    });

    it('should return false for Ok result', () => {
      const result = Ok('value');
      expect(isErr(result)).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('should return value for Ok result', () => {
      const result = Ok('success');
      expect(unwrap(result)).toBe('success');
    });

    it('should throw error for Err result', () => {
      const error = createError(RetellErrorCode.UNKNOWN_ERROR, 'test error');
      const result = Err(error);

      expect(() => unwrap(result)).toThrow();
    });
  });
});
