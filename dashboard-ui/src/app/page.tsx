'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────
interface STBStatus {
  device_id: string
  weight_kg: number
  locked: boolean
  bag_open: boolean
  movement_detected: boolean
  distance_cm: number
  gps: { valid: boolean; latitude: number; longitude: number }
  sensors: Record<string, string>
  rfid_result?: string
  battery?: number
  updated_at?: string
}

interface STBEvent {
  timestamp: string
  type: string
  message: string
  severity?: string
  data?: Record<string, unknown>
}

// ─── Demo Data ────────────────────────────────────────────────────
const DEMO_STATUS: STBStatus = {
  device_id: 'smart-travel-bag-01',
  weight_kg: 4.25,
  locked: true,
  bag_open: false,
  movement_detected: false,
  distance_cm: 85.4,
  gps: { valid: true, latitude: 20.4625, longitude: 85.8828 },
  sensors: {
    rfid: 'online', servo: 'online', hx711: 'online', mpu6050: 'online',
    reed_switch: 'online', ultrasonic: 'online', gps: 'online',
    buzzer: 'online', esp32_cam: 'online',
  },
  battery: 87,
}

const DEMO_EVENTS: STBEvent[] = [
  { timestamp: new Date().toISOString(), type: 'security', message: 'Bag locked successfully', severity: 'info' },
  { timestamp: new Date().toISOString(), type: 'rfid', message: 'RFID tag authenticated', severity: 'success' },
  { timestamp: new Date().toISOString(), type: 'sensor', message: 'All 9 sensors online', severity: 'success' },
  { timestamp: new Date().toISOString(), type: 'gps', message: 'GPS fix acquired at Cuttack, OD', severity: 'info' },
  { timestamp: new Date().toISOString(), type: 'weight', message: 'Weight stable at 4.25 kg', severity: 'info' },
]

// ─── Colors ───────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0f',
  card: '#12121a',
  border: '#1e1e2e',
  muted: '#2a2a3e',
  text: '#f5f5f7',
  textMuted: '#8888a0',
  blue: '#3b82f6',
  green: '#10b981',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  red: '#ef4444',
  cyan: '#06b6d4',
}

// ─── Icons ────────────────────────────────────────────────────────
function SvgIcon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

const icons = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5H14zM14 12h7v9H14zM3 16h7v5H3z',
  analytics: 'M3 3v18h18 M7 16l4-8 4 4 4-6',
  sensors: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42',
  history: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M12 6v6l4 2',
  security: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  arrowUp: 'M12 19V5 M5 12l7-7 7 7',
  arrowDown: 'M12 5v14 M19 12l-7 7-7-7',
  arrowUpRight: 'M7 17L17 7 M17 7H7 M17 7v10',
  calendar: 'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18',
  export: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
}

// ─── Sidebar ──────────────────────────────────────────────────────
const navSections = [
  { label: 'Overview', items: [
    { name: 'Dashboard', icon: 'dashboard', active: true },
    { name: 'Analytics', icon: 'analytics' },
  ]},
  { label: 'Operations', items: [
    { name: 'Sensors', icon: 'sensors' },
    { name: 'History', icon: 'history' },
  ]},
  { label: 'System', items: [
    { name: 'Security', icon: 'security' },
    { name: 'Settings', icon: 'settings' },
  ]},
]

function Sidebar() {
  return (
    <div style={{
      width: 240, minWidth: 240, background: C.bg,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(to top, #2563eb, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 18,
        }}>S</div>
        <span style={{ fontSize: 18, fontWeight: 600, color: C.text }}>SmartTravel</span>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
        {navSections.map((section) => (
          <div key={section.label} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, color: C.textMuted, padding: '8px 12px',
              textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500,
            }}>{section.label}</div>
            {section.items.map((item) => (
              <div key={item.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                color: item.active ? C.text : C.textMuted,
                background: item.active ? C.muted : 'transparent',
                fontSize: 14, fontWeight: item.active ? 500 : 400,
                cursor: 'pointer', transition: 'background 0.15s',
              }}>
                <SvgIcon path={icons[item.icon as keyof typeof icons]} size={18} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* User */}
      <div style={{
        padding: 16, borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: C.green,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 600, fontSize: 14,
        }}>T</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Traveler</div>
          <span style={{ fontSize: 11, background: C.orange, color: '#000', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Pro</span>
        </div>
      </div>
    </div>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────
function Topbar({ status }: { status: STBStatus | null }) {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      padding: '16px 32px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`,
      flexShrink: 0, background: C.bg,
    }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: 0 }}>Dashboard</h1>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          Last updates Today, {timeStr} · <span style={{ color: C.text }}>{status?.device_id || 'smart-travel-bag-01'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', background: C.card,
          border: `1px solid ${C.border}`, borderRadius: 8,
          fontSize: 13, color: C.textMuted,
        }}>
          <SvgIcon path={icons.calendar} size={14} />
          Nov 22 – Nov 22
        </div>
        <select defaultValue="daily" style={{
          padding: '8px 14px', background: C.card,
          border: `1px solid ${C.border}`, borderLeft: 'none',
          borderRadius: '0 8px 8px 0', fontSize: 13, color: C.textMuted,
          cursor: 'pointer', outline: 'none',
        }}>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button style={{
          padding: '8px 18px', background: C.blue, color: 'white',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Export <SvgIcon path={icons.export} size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Mini Charts ──────────────────────────────────────────────────
function MiniArea({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ x: i, y: v }))
  return (
    <div style={{ width: '100%', height: 56 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`ma-${color}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="x" hide domain={[0, chartData.length - 1]} />
          <YAxis hide domain={['auto', 'auto']} />
          <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2}
            fill={`url(#ma-${color})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MiniBar({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ x: i, y: v }))
  return (
    <div style={{ width: '100%', height: 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis dataKey="x" hide />
          <YAxis hide domain={[0, 'auto']} />
          <Bar dataKey="y" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────
function SummaryCards({ status, weightHistory }: { status: STBStatus | null; weightHistory: number[] }) {
  const sensors = status?.sensors || {}
  const onlineCount = Object.values(sensors).filter(v => v === 'online').length
  const totalCount = Object.keys(sensors).length || 9
  const distance = status?.distance_cm || 0

  const distData = Array(7).fill(0).map(() => distance * (0.7 + Math.random() * 0.5))
  const weightData = weightHistory.length ? weightHistory.slice(-7) : [4.0, 4.1, 4.2, 4.25, 4.2, 4.3, 4.25]
  const secData = Array(7).fill(0).map(() => 85 + Math.random() * 15)

  const cards = [
    {
      title: 'Total Distance', value: `${distance.toFixed(1)} cm`,
      change: '+12%', changeLabel: 'vs yesterday', positive: true,
      iconBg: C.blue, chart: <MiniArea data={distData} color={C.blue} />,
    },
    {
      title: 'Current Weight', value: `${(status?.weight_kg || 0).toFixed(2)} kg`,
      change: 'Stable', changeLabel: 'last 24h', positive: true,
      iconBg: C.green, chart: <MiniBar data={weightData} color={C.green} />,
    },
    {
      title: 'Active Sensors', value: `${onlineCount}/${totalCount}`,
      change: '100%', changeLabel: 'online', positive: true,
      iconBg: C.orange,
      chart: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: 56, justifyContent: 'center' }}>
          <div style={{ height: 8, background: C.muted, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(onlineCount / totalCount) * 100}%`, background: C.orange, borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(sensors).slice(0, 4).map(([k, v]) => (
              <span key={k}>{k}: <span style={{ color: v === 'online' ? C.green : C.red }}>{v}</span></span>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Security Score', value: status?.locked ? '95/100' : '72/100',
      change: status?.locked ? '+3' : '-8', changeLabel: 'vs last hour',
      positive: status?.locked || false,
      iconBg: C.purple, chart: <MiniArea data={secData} color={C.purple} />,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
      {cards.map((card) => (
        <div key={card.title} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: C.textMuted }}>{card.title}</span>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: card.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            }}>
              <SvgIcon path={icons.sensors} size={16} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{card.value}</div>
            <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: card.positive ? C.green : C.red }}>
              {card.positive ? <SvgIcon path={icons.arrowUp} size={12} /> : <SvgIcon path={icons.arrowDown} size={12} />}
              <span>{card.change}</span>
              <span style={{ color: C.textMuted, fontWeight: 400 }}>{card.changeLabel}</span>
            </div>
          </div>
          {card.chart}
        </div>
      ))}
    </div>
  )
}

// ─── Weight Trend ─────────────────────────────────────────────────
function WeightTrend({ weightHistory }: { weightHistory: number[] }) {
  const labels = ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now']
  const data = weightHistory.slice(-7)
  const chartData = Array(7).fill(0).map((_, i) => ({
    label: labels[i],
    weight: data[i] ?? (4.0 + Math.random() * 0.5),
    baseline: 4.0,
  }))

  const lastWeight = weightHistory[weightHistory.length - 1] || 4.25
  const minW = Math.min(...weightHistory, 4.0)
  const maxW = Math.max(...weightHistory, 4.5)
  const avgW = weightHistory.length ? weightHistory.reduce((a, b) => a + b, 0) / weightHistory.length : 4.25

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 24, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: C.text }}>Weight Trend</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>Tracked over last 24 hours</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: C.green, fontWeight: 500 }}>+2.4% today</span>
          <button style={{
            padding: '6px 14px', background: C.muted, color: C.text,
            border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>Full Analysis <SvgIcon path={icons.arrowUpRight} size={12} /></button>
        </div>
      </div>

      <div style={{ width: '100%', height: 260, flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="wt-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={C.green} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false}
              tick={{ fill: C.textMuted, fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false}
              tick={{ fill: C.textMuted, fontSize: 12 }}
              tickFormatter={(v) => `${v}kg`} domain={['auto', 'auto']} width={48} />
            <Tooltip contentStyle={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 8, fontSize: 13, color: C.text,
            }} formatter={(value: number) => [`${value.toFixed(2)} kg`, 'Weight']} />
            <Area type="monotone" dataKey="weight" stroke={C.green} strokeWidth={2.5}
              fill="url(#wt-fill)" dot={false} />
            <Area type="monotone" dataKey="baseline" stroke={C.blue} strokeWidth={1.5}
              strokeDasharray="6 4" fill="transparent" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 20, marginTop: 16, fontSize: 13, color: C.textMuted }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.green }} />
          <span>Your Bag</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 2, background: C.blue }} />
          <span>Baseline</span>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
        marginTop: 20, paddingTop: 20, borderTop: `1px solid ${C.border}`,
      }}>
        {[
          { label: 'Current', value: `${lastWeight.toFixed(2)} kg`, change: '+2.4%', up: true },
          { label: 'Min (24h)', value: `${minW.toFixed(2)} kg` },
          { label: 'Max (24h)', value: `${maxW.toFixed(2)} kg` },
          { label: 'Avg (24h)', value: `${avgW.toFixed(2)} kg` },
        ].map((m) => (
          <div key={m.label}>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: C.text }}>{m.value}</div>
            {m.change && (
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, color: m.up ? C.green : C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <SvgIcon path={m.up ? icons.arrowUp : icons.arrowDown} size={10} /> {m.change}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sensor Donut ─────────────────────────────────────────────────
function SensorDonut({ status }: { status: STBStatus | null }) {
  const sensors = status?.sensors || {}
  const online = Object.values(sensors).filter(v => v === 'online').length
  const total = Object.keys(sensors).length || 9

  const data = [
    { name: 'Position', value: 3, color: C.blue },
    { name: 'Weight', value: 2, color: C.green },
    { name: 'Security', value: 2, color: C.orange },
    { name: 'Environment', value: 1, color: C.purple },
    { name: 'Camera', value: 1, color: C.cyan },
  ]
  const totalVal = data.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: C.text }}>Sensor Allocation</div>
        <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: C.blue, fontWeight: 500 }}>Balanced</span>
      </div>

      <div style={{ position: 'relative', width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius="65%" outerRadius="85%"
              paddingAngle={4} dataKey="value" stroke="none" cornerRadius={4} isAnimationActive={false}>
              {data.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
            </Pie>
            <Tooltip contentStyle={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 8, fontSize: 13,
            }} formatter={(value: number, name: string) => [`${value} sensors`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: C.text }}>{totalVal}</div>
          <div style={{ fontSize: 14, color: C.textMuted, marginTop: 4 }}>Categories</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
        {data.map((item) => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, color: C.text }}>{item.name}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.text, minWidth: 70, textAlign: 'right' }}>{item.value} sensors</span>
            <span style={{ fontSize: 14, color: C.textMuted, minWidth: 40, textAlign: 'right' }}>{((item.value / totalVal) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 20, padding: 12, background: C.muted, borderRadius: 8, fontSize: 13,
      }}>
        <div style={{ color: C.textMuted, marginBottom: 6, fontSize: 12 }}>System Health</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, color: C.green }}>{online}/{total} Online</span>
          <span style={{ color: C.textMuted }}>{((online / total) * 100).toFixed(0)}%</span>
        </div>
        <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(online / total) * 100}%`, background: C.green, borderRadius: 3, transition: 'width 0.5s' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Events Table ─────────────────────────────────────────────────
function EventsTable({ events }: { events: STBEvent[] }) {
  const iconMap: Record<string, { bg: string; emoji: string }> = {
    security: { bg: 'rgba(239,68,68,0.15)', emoji: '🔒' },
    rfid: { bg: 'rgba(59,130,246,0.15)', emoji: '📡' },
    sensor: { bg: 'rgba(16,185,129,0.15)', emoji: '📊' },
    gps: { bg: 'rgba(245,158,11,0.15)', emoji: '📍' },
    weight: { bg: 'rgba(139,92,246,0.15)', emoji: '⚖️' },
    telemetry: { bg: 'rgba(6,182,212,0.15)', emoji: '📶' },
    movement: { bg: 'rgba(236,72,153,0.15)', emoji: '🏃' },
    door: { bg: 'rgba(245,158,11,0.15)', emoji: '🚪' },
  }
  const typeLabels: Record<string, string> = {
    security: 'Security', rfid: 'RFID Scan', sensor: 'Sensor',
    gps: 'GPS Fix', weight: 'Weight', telemetry: 'Telemetry',
    movement: 'Movement', door: 'Door',
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: C.text }}>Recent Events</div>
        <button style={{
          padding: '6px 14px', background: C.muted, color: C.text,
          border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>View all <SvgIcon path={icons.arrowUpRight} size={12} /></button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['#', 'Event', 'Time', 'Status', 'Type'].map((h) => (
              <th key={h} style={{
                textAlign: h === '#' || h === 'Type' ? 'left' : 'left',
                fontSize: 13, fontWeight: 500, color: C.textMuted,
                padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 5).map((event, i) => {
            const ic = iconMap[event.type] || iconMap.telemetry
            const time = new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            return (
              <tr key={i}>
                <td style={{ padding: '14px 16px', fontSize: 13, color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>{i + 1}</td>
                <td style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, background: ic.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>{ic.emoji}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: C.text }}>{event.message}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{typeLabels[event.type] || event.type}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>{time}</td>
                <td style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{
                    fontSize: 12, padding: '3px 8px', borderRadius: 6,
                    background: event.severity === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                    color: event.severity === 'success' ? C.green : C.blue,
                  }}>{event.severity === 'success' ? 'OK' : 'Info'}</span>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                  {typeLabels[event.type] || event.type}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── AI Insights ──────────────────────────────────────────────────
function AIInsights({ status }: { status: STBStatus | null }) {
  const insights = [
    {
      icon: '⚡', title: 'Battery optimization',
      description: `Battery at ${status?.battery || 87}%. GPS polling can be reduced to save ~15% power during stationary periods.`,
      action: 'Optimize Now',
    },
    {
      icon: '🔒', title: 'Security recommendation',
      description: status?.locked
        ? 'Bag is locked and secure. Consider enabling auto-lock on movement detection for enhanced protection.'
        : 'Bag is currently unlocked. Enable auto-lock to secure your belongings automatically.',
      action: status?.locked ? 'Enable Auto-Lock' : 'Lock Now',
    },
    {
      icon: '📊', title: 'Weight anomaly detection',
      description: `Current weight ${(status?.weight_kg || 4.25).toFixed(2)} kg is within normal range. No unauthorized items detected.`,
      action: 'View Details',
    },
  ]

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: C.text }}>Smart Insights</div>
        <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: C.blue, fontWeight: 500 }}>AI Analysis</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {insights.map((item, i) => (
          <div key={item.title} style={i > 0 ? { borderTop: `1px solid ${C.border}`, paddingTop: 20 } : {}}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: C.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 16,
              }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{item.description}</div>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={{
                    padding: '6px 14px', background: C.muted, color: C.text,
                    border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}>{item.action} <SvgIcon path={icons.arrowUpRight} size={12} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function DashboardPage() {
  const [status, setStatus] = useState<STBStatus | null>(null)
  const [events, setEvents] = useState<STBEvent[]>([])
  const [weightHistory, setWeightHistory] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, eventsRes] = await Promise.all([
        fetch('http://localhost:5001/api/status').then(r => r.json()),
        fetch('http://localhost:5001/api/events?limit=20').then(r => r.json()),
      ])
      setStatus(statusRes)
      setEvents(eventsRes || DEMO_EVENTS)
      setWeightHistory(prev => {
        const next = [...prev, statusRes.weight_kg || 4.25]
        return next.length > 50 ? next.slice(-50) : next
      })
    } catch {
      setStatus(DEMO_STATUS)
      setEvents(DEMO_EVENTS)
      setWeightHistory(prev => {
        const next = [...prev, 4.25]
        return next.length > 50 ? next.slice(-50) : next
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 3000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: C.textMuted, background: C.bg }}>Loading dashboard...</div>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar status={status} />
        <div style={{ padding: '24px 32px', flex: 1, overflowY: 'auto' }}>
          <SummaryCards status={status} weightHistory={weightHistory} />

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
            <WeightTrend weightHistory={weightHistory} />
            <SensorDonut status={status} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <EventsTable events={events} />
            <AIInsights status={status} />
          </div>
        </div>
      </div>
    </div>
  )
}
