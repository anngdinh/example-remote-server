import { Request, Response } from "express";
import { UpstreamProvider, UpstreamUser } from "./types.js";

/**
 * ============================================================================
 * MOCK UPSTREAM IDENTITY PROVIDER - FOR DEMONSTRATION ONLY
 * ============================================================================
 *
 * Simulates delegating user authentication to an external IdP without needing
 * real credentials. It renders a user-picker page; in production you would use
 * a real provider (Google, GitHub, corporate SSO) instead.
 *
 * Always available so demos and the e2e tests work without configuring secrets.
 * ============================================================================
 */
export class MockProvider implements UpstreamProvider {
  readonly slug = "mock";
  readonly displayName = "Mock IdP";

  isConfigured(): boolean {
    return true;
  }

  startAuthorization({ res, state, callbackUri }: { res: Response; state: string; callbackUri: string }): void {
    // Set a permissive CSP for auth pages to allow inline styles and scripts
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'"
    ].join('; '));

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Upstream Provider Authentication</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          .auth-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 40px;
            max-width: 480px;
            width: 100%;
            text-align: center;
          }

          .logo {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 16px;
            margin: 0 auto 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: white;
          }

          h1 {
            color: #1a202c;
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .subtitle {
            color: #718096;
            font-size: 16px;
            margin-bottom: 32px;
          }

          .user-section {
            background: #f7fafc;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
            border: 2px solid #e2e8f0;
          }

          .user-section h3 {
            color: #2d3748;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
          }

          .user-id-display {
            background: white;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: #4a5568;
            margin-bottom: 16px;
            word-break: break-all;
          }

          .user-actions {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }

          .btn {
            flex: 1;
            min-width: 120px;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .btn-secondary {
            background: #e2e8f0;
            color: #4a5568;
          }

          .btn-secondary:hover {
            background: #cbd5e0;
          }

          .btn-primary {
            background: linear-gradient(135deg, #4299e1, #3182ce);
            color: white;
            font-size: 16px;
            padding: 16px 32px;
            margin-top: 16px;
            width: 100%;
          }

          .btn-primary:hover {
            background: linear-gradient(135deg, #3182ce, #2c5282);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
          }

          .help-text {
            color: #718096;
            font-size: 14px;
            margin-top: 24px;
            line-height: 1.5;
          }

          .help-text strong {
            color: #4a5568;
          }
        </style>
      </head>
      <body>
        <div class="auth-container">
          <div class="logo">🔒</div>
          <h1>Upstream Authentication</h1>
          <p class="subtitle">Please verify your identity with the upstream provider</p>

          <div class="user-section">
            <h3>Your User Identity</h3>
            <div class="user-id-display" id="userIdDisplay">Loading...</div>
            <div class="user-actions">
              <button class="btn btn-secondary" onclick="generateNewUserId()">Generate New ID</button>
              <button class="btn btn-secondary" onclick="editUserId()">Edit ID</button>
            </div>
          </div>

          <button class="btn btn-primary" onclick="authorize()">
            Complete Authentication
          </button>

          <div class="help-text">
            <strong>Testing Multiple Users:</strong> Open this page in different browser windows or incognito tabs to simulate different users. Each will have their own unique User ID and separate MCP sessions.
          </div>
        </div>

        <script>
          // Generate UUID v4
          function generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
          }

          // Get or create user ID
          function getUserId() {
            let userId = localStorage.getItem('mcpUserId');
            if (!userId) {
              userId = generateUUID();
              localStorage.setItem('mcpUserId', userId);
            }
            return userId;
          }

          // Update the display
          function updateDisplay() {
            const userId = getUserId();
            document.getElementById('userIdDisplay').textContent = userId;
          }

          // Generate new user ID
          function generateNewUserId() {
            const newId = generateUUID();
            localStorage.setItem('mcpUserId', newId);
            updateDisplay();
          }

          // Edit user ID
          function editUserId() {
            const currentId = getUserId();
            const newId = prompt('Enter new User ID:', currentId);
            if (newId && newId.trim()) {
              localStorage.setItem('mcpUserId', newId.trim());
              updateDisplay();
            }
          }

          // Authorize with current user ID
          function authorize() {
            const userId = getUserId();
            // Handle relative URLs by making them absolute
            const redirectUri = '${callbackUri}';
            const baseUrl = redirectUri.startsWith('http') ? redirectUri : window.location.origin + redirectUri;
            const url = new URL(baseUrl);
            url.searchParams.set('state', '${state}');
            url.searchParams.set('code', 'mock-auth-code');
            url.searchParams.set('userId', userId);
            window.location.href = url.toString();
          }

          // Initialize on page load
          updateDisplay();
        </script>
      </body>
    </html>
  `);
  }

  async exchangeCodeForUser({ req, code }: { req: Request; code: string }): Promise<UpstreamUser> {
    // The mock "exchange" just echoes the code and reads the user id chosen on
    // the picker page (passed through as a query param on the callback).
    const userId = (req.query.userId as string) || "anonymous-user";
    return {
      userId,
      upstreamAccessToken: `${code}-exchanged-for-access-token`,
      upstreamRefreshToken: `${code}-exchanged-for-refresh-token`,
    };
  }
}
