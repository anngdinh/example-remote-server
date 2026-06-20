import { Response } from "express";
import { UpstreamProvider, UpstreamUser } from "./types.js";

/**
 * GitHub as an upstream identity provider (OAuth 2.0).
 *
 * Setup: create an OAuth app at https://github.com/settings/developers, set the
 * authorization callback URL to `${BASE_URI}/upstream/github/callback`, then set
 * GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.
 */
export class GitHubProvider implements UpstreamProvider {
  readonly slug = "github";
  readonly displayName = "GitHub";

  private get clientId() {
    return process.env.GITHUB_CLIENT_ID;
  }
  private get clientSecret() {
    return process.env.GITHUB_CLIENT_SECRET;
  }

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  startAuthorization({ res, state, callbackUri }: { res: Response; state: string; callbackUri: string }): void {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", this.clientId!);
    url.searchParams.set("redirect_uri", callbackUri);
    url.searchParams.set("scope", "read:user");
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  }

  async exchangeCodeForUser({ code, callbackUri }: { code: string; callbackUri: string }): Promise<UpstreamUser> {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: callbackUri,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    }

    const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokens.access_token) {
      throw new Error(`GitHub token exchange failed: ${tokens.error || "no access_token"}`);
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userRes.ok) {
      throw new Error(`GitHub user lookup failed: ${userRes.status} ${await userRes.text()}`);
    }

    const user = (await userRes.json()) as { id: number };

    return {
      userId: `github:${user.id}`,
      upstreamAccessToken: tokens.access_token,
    };
  }
}
