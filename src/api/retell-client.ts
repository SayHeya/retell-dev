import { Retell } from 'retell-sdk';
import type { WorkspaceConfig } from '../config/workspace-config';
import type { Result } from '../types/common.types';
import { Ok, Err } from '../types/common.types';
import type { RetellAgentConfig } from '../core/agent-transformer';
import type { AgentId, LlmId, KnowledgeBaseId } from '../types/agent.types';

/**
 * Response from creating/updating an agent
 */
export type AgentResponse = {
  readonly agent_id: string;
  readonly last_modification_timestamp?: number;
};

/**
 * Response from creating/updating an LLM
 */
export type LlmResponse = {
  readonly llm_id: string;
  readonly last_modification_timestamp?: number;
};

/**
 * Response from creating/updating a knowledge base
 */
export type KnowledgeBaseResponse = {
  readonly knowledge_base_id: string;
};

/**
 * Retell API client wrapper.
 * Wraps the official retell-sdk with our error handling and types.
 */
export class RetellClient {
  private readonly client: Retell;
  private readonly workspace: WorkspaceConfig;

  constructor(workspace: WorkspaceConfig) {
    this.workspace = workspace;
    this.client = new Retell({
      apiKey: workspace.apiKey,
    });
  }

  /**
   * Create a new agent in Retell.
   *
   * @param config - Agent configuration in Retell's format
   * @returns Result containing agent response or error
   */
  async createAgent(config: RetellAgentConfig): Promise<Result<AgentResponse, Error>> {
    try {
      const response = await this.client.agent.create(config as never);

      return Ok({
        agent_id: response.agent_id,
        last_modification_timestamp: response.last_modification_timestamp,
      });
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to create agent in Retell'));
    }
  }

  /**
   * Update an existing agent in Retell.
   *
   * @param agentId - Agent ID
   * @param config - Agent configuration in Retell's format
   * @returns Result containing agent response or error
   */
  async updateAgent(
    agentId: AgentId,
    config: Partial<RetellAgentConfig>
  ): Promise<Result<AgentResponse, Error>> {
    try {
      const response = await this.client.agent.update(agentId, config as never);

      return Ok({
        agent_id: response.agent_id,
        last_modification_timestamp: response.last_modification_timestamp,
      });
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to update agent ${agentId} in Retell`)
      );
    }
  }

  /**
   * Get an agent from Retell.
   *
   * @param agentId - Agent ID
   * @returns Result containing agent data or error
   */
  async getAgent(agentId: AgentId): Promise<Result<unknown, Error>> {
    try {
      const response = await this.client.agent.retrieve(agentId);
      return Ok(response);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to get agent ${agentId} from Retell`)
      );
    }
  }

  /**
   * Delete an agent from Retell.
   *
   * @param agentId - Agent ID
   * @returns Result indicating success or error
   */
  async deleteAgent(agentId: AgentId): Promise<Result<void, Error>> {
    try {
      await this.client.agent.delete(agentId);
      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to delete agent ${agentId} from Retell`)
      );
    }
  }

  /**
   * Create a new LLM configuration in Retell.
   *
   * @param config - LLM configuration
   * @returns Result containing LLM response or error
   */
  async createLlm(config: unknown): Promise<Result<LlmResponse, Error>> {
    try {
      const response = await this.client.llm.create(config as never);

      return Ok({
        llm_id: response.llm_id,
        last_modification_timestamp: response.last_modification_timestamp,
      });
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to create LLM in Retell'));
    }
  }

  /**
   * Update an existing LLM configuration in Retell.
   *
   * @param llmId - LLM ID
   * @param config - LLM configuration
   * @returns Result containing LLM response or error
   */
  async updateLlm(llmId: LlmId, config: unknown): Promise<Result<LlmResponse, Error>> {
    try {
      const response = await this.client.llm.update(llmId, config as never);

      return Ok({
        llm_id: response.llm_id,
        last_modification_timestamp: response.last_modification_timestamp,
      });
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to update LLM ${llmId} in Retell`)
      );
    }
  }

  /**
   * Get an LLM configuration from Retell.
   *
   * @param llmId - LLM ID
   * @returns Result containing LLM data or error
   */
  async getLlm(llmId: LlmId): Promise<Result<unknown, Error>> {
    try {
      const response = await this.client.llm.retrieve(llmId);
      return Ok(response);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to get LLM ${llmId} from Retell`)
      );
    }
  }

  /**
   * List all LLMs in the workspace.
   *
   * @returns Result containing list of LLMs or error
   */
  async listLlms(): Promise<Result<unknown[], Error>> {
    try {
      const response = await this.client.llm.list();
      return Ok(response as unknown[]);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to list LLMs from Retell'));
    }
  }

  /**
   * Delete an LLM from Retell.
   *
   * @param llmId - LLM ID
   * @returns Result indicating success or error
   */
  async deleteLlm(llmId: LlmId): Promise<Result<void, Error>> {
    try {
      await this.client.llm.delete(llmId);
      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error(`Failed to delete LLM ${llmId} from Retell`)
      );
    }
  }

  /**
   * Create a new knowledge base in Retell.
   *
   * @param name - Knowledge base name
   * @returns Result containing KB response or error
   */
  async createKnowledgeBase(name: string): Promise<Result<KnowledgeBaseResponse, Error>> {
    try {
      const response = await this.client.knowledgeBase.create({
        knowledge_base_name: name,
      } as never);

      return Ok({
        knowledge_base_id: response.knowledge_base_id,
      });
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error('Failed to create knowledge base in Retell')
      );
    }
  }

  /**
   * Upload a file to a knowledge base.
   *
   * @param kbId - Knowledge base ID
   * @param file - File to upload (Core.Uploadable)
   * @returns Result containing updated KB response or error
   */
  async uploadKbFile(
    kbId: KnowledgeBaseId,
    file: unknown
  ): Promise<Result<KnowledgeBaseResponse, Error>> {
    try {
      const response = await this.client.knowledgeBase.addSources(kbId, {
        knowledge_base_files: [file as never],
      });

      return Ok({
        knowledge_base_id: response.knowledge_base_id,
      });
    } catch (error) {
      return Err(error instanceof Error ? error : new Error(`Failed to upload file to KB ${kbId}`));
    }
  }

  /**
   * List all agents in the workspace.
   *
   * @returns Result containing list of agents or error
   */
  async listAgents(): Promise<Result<unknown[], Error>> {
    try {
      const response = await this.client.agent.list();
      return Ok(response as unknown[]);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Failed to list agents from Retell'));
    }
  }

  /**
   * Get workspace name for logging/display.
   */
  getWorkspaceName(): string {
    return this.workspace.name;
  }

  // ============================================================================
  // Phone Number Operations
  // ============================================================================

  /**
   * Create/purchase a new phone number.
   *
   * @param config - Phone number configuration
   * @returns Result containing phone number response or error
   */
  async createPhoneNumber(config: Record<string, unknown>): Promise<Result<unknown, Error>> {
    try {
      const response = await this.client.phoneNumber.create(config as never);
      return Ok(response);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error('Failed to create phone number in Retell')
      );
    }
  }

  /**
   * Import phone number via SIP trunk.
   *
   * @param config - Import configuration
   * @returns Result containing phone number response or error
   */
  async importPhoneNumber(config: Record<string, unknown>): Promise<Result<unknown, Error>> {
    try {
      const response = await this.client.phoneNumber.import(config as never);
      return Ok(response);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error('Failed to import phone number in Retell')
      );
    }
  }

  /**
   * List all phone numbers in the workspace.
   *
   * @returns Result containing list of phone numbers or error
   */
  async listPhoneNumbers(): Promise<Result<unknown[], Error>> {
    try {
      const response = await this.client.phoneNumber.list();
      return Ok(response as unknown[]);
    } catch (error) {
      return Err(
        error instanceof Error ? error : new Error('Failed to list phone numbers from Retell')
      );
    }
  }

  /**
   * Get phone number details.
   *
   * @param phoneNumber - Phone number in E.164 format
   * @returns Result containing phone number data or error
   */
  async getPhoneNumber(phoneNumber: string): Promise<Result<unknown, Error>> {
    try {
      const response = await this.client.phoneNumber.retrieve(phoneNumber);
      return Ok(response);
    } catch (error) {
      return Err(
        error instanceof Error
          ? error
          : new Error(`Failed to get phone number ${phoneNumber} from Retell`)
      );
    }
  }

  /**
   * Update phone number configuration.
   *
   * @param phoneNumber - Phone number in E.164 format
   * @param config - Update configuration
   * @returns Result containing updated phone number data or error
   */
  async updatePhoneNumber(
    phoneNumber: string,
    config: Record<string, unknown>
  ): Promise<Result<unknown, Error>> {
    try {
      const response = await this.client.phoneNumber.update(phoneNumber, config as never);
      return Ok(response);
    } catch (error) {
      return Err(
        error instanceof Error
          ? error
          : new Error(`Failed to update phone number ${phoneNumber} in Retell`)
      );
    }
  }

  /**
   * Delete phone number.
   *
   * @param phoneNumber - Phone number in E.164 format
   * @returns Result indicating success or error
   */
  async deletePhoneNumber(phoneNumber: string): Promise<Result<void, Error>> {
    try {
      await this.client.phoneNumber.delete(phoneNumber);
      return Ok(undefined);
    } catch (error) {
      return Err(
        error instanceof Error
          ? error
          : new Error(`Failed to delete phone number ${phoneNumber} from Retell`)
      );
    }
  }
}
