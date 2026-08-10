import { spawn } from "child_process";
import { z } from "zod";

/**
 * Lightweight client connection to an MCP (Model Context Protocol) stdio server
 */
export class McpStdioClient {
  constructor({ command, args = [], env = {} }) {
    this.command = command;
    this.args = args;
    this.env = env;
    this.process = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          env: { ...process.env, ...this.env },
          stdio: ["pipe", "pipe", "pipe"],
        });

        let buffer = "";
        this.process.stdout.on("data", (chunk) => {
          buffer += chunk.toString("utf8");
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.id && this.pendingRequests.has(msg.id)) {
                const { resolve: res, reject: rej } = this.pendingRequests.get(msg.id);
                this.pendingRequests.delete(msg.id);
                if (msg.error) rej(new Error(msg.error.message || "MCP RPC Error"));
                else res(msg.result);
              }
            } catch {
              // Ignore non-JSON output on stdio
            }
          }
        });

        this.process.on("error", (err) => reject(err));
        
        // Handshake: send initialize request
        this.sendRequest("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "codeagent", version: "0.1.0" },
        })
          .then((res) => {
            // Send initialized notification
            this.sendNotification("notifications/initialized");
            resolve(res);
          })
          .catch((err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }

  sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin.writable) {
        return reject(new Error("MCP process is not connected."));
      }

      const id = this.requestId++;
      this.pendingRequests.set(id, { resolve, reject });

      const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
      this.process.stdin.write(payload);
    });
  }

  sendNotification(method, params = {}) {
    if (this.process && this.process.stdin.writable) {
      const payload = JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n";
      this.process.stdin.write(payload);
    }
  }

  async listTools() {
    const result = await this.sendRequest("tools/list", {});
    return result?.tools || [];
  }

  async callTool(name, args) {
    const result = await this.sendRequest("tools/call", { name, arguments: args });
    return result;
  }

  close() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

/**
 * Converts an MCP tool definition into a codeagent tool object
 * 
 * @param {string} serverName 
 * @param {{ name: string, description?: string, inputSchema?: object }} mcpTool 
 * @param {McpStdioClient} client 
 * @returns {object} Codeagent tool object
 */
export function convertMcpToolToCodeagentTool(serverName, mcpTool, client) {
  const toolName = `${serverName}_${mcpTool.name}`;

  return {
    name: toolName,
    description: `[MCP: ${serverName}] ${mcpTool.description || mcpTool.name}`,
    destructive: true, // Safety default: MCP external tool calls require safety gate unless overridden
    parameters: z.object({}).passthrough(), // Dynamic schema passthrough for MCP JSON schema
    async execute(input) {
      const result = await client.callTool(mcpTool.name, input);
      if (result?.content) {
        return result.content
          .map((item) => (item.type === "text" ? item.text : JSON.stringify(item)))
          .join("\n");
      }
      return JSON.stringify(result);
    },
  };
}
