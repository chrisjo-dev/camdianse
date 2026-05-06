import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { store } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

async function parseBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

async function serveFile(response, filePath) {
  try {
    const content = await readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, { "content-type": mimeTypes[extension] ?? "application/octet-stream" });
    response.end(content);
  } catch {
    sendError(response, 404, "Not found");
  }
}

function routeMatch(pathname, pattern) {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const { pathname, searchParams } = url;

  try {
    if (request.method === "GET" && pathname === "/api/meta") {
      return sendJson(response, 200, store.getMeta());
    }

    if (request.method === "GET" && pathname === "/api/config") {
      return sendJson(response, 200, {
        googleMapsApiKey,
      });
    }

    if (request.method === "GET" && pathname === "/api/search") {
      return sendJson(response, 200, store.searchCatalog(searchParams.get("q") ?? ""));
    }

    if (request.method === "GET" && pathname === "/api/pharmacies/nearby") {
      return sendJson(
        response,
        200,
        store.getNearbyPharmacies({
          productId: searchParams.get("productId"),
          lat: Number(searchParams.get("lat")),
          lng: Number(searchParams.get("lng")),
          radiusMeters: Number(searchParams.get("radiusMeters") ?? 1000),
        }),
      );
    }

    if (request.method === "GET" && pathname === "/api/notifications") {
      return sendJson(
        response,
        200,
        store.getNotificationFeed({
          role: searchParams.get("role")?.toUpperCase(),
          pharmacyId: searchParams.get("pharmacyId") ?? undefined,
          inquiryId: searchParams.get("inquiryId") ?? undefined,
        }),
      );
    }

    if (request.method === "GET" && pathname === "/api/pharmacist/dashboard") {
      return sendJson(response, 200, store.getPharmacistDashboard(searchParams.get("pharmacyId")));
    }

    let params = routeMatch(pathname, "/api/pharmacies/:pharmacyId/catalog");
    if (request.method === "GET" && params) {
      return sendJson(response, 200, store.getPharmacyCatalog(params.pharmacyId));
    }

    params = routeMatch(pathname, "/api/pharmacies/:pharmacyId/profile");
    if (request.method === "GET" && params) {
      return sendJson(response, 200, store.getPharmacyProfile(params.pharmacyId));
    }

    if (request.method === "PATCH" && params) {
      const body = await parseBody(request);
      return sendJson(response, 200, store.updatePharmacyProfile(params.pharmacyId, body));
    }

    if (request.method === "POST" && pathname === "/api/pharmacy-status") {
      const body = await parseBody(request);
      return sendJson(response, 200, store.updatePharmacyProductStatus(body));
    }

    if (request.method === "POST" && pathname === "/api/inquiries") {
      const body = await parseBody(request);
      return sendJson(response, 201, store.createInquiry(body));
    }

    params = routeMatch(pathname, "/api/inquiries/:inquiryId");
    if (request.method === "GET" && params) {
      return sendJson(response, 200, store.getInquiry(params.inquiryId));
    }

    params = routeMatch(pathname, "/api/inquiries/:inquiryId/status");
    if (request.method === "PATCH" && params) {
      const body = await parseBody(request);
      return sendJson(response, 200, store.transitionInquiry(params.inquiryId, body.status));
    }

    if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      return serveFile(response, path.join(publicDir, "index.html"));
    }

    if (request.method === "GET" && pathname === "/pharmacist") {
      return serveFile(response, path.join(publicDir, "pharmacist", "index.html"));
    }

    const safePath = path.normalize(path.join(publicDir, pathname));
    if (!safePath.startsWith(publicDir)) {
      return sendError(response, 403, "Forbidden");
    }

    return serveFile(response, safePath);
  } catch (error) {
    return sendError(response, 400, error.message);
  }
});

server.listen(port, host, () => {
  console.log(`Cambodia Pharmacy Finder MVP running at http://${host}:${port}`);
});
