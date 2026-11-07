<!-- Modified by AIKUSAN, 2026-11-06: rewritten for Blockwright MCP; the upstream README is kept in docs/upstream-README.md. -->
## Blockwright MCP (unofficial MCP for Blockbench)

Runs a Model Context Protocol server inside Blockbench so AI assistants can build, inspect and review models.
Not an official Blockbench plugin.

Default address: `http://localhost:3001/blockwright` (change it under Settings > General).

### Claude Desktop

```json
{
  "mcpServers": {
    "blockwright": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3001/blockwright"]
    }
  }
}
```

### Claude Code

```
claude mcp add --transport http blockwright http://localhost:3001/blockwright
```

Based on blockbench-mcp-plugin by Jason J. Gardner (GPL-3.0-only) with tools from blockbench-mcp by sosadly (MIT).
Changes by AIKUSAN. Licence: GPL-3.0-only.
