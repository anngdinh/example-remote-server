/**
 * MyInfo Module - A minimal authenticated MCP server
 *
 * Demonstrates option A: a second MCP server that reuses the SAME OAuth server
 * (shared token) as the main /mcp endpoint. It mounts at /myinfo/mcp behind the
 * same bearer-auth middleware, so any valid MCP access token works here too.
 *
 * It exposes a single tool, getMyInfo, which returns the authenticated user's
 * email and id from the access token, or an empty result if unavailable.
 */

import { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { BearerAuthMiddlewareOptions, requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { ITokenValidator } from '../../interfaces/auth-validator.js';

export interface MyInfoConfig {
  baseUri: string;
}

function createMyInfoServer(): McpServer {
  const server = new McpServer({ name: 'myinfo', version: '1.0.0' });

  server.registerTool(
    'getMyInfo',
    {
      description:
        "Returns the authenticated user's email and id from the access token. Returns empty values if unavailable.",
      inputSchema: {},
    },
    async (_args, extra) => {
      const { userId, email } = (extra.authInfo?.extra ?? {}) as {
        userId?: string;
        email?: string;
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ id: userId ?? '', email: email ?? '' }),
          },
        ],
      };
    }
  );

  return server;
}

export class MyInfoModule {
  private router: Router;

  constructor(
    private config: MyInfoConfig,
    private tokenValidator: ITokenValidator
  ) {
    this.router = this.setupRouter();
  }

  getRouter(): Router {
    return this.router;
  }

  private setupRouter(): Router {
    const router = Router();

    // Intentionally permissive CORS, matching the other MCP endpoints
    const corsOptions = {
      origin: true,
      methods: ['GET', 'POST', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Protocol-Version', 'Mcp-Protocol-Id', 'Mcp-Session-Id'],
      exposedHeaders: ['Mcp-Protocol-Version', 'Mcp-Protocol-Id', 'Mcp-Session-Id'],
      credentials: true,
    };

    const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      next();
    };

    // Same bearer auth as the main MCP server -> shared OAuth/token (option A)
    const bearerAuthOptions: BearerAuthMiddlewareOptions = {
      verifier: this.tokenValidator,
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(this.config.baseUri)),
    };
    const bearerAuth = requireBearerAuth(bearerAuthOptions);

    // Stateless: a fresh server/transport per request (like the example apps)
    const handleMcp = async (req: Request, res: Response) => {
      try {
        const server = createMyInfoServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        res.on('close', () => {
          transport.close();
          server.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MyInfo MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' },
            id: null,
          });
        }
      }
    };

    router.get('/myinfo/mcp', cors(corsOptions), bearerAuth, securityHeaders, handleMcp);
    router.post('/myinfo/mcp', cors(corsOptions), bearerAuth, securityHeaders, handleMcp);
    router.delete('/myinfo/mcp', cors(corsOptions), bearerAuth, securityHeaders, handleMcp);

    return router;
  }
}
