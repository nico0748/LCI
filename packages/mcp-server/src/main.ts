import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { configFromEnv, createServer } from "./server.ts";

// stdio サーバ: stdout は JSON-RPC 専用なのでログは必ず stderr に出す
const cfg = configFromEnv();
const server = createServer(cfg);
await server.connect(new StdioServerTransport());
console.error(`[lci-mcp] ready data=${cfg.dataRoot} problems=${cfg.problemsRoot}`);
