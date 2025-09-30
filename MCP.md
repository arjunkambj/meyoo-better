# Meyoo MCP Server Integration Guide

This guide explains how to integrate the Meyoo Analytics MCP (Model Context Protocol) server with various AI applications and development tools.

## Overview

The Meyoo MCP server provides 10 tools for e-commerce analytics, inventory management, team collaboration, and email automation through a standardized API.

**Server URL:**
- Development: `http://localhost:3000/api/mcp`
- Production: `https://meyoo.io/api/mcp`

## Authentication

All requests require authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

You can generate API keys from your Meyoo dashboard under Settings > API Keys.

---

## 1. Claude Desktop App Integration

### Configuration

**MacOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

### Setup

1. Create or edit the config file:

```json
{
  "mcpServers": {
    "meyoo-analytics": {
      "url": "https://meyoo.io/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      },
      "transport": {
        "type": "http"
      }
    }
  }
}
```

**For local development:**
```json
{
  "mcpServers": {
    "meyoo-analytics": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      },
      "transport": {
        "type": "http"
      }
    }
  }
}
```

2. Replace `YOUR_API_KEY` with your actual API key from https://meyoo.io/settings/api-keys
3. Restart Claude Desktop
5. The tools will appear in Claude's tool selection menu

### Usage

Once configured, you can ask Claude:
- "Show me today's orders summary"
- "What products are low on stock?"
- "Get our P&L snapshot for last month"
- "List all team members"

---

## 2. ChatGPT Desktop Integration

**Note:** As of June 2025, ChatGPT has **native MCP support**. This feature is available for ChatGPT Enterprise, Education, and Team subscribers only. ChatGPT Plus users do not have access to this functionality.

### ChatGPT Desktop Setup

#### Prerequisites
- ChatGPT Enterprise, Education, or Team subscription
- Latest version of ChatGPT Desktop app
- Valid Meyoo API key from https://meyoo.io/settings/api-keys

#### Configuration Steps

1. **Enable Developer Mode**
   - Open ChatGPT Desktop
   - Navigate to: Settings > Advanced
   - Enable "Developer Mode"

2. **Add MCP Server**
   - Go to Settings > Connectors (visible after enabling Developer Mode)
   - Click "Add Connector" or "Add MCP Server"
   - Configure the connector:
     - **Name:** Meyoo Analytics
     - **Server URL:** `https://meyoo.io/api/mcp`
     - **Authentication:** Bearer Token
     - **API Key:** `YOUR_API_KEY`

3. **Configure Deep Research Integration**
   - In the connector settings, enable "Deep Research"
   - Add custom instructions (optional):
     ```
     This MCP server provides e-commerce analytics tools for Meyoo.
     Use it to retrieve orders, inventory, P&L data, team members, and send emails.
     ```

4. **Test the Connection**
   - Start a new chat
   - Ask: "What tools do you have access to from Meyoo?"
   - ChatGPT should list the 10 available MCP tools

### Usage Examples

Once configured, you can interact naturally:
- "Show me orders summary for last month using Meyoo"
- "Check which products are low on stock"
- "Get our P&L snapshot for Q3"
- "List all team members"
- "Send a test email preview"

### OpenAI API Integration

For programmatic access, you can also use the OpenAI Responses API with MCP:

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o",
    "tools": [
      {
        "type": "mcp",
        "server_label": "meyoo",
        "server_url": "https://meyoo.io/api/mcp",
        "require_approval": "never",
        "headers": {
          "Authorization": "Bearer YOUR_MEYOO_API_KEY"
        }
      }
    ],
    "input": "What are my low stock products?"
  }'
```

### Limitations

- Only available for Enterprise, Education, and Team subscriptions
- Deep Research currently supports search and document retrieval operations
- Some advanced tool capabilities may be rolled out gradually

---

## 3. ChatGPT Web (Custom GPT Fallback)

**Note:** For users without Enterprise/Team/Education subscriptions, you can create a Custom GPT with Actions as a workaround:

### Custom GPT Setup

1. Go to ChatGPT > Explore GPTs > Create
2. Configure basic settings (name, description)
3. Click "Configure" > "Actions" > "Create new action"
4. Add this OpenAPI schema:

```yaml
openapi: 3.1.0
info:
  title: Meyoo Analytics API
  version: 1.0.0
servers:
  - url: https://meyoo.io/api/mcp
paths:
  /:
    post:
      operationId: callMcpTool
      summary: Call Meyoo MCP tools
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                jsonrpc:
                  type: string
                  default: "2.0"
                id:
                  type: integer
                method:
                  type: string
                  enum: [tools/list, tools/call]
                params:
                  type: object
      responses:
        '200':
          description: Successful response
```

5. Add Authentication:
   - Type: API Key
   - Auth Type: Bearer
   - API Key: `YOUR_API_KEY`

6. Save and test the action

**Limitations:** This method requires manual JSON-RPC formatting and doesn't provide the same seamless experience as native MCP integration.

---

## 4. Claude Code Integration

Claude Code has experimental MCP support through configuration files.

### Project Configuration

Create `.claude/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "meyoo": {
      "command": "node",
      "args": ["-e", "require('http').get('http://localhost:3000/api/mcp')"],
      "env": {
        "MEYOO_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

Alternatively, use direct HTTP transport:

```json
{
  "mcpServers": {
    "meyoo": {
      "url": "https://meyoo.io/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

**For local development, use:** `http://localhost:3000/api/mcp`

### Testing in Claude Code

```bash
# In your terminal within Claude Code
curl -X POST "http://localhost:3000/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 5. Cursor IDE Integration

Cursor supports MCP servers through its AI settings.

### Setup

1. Open Cursor Settings (+, or Ctrl+,)
2. Navigate to: Features > AI > Model Context Protocol
3. Click "Add MCP Server"
4. Configure:
   ```json
   {
     "name": "Meyoo Analytics",
     "url": "https://meyoo.io/api/mcp",
     "headers": {
       "Authorization": "Bearer YOUR_API_KEY"
     }
   }
   ```

   **For local development, use:** `http://localhost:3000/api/mcp`

5. Save and restart Cursor

### Usage in Cursor

The tools will be available when using Cursor's AI features:
- Chat panel (+L)
- Code generation
- Terminal AI commands

Example prompts:
- "Use Meyoo to check inventory levels"
- "Get organization members list"
- "What's our revenue for this quarter?"

---

## Available MCP Tools

### 1. `orders_summary`
Summarize order volumes, revenue, and fulfillment performance.

**Parameters:**
- `startDate` (optional): ISO date (YYYY-MM-DD)
- `endDate` (optional): ISO date (YYYY-MM-DD)

**Example:**
```json
{
  "name": "orders_summary",
  "arguments": {
    "startDate": "2025-09-01",
    "endDate": "2025-09-30"
  }
}
```

### 2. `inventory_low_stock`
List products low or critical on stock.

**Parameters:**
- `limit` (optional): Max alerts (1-50, default: 10)

### 3. `pnl_snapshot`
Get profit & loss snapshot with revenue, margins, and expenses.

**Parameters:**
- `startDate` (optional): ISO date
- `endDate` (optional): ISO date

### 4. `analytics_summary`
Store performance metrics aggregated daily/weekly/monthly.

**Parameters:**
- `startDate` (required): ISO date
- `endDate` (required): ISO date
- `granularity` (optional): "daily", "weekly", or "monthly"
- `metrics` (optional): Array of metric names

### 5. `meta_ads_overview`
Meta/Facebook ads performance metrics.

**Parameters:**
- `startDate` (optional): ISO date
- `endDate` (optional): ISO date

### 6. `current_date`
Returns current date in ISO 8601 format (UTC).

**Parameters:** None

### 7. `brand_summary`
Retrieve stored brand overview and positioning.

**Parameters:** None

### 8. `products_inventory`
List products with inventory details, variants, and stock status.

**Parameters:**
- `page` (optional): Page number
- `pageSize` (optional): Items per page (max: 200)
- `stockLevel` (optional): "all", "healthy", "low", "critical", "out"
- `search` (optional): Search term
- `sortBy` (optional): Field to sort by
- `sortOrder` (optional): "asc" or "desc"

### 9. `org_members`
List organization members with roles and status.

**Parameters:**
- `role` (optional): "StoreOwner" or "StoreTeam"
- `status` (optional): "active", "suspended", "removed"
- `includeRemoved` (optional): Boolean (default: false)

### 10. `send_email`
Send emails via Resend with preview support.

**Parameters:**
- `memberId` (optional): Organization member ID
- `toEmail` (optional): Email address (required if no memberId)
- `subject` (required): Email subject (3-160 chars)
- `html` (optional): HTML body
- `text` (optional): Plain text body
- `replyTo` (optional): Array of reply-to addresses (max: 4)
- `from` (optional): From address
- `previewOnly` (optional): Boolean for dry-run

---

## Testing Your MCP Server

### Using MCP Inspector (Recommended)

```bash
# For production
npx @modelcontextprotocol/inspector https://meyoo.io/api/mcp

# For local development
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

This launches a web UI for testing tools interactively.

### Using cURL

#### 1. Initialize Connection
```bash
curl -X POST "https://meyoo.io/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

#### 2. List Available Tools
```bash
curl -X POST "https://meyoo.io/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

#### 3. Call a Tool
```bash
curl -X POST "https://meyoo.io/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "current_date",
      "arguments": {}
    }
  }'
```

**Note:** Replace `https://meyoo.io` with `http://localhost:3000` for local development.

---

## Troubleshooting

### Connection Issues

1. **"Not found" error:** Ensure you're using `/api/mcp` (not `/api/messages` or `/api/sse`)
2. **"Not Acceptable" error:** Add both headers:
   ```
   Content-Type: application/json
   Accept: application/json, text/event-stream
   ```
3. **"Unauthorized" error:** Check your API key is valid and properly formatted

### Tool Execution Issues

1. **"No data" responses:** The API key's organization may not have data populated
2. **Empty results:** Check date ranges are valid and within your data scope
3. **Validation errors:** Ensure all required parameters are provided

### Development Tips

- Use `previewOnly: true` for email tool to test without sending
- Test with small `pageSize` values for inventory/products
- Use `current_date` tool to ensure server is responding

---

## Security Considerations

1. **Never commit API keys** to version control
2. **Use environment variables** for production deployments
3. **Restrict API key permissions** to minimum required scope
4. **Use HTTPS** in production (not HTTP)
5. **Rotate API keys** regularly
6. **Monitor API usage** for suspicious activity

---

## Production Deployment

When deploying to production:

1. Update server URL in all configs:
   ```json
   "url": "https://your-domain.com/api/mcp"
   ```

2. Use environment variables for API keys:
   ```bash
   export MEYOO_API_KEY="your-production-key"
   ```

3. Enable HTTPS and proper CORS settings

4. Set up rate limiting and monitoring

5. Test all integrations in staging first

---

## Support

For issues or questions:
- Website: https://meyoo.io
- Documentation: https://meyoo.io/docs
- API Keys: https://meyoo.io/settings/api-keys
- Email: support@meyoo.io

---

**Last Updated:** September 30, 2025
**MCP Server Version:** 1.0.0
**Protocol Version:** 2024-11-05