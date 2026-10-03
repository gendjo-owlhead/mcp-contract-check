import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const isBroken = process.argv.includes("--broken");

const server = new Server(
  {
    name: "mcp-check-demo-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "echo",
        description: "Echo tool demonstrating contract checking",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
          },
          required: ["text"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  if (name !== "echo") {
    throw new Error(`Unknown tool: ${name}`);
  }

  if (isBroken) {
    // Broken handler returns { message: "hi" } instead of { text: string }
    return {
      content: [{ type: "text", text: "hi" }],
      structuredContent: { message: "hi" },
      message: "hi",
    };
  }

  // Fixed handler returns { text: "hi" }
  return {
    content: [{ type: "text", text: "hi" }],
    structuredContent: { text: "hi" },
    text: "hi",
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
