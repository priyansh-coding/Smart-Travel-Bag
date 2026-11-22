/**
 * Smart Travel Bag Command Center
 * Compact, award-winning dashboard with vibrant charts
 */

let charts = {};
let weightHistory = { labels: [], data: [] };
let distanceHistory = { labels: [], data: [] };
let movementHistory = { labels: [], data: [] };
const MAX_POINTS = 60;
let pollTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    initEventFilters();
    startPolling();
});

/* ====================== CHART DEFAULTS ====================== */
function initCharts() {
    Chart.defaults.color = '#666666';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 10;
    Chart.defaults.font.weight = '600';

    initSparklines();
    initWeightTrend();
    initHealthDonut();
    initSensorBar();
}

/* ====================== SPARKLINES ====================== */
function initSparklines() {
    ['sparkWeight', 'sparkDistance', 'sparkMovement'].forEach(id => {
        const ctx = document.getElementById(id)?.getContext('2d');
        if (!ctx) return;
        charts[id] = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ data: [], borderColor: 'transparent', fill: true, backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 0, tension: 0.4, pointRadius: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, animation: { duration: 400 } },
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

/* ====================== WEIGHT TREND ====================== */
function initWeightTrend() {
    const ctx = document.getElementById('weightTrendChart')?.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, 'rgba(16,185,129,0.25)');
    grad.addColorStop(1, 'rgba(16,185,129,0)');

    charts.weightTrend = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{
            label: 'Weight',
            data: [],
            borderColor: '#10b981',
            backgroundColor: grad,
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: '#10b981',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c1c',
                    titleColor: '#fff',
                    bodyColor: '#a0a0a0',
                    borderColor: '#262626',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 10,
                    displayColors: false,
                    callbacks: { label: c => c.parsed.y.toFixed(2) + ' kg' }
                }
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { maxTicksLimit: 8, font: { size: 10, weight: '600' } } },
                y: { grid: { color: 'rgba(38,38,38,0.5)', drawBorder: false }, ticks: { callback: v => v + ' kg', font: { size: 10, weight: '600' } } }
            },
            interaction: { intersect: false, mode: 'index' },
            animation: { duration: 500 }
        }
    });
}

/* ====================== HEALTH DONUT ====================== */
function initHealthDonut() {
    const ctx = document.getElementById('healthDonut')?.getContext('2d');
    if (!ctx) return;
    charts.healthDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Online', 'Offline', 'Not Tested'],
            datasets: [{
                data: [0, 0, 9],
                backgroundColor: ['#10b981', '#f43f5e', '#444444'],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c1c',
                    titleColor: '#fff',
                    bodyColor: '#a0a0a0',
                    borderColor: '#262626',
                    borderWidth: 1,
                    cornerRadius: 8
                }
            },
            animation: { duration: 600 }
        }
    });
}

/* ====================== SENSOR BAR ====================== */
function initSensorBar() {
    const ctx = document.getElementById('sensorBarChart')?.getContext('2d');
    if (!ctx) return;
    charts.sensorBar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Value',
                data: [],
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b'],
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c1c1c',
                    titleColor: '#fff',
                    bodyColor: '#a0a0a0',
                    borderColor: '#262626',
                    borderWidth: 1,
                    cornerRadius: 8
                }
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { font: { size: 10, weight: '600' } } },
                y: { grid: { color: 'rgba(38,38,38,0.5)', drawBorder: false }, ticks: { font: { size: 10, weight: '600' } } }
            },
            animation: { duration: 500 }
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
        setStatus('offline', 'Backend unreachable');
    }
}

function updateDashboard(status) {
    const t = status.telemetry || {};
    const online = status.device_online;
    const stale = status.stale;

    // Status
    if (!online && !t.device_id) setStatus('offline', 'No device connected');
    else if (!online || stale) setStatus('stale', 'Device offline');
    else setStatus('online', 'Device online');

    // Security badge
    updateSecurityBadge(online, stale, t);

    if (online || t.weight_kg !== undefined) {
        updateMetrics(t, stale);
        updateSensorBar(t);
        updateHealthDonut(status.sensor_health || {});
    }

    // History
    if (t.weight_kg !== null && t.weight_kg !== undefined) addWeightPoint(t.weight_kg, t.server_received_at);
    if (t.distance_cm !== null && t.distance_cm !== undefined) addDistancePoint(t.distance_cm, t.server_received_at);
    if (t.movement_detected !== undefined) addMovementPoint(t.movement_detected ? 1 : 0, t.server_received_at);

    fetchEvents();
}

function setStatus(state, text) {
    const dot = document.getElementById('pulseDot');
    const txt = document.getElementById('statusText');
    dot.className = 'pulse-dot ' + state;
    txt.textContent = text;
}

function updateSecurityBadge(online, stale, t) {
    const badge = document.getElementById('securityBadge');
    const icon = badge.querySelector('.material-icons-round');
    const label = document.getElementById('securityLabel');
    badge.className = 'security-badge';

    if (!online && !stale && !t.device_id) { badge.classList.add('offline'); icon.textContent = 'cloud_off'; label.textContent = 'Offline'; return; }
    if (stale) { badge.classList.add('warning'); icon.textContent = 'warning'; label.textContent = 'Stale'; return; }

    if (t.bag_open === true && t.locked === true) { badge.classList.add('critical'); icon.textContent = 'gpp_maybe'; label.textContent = 'ALERT'; }
    else if (t.bag_open === true) { badge.classList.add('warning'); icon.textContent = 'warning'; label.textContent = 'Open'; }
    else if (t.movement_detected === true) { badge.classList.add('warning'); icon.textContent = 'sensors'; label.textContent = 'Moving'; }
    else { badge.classList.add('safe'); icon.textContent = 'shield'; label.textContent = 'Secure'; }
}

function updateMetrics(t, stale) {
    const time = formatTime(t.server_received_at);

    // Weight
    if (t.weight_kg !== null && t.weight_kg !== undefined) {
        document.getElementById('weightValue').textContent = t.weight_kg.toFixed(2);
        document.getElementById('weightChange').textContent = stale ? 'Stale' : 'Live';
        document.getElementById('weightTime').textContent = time;
    }

    // Distance
    if (t.distance_cm !== null && t.distance_cm !== undefined) {
        document.getElementById('distanceValue').textContent = t.distance_cm.toFixed(1);
        document.getElementById('distanceChange').textContent = stale ? 'Stale' : 'Live';
        document.getElementById('distanceTime').textContent = time;
    }

    // Movement
    if (t.movement_detected === true) { document.getElementById('movementValue').textContent = 'Active'; document.getElementById('movementTag').textContent = 'Moving'; }
    else if (t.movement_detected === false) { document.getElementById('movementValue').textContent = 'Still'; document.getElementById('movementTag').textContent = 'Calm'; }
    document.getElementById('movementTime').textContent = time;

    // Lock
    if (t.locked === true) {
        document.getElementById('lockValue').textContent = 'Locked';
        document.getElementById('lockIcon').textContent = 'lock';
        document.getElementById('lockIcon').style.color = 'var(--emerald)';
        document.getElementById('lockTag').textContent = 'Secure';
    } else if (t.locked === false) {
        document.getElementById('lockValue').textContent = 'Unlocked';
        document.getElementById('lockIcon').textContent = 'lock_open';
        document.getElementById('lockIcon').style.color = 'var(--amber)';
        document.getElementById('lockTag').textContent = 'Open';
    }
    document.getElementById('lockTime').textContent = time;

    // Bag state
    const bagVis = document.getElementById('bagVisual');
    const bagIcon = document.getElementById('bagIcon');
    const bagLabel = document.getElementById('bagLabel');
    const bagSub = document.getElementById('bagSub');
    bagVis.className = 'bag-visual';
    if (t.bag_open === true) { bagVis.classList.add('open'); bagLabel.textContent = 'Open'; bagSub.textContent = 'Security risk'; bagIcon.textContent = 'inventory_2'; }
    else if (t.bag_open === false) { bagVis.classList.add('closed'); bagLabel.textContent = 'Closed'; bagSub.textContent = 'Secure'; bagIcon.textContent = 'inventory'; }
    else { bagLabel.textContent = '--'; bagSub.textContent = 'No data'; }

    // GPS
    const gps = t.gps || {};
    if (gps.valid && gps.latitude !== null) {
        document.getElementById('gpsLat').textContent = gps.latitude.toFixed(6);
        document.getElementById('gpsLng').textContent = gps.longitude.toFixed(6);
        document.getElementById('gpsFix').textContent = 'Acquired'; document.getElementById('gpsFix').style.color = 'var(--emerald)';
        const mapLink = document.getElementById('mapLink'); mapLink.style.display = 'inline-flex'; mapLink.href = 'https://www.google.com/maps?q=' + gps.latitude + ',' + gps.longitude;
        const gpsMap = document.getElementById('gpsMap'); gpsMap.innerHTML = '';
        const iframe = document.createElement('iframe'); iframe.width = '100%'; iframe.height = '80'; iframe.style.border = 'none'; iframe.style.borderRadius = '8px'; iframe.loading = 'lazy';
        iframe.src = 'https://maps.google.com/maps?q=' + gps.latitude + ',' + gps.longitude + '&z=14&output=embed';
        gpsMap.appendChild(iframe);
    } else {
        document.getElementById('gpsLat').textContent = '--'; document.getElementById('gpsLng').textContent = '--';
        document.getElementById('gpsFix').textContent = 'No fix'; document.getElementById('gpsFix').style.color = 'var(--amber)';
        document.getElementById('mapLink').style.display = 'none';
        document.getElementById('gpsMap').innerHTML = '<span class="material-icons-round">explore</span>';
    }

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        const btn = document.getElementById('refreshBtn'); btn.classList.add('spinning');
        setTimeout(() => btn.classList.remove('spinning'), 600);
    });
}

function updateSensorBar(t) {
    const labels = []; const data = [];
    if (t.weight_kg !== null && t.weight_kg !== undefined) { labels.push('Weight'); data.push(t.weight_kg); }
    if (t.distance_cm !== null) { labels.push('Dist'); data.push(t.distance_cm); }
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
        document.getElementById('onlineCount').textContent = online;
    }
    const legend = document.getElementById('healthLegend');
    legend.innerHTML = [
        { label: 'Online', val: online, color: 'var(--emerald)' },
        { label: 'Offline', val: offline, color: 'var(--rose)' },
        { label: 'Not Tested', val: notTested, color: 'var(--text-dim)' }
    ].map(i => `<div class="legend-item"><span class="legend-dot" style="background:${i.color}"></span><span class="legend-label">${i.label}</span><span class="legend-val">${i.val}</span></div>`).join('');
}

/* ====================== HISTORY ====================== */
function addWeightPoint(weight, ts) {
    const label = formatTimeShort(ts);
    weightHistory.labels.push(label); weightHistory.data.push(weight);
    if (weightHistory.labels.length > MAX_POINTS) { weightHistory.labels.shift(); weightHistory.data.shift(); }
    const chart = charts.weightTrend;
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
function initEventFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetchEvents(btn.dataset.filter);
        });
    });
}

async function fetchEvents(filter) {
    try {
        const resp = await fetch('/api/events?limit=50');
        if (!resp.ok) return;
        const data = await resp.json();
        let events = data.events || [];
        if (filter && filter !== 'all') {
            events = events.filter(e => {
                if (filter === 'security') return e.type?.includes('security') || e.severity === 'critical';
                if (filter === 'system') return e.type?.includes('device') || e.type?.includes('system');
                return true;
            });
        }
        renderEvents(events);
    } catch (err) { /* silent */ }
}

function renderEvents(events) {
    const container = document.getElementById('eventsList');
    const count = document.getElementById('eventCount');
    if (count) count.textContent = events.length + ' event' + (events.length !== 1 ? 's' : '');
    if (events.length === 0) { container.innerHTML = '<div class="events-empty"><span class="material-icons-round">event_note</span><p>No events yet</p></div>'; return; }
    container.innerHTML = events.map(e => `
        <div class="event-item">
            <span class="event-dot ${e.severity || 'info'}"></span>
            <div class="event-content">
                <div class="event-type">${escHtml(e.type||'event')}</div>
                <div class="event-message">${escHtml(e.message||'')}</div>
            </div>
            <span class="event-time">${e.timestamp ? formatTime(e.timestamp) : '--'}</span>
        </div>
    `).join('');
}

/* ====================== CONTROLS ====================== */
async function buzzerCmd(action, durationMs, pattern) {
    try { await fetch('/api/buzzer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, duration_ms: durationMs, pattern: pattern || null }) }); }
    catch (err) { console.error('Buzzer cmd failed:', err); }
}

async function toggleLock() {
    const btn = document.getElementById('lockBtn');
    const icon = document.getElementById('lockBtnIcon');
    const text = document.getElementById('lockBtnText');
    const isLocked = btn.classList.contains('locked');
    const action = isLocked ? 'unlock' : 'lock';
    try {
        await fetch('/api/lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
        if (isLocked) { btn.classList.remove('locked'); icon.textContent = 'lock'; text.textContent = 'Lock'; }
        else { btn.classList.add('locked'); icon.textContent = 'lock_open'; text.textContent = 'Unlock'; }
    } catch (err) { console.error('Lock cmd failed:', err); }
}

document.getElementById('analyzeBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('analyzeBtn');
    btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span><span>Analyzing…</span>'; btn.disabled = true;
    try { await fetch('/api/analyze', { method: 'POST' }); }
    catch (err) { /* silent */ }
    finally { btn.innerHTML = '<span class="material-icons-round">psychology</span><span>Analyze</span>'; btn.disabled = false; }
});

/* ====================== HELPERS ====================== */
function formatTime(iso) { if (!iso) return '--'; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return iso; } }
function formatTimeShort(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
