import { describe, expect, it } from '@jest/globals';
import { VariableResolver } from '@core/variable-resolver';
import type { PromptConfig } from '../../../src/types/agent.types';

describe('VariableResolver', () => {
  describe('categorize', () => {
    it('should categorize static variables', () => {
      const promptText = 'Welcome to {{company_name}} support at {{support_hours}}.';
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
          support_hours: '9am-5pm EST',
        },
      };

      const result = VariableResolver.categorize(promptText, config);

      expect(result.static).toEqual([
        { type: 'static', name: 'company_name', value: 'Acme Corp' },
        { type: 'static', name: 'support_hours', value: '9am-5pm EST' },
      ]);
      expect(result.override).toEqual([]);
      expect(result.dynamic).toEqual([]);
      expect(result.system).toEqual([]);
    });

    it('should categorize override variables', () => {
      const promptText = 'User {{user_id}} with session {{session_token}}.';
      const config: PromptConfig = {
        variables: {
          user_id: 'OVERRIDE',
          session_token: 'OVERRIDE',
        },
      };

      const result = VariableResolver.categorize(promptText, config);

      expect(result.static).toEqual([]);
      expect(result.override).toEqual([
        { type: 'override', name: 'user_id' },
        { type: 'override', name: 'session_token' },
      ]);
      expect(result.dynamic).toEqual([]);
      expect(result.system).toEqual([]);
    });

    it('should categorize dynamic variables', () => {
      const promptText = 'Customer {{customer_name}} with order {{order_id}}.';
      const config: PromptConfig = {
        dynamic_variables: {
          customer_name: {
            type: 'string',
            description: 'Customer full name',
          },
          order_id: {
            type: 'string',
            description: 'Order ID',
          },
        },
      };

      const result = VariableResolver.categorize(promptText, config);

      expect(result.static).toEqual([]);
      expect(result.override).toEqual([]);
      expect(result.dynamic).toEqual([
        {
          type: 'dynamic',
          name: 'customer_name',
          valueType: 'string',
          description: 'Customer full name',
        },
        {
          type: 'dynamic',
          name: 'order_id',
          valueType: 'string',
          description: 'Order ID',
        },
      ]);
      expect(result.system).toEqual([]);
    });

    it('should categorize system variables', () => {
      const promptText =
        'Current time: {{current_time_UTC}} and {{current_time_Australia/Sydney}}.';
      const config: PromptConfig = {};

      const result = VariableResolver.categorize(promptText, config);

      expect(result.static).toEqual([]);
      expect(result.override).toEqual([]);
      expect(result.dynamic).toEqual([]);
      expect(result.system).toEqual([
        { type: 'system', name: 'current_time_UTC' },
        { type: 'system', name: 'current_time_Australia/Sydney' },
      ]);
    });

    it('should categorize mixed variable types', () => {
      const promptText = `
        Welcome to {{company_name}}!
        User {{user_id}} session {{session_token}}.
        Customer: {{customer_name}}
        Time: {{current_time_UTC}}
      `;
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
          user_id: 'OVERRIDE',
          session_token: 'OVERRIDE',
        },
        dynamic_variables: {
          customer_name: {
            type: 'string',
            description: 'Customer name',
          },
        },
      };

      const result = VariableResolver.categorize(promptText, config);

      expect(result.static).toEqual([{ type: 'static', name: 'company_name', value: 'Acme Corp' }]);
      expect(result.override).toEqual([
        { type: 'override', name: 'user_id' },
        { type: 'override', name: 'session_token' },
      ]);
      expect(result.dynamic).toEqual([
        {
          type: 'dynamic',
          name: 'customer_name',
          valueType: 'string',
          description: 'Customer name',
        },
      ]);
      expect(result.system).toEqual([{ type: 'system', name: 'current_time_UTC' }]);
    });

    it('should handle variables not used in prompt', () => {
      const promptText = 'Welcome to {{company_name}}.';
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
          unused_var: 'Some Value',
        },
      };

      const result = VariableResolver.categorize(promptText, config);

      // Should only return variables actually used in prompt
      expect(result.static).toEqual([{ type: 'static', name: 'company_name', value: 'Acme Corp' }]);
    });

    it('should handle empty prompt', () => {
      const promptText = '';
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
        },
      };

      const result = VariableResolver.categorize(promptText, config);

      expect(result.static).toEqual([]);
      expect(result.override).toEqual([]);
      expect(result.dynamic).toEqual([]);
      expect(result.system).toEqual([]);
    });

    it('should handle empty config', () => {
      const promptText = 'Welcome to {{company_name}}.';
      const config: PromptConfig = {};

      const result = VariableResolver.categorize(promptText, config);

      // Variable not defined in config = system variable
      expect(result.static).toEqual([]);
      expect(result.override).toEqual([]);
      expect(result.dynamic).toEqual([]);
      expect(result.system).toEqual([{ type: 'system', name: 'company_name' }]);
    });

    it('should recognize common system variable patterns', () => {
      const promptText = `
        {{current_time_UTC}}
        {{current_time_America/New_York}}
        {{current_date_UTC}}
        {{user_number}}
        {{call_id}}
      `;
      const config: PromptConfig = {};

      const result = VariableResolver.categorize(promptText, config);

      expect(result.system).toEqual([
        { type: 'system', name: 'current_time_UTC' },
        { type: 'system', name: 'current_time_America/New_York' },
        { type: 'system', name: 'current_date_UTC' },
        { type: 'system', name: 'user_number' },
        { type: 'system', name: 'call_id' },
      ]);
    });

    it('should handle duplicate variable usage', () => {
      const promptText = 'Welcome to {{company_name}}! At {{company_name}} we care.';
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
        },
      };

      const result = VariableResolver.categorize(promptText, config);

      // Should only list each variable once
      expect(result.static).toEqual([{ type: 'static', name: 'company_name', value: 'Acme Corp' }]);
    });
  });

  describe('validate', () => {
    it('should pass validation when all variables are accounted for', () => {
      const promptText = 'Welcome to {{company_name}}, {{user_id}}. Customer: {{customer_name}}.';
      const config: PromptConfig = {
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
      };

      const result = VariableResolver.validate(promptText, config);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation when dynamic variable is missing definition', () => {
      const promptText = 'Customer {{customer_name}} has order {{order_id}}.';
      const config: PromptConfig = {
        dynamic_variables: {
          customer_name: {
            type: 'string',
            description: 'Customer name',
          },
          // order_id is missing!
        },
      };

      const result = VariableResolver.validate(promptText, config);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Variable "order_id" is used in prompt but not defined in variables or dynamic_variables'
      );
    });

    it('should pass validation with system variables', () => {
      const promptText = 'Time: {{current_time_UTC}} for {{company_name}}.';
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
        },
      };

      const result = VariableResolver.validate(promptText, config);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation for undefined non-system variables', () => {
      const promptText = 'Welcome {{unknown_var}}.';
      const config: PromptConfig = {};

      const result = VariableResolver.validate(promptText, config);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass validation when no variables in prompt', () => {
      const promptText = 'This is a simple prompt with no variables.';
      const config: PromptConfig = {};

      const result = VariableResolver.validate(promptText, config);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('isSystemVariable', () => {
    it('should recognize current_time variables', () => {
      expect(VariableResolver.isSystemVariable('current_time_UTC')).toBe(true);
      expect(VariableResolver.isSystemVariable('current_time_America/New_York')).toBe(true);
      expect(VariableResolver.isSystemVariable('current_time_Australia/Sydney')).toBe(true);
    });

    it('should recognize current_date variables', () => {
      expect(VariableResolver.isSystemVariable('current_date_UTC')).toBe(true);
      expect(VariableResolver.isSystemVariable('current_date_America/Chicago')).toBe(true);
    });

    it('should recognize Retell system variables', () => {
      expect(VariableResolver.isSystemVariable('user_number')).toBe(true);
      expect(VariableResolver.isSystemVariable('call_id')).toBe(true);
      expect(VariableResolver.isSystemVariable('agent_id')).toBe(true);
    });

    it('should not recognize regular variables as system variables', () => {
      expect(VariableResolver.isSystemVariable('company_name')).toBe(false);
      expect(VariableResolver.isSystemVariable('user_id')).toBe(false);
      expect(VariableResolver.isSystemVariable('customer_name')).toBe(false);
    });
  });

  describe('getUnaccountedVariables', () => {
    it('should return empty array when all variables accounted for', () => {
      const promptText = 'Welcome to {{company_name}}, {{user_id}}.';
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
          user_id: 'OVERRIDE',
        },
      };

      const result = VariableResolver.getUnaccountedVariables(promptText, config);

      expect(result).toEqual([]);
    });

    it('should return unaccounted variables', () => {
      const promptText = 'Welcome {{company_name}}, user {{user_id}}, order {{order_id}}.';
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
        },
      };

      const result = VariableResolver.getUnaccountedVariables(promptText, config);

      expect(result).toEqual(['user_id', 'order_id']);
    });

    it('should not include system variables as unaccounted', () => {
      const promptText = 'Time {{current_time_UTC}} for {{company_name}} and {{unknown_var}}.';
      const config: PromptConfig = {
        variables: {
          company_name: 'Acme Corp',
        },
      };

      const result = VariableResolver.getUnaccountedVariables(promptText, config);

      // current_time_UTC is system variable, should not be unaccounted
      expect(result).toEqual(['unknown_var']);
    });
  });
});
