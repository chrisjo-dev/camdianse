import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store.js";

test("search returns ingredient groups for acetaminophen", () => {
  const testStore = createStore();
  const payload = testStore.searchCatalog("acetaminophen");
  const ingredientMatch = payload.results.find((entry) => entry.type === "INGREDIENT_MATCH");

  assert.ok(ingredientMatch);
  assert.equal(ingredientMatch.ingredient.name, "Acetaminophen");
  assert.ok(ingredientMatch.products.length >= 2);
});

test("direct product search returns product match", () => {
  const testStore = createStore();
  const payload = testStore.searchCatalog("advil");
  const productMatch = payload.results.find((entry) => entry.type === "PRODUCT_MATCH");

  assert.ok(productMatch);
  assert.equal(productMatch.product.localBrandName, "Advil");
});

test("nearby pharmacy filtering excludes red and stale entries", () => {
  const testStore = createStore();
  testStore.updatePharmacyProductStatus({
    pharmacyId: "pharm-riverside",
    productId: "prd-panadol-500",
    status: "GREEN",
    updatedAt: "2020-01-01T08:00:00.000Z",
  });

  const payload = testStore.getNearbyPharmacies({
    productId: "prd-panadol-500",
    lat: 11.5564,
    lng: 104.9282,
    radiusMeters: 3000,
  });

  assert.ok(payload.pharmacies.every((entry) => entry.stockStatus !== "RED"));
  assert.ok(payload.pharmacies.every((entry) => entry.pharmacyId !== "pharm-riverside"));
});

test("creating an inquiry initializes notification flow", () => {
  const testStore = createStore();
  const inquiry = testStore.createInquiry({
    productId: "prd-panadol-500",
    pharmacyId: "pharm-bkk1",
    userLocation: { lat: 11.5564, lng: 104.9282 },
    note: "Need pickup this evening",
  });

  assert.equal(inquiry.status, "NEW");
  const pharmacistFeed = testStore.getNotificationFeed({
    role: "PHARMACIST",
    pharmacyId: "pharm-bkk1",
  });
  assert.equal(pharmacistFeed.badgeCount, 1);
  assert.ok(pharmacistFeed.notifications.length > 0);
});

test("pharmacist can move inquiry from checking to ready", () => {
  const testStore = createStore();
  const inquiry = testStore.createInquiry({
    productId: "prd-panadol-500",
    pharmacyId: "pharm-aeon",
    userLocation: { lat: 11.5564, lng: 104.9282 },
  });

  testStore.transitionInquiry(inquiry.id, "CHECKING");
  const readyInquiry = testStore.transitionInquiry(inquiry.id, "READY");

  assert.equal(readyInquiry.status, "READY");
  assert.equal(readyInquiry.timeline[0].status, "READY");
});
