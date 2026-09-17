import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const envPath = join(root, ".env");

try {
  const envFile = await readFile(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch {
  // Environment variables may be provided by the hosting platform.
}

const port = Number(process.env.PORT || 3000);
const clientId = process.env.LINKEDIN_CLIENT_ID;
const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `http://localhost:${port}/auth/linkedin/callback`;
const companyPageUrl = process.env.LINKEDIN_COMPANY_PAGE_URL || "https://www.linkedin.com/company/rafaella-guimar%C3%A3es-data-technology";
const scopes = process.env.LINKEDIN_SCOPES || "openid profile email";
const pendingStates = new Map();
const profilePath = join(root, "data", "linkedin-profile.json");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType });
  response.end(body);
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function requireConfig(response) {
  if (clientId && clientSecret) return true;
  send(response, 500, "Configure LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env before connecting.");
  return false;
}

async function handleLinkedInCallback(url, response) {
  const error = url.searchParams.get("error");
  if (error) {
    send(response, 400, `LinkedIn authorization was not completed: ${error}`);
    return;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = state && pendingStates.get(state);
  pendingStates.delete(state);

  if (!code || !expectedState || expectedState.expiresAt < Date.now()) {
    send(response, 400, "Invalid or expired LinkedIn OAuth state.");
    return;
  }

  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    send(response, 502, `LinkedIn token exchange failed: ${await tokenResponse.text()}`);
    return;
  }

  const token = await tokenResponse.json();
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (!profileResponse.ok) {
    send(response, 502, `LinkedIn profile request failed: ${await profileResponse.text()}`);
    return;
  }

  const profile = await profileResponse.json();
  await writeFile(profilePath, JSON.stringify({
    syncedAt: new Date().toISOString(),
    companyPageUrl,
    profile,
  }, null, 2));

  redirect(response, "/?linkedin=connected");
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requestedPath).replace(/^([.][.][/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    send(response, 200, body, mimeTypes[extname(filePath)] || "application/octet-stream");
  } catch {
    send(response, 404, "Not found");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname === "/auth/linkedin") {
      if (!requireConfig(response)) return;
      const state = randomBytes(24).toString("hex");
      pendingStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });
      const authorizationUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
      authorizationUrl.search = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: scopes,
      });
      redirect(response, authorizationUrl.toString());
      return;
    }

    if (url.pathname === "/auth/linkedin/callback") {
      if (!requireConfig(response)) return;
      await handleLinkedInCallback(url, response);
      return;
    }

    if (url.pathname === "/api/linkedin-profile") {
      try {
        const profile = await readFile(profilePath, "utf8");
        send(response, 200, profile, "application/json; charset=utf-8");
      } catch {
        send(response, 404, JSON.stringify({ connected: false }), "application/json; charset=utf-8");
      }
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    send(response, 500, "Unexpected server error.");
  }
});

server.listen(port, () => {
  console.log(`Portfolio running at http://localhost:${port}`);
  console.log(`LinkedIn company page: ${companyPageUrl}`);
});
