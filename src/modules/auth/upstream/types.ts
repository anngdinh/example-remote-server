import { Request, Response } from "express";

/**
 * Result of authenticating a user with an upstream identity provider.
 */
export interface UpstreamUser {
  /** Stable unique identifier for the user from the upstream provider */
  userId: string;
  /** Email of the user, if the provider supplies one */
  email?: string;
  /** Access token issued by the upstream provider */
  upstreamAccessToken: string;
  /** Refresh token issued by the upstream provider (if any) */
  upstreamRefreshToken?: string;
}

/**
 * An upstream identity provider (Google, GitHub, mock, ...).
 *
 * The MCP OAuth server delegates *user authentication* to one of these.
 * Each provider knows how to send the user to its login page and how to turn
 * the returned authorization code into a stable user identity.
 */
export interface UpstreamProvider {
  /** URL slug, e.g. 'google' | 'github' | 'mock' */
  readonly slug: string;
  /** Human-readable name shown on the consent page, e.g. 'Google' */
  readonly displayName: string;

  /** Whether this provider has the credentials it needs to be used. */
  isConfigured(): boolean;

  /**
   * Send the user to the provider's login page.
   *
   * `state` is the MCP authorization code (used to correlate the callback with
   * the pending authorization). `callbackUri` is the absolute URL the provider
   * must redirect back to after login.
   *
   * Providers that redirect to a real IdP should call `res.redirect(...)`.
   * The mock provider renders its own HTML user-picker page instead.
   */
  startAuthorization(args: {
    req: Request;
    res: Response;
    state: string;
    callbackUri: string;
  }): Promise<void> | void;

  /**
   * Exchange the authorization code returned on the callback for a stable user
   * identity. `callbackUri` must match the one used in startAuthorization.
   */
  exchangeCodeForUser(args: {
    req: Request;
    code: string;
    callbackUri: string;
  }): Promise<UpstreamUser>;
}
