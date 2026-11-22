/**
 * Smart Travel Bag Dashboard — Capitalio-Style
 * Chart.js based charts, sidebar nav, real-time polling
 */

let charts = {};
let weightHistory = { labels: [], data: [] };
let distanceHistory = { labels: [], data: [] };
let movementHistory = { labels: [], data: [] };
const MAX_POINTS = 60;
let pollTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initCharts();
    initEventFilters();
    startPolling();
});

/* ====================== NAVIGATION ====================== */
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            const section = item.dataset.section;
            document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
            document.getElementById('section-' + section).classList.remove('hidden');
            document.getElementById('pageTitle').textContent = item.textContent.trim();
        });
    });
}

function initEventFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetchEvents(btn.dataset.filter);
        });
    });
}

/* ====================== CHART DEFAULTS ====================== */
function chartDefaults() {
    Chart.defaults.color = '#71717a';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11;
}

function initCharts() {
    chartDefaults();
    initSparklines();
    initWeightAreaChart();
    initSensorBarChart();
    initHealthDonut();
}

/* ====================== SPARKLINES ====================== */
function initSparklines() {
    ['sparkWeight', 'sparkDistance', 'sparkMovement'].forEach(id => {
        const ctx = document.getElementById(id)?.getContext('2d');
        if (!ctx) return;
        charts[id] = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: 'transparent', fill: true, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 0, tension: 0.4, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, animation: { duration: 400 }, interaction: { intersect: false, mode: 'index' } },
        });
    });
}

function updateSparkline(id, data, color) {
    const chart = charts[id];
    if (!chart) return;
    chart.data.datasets[0].data = data.slice(-20);
    chart.data.datasets[0].backgroundColor = color.replace(')', ',0.12)').replace('rgb', 'rgba');
    chart.update('none');
}

/* ====================== WEIGHT AREA CHART ====================== */
function initWeightAreaChart() {
    const ctx = document.getElementById('weightAreaChart')?.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, 'rgba(16,185,129,0.3)');
    grad.addColorStop(1, 'rgba(16,185,129,0)');

    charts.weightArea = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'Weight', data: [], borderColor: '#10b981', backgroundColor: grad, borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#10b981' }
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1c1c21', titleColor: '#fafafa', bodyColor: '#a1a1aa', borderColor: '#27272a', borderWidth: 1, cornerRadius: 8, padding: 10, callbacks: { label: c => c.parsed.y.toFixed(2) + ' kg' } } },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
                y: { grid: { color: 'rgba(39,39,42,0.5)' }, ticks: { callback: v => v + ' kg', font: { size: 10 } } }
            },
            interaction: { intersect: false, mode: 'index' },
            animation: { duration: 600 }
        }
    });
}

/* ====================== SENSOR BAR CHART ====================== */
function initSensorBarChart() {
    const ctx = document.getElementById('sensorBarChart')?.getContext('2d');
    if (!ctx) return;
    charts.sensorBar = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [
            { label: 'Value', data: [], backgroundColor: ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f43f5e','#3b82f6','#10b981','#f59e0b'], borderRadius: 6, borderSkipped: false, barPercentage: 0.6 }
        ]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1c1c21', titleColor: '#fafafa', bodyColor: '#a1a1aa', borderColor: '#27272a', borderWidth: 1, cornerRadius: 8 } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { grid: { color: 'rgba(39,39,42,0.5)', drawBorder: false }, ticks: { font: { size: 10 } } }
            },
            animation: { duration: 500 }
        }
    });
}

/* ====================== HEALTH DONUT ====================== */
function initHealthDonut() {
    const ctx = document.getElementById('healthDonutChart')?.getContext('2d');
    if (!ctx) return;
    charts.healthDonut = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Online','Offline','Not Tested'], datasets: [{ data: [0,0,9], backgroundColor: ['#10b981','#f43f5e','#71717a'], borderWidth: 0, hoverOffset: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '72%',
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1c1c21', titleColor: '#fafafa', bodyColor: '#a1a1aa', borderColor: '#27272a', borderWidth: 1, cornerRadius: 8 } },
            animation: { duration: 600 }
        }
    });
}

/* ====================== POLLING ====================== */
function startPolling() {
    fetchStatus();
    pollTimer = setInterval(fetchStatus, 2000);
}

async function fetchStatus() {
    try {
        const resp = await fetch('/api/status');
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const data = await resp.json();
        updateDashboard(data);
    } catch (err) {
        console.error('Fetch failed:', err);
        setConnectionState('offline', 'Backend unreachable');
    }
}

function updateDashboard(status) {
    const t = status.telemetry || {};
    const online = status.device_online;
    const stale = status.stale;

    // Connection
    if (!online && !t.device_id) setConnectionState('offline', 'No device connected');
    else if (!online || stale) setConnectionState('stale', 'Device offline');
    else setConnectionState('online', 'Device online');

    // Top bar
    if (t.server_received_at) document.getElementById('lastUpdateTop').textContent = formatTime(t.server_received_at);
    updateSecurityPill(online, stale, t);

    if (online || t.weight_kg !== undefined) {
        updateMetricCards(t, stale);
        updateSensorBar(t, status.sensor_health || {});
        updateHealthDonut(status.sensor_health || {});
        updateSensorsGrid(status.sensor_health || {}, t);
    }

    // History
    if (t.weight_kg !== null && t.weight_kg !== undefined) addWeightPoint(t.weight_kg, t.server_received_at);
    if (t.distance_cm !== null && t.distance_cm !== undefined) addDistancePoint(t.distance_cm, t.server_received_at);
    if (t.movement_detected !== undefined) addMovementPoint(t.movement_detected ? 1 : 0, t.server_received_at);

    fetchEvents();
}

function setConnectionState(state, text) {
    const dot = document.getElementById('connectionDot');
    const txt = document.getElementById('connectionText');
    dot.className = 'pill-dot ' + state;
    txt.textContent = text;
}

function updateSecurityPill(online, stale, t) {
    const pill = document.getElementById('securityPill');
    const icon = document.getElementById('securityIcon');
    const text = document.getElementById('securityText');
    pill.className = 'security-pill';

    if (!online && !stale && !t.device_id) { pill.classList.add('offline'); icon.textContent = 'cloud_off'; text.textContent = 'Checking…'; return; }
    if (stale) { pill.classList.add('warning'); icon.textContent = 'warning'; text.textContent = 'Device offline'; return; }

    if (t.bag_open === true && t.locked === true) { pill.classList.add('critical'); icon.textContent = 'gpp_maybe'; text.textContent = 'ALERT'; }
    else if (t.bag_open === true) { pill.classList.add('warning'); icon.textContent = 'warning'; text.textContent = 'Bag Open'; }
    else if (t.movement_detected === true) { pill.classList.add('warning'); icon.textContent = 'sensors'; text.textContent = 'Moving'; }
    else { pill.classList.add('safe'); icon.textContent = 'shield'; text.textContent = 'Secure'; }
}

function updateMetricCards(t, stale) {
    // Weight
    if (t.weight_kg !== null && t.weight_kg !== undefined) {
        document.getElementById('weightBig').textContent = t.weight_kg.toFixed(2);
        document.getElementById('weightChange').textContent = stale ? 'Stale' : 'Live';
    }
    // Distance
    if (t.distance_cm !== null && t.distance_cm !== undefined) {
        document.getElementById('distanceBig').textContent = t.distance_cm.toFixed(1);
        document.getElementById('distanceChange').textContent = stale ? 'Stale' : 'Live';
    }
    // Movement
    if (t.movement_detected === true) { document.getElementById('movementBig').textContent = 'Active'; document.getElementById('movementTag').textContent = 'Moving'; }
    else if (t.movement_detected === false) { document.getElementById('movementBig').textContent = 'Still'; document.getElementById('movementTag').textContent = 'Calm'; }
    // Lock
    if (t.locked === true) { document.getElementById('lockBig').innerHTML = '<span class="material-icons-round lock-ico" style="color:var(--emerald)">lock</span>'; document.getElementById('lockTag').textContent = 'Locked'; }
    else if (t.locked === false) { document.getElementById('lockBig').innerHTML = '<span class="material-icons-round lock-ico" style="color:var(--amber)">lock_open</span>'; document.getElementById('lockTag').textContent = 'Unlocked'; }
    if (t.rfid_result === 'accepted') document.getElementById('lockRfid').textContent = 'RFID: ✓ Authorized';
    else if (t.rfid_result === 'rejected') document.getElementById('lockRfid').textContent = 'RFID: ✗ Unauthorized';
    else document.getElementById('lockRfid').textContent = 'RFID: --';

    // Bag state
    const bagVis = document.getElementById('bagVisual');
    const bagIcon = document.getElementById('bagIcon');
    const bagStatus = document.getElementById('bagStatus');
    const bagSub = document.getElementById('bagSub');
    bagVis.className = 'bag-visual';
    if (t.bag_open === true) { bagVis.classList.add('open'); bagStatus.textContent = 'Open'; bagSub.textContent = 'Security risk'; bagIcon.textContent = 'inventory_2'; bagIcon.style.color = 'var(--rose)'; }
    else if (t.bag_open === false) { bagVis.classList.add('closed'); bagStatus.textContent = 'Closed'; bagSub.textContent = 'Secure'; bagIcon.textContent = 'inventory'; bagIcon.style.color = 'var(--emerald)'; }
    else { bagStatus.textContent = '--'; bagSub.textContent = 'No data'; }

    // GPS
    const gps = t.gps || {};
    if (gps.valid && gps.latitude !== null) {
        document.getElementById('gpsLatVal').textContent = gps.latitude.toFixed(6);
        document.getElementById('gpsLngVal').textContent = gps.longitude.toFixed(6);
        document.getElementById('gpsFixVal').textContent = 'Yes'; document.getElementById('gpsFixVal').style.color = 'var(--emerald)';
        document.getElementById('gpsSub').textContent = 'Fix acquired';
        const mapBtn = document.getElementById('mapBtn'); mapBtn.style.display = 'inline-flex'; mapBtn.href = 'https://www.google.com/maps?q=' + gps.latitude + ',' + gps.longitude;
        const gpsMap = document.getElementById('gpsMap'); gpsMap.innerHTML = '';
        const iframe = document.createElement('iframe'); iframe.width = '100'; iframe.height = '80'; iframe.style.border = 'none'; iframe.style.borderRadius = '8px'; iframe.loading = 'lazy';
        iframe.src = 'https://maps.google.com/maps?q=' + gps.latitude + ',' + gps.longitude + '&z=14&output=embed';
        gpsMap.appendChild(iframe);
    } else {
        document.getElementById('gpsLatVal').textContent = '--'; document.getElementById('gpsLngVal').textContent = '--';
        document.getElementById('gpsFixVal').textContent = 'No'; document.getElementById('gpsFixVal').style.color = 'var(--amber)';
        document.getElementById('gpsSub').textContent = 'Waiting for fix…';
        document.getElementById('mapBtn').style.display = 'none';
        document.getElementById('gpsMap').innerHTML = '<span class="material-icons-round">map</span>';
    }

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        const btn = document.getElementById('refreshBtn'); btn.classList.add('spinning');
        setTimeout(() => btn.classList.remove('spinning'), 600);
    });
}

function updateSensorBar(t, health) {
    const labels = []; const data = [];
    if (t.weight_kg !== null && t.weight_kg !== undefined) { labels.push('Weight'); data.push(t.weight_kg); }
    if (t.distance_cm !== null) { labels.push('Distance'); data.push(t.distance_cm); }
    const accel = t.accel || {};
    if (accel.x !== undefined) { labels.push('AccX'); data.push(Math.abs(accel.x)); }
    if (accel.y !== undefined) { labels.push('AccY'); data.push(Math.abs(accel.y)); }
    if (accel.z !== undefined) { labels.push('AccZ'); data.push(Math.abs(accel.z)); }
    if (labels.length === 0) { labels.push('No data'); data.push(0); }

    const chart = charts.sensorBar;
    if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update('none');
    }
}

function updateHealthDonut(health) {
    let online = 0, offline = 0, notTested = 0;
    for (const [, state] of Object.entries(health)) {
        if (state === 'online') online++;
        else if (state === 'offline') offline++;
        else notTested++;
    }
    const chart = charts.healthDonut;
    if (chart) {
        chart.data.datasets[0].data = [online, offline, notTested];
        chart.update();
        document.getElementById('donutOnline').textContent = online;
    }
    // Legend
    const legend = document.getElementById('donutLegend');
    legend.innerHTML = [
        { label: 'Online', val: online, color: 'var(--emerald)' },
        { label: 'Offline', val: offline, color: 'var(--rose)' },
        { label: 'Not Tested', val: notTested, color: 'var(--text-muted)' }
    ].map(i => `<div class="legend-item"><span class="legend-dot" style="background:${i.color}"></span><span class="legend-label">${i.label}</span><span class="legend-val">${i.val}</span></div>`).join('');
}

function updateSensorsGrid(health, t) {
    const sensors = [
        { id: 'rfid', name: 'RFID RC522', desc: 'Authentication module', icon: 'credit_card' },
        { id: 'servo', name: 'Servo Motor', desc: 'Lock actuator', icon: 'settings' },
        { id: 'hx711', name: 'HX711', desc: 'Weight sensor', icon: 'scale' },
        { id: 'mpu6050', name: 'MPU6050', desc: 'Accelerometer/Gyro', icon: 'sensors' },
        { id: 'reed_switch', name: 'Reed Switch', desc: 'Door sensor', icon: 'door_front' },
        { id: 'ultrasonic', name: 'Ultrasonic', desc: 'Distance sensor', icon: 'radar' },
        { id: 'gps', name: 'GPS Module', desc: 'Location tracking', icon: 'location_on' },
        { id: 'buzzer', name: 'Buzzer', desc: 'Alert speaker', icon: 'notifications' },
        { id: 'esp32_cam', name: 'ESP32-CAM', desc: 'Camera module', icon: 'videocam' },
    ];
    const grid = document.getElementById('sensorsGrid');
    if (!grid) return;
    grid.innerHTML = sensors.map(s => {
        const state = health[s.id] || 'not_tested';
        const stateLabels = { online: 'Online', offline: 'Offline', not_tested: 'Not Tested', error: 'Error' };
        let value = '--';
        if (s.id === 'hx711' && t.weight_kg !== null) value = t.weight_kg.toFixed(2) + ' kg';
        else if (s.id === 'ultrasonic' && t.distance_cm !== null) value = t.distance_cm.toFixed(1) + ' cm';
        else if (s.id === 'mpu6050' && t.accel) value = `X:${t.accel.x||0}`;
        else if (s.id === 'reed_switch') value = t.bag_open === true ? 'Open' : t.bag_open === false ? 'Closed' : '--';
        else if (s.id === 'gps' && t.gps?.valid) value = `${t.gps.latitude.toFixed(4)}, ${t.gps.longitude.toFixed(4)}`;
        return `<div class="sensor-card">
            <div class="sensor-card-header">
                <span class="sensor-dot ${state}"></span>
                <span class="sensor-name">${s.name}</span>
                <span class="sensor-status ${state}">${stateLabels[state]}</span>
            </div>
            <div class="sensor-value">${value}</div>
            <div class="sensor-desc">${s.desc}</div>
        </div>`;
    }).join('');
}

/* ====================== HISTORY TRACKING ====================== */
function addWeightPoint(weight, ts) {
    const label = formatTimeShort(ts);
    weightHistory.labels.push(label); weightHistory.data.push(weight);
    if (weightHistory.labels.length > MAX_POINTS) { weightHistory.labels.shift(); weightHistory.data.shift(); }
    const chart = charts.weightArea;
    if (chart) { chart.data.labels = weightHistory.labels; chart.data.datasets[0].data = weightHistory.data; chart.update('none'); }
    updateSparkline('sparkWeight', weightHistory.data, 'rgb(16,185,129)');
}
function addDistancePoint(dist, ts) {
    distanceHistory.data.push(dist);
    if (distanceHistory.data.length > MAX_POINTS) distanceHistory.data.shift();
    updateSparkline('sparkDistance', distanceHistory.data, 'rgb(59,130,246)');
}
function addMovementPoint(val, ts) {
    movementHistory.data.push(val);
    if (movementHistory.data.length > MAX_POINTS) movementHistory.data.shift();
    updateSparkline('sparkMovement', movementHistory.data, 'rgb(245,158,11)');
}

/* ====================== EVENTS ====================== */
async function fetchEvents(filter) {
    try {
        const resp = await fetch('/api/events?limit=50');
        if (!resp.ok) return;
        const data = await resp.json();
        let events = data.events || [];
        if (filter && filter !== 'all') {
            events = events.filter(e => {
                if (filter === 'security') return e.type?.includes('security') || e.severity === 'critical';
                if (filter === 'device') return e.type?.includes('device') || e.type?.includes('system');
                return true;
            });
        }
        renderEvents(events);
    } catch (err) { /* silent */ }
}

function renderEvents(events) {
    const container = document.getElementById('eventsTimeline');
    const sub = document.getElementById('eventSub');
    if (sub) sub.textContent = events.length + ' event' + (events.length !== 1 ? 's' : '');
    if (events.length === 0) { container.innerHTML = '<div class="events-empty"><span class="material-icons-round">event_note</span><p>No events yet</p></div>'; return; }
    container.innerHTML = events.map(e => `
        <div class="event-item">
            <span class="event-severity-dot ${e.severity || 'info'}"></span>
            <div style="flex:1"><div class="event-type">${escHtml(e.type||'event')}</div><div class="event-message">${escHtml(e.message||'')}</div></div>
            <span class="event-time">${e.timestamp ? formatTime(e.timestamp) : '--'}</span>
        </div>
    `).join('');
}

/* ====================== CONTROLS ====================== */
async function buzzerCmd(action, durationMs, pattern) {
    try {
        await fetch('/api/buzzer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, duration_ms: durationMs, pattern: pattern || null }) });
    } catch (err) { console.error('Buzzer cmd failed:', err); }
}

async function toggleLock() {
    const btn = document.getElementById('lockToggleBtn');
    const icon = document.getElementById('lockToggleIcon');
    const text = document.getElementById('lockToggleText');
    const isLocked = btn.classList.contains('locked');
    const action = isLocked ? 'unlock' : 'lock';
    try {
        await fetch('/api/lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
        if (isLocked) { btn.classList.remove('locked'); icon.textContent = 'lock'; text.textContent = 'Lock'; }
        else { btn.classList.add('locked'); icon.textContent = 'lock_open'; text.textContent = 'Unlock'; }
    } catch (err) { console.error('Lock cmd failed:', err); }
}

document.getElementById('analyzeBtn2')?.addEventListener('click', async () => {
    const btn = document.getElementById('analyzeBtn2');
    btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> Analyzing…'; btn.disabled = true;
    try {
        const resp = await fetch('/api/analyze', { method: 'POST' });
        const data = await resp.json();
        const badge = document.getElementById('riskBadge');
        const factors = document.getElementById('riskFactors');
        if (data.status) {
            badge.textContent = data.status;
            badge.className = 'risk-badge ' + (data.risk_level || 'medium').toLowerCase();
        }
        if (data.factors?.length) {
            factors.innerHTML = data.factors.map(f => `<div class="factor-item">${escHtml(f)}</div>`).join('');
        } else if (data.error) {
            factors.innerHTML = '<p class="risk-empty">' + escHtml(data.error) + '</p>';
        }
    } catch (err) { /* silent */ }
    finally { btn.innerHTML = '<span class="material-icons-round">psychology</span> Run AI Analysis'; btn.disabled = false; }
});

/* ====================== HELPERS ====================== */
function formatTime(iso) { if (!iso) return '--'; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return iso; } }
function formatTimeShort(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
