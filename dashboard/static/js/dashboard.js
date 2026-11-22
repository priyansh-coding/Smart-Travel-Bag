/**
 * Smart Travel Bag — Dashboard Frontend
 * Polls /api/status for live telemetry, renders cards, charts, events, camera, and AI panel.
 */

let previousTelemetry = null;
let weightHistory = { labels: [], data: [] };
const MAX_WEIGHT_POINTS = 60;
let weightChart = null;
let pollInterval = null;
let cameraStreamUrl = null;

document.addEventListener("DOMContentLoaded", () => {
    initWeightChart();
    initHealthGrid();
    bindEvents();
    startPolling();
});

function bindEvents() {
    document.getElementById("refreshBtn").addEventListener("click", manualRefresh);
    document.getElementById("analyzeBtn").addEventListener("click", requestAIAnalysis);
}

function startPolling() {
    fetchStatus();
    pollInterval = setInterval(fetchStatus, 2000);
}

async function fetchStatus() {
    try {
        const resp = await fetch("/api/status");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        updateDashboard(data);
    } catch (err) {
        console.error("Failed to fetch status:", err);
        setConnectionState("offline", "Backend unreachable");
    }
}

async function manualRefresh() {
    const btn = document.getElementById("refreshBtn");
    btn.classList.add("spinning");
    await fetchStatus();
    fetchEvents();
    setTimeout(() => btn.classList.remove("spinning"), 800);
}

function updateDashboard(status) {
    const telemetry = status.telemetry || {};
    const online = status.device_online;
    const stale = status.stale;

    if (!online && !telemetry.device_id) {
        setConnectionState("offline", "No device connected");
    } else if (!online || stale) {
        setConnectionState("stale", "Device offline (stale data)");
    } else {
        setConnectionState("online", "Device online");
    }

    const lastUpdate = telemetry.server_received_at;
    if (lastUpdate) {
        document.getElementById("lastUpdateText").textContent = "Updated: " + formatTime(lastUpdate);
    }

    updateSecurityBanner(online, stale, telemetry);

    if (online || telemetry.weight_kg !== undefined) {
        updateWeightCard(telemetry, stale);
        updateLockCard(telemetry, stale);
        updateBagCard(telemetry, stale);
        updateMovementCard(telemetry, stale);
        updateGPSCard(telemetry, stale);
        updateDistanceCard(telemetry, stale);
        updateSensorHealth(status.sensor_health || {});
        updateCamera(status.config);
    }

    if (telemetry.weight_kg !== null && telemetry.weight_kg !== undefined) {
        addWeightPoint(telemetry.weight_kg, telemetry.server_received_at);
    }

    fetchEvents();
    previousTelemetry = { ...telemetry };
}

function setConnectionState(state, text) {
    const dot = document.getElementById("connectionDot");
    const textEl = document.getElementById("connectionText");
    dot.className = "status-dot " + state;
    textEl.textContent = text;
}

function updateSecurityBanner(online, stale, telemetry) {
    const banner = document.getElementById("securityBanner");
    const icon = document.getElementById("bannerIcon");
    const text = document.getElementById("bannerText");
    banner.className = "security-banner";

    if (!online && !stale && !telemetry.device_id) {
        banner.classList.add("offline");
        icon.textContent = "cloud_off";
        text.textContent = "Waiting for device connection…";
        return;
    }
    if (stale) {
        banner.classList.add("warning");
        icon.textContent = "warning";
        text.textContent = "Device offline — last data is stale";
        return;
    }

    const bagOpen = telemetry.bag_open;
    const locked = telemetry.locked;
    const movement = telemetry.movement_detected;

    if (bagOpen === true && locked === true) {
        banner.classList.add("critical");
        icon.textContent = "gpp_maybe";
        text.textContent = "ALERT: Bag opened while locked — possible unauthorized access!";
    } else if (bagOpen === true) {
        banner.classList.add("warning");
        icon.textContent = "warning";
        text.textContent = "Warning: Bag is currently open";
    } else if (movement === true) {
        banner.classList.add("warning");
        icon.textContent = "sensors";
        text.textContent = "Movement detected — bag may be in transit";
    } else {
        banner.classList.add("safe");
        icon.textContent = "shield";
        text.textContent = "All systems nominal — bag is secure";
    }
}

function updateWeightCard(telemetry, stale) {
    const valueEl = document.getElementById("weightValue");
    const statusEl = document.getElementById("weightStatus");
    const tsEl = document.getElementById("weightTimestamp");
    const weight = telemetry.weight_kg;
    if (weight !== null && weight !== undefined) {
        valueEl.textContent = weight.toFixed(2);
        tsEl.textContent = formatTime(telemetry.server_received_at);
        statusEl.textContent = stale ? "Stale" : "Live";
        statusEl.className = stale ? "card-status warning" : "card-status online";
    } else {
        valueEl.textContent = "--";
        statusEl.textContent = "No data";
        statusEl.className = "card-status not-tested";
        tsEl.textContent = "No data";
    }
}

function updateLockCard(telemetry, stale) {
    const iconEl = document.getElementById("lockIcon");
    const textEl = document.getElementById("lockText");
    const statusEl = document.getElementById("lockStatus");
    const rfidEl = document.getElementById("rfidInfo");
    const tsEl = document.getElementById("lockTimestamp");
    const locked = telemetry.locked;

    if (locked === true) {
        iconEl.className = "big-value lock-icon locked";
        iconEl.innerHTML = '<span class="material-icons-round">lock</span>';
        textEl.textContent = "Locked";
        textEl.style.color = "var(--color-safe)";
        statusEl.textContent = stale ? "Stale" : "Live";
        statusEl.className = stale ? "card-status warning" : "card-status online";
    } else if (locked === false) {
        iconEl.className = "big-value lock-icon unlocked";
        iconEl.innerHTML = '<span class="material-icons-round">lock_open</span>';
        textEl.textContent = "Unlocked";
        textEl.style.color = "var(--color-warning)";
        statusEl.textContent = stale ? "Stale" : "Live";
        statusEl.className = stale ? "card-status warning" : "card-status online";
    } else {
        iconEl.className = "big-value lock-icon";
        iconEl.innerHTML = '<span class="material-icons-round">lock</span>';
        textEl.textContent = "Unknown";
        textEl.style.color = "";
        statusEl.textContent = "No data";
        statusEl.className = "card-status not-tested";
    }

    const rfid = telemetry.rfid_result;
    if (rfid === "accepted") { rfidEl.textContent = "RFID: ✓ Authorized tag"; rfidEl.className = "rfid-info accepted"; }
    else if (rfid === "rejected") { rfidEl.textContent = "RFID: ✗ Unauthorized tag"; rfidEl.className = "rfid-info rejected"; }
    else { rfidEl.textContent = "RFID: No authentication data"; rfidEl.className = "rfid-info"; }

    tsEl.textContent = telemetry.server_received_at ? formatTime(telemetry.server_received_at) : "No data";
}

function updateBagCard(telemetry, stale) {
    const valueEl = document.getElementById("bagValue");
    const statusEl = document.getElementById("bagStatus");
    const tsEl = document.getElementById("bagTimestamp");
    const bagOpen = telemetry.bag_open;

    if (bagOpen === true) {
        valueEl.textContent = "Open"; valueEl.style.color = "var(--color-critical)";
        statusEl.textContent = stale ? "Stale" : "Live";
        statusEl.className = stale ? "card-status warning" : "card-status warning";
    } else if (bagOpen === false) {
        valueEl.textContent = "Closed"; valueEl.style.color = "var(--color-safe)";
        statusEl.textContent = stale ? "Stale" : "Live";
        statusEl.className = stale ? "card-status warning" : "card-status online";
    } else {
        valueEl.textContent = "--"; valueEl.style.color = "";
        statusEl.textContent = "No data"; statusEl.className = "card-status not-tested";
    }
    tsEl.textContent = telemetry.server_received_at ? formatTime(telemetry.server_received_at) : "No data";
}

function updateMovementCard(telemetry, stale) {
    const valueEl = document.getElementById("movementValue");
    const statusEl = document.getElementById("movementStatus");
    const accelEl = document.getElementById("accelData");
    const tsEl = document.getElementById("movementTimestamp");
    const movement = telemetry.movement_detected;

    if (movement === true) {
        valueEl.textContent = "Detected"; valueEl.style.color = "var(--color-warning)";
        statusEl.textContent = stale ? "Stale" : "Active";
        statusEl.className = stale ? "card-status warning" : "card-status warning";
    } else if (movement === false) {
        valueEl.textContent = "Stationary"; valueEl.style.color = "var(--color-safe)";
        statusEl.textContent = stale ? "Stale" : "Live";
        statusEl.className = stale ? "card-status warning" : "card-status online";
    } else {
        valueEl.textContent = "--"; valueEl.style.color = "";
        statusEl.textContent = "No data"; statusEl.className = "card-status not-tested";
    }

    if (telemetry.accel) {
        const a = telemetry.accel;
        accelEl.textContent = `Accel: X=${a.x || 0}, Y=${a.y || 0}, Z=${a.z || 0}`;
    } else { accelEl.textContent = "Accel: --"; }

    tsEl.textContent = telemetry.server_received_at ? formatTime(telemetry.server_received_at) : "No data";
}

function updateGPSCard(telemetry, stale) {
    const latEl = document.getElementById("gpsLat");
    const lonEl = document.getElementById("gpsLon");
    const fixEl = document.getElementById("gpsFix");
    const statusEl = document.getElementById("gpsStatus");
    const mapPlaceholder = document.getElementById("mapPlaceholder");
    const mapLink = document.getElementById("mapLink");
    const gps = telemetry.gps || {};
    const valid = gps.valid;

    if (valid && gps.latitude !== null && gps.longitude !== null) {
        latEl.textContent = gps.latitude.toFixed(6);
        lonEl.textContent = gps.longitude.toFixed(6);
        fixEl.textContent = "Yes"; fixEl.style.color = "var(--color-safe)";
        statusEl.textContent = stale ? "Stale" : "Fix";
        statusEl.className = stale ? "card-status warning" : "card-status online";
        mapPlaceholder.style.display = "none";
        mapLink.style.display = "inline-flex";
        mapLink.href = `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`;

        const mapContainer = document.getElementById("mapContainer");
        let iframe = mapContainer.querySelector("iframe");
        if (!iframe) {
            iframe = document.createElement("iframe");
            iframe.width = "100%"; iframe.height = "180";
            iframe.style.border = "none"; iframe.style.borderRadius = "8px";
            iframe.loading = "lazy";
            mapContainer.insertBefore(iframe, mapLink);
        }
        iframe.src = `https://maps.google.com/maps?q=${gps.latitude},${gps.longitude}&z=15&output=embed`;
    } else {
        latEl.textContent = "--"; lonEl.textContent = "--";
        fixEl.textContent = "No fix"; fixEl.style.color = "var(--color-warning)";
        statusEl.textContent = "No fix"; statusEl.className = "card-status warning";
        mapPlaceholder.style.display = "flex";
        mapLink.style.display = "none";
        const iframe = document.getElementById("mapContainer").querySelector("iframe");
        if (iframe) iframe.remove();
    }
}

function updateDistanceCard(telemetry, stale) {
    const valueEl = document.getElementById("distanceValue");
    const statusEl = document.getElementById("distanceStatus");
    const tsEl = document.getElementById("distanceTimestamp");
    const barEl = document.getElementById("distanceBar");
    const distance = telemetry.distance_cm;

    if (distance !== null && distance !== undefined) {
        valueEl.textContent = distance.toFixed(1);
        tsEl.textContent = formatTime(telemetry.server_received_at);
        const pct = Math.min(100, Math.max(0, (distance / 200) * 100));
        barEl.style.width = pct + "%";
        if (distance < 30) barEl.style.background = "var(--color-critical)";
        else if (distance < 80) barEl.style.background = "var(--color-warning)";
        else barEl.style.background = "var(--accent-blue)";
        statusEl.textContent = stale ? "Stale" : "Live";
        statusEl.className = stale ? "card-status warning" : "card-status online";
    } else {
        valueEl.textContent = "--"; statusEl.textContent = "No data";
        statusEl.className = "card-status not-tested";
        tsEl.textContent = "No data"; barEl.style.width = "0%";
    }
}

function initHealthGrid() {
    const grid = document.getElementById("healthGrid");
    const sensors = [
        { id: "rfid", label: "RFID RC522" }, { id: "servo", label: "Servo Motor" },
        { id: "hx711", label: "HX711 (Weight)" }, { id: "mpu6050", label: "MPU6050 (Motion)" },
        { id: "reed_switch", label: "Reed Switch" }, { id: "ultrasonic", label: "Ultrasonic" },
        { id: "gps", label: "GPS Module" }, { id: "buzzer", label: "Buzzer" },
        { id: "esp32_cam", label: "ESP32-CAM" },
    ];
    grid.innerHTML = sensors.map(s => `
        <div class="health-item not_tested" id="health-${s.id}">
            <span class="health-dot not_tested" id="dot-${s.id}"></span>
            <span class="health-label">${s.label}</span>
            <span class="health-state not_tested" id="state-${s.id}">Not tested</span>
        </div>
    `).join("");
}

function updateSensorHealth(sensorStates) {
    for (const [sensor, state] of Object.entries(sensorStates)) {
        const item = document.getElementById(`health-${sensor}`);
        const dot = document.getElementById(`dot-${sensor}`);
        const stateEl = document.getElementById(`state-${sensor}`);
        if (item && dot && stateEl) {
            item.className = `health-item ${state}`;
            dot.className = `health-dot ${state}`;
            stateEl.className = `health-state ${state}`;
            const labels = { "online": "Online", "offline": "Offline", "not_tested": "Not tested", "error": "Error" };
            stateEl.textContent = labels[state] || state;
        }
    }
}

function updateCamera(config) {
    const streamUrl = config ? config.esp32_cam_stream_url : null;
    const placeholder = document.getElementById("cameraPlaceholder");
    const streamImg = document.getElementById("cameraStream");
    const statusEl = document.getElementById("cameraStatus");

    if (streamUrl && streamUrl !== cameraStreamUrl) {
        cameraStreamUrl = streamUrl;
        streamImg.src = streamUrl; streamImg.style.display = "block";
        placeholder.style.display = "none";
        statusEl.textContent = "Streaming"; statusEl.className = "card-status online";
        streamImg.onerror = () => { streamImg.style.display = "none"; placeholder.style.display = "flex"; statusEl.textContent = "Offline"; statusEl.className = "card-status offline"; };
        streamImg.onload = () => { statusEl.textContent = "Streaming"; statusEl.className = "card-status online"; };
    } else if (!streamUrl) {
        streamImg.style.display = "none"; placeholder.style.display = "flex";
        statusEl.textContent = "No stream URL"; statusEl.className = "card-status not-tested";
    }
}

async function requestAIAnalysis() {
    const btn = document.getElementById("analyzeBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> Analyzing…';
    try {
        const resp = await fetch("/api/analyze", { method: "POST" });
        const data = await resp.json();
        displayAIResult(data);
    } catch (err) {
        displayAIResult({ service_available: false, error: "Failed: " + err.message, timestamp: new Date().toISOString() });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-round">analytics</span> Run Analysis';
    }
}

function displayAIResult(result) {
    const placeholder = document.getElementById("aiPlaceholder");
    const resultDiv = document.getElementById("aiResult");
    const statusBadge = document.getElementById("aiStatusBadge");
    const statusText = document.getElementById("aiStatusText");
    const riskEl = document.getElementById("aiRiskLevel");
    const explanationEl = document.getElementById("aiExplanation");
    const factorsEl = document.getElementById("aiFactors");
    const tsEl = document.getElementById("aiTimestamp");

    placeholder.style.display = "none";
    resultDiv.style.display = "block";

    if (result.service_available === false) {
        statusBadge.className = "ai-status-badge ERROR";
        statusText.textContent = "UNAVAILABLE";
        riskEl.textContent = "--"; riskEl.className = "risk-value";
        explanationEl.textContent = result.error || "AI service is not available";
        factorsEl.innerHTML = "";
    } else {
        const status = result.status || "UNKNOWN";
        statusBadge.className = `ai-status-badge ${status}`;
        statusText.textContent = status;
        const risk = result.risk_level || "unknown";
        riskEl.textContent = risk; riskEl.className = `risk-value ${risk}`;
        explanationEl.textContent = result.explanation || "No explanation provided";
        const factors = result.factors || [];
        factorsEl.innerHTML = factors.length > 0 ? factors.map(f => `<div class="factor-item">${f}</div>`).join("") : "";
    }
    tsEl.textContent = result.timestamp ? "Analyzed: " + formatTime(result.timestamp) : "--";
}

function initWeightChart() {
    const ctx = document.getElementById("weightChart").getContext("2d");
    weightChart = new Chart(ctx, {
        type: "line",
        data: { labels: [], datasets: [{ label: "Weight (kg)", data: [], borderColor: "#58a6ff", backgroundColor: "rgba(88,166,255,0.1)", borderWidth: 2, fill: true, tension: 0.3, pointRadius: 2, pointHoverRadius: 5 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: "#8b949e", font: { size: 11 } } } },
            scales: {
                x: { display: true, ticks: { color: "#6e7681", font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: "rgba(48,54,61,0.5)" } },
                y: { display: true, ticks: { color: "#6e7681", font: { size: 10 } }, grid: { color: "rgba(48,54,61,0.5)" }, title: { display: true, text: "kg", color: "#6e7681" } },
            },
            interaction: { intersect: false, mode: "index" },
        },
    });
}

function addWeightPoint(weight, timestamp) {
    const label = formatTimeShort(timestamp);
    weightHistory.labels.push(label);
    weightHistory.data.push(weight);
    if (weightHistory.labels.length > MAX_WEIGHT_POINTS) { weightHistory.labels.shift(); weightHistory.data.shift(); }
    weightChart.data.labels = weightHistory.labels;
    weightChart.data.datasets[0].data = weightHistory.data;
    weightChart.update("none");
}

async function fetchEvents() {
    try {
        const resp = await fetch("/api/events?limit=50");
        if (!resp.ok) return;
        const data = await resp.json();
        renderEvents(data.events || []);
    } catch (err) { /* silent */ }
}

function renderEvents(eventsList) {
    const container = document.getElementById("eventsList");
    const emptyEl = document.getElementById("eventsEmpty");
    const countEl = document.getElementById("eventCount");
    countEl.textContent = `${eventsList.length} event${eventsList.length !== 1 ? "s" : ""}`;

    if (eventsList.length === 0) { emptyEl.style.display = "flex"; container.querySelectorAll(".event-item").forEach(el => el.remove()); return; }
    emptyEl.style.display = "none";
    const html = eventsList.map(evt => `
        <div class="event-item">
            <span class="event-severity-dot ${evt.severity || 'info'}"></span>
            <div class="event-content">
                <div class="event-type">${escapeHtml(evt.type || 'event')}</div>
                <div class="event-message">${escapeHtml(evt.message || '')}</div>
            </div>
            <span class="event-time">${evt.timestamp ? formatTime(evt.timestamp) : '--'}</span>
        </div>
    `).join("");
    container.querySelectorAll(".event-item").forEach(el => el.remove());
    container.insertAdjacentHTML("beforeend", html);
}

function formatTime(isoStr) {
    if (!isoStr) return "--";
    try { return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return isoStr; }
}
function formatTimeShort(isoStr) {
    if (!isoStr) return "";
    try { return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ""; }
}
function escapeHtml(str) { const div = document.createElement("div"); div.textContent = str; return div.innerHTML; }
