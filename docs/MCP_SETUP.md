# MCP (Model Context Protocol) Setup Guide

This guide explains how to configure MCP servers and tools for Retell AI agents.

## Overview

MCP (Model Context Protocol) allows your voice agent to call external tools mid-conversation without compromising latency or reliability. MCP enables agents to securely interact with external services like CRMs, scheduling tools, databases, and custom APIs.

## Configuration Structure

MCP configuration happens at the **LLM level** with two components:

1. **`mcps`** - Array of MCP server connections
2. **`general_tools`** - Array of tools (including MCP tools) the agent can use

```
┌─────────────────────────────────────────────────────┐
│  LLM Config                                         │
│  ┌───────────────────────────────────────────────┐  │
│  │  mcps: [                                      │  │
│  │    { name, url, headers, timeout_ms }         │  │  ← Server connections
│  │  ]                                            │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  general_tools: [                             │  │
│  │    { type: "mcp", mcp_id, name, ... }         │  │  ← Tool definitions
│  │  ]                                            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Step 1: Define MCP Servers

Add MCP server connections to the `mcps` array in your LLM config:

```json
{
  "llm_config": {
    "mcps": [
      {
        "name": "order-service",
        "url": "https://api.example.com/mcp/orders",
        "headers": {
          "Authorization": "Bearer your-api-token"
        },
        "query_params": {
          "version": "v1"
        },
        "timeout_ms": 30000
      }
    ]
  }
}
```

### MCP Server Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for this MCP server. Referenced by `mcp_id` in tools. |
| `url` | string | Yes | The URL endpoint of your MCP server. |
| `headers` | object | No | Custom headers sent with requests (e.g., `Authorization`). |
| `query_params` | object | No | Query parameters appended to the MCP server URL. |
| `timeout_ms` | integer | No | Connection timeout in milliseconds. Default: 120,000 (2 minutes). |

## Step 2: Define MCP Tools

Add MCP tools to the `general_tools` array, referencing the MCP server by `mcp_id`:

```json
{
  "llm_config": {
    "general_tools": [
      {
        "type": "mcp",
        "mcp_id": "order-service",
        "name": "get_order_status",
        "description": "Retrieve the current status of a customer order by order ID",
        "response_variables": {
          "order_status": "$.status",
          "delivery_date": "$.estimated_delivery"
        },
        "speak_during_execution": true,
        "speak_after_execution": false,
        "execution_message_description": "Let me look up your order status..."
      }
    ]
  }
}
```

### MCP Tool Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"mcp"` | Yes | Must be `"mcp"` to indicate this is an MCP tool. |
| `mcp_id` | string | No | References the `name` of an MCP server in the `mcps` array. |
| `name` | string | Yes | Tool name. Must be unique. Allowed: a-z, A-Z, 0-9, underscores, dashes. Max 64 characters. |
| `description` | string | Yes | Description of what the tool does. Used by the LLM to decide when to call it. |
| `response_variables` | object | No | Extract values from responses using JSON path syntax. |
| `speak_during_execution` | boolean | No | If `true`, agent speaks during execution when processing exceeds 1 second. |
| `speak_after_execution` | boolean | No | If `true`, agent calls LLM again after execution to provide a spoken update. |
| `execution_message_description` | string | No | Guides what the agent says during execution (when `speak_during_execution` is `true`). |

## Complete Example

Here's a full agent configuration with MCP:

```json
{
  "agent_name": "Customer Service Agent",
  "voice_id": "11labs-Adrian",
  "language": "en-US",
  "llm_config": {
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "mcps": [
      {
        "name": "order-service",
        "url": "https://api.example.com/mcp/orders",
        "headers": {
          "Authorization": "Bearer {{order_api_token}}"
        },
        "timeout_ms": 30000
      },
      {
        "name": "crm-service",
        "url": "https://api.example.com/mcp/crm",
        "headers": {
          "X-API-Key": "your-crm-api-key"
        },
        "timeout_ms": 60000
      }
    ],
    "general_tools": [
      {
        "type": "mcp",
        "mcp_id": "order-service",
        "name": "get_order",
        "description": "Retrieve order details including status, items, and delivery date by order ID",
        "response_variables": {
          "order_status": "$.status",
          "delivery_date": "$.estimated_delivery",
          "order_total": "$.total"
        },
        "speak_during_execution": true,
        "execution_message_description": "Let me look up your order..."
      },
      {
        "type": "mcp",
        "mcp_id": "order-service",
        "name": "cancel_order",
        "description": "Cancel an order if it has not yet shipped",
        "speak_after_execution": true
      },
      {
        "type": "mcp",
        "mcp_id": "crm-service",
        "name": "update_customer_info",
        "description": "Update customer contact information in the CRM",
        "speak_during_execution": true,
        "execution_message_description": "Updating your information now..."
      }
    ],
    "general_prompt": "You are a helpful customer service agent for Acme Corp.\n\nWhen a customer asks about their order, use the get_order tool to look up the information.\nWhen a customer wants to cancel, use the cancel_order tool.\nWhen updating customer details, use the update_customer_info tool.\n\nAlways confirm actions before executing them.",
    "begin_message": "Hello! Thank you for calling Acme Corp. How can I help you today?"
  }
}
```

## Response Variables

Response variables allow you to extract values from MCP tool responses and use them later in the conversation as dynamic variables.

### JSON Path Syntax

Use JSON path syntax to specify which values to extract:

```json
{
  "response_variables": {
    "order_status": "$.status",
    "customer_name": "$.customer.name",
    "first_item": "$.items[0].name"
  }
}
```

Given this MCP response:
```json
{
  "status": "shipped",
  "customer": {
    "name": "John Doe"
  },
  "items": [
    { "name": "Widget A" },
    { "name": "Widget B" }
  ]
}
```

The extracted variables would be:
- `{{order_status}}` = "shipped"
- `{{customer_name}}` = "John Doe"
- `{{first_item}}` = "Widget A"

These variables can then be used in prompts or subsequent tool calls.

## Execution Behavior

### `speak_during_execution`

When `true`, the agent will speak while waiting for the MCP tool to complete (if it takes longer than 1 second). Use `execution_message_description` to guide what the agent says.

**Example:**
```json
{
  "speak_during_execution": true,
  "execution_message_description": "Looking up your account information, one moment please..."
}
```

### `speak_after_execution`

When `true`, the agent will call the LLM again after receiving the tool result to provide a natural spoken response about the outcome.

**Use cases:**
- When you want the agent to summarize results conversationally
- When the tool response needs interpretation before speaking

## Best Practices

### 1. Write Clear Tool Descriptions

The LLM uses the `description` field to decide when to call a tool. Be specific:

```json
// Good
"description": "Retrieve order status, items, and estimated delivery date using the customer's order ID"

// Too vague
"description": "Get order info"
```

### 2. Guide Tool Usage in Prompts

Include explicit instructions in your `general_prompt` about when to use MCP tools:

```
When the customer asks about their order status, always use the get_order tool
before responding. Ask for their order ID if they haven't provided it.
```

### 3. Set Appropriate Timeouts

Set `timeout_ms` based on your service's expected response time:
- Fast APIs (< 5s): 10,000 - 30,000 ms
- Moderate APIs (5-30s): 30,000 - 60,000 ms
- Slow APIs (30s+): 60,000 - 120,000 ms

### 4. Use Response Variables for Context

Extract important values from responses to maintain conversation context:

```json
{
  "response_variables": {
    "account_balance": "$.balance",
    "account_status": "$.status"
  }
}
```

Then reference in prompts: "Your current balance is {{account_balance}}."

### 5. Handle Errors Gracefully

Include error handling guidance in your prompts:

```
If a tool call fails or returns an error, apologize to the customer and offer
to try again or transfer them to a human agent.
```

## Connecting to Common Services

### HTTP Endpoints

Any service with an HTTP endpoint can be connected via MCP:
- REST APIs
- GraphQL endpoints
- Webhooks
- Internal services

### Authentication

Use the `headers` field for authentication:

```json
{
  "headers": {
    "Authorization": "Bearer your-token",
    "X-API-Key": "your-api-key"
  }
}
```

### No-Code Platforms

MCP works with automation platforms like:
- Zapier
- n8n
- Make (Integromat)

These platforms can expose MCP-compatible endpoints for your workflows.

## Troubleshooting

### Tool Not Being Called

1. Check that `mcp_id` matches the `name` in your `mcps` array
2. Verify the tool `description` clearly explains when to use it
3. Add explicit instructions in your `general_prompt`

### Timeout Errors

1. Increase `timeout_ms` for slow services
2. Check that the MCP server URL is correct and accessible
3. Verify authentication headers are valid

### Response Variables Not Working

1. Verify JSON path syntax (use `$.` prefix)
2. Check that the response structure matches your paths
3. Test the MCP endpoint directly to see actual response format

## API Reference

When using the Retell API directly, MCP is configured via the **Update Retell LLM** endpoint:

```bash
PATCH https://api.retellai.com/v2/update-retell-llm/{llm_id}
```

Request body includes both `mcps` and `general_tools` arrays as shown in the examples above.

## Related Documentation

- [Retell AI MCP Docs](https://docs.retellai.com/build/single-multi-prompt/mcp)
- [Update Retell LLM API](https://docs.retellai.com/api-references/update-retell-llm)
- [Create Retell LLM API](https://docs.retellai.com/api-references/create-retell-llm)
