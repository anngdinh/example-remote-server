import { Response } from "express";
import { UpstreamProvider, UpstreamUser } from "./types.js";

/**
 * Google as an upstream identity provider (OAuth 2.0 + OpenID Connect).
 *
 * Setup: create an OAuth client at https://console.cloud.google.com/apis/credentials
 * (type "Web application"), add `${BASE_URI}/upstream/google/callback` as an
 * authorized redirect URI, then set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
 */
export class GoogleProvider implements UpstreamProvider {
  readonly slug = "google";
  readonly displayName = "Google";

  private get clientId() {
    return process.env.GOOGLE_CLIENT_ID;
  }
  private get clientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET;
  }

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  startAuthorization({ res, state, callbackUri }: { res: Response; state: string; callbackUri: string }): void {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.clientId!);
    url.searchParams.set("redirect_uri", callbackUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email");
    url.searchParams.set("state", state);
    res.redirect(url.toString());
  }

  async exchangeCodeForUser({ code, callbackUri }: { code: string; callbackUri: string }): Promise<UpstreamUser> {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: callbackUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
    };

    // Derive a stable user id from the OIDC userinfo endpoint (`sub`).
    const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new Error(`Google userinfo failed: ${userInfoRes.status} ${await userInfoRes.text()}`);
    }

    const userInfo = (await userInfoRes.json()) as { sub: string; email?: string };

    return {
      userId: `google:${userInfo.sub}`,
      upstreamAccessToken: tokens.access_token,
      upstreamRefreshToken: tokens.refresh_token,
    };
  }
}
