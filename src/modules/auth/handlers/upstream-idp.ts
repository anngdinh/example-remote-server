import { Request, Response } from "express";
import { generateMcpTokens, readPendingAuthorization, saveMcpInstallation, saveRefreshToken, saveTokenExchange } from "../services/auth.js";
import { McpInstallation } from "../types.js";
import { getProvider } from "../upstream/registry.js";
import { logger } from "../../shared/logger.js";

/**
 * Build the absolute callback URI for a provider, based on the incoming request.
 * Must match the redirect URI registered with the upstream provider.
 */
function callbackUriFor(req: Request, slug: string): string {
  return `${req.protocol}://${req.get("host")}/upstream/${slug}/callback`;
}

/**
 * GET /upstream/:provider/authorize
 * Hands the user off to the chosen upstream identity provider.
 * `state` is the MCP authorization code created in provider.authorize().
 */
export async function handleUpstreamAuthorize(req: Request, res: Response) {
  const slug = req.params.provider;
  const provider = getProvider(slug);

  if (!provider || !provider.isConfigured()) {
    res.status(404).send(`Unknown or unconfigured provider: ${slug}`);
    return;
  }

  const state = req.query.state as string;
  if (!state) {
    res.status(400).send("Missing state");
    return;
  }

  await provider.startAuthorization({
    req,
    res,
    state,
    callbackUri: callbackUriFor(req, slug),
  });
}

/**
 * GET /upstream/:provider/callback
 * Exchanges the upstream authorization code for a user identity, then issues
 * MCP tokens and redirects back to the MCP client.
 */
export async function handleUpstreamCallback(req: Request, res: Response) {
  const slug = req.params.provider;
  const provider = getProvider(slug);

  if (!provider || !provider.isConfigured()) {
    res.status(404).send(`Unknown or unconfigured provider: ${slug}`);
    return;
  }

  // The `state` returned by the upstream provider is the MCP authorization code.
  const mcpAuthorizationCode = req.query.state as string;
  const upstreamCode = req.query.code as string;

  if (typeof mcpAuthorizationCode !== "string") {
    throw new Error("Invalid authorization code");
  }

  const upstreamUser = await provider.exchangeCodeForUser({
    req,
    code: upstreamCode,
    callbackUri: callbackUriFor(req, slug),
  });

  const pendingAuth = await readPendingAuthorization(mcpAuthorizationCode);
  logger.debug("Reading pending authorization", {
    mcpAuthorizationCode: mcpAuthorizationCode.substring(0, 8) + "...",
    found: !!pendingAuth,
    provider: slug,
  });

  if (!pendingAuth) {
    throw new Error("No matching authorization found");
  }

  const mcpTokens = generateMcpTokens();

  const mcpInstallation: McpInstallation = {
    mockUpstreamInstallation: {
      mockUpstreamAccessToken: upstreamUser.upstreamAccessToken,
      mockUpstreamRefreshToken: upstreamUser.upstreamRefreshToken || "",
    },
    provider: slug,
    mcpTokens,
    clientId: pendingAuth.clientId,
    issuedAt: Date.now() / 1000,
    userId: upstreamUser.userId,
  };

  await saveMcpInstallation(mcpTokens.access_token, mcpInstallation);

  if (mcpTokens.refresh_token) {
    await saveRefreshToken(mcpTokens.refresh_token, mcpTokens.access_token);
  }

  await saveTokenExchange(mcpAuthorizationCode, {
    mcpAccessToken: mcpTokens.access_token,
    alreadyUsed: false,
  });

  // Redirect back to the MCP client with the authorization code and state.
  const redirectUrl = pendingAuth.state
    ? `${pendingAuth.redirectUri}?code=${mcpAuthorizationCode}&state=${pendingAuth.state}`
    : `${pendingAuth.redirectUri}?code=${mcpAuthorizationCode}`;

  res.redirect(redirectUrl);
}
