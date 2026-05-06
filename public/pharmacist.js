const pharmacySelect = document.querySelector("#pharmacy-select");
const pharmacistBadge = document.querySelector("#pharmacist-badge");
const inventoryTable = document.querySelector("#inventory-table");
const inquiryQueue = document.querySelector("#inquiry-queue");
const pharmacistNotifications = document.querySelector("#pharmacist-notifications");
const profileForm = document.querySelector("#profile-form");
const profileName = document.querySelector("#profile-name");
const profileAddress = document.querySelector("#profile-address");
const profileHours = document.querySelector("#profile-hours");

const pharmacyOptions = [
  { id: "pharm-riverside", label: "Riverside Care Pharmacy" },
  { id: "pharm-bkk1", label: "BKK1 Health Point" },
  { id: "pharm-aeon", label: "Aeon Wellness Pharmacy" },
];

pharmacySelect.innerHTML = pharmacyOptions
  .map((option) => `<option value="${option.id}">${option.label}</option>`)
  .join("");

async function request(url, options) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

function statusButtonMarkup(productId, currentStatus, nextStatus) {
  const activeClass =
    currentStatus === nextStatus ? `active-${nextStatus.toLowerCase()}` : "";
  return `
    <button class="status-button ${activeClass}" type="button" data-product-id="${productId}" data-status="${nextStatus}">
      ${nextStatus}
    </button>
  `;
}

async function loadProfile() {
  const profile = await request(`/api/pharmacies/${pharmacySelect.value}/profile`);
  profileName.value = profile.name;
  profileAddress.value = profile.address;
  profileHours.value = profile.hours;
}

async function loadInventory() {
  const payload = await request(`/api/pharmacies/${pharmacySelect.value}/catalog`);
  inventoryTable.innerHTML = payload.catalog
    .map(
      (item) => `
        <article class="inventory-row">
          <div class="inventory-row-top">
            <div>
              <strong>${item.product.localBrandName}</strong>
              <p class="meta-line">${item.product.englishName} · ${item.product.dosageForm}</p>
            </div>
            <div class="pill-note">Updated ${new Date(item.updatedAt).toLocaleString()}</div>
          </div>
          <div class="status-pills">
            ${statusButtonMarkup(item.product.id, item.status, "GREEN")}
            ${statusButtonMarkup(item.product.id, item.status, "YELLOW")}
            ${statusButtonMarkup(item.product.id, item.status, "RED")}
          </div>
        </article>
      `,
    )
    .join("");

  inventoryTable.querySelectorAll("[data-product-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await request("/api/pharmacy-status", {
        method: "POST",
        body: JSON.stringify({
          pharmacyId: pharmacySelect.value,
          productId: button.dataset.productId,
          status: button.dataset.status,
        }),
      });
      await Promise.all([loadInventory(), loadDashboard()]);
    });
  });
}

function renderInquiryActions(inquiry) {
  if (inquiry.status === "NEW") {
    return `
      <button class="chip-button" type="button" data-inquiry-id="${inquiry.id}" data-next-status="CHECKING">Start checking</button>
    `;
  }

  if (inquiry.status === "CHECKING") {
    return `
      <button class="chip-button" type="button" data-inquiry-id="${inquiry.id}" data-next-status="READY">Mark ready</button>
      <button class="chip-button" type="button" data-inquiry-id="${inquiry.id}" data-next-status="UNAVAILABLE">Mark unavailable</button>
    `;
  }

  return "";
}

async function loadDashboard() {
  const payload = await request(`/api/pharmacist/dashboard?pharmacyId=${pharmacySelect.value}`);
  pharmacistBadge.textContent = `${payload.badgeCount} new inquiries`;

  inquiryQueue.innerHTML =
    payload.inquiries.length === 0
      ? `<div class="empty-state">No inquiries yet for this pharmacy.</div>`
      : payload.inquiries
          .map(
            (inquiry) => `
              <article class="inquiry-card">
                <div class="panel-header">
                  <div>
                    <h3>${inquiry.product.localBrandName}</h3>
                    <p class="meta-line">Guest pickup inquiry · ${new Date(inquiry.createdAt).toLocaleString()}</p>
                  </div>
                  <span class="status-pill ${inquiry.status.toLowerCase()}">${inquiry.status}</span>
                </div>
                <p class="meta-line">User location: ${inquiry.userLocationSnapshot.lat.toFixed(4)}, ${inquiry.userLocationSnapshot.lng.toFixed(4)}</p>
                <p class="meta-line">${inquiry.note || "No note provided."}</p>
                <div class="card-actions">${renderInquiryActions(inquiry)}</div>
              </article>
            `,
          )
          .join("");

  pharmacistNotifications.innerHTML =
    payload.notifications.length === 0
      ? `<div class="empty-state">No recent alerts.</div>`
      : payload.notifications
          .slice(0, 8)
          .map(
            (notification) => `
              <article class="notification-card">
                <strong>${notification.message}</strong>
                <p class="meta-line">${new Date(notification.createdAt).toLocaleString()}</p>
              </article>
            `,
          )
          .join("");

  inquiryQueue.querySelectorAll("[data-inquiry-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await request(`/api/inquiries/${button.dataset.inquiryId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: button.dataset.nextStatus,
        }),
      });
      await loadDashboard();
    });
  });
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await request(`/api/pharmacies/${pharmacySelect.value}/profile`, {
    method: "PATCH",
    body: JSON.stringify({
      name: profileName.value,
      address: profileAddress.value,
      hours: profileHours.value,
    }),
  });
  await loadDashboard();
});

pharmacySelect.addEventListener("change", async () => {
  await Promise.all([loadProfile(), loadInventory(), loadDashboard()]);
});

await Promise.all([loadProfile(), loadInventory(), loadDashboard()]);
setInterval(loadDashboard, 8000);
