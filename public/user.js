import { request } from "./app-store.js";

const appState = {
  selectedProduct: null,
  selectedPharmacyId: null,
  userLocation: {
    lat: 11.5564,
    lng: 104.9282,
  },
  inquiryId: localStorage.getItem("inquiryId"),
  inquiry: null,
};

const searchInput = document.querySelector("#search-input");
const searchButton = document.querySelector("#search-button");
const searchResults = document.querySelector("#search-results");
const selectedProductTitle = document.querySelector("#selected-product-title");
const pharmacyList = document.querySelector("#pharmacy-list");
const mapView = document.querySelector("#map-view");
const inquiryStatus = document.querySelector("#inquiry-status");
const radiusSelect = document.querySelector("#radius-select");
const notificationBadge = document.querySelector("#notification-badge");
const mapState = {
  map: null,
  userMarker: null,
  pharmacyMarkers: new Map(),
  radiusCircle: null,
};

function statusClass(status) {
  return String(status).toLowerCase();
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function productLabel(product) {
  return `${product.localBrandName} · ${product.dosageForm}`;
}

function ensureMap() {
  if (mapState.map) {
    return;
  }

  mapState.map = L.map(mapView, {
    zoomControl: true,
    scrollWheelZoom: true,
  }).setView([appState.userLocation.lat, appState.userLocation.lng], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapState.map);

  mapState.userMarker = L.marker([appState.userLocation.lat, appState.userLocation.lng], {
    icon: L.divIcon({
      className: "",
      html: '<div class="map-pin user"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
  })
    .addTo(mapState.map)
    .bindPopup('<p class="map-popup-title">You are here</p><p class="map-popup-copy">Current search origin</p>');

  mapState.radiusCircle = L.circle([appState.userLocation.lat, appState.userLocation.lng], {
    radius: Number(radiusSelect.value),
    color: "#d8672b",
    weight: 1.5,
    fillColor: "#d8672b",
    fillOpacity: 0.08,
  }).addTo(mapState.map);
}

function buildPharmacyPopup(pharmacy) {
  return `
    <p class="map-popup-title">${escapeHtml(pharmacy.pharmacyName)}</p>
    <p class="map-popup-copy">${escapeHtml(pharmacy.address)}</p>
    <p class="map-popup-copy">${formatDistance(pharmacy.distanceMeters)} away · ${
      pharmacy.stockStatus === "GREEN" ? "In stock" : "Needs pharmacist check"
    }</p>
  `;
}

function selectPharmacy(pharmacyId, payload) {
  appState.selectedPharmacyId = pharmacyId;
  renderPharmacies(payload);

  const marker = mapState.pharmacyMarkers.get(pharmacyId);
  if (marker) {
    marker.openPopup();
    mapState.map.flyTo(marker.getLatLng(), Math.max(mapState.map.getZoom(), 15), {
      animate: true,
      duration: 0.6,
    });
  }
}

function renderSearchResults(payload) {
  if (payload.results.length === 0) {
    searchResults.innerHTML = `<div class="empty-state">No products matched that search.</div>`;
    return;
  }

  searchResults.innerHTML = payload.results
    .map((result) => {
      if (result.type === "INGREDIENT_MATCH") {
        return `
          <article class="result-card">
            <p class="eyebrow">Ingredient match</p>
            <h3>${result.ingredient.name}</h3>
            <p class="meta-line">Matching products available in local circulation.</p>
            <div class="result-products">
              ${result.products
                .map(
                  (product) => `
                    <button class="chip-button" type="button" data-product-id="${product.id}">
                      ${productLabel(product)}
                    </button>
                  `,
                )
                .join("")}
            </div>
          </article>
        `;
      }

      return `
        <article class="result-card">
          <p class="eyebrow">Direct product match</p>
          <h3>${result.product.localBrandName}</h3>
          <p class="meta-line">${result.product.englishName} · ${result.product.packageSize}</p>
          <div class="result-products">
            <button class="chip-button" type="button" data-product-id="${result.product.id}">
              Select product
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  searchResults.querySelectorAll("[data-product-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const product = payload.results
        .flatMap((result) => (result.type === "INGREDIENT_MATCH" ? result.products : [result.product]))
        .find((entry) => entry.id === button.dataset.productId);

      if (product) {
        appState.selectedProduct = product;
        selectedProductTitle.textContent = `${product.localBrandName} nearby in Phnom Penh`;
        loadNearbyPharmacies();
      }
    });
  });
}

function renderMap(pharmacies) {
  ensureMap();

  mapState.radiusCircle.setRadius(Number(radiusSelect.value));

  for (const marker of mapState.pharmacyMarkers.values()) {
    mapState.map.removeLayer(marker);
  }
  mapState.pharmacyMarkers.clear();

  const bounds = L.latLngBounds([[appState.userLocation.lat, appState.userLocation.lng]]);

  pharmacies.forEach((pharmacy) => {
    const marker = L.marker([pharmacy.lat, pharmacy.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="map-pin ${statusClass(pharmacy.stockStatus)}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    })
      .addTo(mapState.map)
      .bindPopup(buildPharmacyPopup(pharmacy));

    marker.on("click", () => {
      selectPharmacy(pharmacy.pharmacyId, { pharmacies });
    });

    mapState.pharmacyMarkers.set(pharmacy.pharmacyId, marker);
    bounds.extend([pharmacy.lat, pharmacy.lng]);
  });

  if (pharmacies.length === 0) {
    mapState.map.setView([appState.userLocation.lat, appState.userLocation.lng], 14);
    return;
  }

  mapState.map.fitBounds(bounds.pad(0.28), { animate: true, duration: 0.5 });
}

function renderPharmacies(payload) {
  if (payload.pharmacies.length === 0) {
    pharmacyList.className = "pharmacy-list empty-state";
    pharmacyList.textContent = "No pharmacies with trusted same-day status were found in this radius.";
    renderMap([]);
    return;
  }

  pharmacyList.className = "pharmacy-list";
  pharmacyList.innerHTML = payload.pharmacies
    .map(
      (pharmacy) => `
        <article class="pharmacy-card ${appState.selectedPharmacyId === pharmacy.pharmacyId ? "selected" : ""}">
          <div class="panel-header">
            <div>
              <h3>${pharmacy.pharmacyName}</h3>
              <p class="meta-line">${pharmacy.address}</p>
            </div>
            <span class="status-pill ${statusClass(pharmacy.stockStatus)}">
              ${pharmacy.stockStatus === "GREEN" ? "In stock" : "Needs check"}
            </span>
          </div>
          <p class="meta-line">Distance: ${formatDistance(pharmacy.distanceMeters)} · Updated ${new Date(
            pharmacy.lastUpdatedAt,
          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          <p class="meta-line">Hours: ${pharmacy.hours}</p>
          <div class="card-actions">
            <button class="chip-button" type="button" data-select-pharmacy="${pharmacy.pharmacyId}">
              View on map
            </button>
            <a
              class="chip-button"
              href="https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}"
              target="_blank"
              rel="noreferrer"
            >
              Directions
            </a>
            <button class="primary-button" type="button" data-inquiry-pharmacy="${pharmacy.pharmacyId}">
              Send inquiry
            </button>
          </div>
        </article>
      `,
    )
    .join("");

  renderMap(payload.pharmacies);

  pharmacyList.querySelectorAll("[data-select-pharmacy]").forEach((button) => {
    button.addEventListener("click", () => {
      selectPharmacy(button.dataset.selectPharmacy, payload);
    });
  });

  pharmacyList.querySelectorAll("[data-inquiry-pharmacy]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const inquiry = await request("/api/inquiries", {
          method: "POST",
          body: JSON.stringify({
            productId: appState.selectedProduct.id,
            pharmacyId: button.dataset.inquiryPharmacy,
            userLocation: appState.userLocation,
            note: "Pickup inquiry from mobile web guest user.",
          }),
        });

        appState.inquiryId = inquiry.id;
        appState.inquiry = inquiry;
        localStorage.setItem("inquiryId", inquiry.id);
        renderInquiry();
        await refreshNotifications();
      } catch (error) {
        inquiryStatus.innerHTML = `<div class="empty-state">${error.message}</div>`;
      }
    });
  });
}

function renderInquiry() {
  if (!appState.inquiry) {
    inquiryStatus.innerHTML =
      '<div class="empty-state">Select a pharmacy and send an inquiry to start tracking pickup readiness.</div>';
    return;
  }

  const inquiry = appState.inquiry;
  inquiryStatus.className = "stack";
  inquiryStatus.innerHTML = `
    <article class="inquiry-card">
      <div class="panel-header">
        <div>
          <h3>${inquiry.product.localBrandName} at ${inquiry.pharmacy.name}</h3>
          <p class="meta-line">${inquiry.pharmacy.address}</p>
        </div>
        <span class="status-pill ${statusClass(inquiry.status)}">${inquiry.status}</span>
      </div>
      <p class="meta-line">Pickup flow: inquiry only, then visit and pay offline.</p>
      <div class="stack">
        ${inquiry.timeline
          .map(
            (entry) => `
              <div class="notification-card">
                <strong>${entry.status}</strong>
                <p class="meta-line">${entry.message}</p>
                <p class="meta-line">${new Date(entry.createdAt).toLocaleString()}</p>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

async function loadNearbyPharmacies() {
  if (!appState.selectedProduct) {
    return;
  }

  const payload = await request(
    `/api/pharmacies/nearby?productId=${encodeURIComponent(appState.selectedProduct.id)}&lat=${
      appState.userLocation.lat
    }&lng=${appState.userLocation.lng}&radiusMeters=${radiusSelect.value}`,
  );
  renderPharmacies(payload);
}

async function handleSearch() {
  const term = searchInput.value.trim();
  if (!term) {
    searchResults.innerHTML = `<div class="empty-state">Enter a medicine or ingredient to begin.</div>`;
    return;
  }

  try {
    const payload = await request(`/api/search?q=${encodeURIComponent(term)}`);
    renderSearchResults(payload);
  } catch (error) {
    searchResults.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

async function refreshInquiry() {
  if (!appState.inquiryId) {
    return;
  }

  try {
    appState.inquiry = await request(`/api/inquiries/${appState.inquiryId}`);
    renderInquiry();
  } catch {
    localStorage.removeItem("inquiryId");
    appState.inquiryId = null;
  }
}

async function refreshNotifications() {
  if (!appState.inquiryId) {
    notificationBadge.textContent = "0 updates";
    return;
  }

  const payload = await request(`/api/notifications?role=user&inquiryId=${appState.inquiryId}`);
  notificationBadge.textContent = `${payload.badgeCount} updates`;
}

searchButton.addEventListener("click", handleSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleSearch();
  }
});
radiusSelect.addEventListener("change", loadNearbyPharmacies);

ensureMap();
renderInquiry();
void refreshInquiry();
void refreshNotifications();
setInterval(() => {
  void refreshInquiry();
  void refreshNotifications();
}, 8000);
