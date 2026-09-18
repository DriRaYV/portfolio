import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 3000);

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
    await serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    send(response, 500, "Unexpected server error.");
  }
});

server.listen(port, () => {
  console.log(`Portfolio running at http://localhost:${port}`);
});
