import {
  INQUIRY_STATUSES,
  STOCK_STATUSES,
  buildSeed,
  createStore as createStoreCore,
  getDateKey,
  haversineDistanceMeters,
  normalizeText,
} from "../public/store-core.js";

export { INQUIRY_STATUSES, STOCK_STATUSES, buildSeed, getDateKey, haversineDistanceMeters, normalizeText };

export function createStore(options = {}) {
  return createStoreCore({
    ...options,
    uuid: options.uuid ?? (() => crypto.randomUUID()),
  });
}

export const store = createStore();
