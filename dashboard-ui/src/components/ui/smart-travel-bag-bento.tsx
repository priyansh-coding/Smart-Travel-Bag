"use client";

import * as React from "react";
import {
  Scale,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  WifiOff,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface STBSensorHealth {
  rfid: string;
  servo: string;
  hx711: string;
  mpu6050: string;
  reed_switch: string;
  ultrasonic: string;
  gps: string;
  buzzer: string;
  esp32_cam: string;
}

export interface STBGPS {
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface STBTelemetry {
  device_id: string;
  weight_kg: number | null;
  locked: boolean | null;
  bag_open: boolean | null;
  movement_detected: boolean | null;
  distance_cm: number | null;
  gps: STBGPS;
  sensors: STBSensorHealth;
  rfid_result: string | null;
  server_received_at: string | null;
}

export interface STBStatus {
  device_online: boolean;
  stale: boolean;
  telemetry: STBTelemetry | null;
  sensor_health: STBSensorHealth;
  config?: { esp32_cam_stream_url?: string };
}

export interface STBEvent {
  type: string;
  message: string;
  severity: "info" | "warning" | "critical";
  timestamp: string;
}

export interface STBBentoProps {
  status?: STBStatus | null;
  events?: STBEvent[];
  weightHistory?: { labels: string[]; data: number[] };
}

/* ------------------------------------------------------------------ */
/*  Demo data                                                          */
/* ------------------------------------------------------------------ */

export const STB_DEMO: STBStatus = {
  device_online: true,
  stale: false,
  telemetry: {
    device_id: "smart-travel-bag-01",
    weight_kg: 4.25,
    locked: true,
    bag_open: false,
    movement_detected: false,
    distance_cm: 85,
    gps: { valid: false, latitude: null, longitude: null },
    sensors: {
      rfid: "online", servo: "online", hx711: "online", mpu6050: "online",
      reed_switch: "online", ultrasonic: "online", gps: "online",
      buzzer: "online", esp32_cam: "online",
    },
    rfid_result: "accepted",
    server_received_at: new Date().toISOString(),
  },
  sensor_health: {
    rfid: "online", servo: "online", hx711: "online", mpu6050: "online",
    reed_switch: "online", ultrasonic: "online", gps: "online",
    buzzer: "online", esp32_cam: "online",
  },
};

export const STB_DEMO_EVENTS: STBEvent[] = [];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(iso: string | null) {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--";
  }
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard — Minimal                                           */
/* ------------------------------------------------------------------ */

export function SmartTravelBagBento({
  status = STB_DEMO,
  events = STB_DEMO_EVENTS,
}: STBBentoProps) {
  const t = status?.telemetry;
  const online = status?.device_online ?? false;
  const stale = status?.stale ?? true;

  // Determine overall status
  let statusLevel: "safe" | "warning" | "alert";
  let statusMessage: string;

  if (!online || stale) {
    statusLevel = "warning";
    statusMessage = "Device offline";
  } else if (t?.bag_open && t?.locked) {
    statusLevel = "alert";
    statusMessage = "Bag opened while locked";
  } else if (t?.bag_open) {
    statusLevel = "warning";
    statusMessage = "Bag is open";
  } else if (t?.movement_detected) {
    statusLevel = "warning";
    statusMessage = "Movement detected";
  } else {
    statusLevel = "safe";
    statusMessage = "All secure";
  }

  const statusColors = {
    safe: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    alert: "bg-red-50 text-red-700 border-red-200",
  };

  const StatusIcon = statusLevel === "safe" ? CheckCircle2 : AlertTriangle;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Smart Travel Bag</h1>
          <p className="mt-0.5 text-xs text-zinc-400">
            {t?.device_id || "No device"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {online && !stale ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-zinc-400" />
          )}
          <span className="text-xs text-zinc-500">
            {online && !stale ? "Connected" : "Offline"}
          </span>
        </div>
      </div>

      {/* Status Card */}
      <div className={`mb-6 rounded-xl border p-4 ${statusColors[statusLevel]}`}>
        <div className="flex items-center gap-3">
          <StatusIcon className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium">{statusMessage}</p>
            {t?.server_received_at && (
              <p className="mt-0.5 text-xs opacity-70">
                Updated {formatTime(t.server_received_at)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="mb-1 flex items-center gap-1.5 text-zinc-400">
            <Scale className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Weight</span>
          </div>
          <p className="text-lg font-semibold text-zinc-900">
            {t?.weight_kg?.toFixed(1) ?? "--"}
            <span className="ml-0.5 text-xs font-normal text-zinc-400">kg</span>
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="mb-1 flex items-center gap-1.5 text-zinc-400">
            {t?.locked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <Unlock className="h-3.5 w-3.5" />
            )}
            <span className="text-[10px] font-medium uppercase tracking-wide">Lock</span>
          </div>
          <p className="text-lg font-semibold text-zinc-900">
            {t?.locked ? "Locked" : t?.locked === false ? "Open" : "--"}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="mb-1 flex items-center gap-1.5 text-zinc-400">
            <span className="h-3.5 w-3.5 rounded-full bg-zinc-300" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Door</span>
          </div>
          <p className="text-lg font-semibold text-zinc-900">
            {t?.bag_open === false ? "Closed" : t?.bag_open === true ? "Open" : "--"}
          </p>
        </div>
      </div>

      {/* Events (only if any) */}
      {events.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Recent Activity
          </h2>
          <ul className="space-y-2">
            {events.slice(0, 5).map((e, i) => (
              <li key={i} className="flex items-start justify-between gap-2">
                <span className="text-sm text-zinc-700">{e.message}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {formatTime(e.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SmartTravelBagBento;
