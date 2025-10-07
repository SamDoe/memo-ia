import http from 'node:http';
import { WebSocketServer } from 'ws';
import type { WebSocket, RawData } from 'ws';
import { z } from 'zod';
import { tools } from './tools.js';
import pkg from '../../package.json' assert { type: 'json' };

const appName = pkg.name ?? 'memo-ia';
const appVersion = pkg.version ?? '0.1.0';

const host = process.env.MCP_HOST || '0.0.0.0';
const port = parseInt(process.env.MCP_PORT || '9090', 10);

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (socket: WebSocket) => {
  socket.on('message', async (data: RawData) => {
    let message: any;
    try {
      message = JSON.parse(data.toString());
    } catch {
      socket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Invalid JSON' },
        })
      );
      return;
    }

    const { id, method, params } = message;

    if (method === 'initialize') {
      socket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-05-24',
            serverInfo: { name: appName, version: appVersion },
            capabilities: {
              tools: {
                list: true,
                call: true,
              },
            },
          },
        })
      );
      socket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/ready',
          params: {},
        })
      );
      return;
    }

    if (method === 'tools/list') {
      socket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.jsonSchema,
            })),
          },
        })
      );
      return;
    }

    if (method === 'tools/call') {
      const schema = z.object({
        name: z.string(),
        arguments: z.record(z.any()).optional(),
      });
      const parsedParams = schema.safeParse(params);
      if (!parsedParams.success) {
        socket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Invalid params',
              data: parsedParams.error.flatten(),
            },
          })
        );
        return;
      }
      const { name, arguments: args = {} } = parsedParams.data;
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        socket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Unknown tool ${name}`,
            },
          })
        );
        return;
      }

      const validated = tool.schema.safeParse(args);
      if (!validated.success) {
        socket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Tool argument validation failed',
              data: validated.error.flatten(),
            },
          })
        );
        return;
      }

      try {
        const result = await tool.handler(validated.data);
        socket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              content: result.content,
              data: result.data ?? null,
            },
          })
        );
      } catch (err: any) {
        socket.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: err?.message || 'Tool execution failed',
            },
          })
        );
      }
      return;
    }

    if (method === 'shutdown') {
      socket.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: null,
        })
      );
      socket.close();
      return;
    }

    socket.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown method ${method}`,
        },
      })
    );
  });
});

server.listen(port, host, () => {
  console.log(`MemoIA MCP server listening on ws://${host}:${port}`);
});
