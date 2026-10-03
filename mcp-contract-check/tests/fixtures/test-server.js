import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const mode = process.argv[2] || "valid";

const server = new Server(
  { name: "test-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "greet",
        description: "Greets someone",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
        },
        outputSchema: {
          type: "object",
          properties: {
            greeting: { type: "string" },
          },
          required: ["greeting"],
        },
      },
      {
        name: "failTool",
        description: "Always fails",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      {
        name: "noFixtureTool",
        description: "Tool with no fixture",
        inputSchema: { type: "object" },
        outputSchema: {
          type: "object",
          properties: {
            status: { type: "string" },
          },
          required: ["status"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "greet") {
    if (mode === "broken") {
      return {
        content: [{ type: "text", text: "hi" }],
        structuredContent: { wrongField: 123 },
      };
    }
    return {
      content: [{ type: "text", text: `Hello, ${args?.name}!` }],
      structuredContent: { greeting: `Hello, ${args?.name}!` },
    };
  }

  if (name === "failTool") {
    return {
      isError: true,
      content: [{ type: "text", text: "Something went wrong" }],
    };
  }

  if (name === "noFixtureTool") {
    return {
      content: [{ type: "text", text: "all good" }],
      structuredContent: { status: "ok" },
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
