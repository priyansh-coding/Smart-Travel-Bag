"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Circle,
  ChevronDown,
  ChevronUp,
  Server,
  Cpu,
  Camera,
  Wifi,
  Brain,
  Radio,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ServiceStatus = "operational" | "degraded" | "down" | "unknown";

interface Service {
  name: string;
  key: string;
  icon: React.ReactNode;
  status: ServiceStatus;
  lastIncident: { date: string; desc: string } | null;
  uptimeHistory: number[]; // 1 = up, 0 = incident
}

interface SystemStatusProps {
  services?: Service[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateUptimeHistory(status: ServiceStatus, length = 30): number[] {
  const history: number[] = [];
  for (let i = 0; i < length; i++) {
    if (status === "operational") {
      history.push(Math.random() > 0.05 ? 1 : 0); // 95% uptime
    } else if (status === "degraded") {
      history.push(Math.random() > 0.2 ? 1 : 0); // 80% uptime
    } else {
      history.push(Math.random() > 0.5 ? 1 : 0); // 50% uptime
    }
  }
  return history;
}

function getStatusColor(status: ServiceStatus): string {
  switch (status) {
    case "operational":
      return "text-emerald-500";
    case "degraded":
      return "text-amber-500";
    case "down":
      return "text-red-500";
    default:
      return "text-zinc-400";
  }
}

function getStatusLabel(status: ServiceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusIcon(status: ServiceStatus) {
  if (status === "operational") {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  }
  if (status === "degraded") {
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  }
  if (status === "down") {
    return <Circle className="w-4 h-4 text-red-500" />;
  }
  return <Circle className="w-4 h-4 text-zinc-400" />;
}

/* ------------------------------------------------------------------ */
/*  Uptime Bar                                                         */
/* ------------------------------------------------------------------ */

function UptimeBar({ history }: { history: number[] }) {
  return (
    <div className="flex gap-0.5 mt-2">
      {history.map((v, i) => (
        <div
          key={i}
          className={`h-6 w-1 rounded-sm transition-colors ${
            v ? "bg-emerald-400" : "bg-red-400"
          }`}
          title={v ? "Operational" : "Incident"}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Service Row                                                        */
/* ------------------------------------------------------------------ */

function ServiceRow({ service }: { service: Service }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-zinc-400">{service.icon}</span>
        <span className="font-medium text-zinc-900 text-sm">{service.name}</span>
        <span className={`text-xs font-medium ${getStatusColor(service.status)}`}>
          {getStatusLabel(service.status)}
        </span>
        {service.lastIncident && (
          <span className="text-xs text-zinc-400 ml-auto">
            Last: {service.lastIncident.date}
          </span>
        )}
      </div>
      <UptimeBar history={service.uptimeHistory} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  System Status Panel                                                */
/* ------------------------------------------------------------------ */

export function SystemStatus({ services: initialServices }: SystemStatusProps) {
  const [showIncidents, setShowIncidents] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>(
    initialServices ?? []
  );

  // If no services provided, use defaults
  React.useEffect(() => {
    if (!initialServices || initialServices.length === 0) {
      const defaultServices: Service[] = [
        {
          name: "Dashboard API",
          key: "api",
          icon: <Server className="w-4 h-4" />,
          status: "operational",
          lastIncident: { date: "2024-05-01", desc: "Minor outage resolved." },
          uptimeHistory: generateUptimeHistory("operational"),
        },
        {
          name: "AI Service",
          key: "ai",
          icon: <Brain className="w-4 h-4" />,
          status: "operational",
          lastIncident: null,
          uptimeHistory: generateUptimeHistory("operational"),
        },
        {
          name: "ESP32 Device",
          key: "device",
          icon: <Cpu className="w-4 h-4" />,
          status: "operational",
          lastIncident: null,
          uptimeHistory: generateUptimeHistory("operational"),
        },
        {
          name: "ESP32-CAM",
          key: "camera",
          icon: <Camera className="w-4 h-4" />,
          status: "degraded",
          lastIncident: { date: "2024-04-28", desc: "Stream unavailable." },
          uptimeHistory: generateUptimeHistory("degraded"),
        },
        {
          name: "Wi-Fi Connection",
          key: "wifi",
          icon: <Wifi className="w-4 h-4" />,
          status: "operational",
          lastIncident: null,
          uptimeHistory: generateUptimeHistory("operational"),
        },
        {
          name: "GPS Module",
          key: "gps",
          icon: <Radio className="w-4 h-4" />,
          status: "unknown",
          lastIncident: null,
          uptimeHistory: generateUptimeHistory("operational"),
        },
      ];
      setServices(defaultServices);
    }
  }, [initialServices]);

  // Collect all incidents
  const incidents = services
    .filter((s) => s.lastIncident)
    .map((s) => ({
      service: s.name,
      date: s.lastIncident!.date,
      desc: s.lastIncident!.desc,
    }))
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-medium text-zinc-500">System Status</h3>
        <button
          onClick={() => setShowIncidents((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
        >
          {showIncidents ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          {showIncidents ? "Hide" : "Incident History"}
        </button>
      </div>

      {/* Services */}
      <div className="flex flex-col gap-3">
        {services.map((svc) => (
          <ServiceRow key={svc.key} service={svc} />
        ))}
      </div>

      {/* Incidents */}
      {showIncidents && incidents.length > 0 && (
        <div className="mt-2 rounded-lg bg-zinc-50 p-4">
          <p className="text-xs font-semibold text-zinc-700 mb-3">
            Incident History
          </p>
          <div className="flex flex-col gap-2">
            {incidents.map((inc, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 border-b border-zinc-200 pb-2 last:border-0 last:pb-0"
              >
                <span className="text-xs font-medium text-zinc-700">
                  {inc.service} — {inc.date}
                </span>
                <span className="text-xs text-zinc-500">{inc.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemStatus;
