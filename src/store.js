import { randomUUID } from "node:crypto";

export const STOCK_STATUSES = ["GREEN", "YELLOW", "RED"];
export const INQUIRY_STATUSES = ["NEW", "CHECKING", "READY", "UNAVAILABLE", "EXPIRED"];
const ACTIVE_STOCK_STATUSES = new Set(["GREEN", "YELLOW"]);
const TRANSITIONS = {
  NEW: new Set(["CHECKING", "EXPIRED"]),
  CHECKING: new Set(["READY", "UNAVAILABLE", "EXPIRED"]),
  READY: new Set(),
  UNAVAILABLE: new Set(),
  EXPIRED: new Set(),
};

export function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function getDateKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildSeed(todayKey) {
  const ingredients = [
    {
      id: "ing-acetaminophen",
      name: "Acetaminophen",
      aliases: ["paracetamol", "acetaminophen", "아세트아미노펜"],
    },
    {
      id: "ing-ibuprofen",
      name: "Ibuprofen",
      aliases: ["ibuprofen", "ibu", "이부프로펜"],
    },
    {
      id: "ing-loperamide",
      name: "Loperamide",
      aliases: ["loperamide", "diarrhea", "로페라마이드"],
    },
  ];

  const products = [
    {
      id: "prd-panadol-500",
      localBrandName: "Panadol",
      englishName: "Panadol Advance",
      ingredientIds: ["ing-acetaminophen"],
      dosageForm: "500 mg tablet",
      packageSize: "10 tablets",
      aliases: ["panadol", "advance", "파나돌"],
    },
    {
      id: "prd-tylenol-500",
      localBrandName: "Tylenol",
      englishName: "Tylenol Extra Strength",
      ingredientIds: ["ing-acetaminophen"],
      dosageForm: "500 mg caplet",
      packageSize: "10 caplets",
      aliases: ["tylenol", "extra strength", "타이레놀"],
    },
    {
      id: "prd-ibuprofen-200",
      localBrandName: "Advil",
      englishName: "Advil",
      ingredientIds: ["ing-ibuprofen"],
      dosageForm: "200 mg tablet",
      packageSize: "12 tablets",
      aliases: ["advil", "ibuprofen", "애드빌"],
    },
    {
      id: "prd-imodium",
      localBrandName: "Imodium",
      englishName: "Imodium",
      ingredientIds: ["ing-loperamide"],
      dosageForm: "2 mg capsule",
      packageSize: "6 capsules",
      aliases: ["imodium", "loperamide"],
    },
  ];

  const pharmacies = [
    {
      id: "pharm-riverside",
      name: "Riverside Care Pharmacy",
      address: "Sisowath Quay, Phnom Penh",
      lat: 11.5657,
      lng: 104.9282,
      hours: "08:00 - 22:00",
    },
    {
      id: "pharm-bkk1",
      name: "BKK1 Health Point",
      address: "Street 308, BKK1, Phnom Penh",
      lat: 11.5508,
      lng: 104.9214,
      hours: "07:30 - 21:30",
    },
    {
      id: "pharm-aeon",
      name: "Aeon Wellness Pharmacy",
      address: "Samdach Sothearos Blvd, Phnom Penh",
      lat: 11.5431,
      lng: 104.9307,
      hours: "09:00 - 21:00",
    },
  ];

  const timestamp = (time) => `${todayKey}T${time}:00.000Z`;

  const pharmacyProductStatuses = [
    {
      pharmacyId: "pharm-riverside",
      productId: "prd-panadol-500",
      status: "GREEN",
      updatedAt: timestamp("06:30"),
    },
    {
      pharmacyId: "pharm-riverside",
      productId: "prd-tylenol-500",
      status: "YELLOW",
      updatedAt: timestamp("06:35"),
    },
    {
      pharmacyId: "pharm-riverside",
      productId: "prd-ibuprofen-200",
      status: "RED",
      updatedAt: timestamp("06:40"),
    },
    {
      pharmacyId: "pharm-bkk1",
      productId: "prd-panadol-500",
      status: "GREEN",
      updatedAt: timestamp("07:10"),
    },
    {
      pharmacyId: "pharm-bkk1",
      productId: "prd-tylenol-500",
      status: "RED",
      updatedAt: timestamp("07:12"),
    },
    {
      pharmacyId: "pharm-bkk1",
      productId: "prd-imodium",
      status: "YELLOW",
      updatedAt: timestamp("07:14"),
    },
    {
      pharmacyId: "pharm-aeon",
      productId: "prd-panadol-500",
      status: "GREEN",
      updatedAt: timestamp("08:10"),
    },
    {
      pharmacyId: "pharm-aeon",
      productId: "prd-tylenol-500",
      status: "GREEN",
      updatedAt: timestamp("08:15"),
    },
    {
      pharmacyId: "pharm-aeon",
      productId: "prd-ibuprofen-200",
      status: "YELLOW",
      updatedAt: timestamp("08:20"),
    },
  ];

  return {
    ingredients,
    products,
    pharmacies,
    pharmacyProductStatuses,
    inquiries: [],
    notifications: [],
  };
}

function buildProductSummary(product, ingredientsById) {
  return {
    id: product.id,
    localBrandName: product.localBrandName,
    englishName: product.englishName,
    dosageForm: product.dosageForm,
    packageSize: product.packageSize,
    aliases: product.aliases,
    ingredients: product.ingredientIds.map((ingredientId) => ingredientsById.get(ingredientId)),
  };
}

export function createStore(options = {}) {
  const todayKey = getDateKey(options.now ?? new Date());
  const state = buildSeed(todayKey);
  const productById = new Map(state.products.map((product) => [product.id, product]));
  const ingredientById = new Map(state.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const pharmacyById = new Map(state.pharmacies.map((pharmacy) => [pharmacy.id, pharmacy]));

  function getStatusRecord(pharmacyId, productId) {
    return state.pharmacyProductStatuses.find(
      (entry) => entry.pharmacyId === pharmacyId && entry.productId === productId,
    );
  }

  function isStatusFresh(entry) {
    return getDateKey(entry.updatedAt) === getDateKey();
  }

  function appendNotification(notification) {
    state.notifications.unshift({
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...notification,
    });
  }

  function getProductSummary(productId) {
    const product = productById.get(productId);
    if (!product) {
      return null;
    }

    return buildProductSummary(product, ingredientById);
  }

  return {
    getMeta() {
      return {
        stockStatuses: STOCK_STATUSES,
        inquiryStatuses: INQUIRY_STATUSES,
        defaultRadiusMeters: 1000,
        launchCity: "Phnom Penh",
      };
    },

    searchCatalog(query) {
      const normalizedQuery = normalizeText(query);
      if (!normalizedQuery) {
        return { query: "", results: [] };
      }

      const ingredientMatches = state.ingredients
        .filter((ingredient) =>
          [ingredient.name, ...ingredient.aliases].some((value) =>
            normalizeText(value).includes(normalizedQuery),
          ),
        )
        .map((ingredient) => {
          const products = state.products
            .filter((product) => product.ingredientIds.includes(ingredient.id))
            .map((product) => buildProductSummary(product, ingredientById));

          return {
            type: "INGREDIENT_MATCH",
            ingredient,
            products,
          };
        });

      const groupedProductIds = new Set(
        ingredientMatches.flatMap((match) => match.products.map((product) => product.id)),
      );

      const directProductMatches = state.products
        .filter((product) =>
          [
            product.localBrandName,
            product.englishName,
            product.dosageForm,
            product.packageSize,
            ...product.aliases,
          ].some((value) => normalizeText(value).includes(normalizedQuery)),
        )
        .filter((product) => !groupedProductIds.has(product.id))
        .map((product) => ({
          type: "PRODUCT_MATCH",
          product: buildProductSummary(product, ingredientById),
        }));

      return {
        query,
        results: [...ingredientMatches, ...directProductMatches],
      };
    },

    getNearbyPharmacies({ productId, lat, lng, radiusMeters = 1000 }) {
      const product = getProductSummary(productId);
      if (!product) {
        throw new Error("Unknown product");
      }

      const entries = state.pharmacyProductStatuses
        .filter((entry) => entry.productId === productId)
        .filter((entry) => ACTIVE_STOCK_STATUSES.has(entry.status))
        .filter((entry) => isStatusFresh(entry))
        .map((entry) => {
          const pharmacy = pharmacyById.get(entry.pharmacyId);
          const distanceMeters = haversineDistanceMeters(lat, lng, pharmacy.lat, pharmacy.lng);
          return {
            pharmacyId: pharmacy.id,
            pharmacyName: pharmacy.name,
            address: pharmacy.address,
            hours: pharmacy.hours,
            lat: pharmacy.lat,
            lng: pharmacy.lng,
            distanceMeters,
            stockStatus: entry.status,
            lastUpdatedAt: entry.updatedAt,
            inquiryAvailable: true,
          };
        })
        .filter((entry) => entry.distanceMeters <= radiusMeters)
        .sort((left, right) => left.distanceMeters - right.distanceMeters);

      return {
        product,
        radiusMeters,
        pharmacies: entries,
      };
    },

    getPharmacyCatalog(pharmacyId) {
      const pharmacy = pharmacyById.get(pharmacyId);
      if (!pharmacy) {
        throw new Error("Unknown pharmacy");
      }

      const catalog = state.pharmacyProductStatuses
        .filter((entry) => entry.pharmacyId === pharmacyId)
        .map((entry) => ({
          pharmacyId,
          product: getProductSummary(entry.productId),
          status: entry.status,
          updatedAt: entry.updatedAt,
          isFresh: isStatusFresh(entry),
        }))
        .sort((left, right) => left.product.localBrandName.localeCompare(right.product.localBrandName));

      return { pharmacy, catalog };
    },

    getPharmacyProfile(pharmacyId) {
      const pharmacy = pharmacyById.get(pharmacyId);
      if (!pharmacy) {
        throw new Error("Unknown pharmacy");
      }

      return pharmacy;
    },

    updatePharmacyProfile(pharmacyId, updates) {
      const pharmacy = pharmacyById.get(pharmacyId);
      if (!pharmacy) {
        throw new Error("Unknown pharmacy");
      }

      Object.assign(pharmacy, {
        name: updates.name ?? pharmacy.name,
        address: updates.address ?? pharmacy.address,
        hours: updates.hours ?? pharmacy.hours,
      });

      return pharmacy;
    },

    updatePharmacyProductStatus({ pharmacyId, productId, status, updatedAt = new Date().toISOString() }) {
      if (!STOCK_STATUSES.includes(status)) {
        throw new Error("Invalid stock status");
      }

      const pharmacy = pharmacyById.get(pharmacyId);
      const product = productById.get(productId);
      if (!pharmacy || !product) {
        throw new Error("Unknown pharmacy or product");
      }

      const record = getStatusRecord(pharmacyId, productId);
      if (record) {
        record.status = status;
        record.updatedAt = updatedAt;
      } else {
        state.pharmacyProductStatuses.push({ pharmacyId, productId, status, updatedAt });
      }

      appendNotification({
        role: "PHARMACIST",
        pharmacyId,
        message: `${product.localBrandName} inventory marked ${status}.`,
      });

      return {
        pharmacyId,
        productId,
        status,
        updatedAt,
      };
    },

    createInquiry({ productId, pharmacyId, userLocation, note = "", contactToken = "" }) {
      const pharmacy = pharmacyById.get(pharmacyId);
      const product = productById.get(productId);
      if (!pharmacy || !product) {
        throw new Error("Unknown pharmacy or product");
      }

      const statusRecord = getStatusRecord(pharmacyId, productId);
      if (!statusRecord || !ACTIVE_STOCK_STATUSES.has(statusRecord.status) || !isStatusFresh(statusRecord)) {
        throw new Error("Selected pharmacy is not currently available for this product");
      }

      const inquiry = {
        id: randomUUID(),
        pharmacyId,
        productId,
        status: "NEW",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userLocationSnapshot: userLocation,
        note,
        contactToken,
        timeline: [
          {
            status: "NEW",
            createdAt: new Date().toISOString(),
            message: "Inquiry created and sent to the pharmacist.",
          },
        ],
      };

      state.inquiries.unshift(inquiry);

      appendNotification({
        role: "PHARMACIST",
        pharmacyId,
        inquiryId: inquiry.id,
        message: `New inquiry for ${product.localBrandName}.`,
      });

      appendNotification({
        role: "USER",
        inquiryId: inquiry.id,
        message: `${pharmacy.name} received your inquiry.`,
      });

      return this.getInquiry(inquiry.id);
    },

    transitionInquiry(inquiryId, nextStatus) {
      if (!INQUIRY_STATUSES.includes(nextStatus)) {
        throw new Error("Invalid inquiry status");
      }

      const inquiry = state.inquiries.find((entry) => entry.id === inquiryId);
      if (!inquiry) {
        throw new Error("Unknown inquiry");
      }

      if (!TRANSITIONS[inquiry.status].has(nextStatus)) {
        throw new Error(`Cannot move inquiry from ${inquiry.status} to ${nextStatus}`);
      }

      inquiry.status = nextStatus;
      inquiry.updatedAt = new Date().toISOString();
      inquiry.timeline.unshift({
        status: nextStatus,
        createdAt: inquiry.updatedAt,
        message:
          nextStatus === "CHECKING"
            ? "Pharmacist is checking the product."
            : nextStatus === "READY"
              ? "Product is ready for pickup."
              : nextStatus === "UNAVAILABLE"
                ? "Product is unavailable at this pharmacy."
                : "Inquiry expired.",
      });

      const pharmacy = pharmacyById.get(inquiry.pharmacyId);
      const product = productById.get(inquiry.productId);
      appendNotification({
        role: "USER",
        inquiryId,
        message: `${pharmacy.name} updated ${product.localBrandName} to ${nextStatus}.`,
      });

      return this.getInquiry(inquiryId);
    },

    getInquiry(inquiryId) {
      const inquiry = state.inquiries.find((entry) => entry.id === inquiryId);
      if (!inquiry) {
        throw new Error("Unknown inquiry");
      }

      const pharmacy = pharmacyById.get(inquiry.pharmacyId);
      const product = getProductSummary(inquiry.productId);
      return {
        ...inquiry,
        pharmacy,
        product,
      };
    },

    getNotificationFeed({ role, pharmacyId, inquiryId }) {
      const notifications = state.notifications.filter((notification) => {
        if (role === "PHARMACIST") {
          return notification.role === "PHARMACIST" && notification.pharmacyId === pharmacyId;
        }

        return notification.role === "USER" && notification.inquiryId === inquiryId;
      });

      const badgeCount =
        role === "PHARMACIST"
          ? state.inquiries.filter((entry) => entry.pharmacyId === pharmacyId && entry.status === "NEW").length
          : state.notifications.filter(
              (notification) => notification.role === "USER" && notification.inquiryId === inquiryId,
            ).length;

      return {
        badgeCount,
        notifications,
      };
    },

    getPharmacistDashboard(pharmacyId) {
      const pharmacy = pharmacyById.get(pharmacyId);
      if (!pharmacy) {
        throw new Error("Unknown pharmacy");
      }

      const inquiries = state.inquiries
        .filter((entry) => entry.pharmacyId === pharmacyId)
        .map((entry) => this.getInquiry(entry.id))
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

      return {
        pharmacy,
        badgeCount: inquiries.filter((entry) => entry.status === "NEW").length,
        inquiries,
        notifications: this.getNotificationFeed({ role: "PHARMACIST", pharmacyId }).notifications,
      };
    },
  };
}

export const store = createStore();
