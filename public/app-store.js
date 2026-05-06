import { buildSeed, createStore, getDateKey } from "./store-core.js";

const STORAGE_KEY = "camdianse-static-store";

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    return JSON.parse(raw);
  }
  return buildSeed(getDateKey());
}

let store = createStore({ initialState: loadState() });

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store.dumpState()));
}

function rebuildStore() {
  store = createStore({ initialState: loadState() });
  return store;
}

function withPersistence(callback) {
  const value = callback();
  persist();
  return value;
}

function parseBody(options) {
  if (!options?.body) {
    return {};
  }
  return JSON.parse(options.body);
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

export function resetDemoStore() {
  localStorage.removeItem(STORAGE_KEY);
  store = createStore({ initialState: loadState() });
}

export async function request(url, options = {}) {
  const parsedUrl = new URL(url, window.location.href);
  const pathname = parsedUrl.pathname;
  const method = (options.method ?? "GET").toUpperCase();
  rebuildStore();

  try {
    if (method === "GET" && pathname.endsWith("/api/meta")) {
      return store.getMeta();
    }

    if (method === "GET" && pathname.endsWith("/api/search")) {
      return store.searchCatalog(parsedUrl.searchParams.get("q") ?? "");
    }

    if (method === "GET" && pathname.endsWith("/api/pharmacies/nearby")) {
      return store.getNearbyPharmacies({
        productId: parsedUrl.searchParams.get("productId"),
        lat: Number(parsedUrl.searchParams.get("lat")),
        lng: Number(parsedUrl.searchParams.get("lng")),
        radiusMeters: Number(parsedUrl.searchParams.get("radiusMeters") ?? 1000),
      });
    }

    if (method === "GET" && pathname.endsWith("/api/notifications")) {
      return store.getNotificationFeed({
        role: parsedUrl.searchParams.get("role")?.toUpperCase(),
        pharmacyId: parsedUrl.searchParams.get("pharmacyId") ?? undefined,
        inquiryId: parsedUrl.searchParams.get("inquiryId") ?? undefined,
      });
    }

    if (method === "GET" && pathname.endsWith("/api/pharmacist/dashboard")) {
      return store.getPharmacistDashboard(parsedUrl.searchParams.get("pharmacyId"));
    }

    let params = routeMatch(pathname, "/api/pharmacies/:pharmacyId/catalog");
    if (method === "GET" && params) {
      return store.getPharmacyCatalog(params.pharmacyId);
    }

    params = routeMatch(pathname, "/api/pharmacies/:pharmacyId/profile");
    if (method === "GET" && params) {
      return store.getPharmacyProfile(params.pharmacyId);
    }
    if (method === "PATCH" && params) {
      return withPersistence(() => store.updatePharmacyProfile(params.pharmacyId, parseBody(options)));
    }

    if (method === "POST" && pathname.endsWith("/api/pharmacy-status")) {
      return withPersistence(() => store.updatePharmacyProductStatus(parseBody(options)));
    }

    if (method === "POST" && pathname.endsWith("/api/inquiries")) {
      return withPersistence(() => store.createInquiry(parseBody(options)));
    }

    params = routeMatch(pathname, "/api/inquiries/:inquiryId");
    if (method === "GET" && params) {
      return store.getInquiry(params.inquiryId);
    }

    params = routeMatch(pathname, "/api/inquiries/:inquiryId/status");
    if (method === "PATCH" && params) {
      return withPersistence(() =>
        store.transitionInquiry(params.inquiryId, parseBody(options).status),
      );
    }
  } catch (error) {
    throw new Error(error.message);
  }

  throw new Error(`Unknown static API route: ${method} ${pathname}`);
}
