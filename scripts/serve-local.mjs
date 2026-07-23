import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(scriptDirectory, "..", "docs");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 8765);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function resolvePublicPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${host}`).pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = path.resolve(publicDirectory, relativePath);

  if (candidate !== publicDirectory && !candidate.startsWith(`${publicDirectory}${path.sep}`)) {
    return null;
  }

  return candidate;
}

const server = createServer(async (request, response) => {
  let filePath = resolvePublicPath(request.url || "/");

  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    let fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      fileStat = await stat(filePath);
    }
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Local course site: http://${host}:${port}/`);
});
