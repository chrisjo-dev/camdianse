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
  infoWindow: null,
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

function renderMapFallback(message) {
  mapView.innerHTML = `<div class="map-fallback">${message}</div>`;
}

function buildMapPin(status) {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="${
        status === "green" ? "#1d8a54" : status === "yellow" ? "#db9d0c" : "#d8672b"
      }" stroke="white" stroke-width="3"/></svg>`,
    )}`,
    scaledSize: new google.maps.Size(18, 18),
    anchor: new google.maps.Point(9, 9),
  };
}

async function loadGoogleMapsApi(apiKey) {
  if (window.google?.maps?.importLibrary) {
    return;
  }

  await new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-google-maps-loader="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), {
        once: true,
      });
      return;
    }

    const callbackName = `initGoogleMaps_${Date.now()}`;
    window[callbackName] = () => {
      resolve();
      delete window[callbackName];
    };

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onerror = () => {
      reject(new Error("Google Maps failed to load."));
      delete window[callbackName];
    };
    document.head.append(script);
  });
}

async function ensureMap() {
  if (mapState.map) {
    return true;
  }

  const googleMapsApiKey = window.APP_CONFIG?.googleMapsApiKey ?? "";
  if (!googleMapsApiKey) {
    renderMapFallback("Google Maps key is not configured for this static deployment yet.");
    return false;
  }

  try {
    await loadGoogleMapsApi(googleMapsApiKey);
  } catch {
    renderMapFallback("Google Maps could not load. Check the API key, referrer policy, and enabled Maps JavaScript API.");
    return false;
  }

  mapState.map = new google.maps.Map(mapView, {
    center: appState.userLocation,
    zoom: 14,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: "greedy",
  });

  mapState.userMarker = new google.maps.Marker({
    map: mapState.map,
    position: appState.userLocation,
    icon: buildMapPin("user"),
    title: "You are here",
  });

  mapState.infoWindow = new google.maps.InfoWindow();

  mapState.userMarker.addListener("click", () => {
    mapState.infoWindow.setContent(
      '<p class="map-popup-title">You are here</p><p class="map-popup-copy">Current search origin</p>',
    );
    mapState.infoWindow.open({
      anchor: mapState.userMarker,
      map: mapState.map,
    });
  });

  mapState.radiusCircle = new google.maps.Circle({
    map: mapState.map,
    center: appState.userLocation,
    radius: Number(radiusSelect.value),
    strokeColor: "#d8672b",
    strokeOpacity: 0.8,
    strokeWeight: 1.5,
    fillColor: "#d8672b",
    fillOpacity: 0.08,
  });

  return true;
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
    mapState.infoWindow.setContent(buildPharmacyPopup(marker.pharmacyData));
    mapState.infoWindow.open({
      anchor: marker,
      map: mapState.map,
    });
    mapState.map.panTo(marker.getPosition());
    if (mapState.map.getZoom() < 15) {
      mapState.map.setZoom(15);
    }
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

async function renderMap(pharmacies) {
  const ready = await ensureMap();
  if (!ready) {
    return;
  }

  mapState.radiusCircle.setRadius(Number(radiusSelect.value));

  for (const marker of mapState.pharmacyMarkers.values()) {
    marker.setMap(null);
  }
  mapState.pharmacyMarkers.clear();

  const bounds = new google.maps.LatLngBounds();
  bounds.extend(appState.userLocation);

  pharmacies.forEach((pharmacy) => {
    const marker = new google.maps.Marker({
      map: mapState.map,
      position: { lat: pharmacy.lat, lng: pharmacy.lng },
      icon: buildMapPin(statusClass(pharmacy.stockStatus)),
      title: pharmacy.pharmacyName,
    });

    marker.pharmacyData = pharmacy;
    marker.addListener("click", () => {
      selectPharmacy(pharmacy.pharmacyId, { pharmacies });
    });

    mapState.pharmacyMarkers.set(pharmacy.pharmacyId, marker);
    bounds.extend(marker.getPosition());
  });

  if (pharmacies.length === 0) {
    mapState.map.setCenter(appState.userLocation);
    mapState.map.setZoom(14);
    return;
  }

  mapState.map.fitBounds(bounds, 80);
}

function renderPharmacies(payload) {
  if (payload.pharmacies.length === 0) {
    pharmacyList.className = "pharmacy-list empty-state";
    pharmacyList.textContent = "No pharmacies with trusted same-day status were found in this radius.";
    void renderMap([]);
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

  void renderMap(payload.pharmacies);

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

void ensureMap();
renderInquiry();
void refreshInquiry();
void refreshNotifications();
setInterval(() => {
  void refreshInquiry();
  void refreshNotifications();
}, 8000);
