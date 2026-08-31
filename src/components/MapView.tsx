"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { Station, Llegada, Ruta } from "@/lib/api";
import { getLlegadas, getRutas, parseCoord, tiempoLabel } from "@/lib/api";

interface Props {
  stations: Station[];
  onLocate: () => void;
  locating: boolean;
  userPos: [number, number] | null;
  onStationClickRef?: React.MutableRefObject<((s: Station) => void) | null>;
}

export default function MapView({ stations, onLocate, locating, userPos, onStationClickRef }: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);

  const [selected, setSelected] = useState<Station | null>(null);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [selectedRuta, setSelectedRuta] = useState<Ruta | null>(null);
  const [llegadas, setLlegadas] = useState<Llegada[]>([]);
  const [loadingLlegadas, setLoadingLlegadas] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Init map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    import("leaflet").then((L) => {
      // Fix default icon paths for Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [4.711, -74.0721],
        zoom: 13,
        zoomControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
      // Force recalculate size after mount
      setTimeout(() => map.invalidateSize(), 100);
    });
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Add station markers
  useEffect(() => {
    if (!mapRef.current || stations.length === 0) return;
    import("leaflet").then((L) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const troncalIcon = L.divIcon({
        className: "",
        html: `<div style="width:10px;height:10px;background:#ef4444;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      const zonalIcon = L.divIcon({
        className: "",
        html: `<div style="width:8px;height:8px;background:#f97316;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });

      for (const st of stations) {
        const pos = parseCoord(st.coordenada);
        if (!pos) continue;
        const isTroncal = (st.codigo || "").toUpperCase().startsWith("TM");
        const marker = L.marker(pos, { icon: isTroncal ? troncalIcon : zonalIcon })
          .addTo(mapRef.current!)
          .on("click", () => handleStationClick(st));
        markersRef.current.push(marker);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations]);

  // Update user position marker
  useEffect(() => {
    if (!mapRef.current || !userPos) return;
    import("leaflet").then((L) => {
      userMarkerRef.current?.remove();
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      userMarkerRef.current = L.marker(userPos, { icon }).addTo(mapRef.current!);
      mapRef.current!.setView(userPos, 15, { animate: true });
    });
  }, [userPos]);

  // Expose click handler so page.tsx can trigger it programmatically (search/locate)
  useEffect(() => {
    if (onStationClickRef) onStationClickRef.current = handleStationClick;
  });

  const handleStationClick = useCallback(async (st: Station) => {
    setSelected(st);
    setSelectedRuta(null);
    setLlegadas([]);
    setRutas([]);
    setPanelOpen(true);
    setLoadingLlegadas(true);

    const isTroncal = (st.codigo || "").toUpperCase().startsWith("TM");
    try {
      const [rutasData, llegadasData] = await Promise.all([
        getRutas(st.codigo, isTroncal).catch(() => getRutas(st.codigo, false)),
        getLlegadas(st.codigo).catch(() => []),
      ]);
      setRutas(rutasData);
      setLlegadas(llegadasData);
    } finally {
      setLoadingLlegadas(false);
    }
  }, []);

  const filteredLlegadas = selectedRuta
    ? llegadas.filter((l) => {
        const rn = selectedRuta.nombre;
        const re = String(l.ruta_extraida || "");
        const rs = String(l.ruta_sae || "");
        return re.includes(rn) || rs.includes(rn) || rn.includes(re);
      }).length > 0
      ? llegadas.filter((l) => {
          const rn = selectedRuta.nombre;
          const re = String(l.ruta_extraida || "");
          const rs = String(l.ruta_sae || "");
          return re.includes(rn) || rs.includes(rn) || rn.includes(re);
        })
      : llegadas
    : llegadas;

  const refresh = useCallback(async () => {
    if (!selected) return;
    setLoadingLlegadas(true);
    try {
      const data = await getLlegadas(selected.codigo);
      setLlegadas(data);
    } finally {
      setLoadingLlegadas(false);
    }
  }, [selected]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100dvh" }} />

      {/* Locate button */}
      <button
        onClick={onLocate}
        disabled={locating}
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 1000,
          width: 44, height: 44, borderRadius: "50%",
          background: "var(--surface)", border: "1px solid var(--border)",
          color: "var(--text)", fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,.4)",
        }}
        title="Mi ubicación"
      >
        {locating ? "⏳" : "📍"}
      </button>

      {/* Bottom panel */}
      {panelOpen && selected && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000,
          background: "var(--surface)", borderRadius: "var(--radius) var(--radius) 0 0",
          maxHeight: "65vh", display: "flex", flexDirection: "column",
          boxShadow: "0 -4px 20px rgba(0,0,0,.5)",
        }}>
          {/* Handle + header */}
          <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 12px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.nombre}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{selected.codigo}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={refresh} disabled={loadingLlegadas}
                  style={{ background: "var(--surface2)", border: "none", borderRadius: 8, padding: "6px 12px", color: "var(--text)", cursor: "pointer", fontSize: 13 }}>
                  {loadingLlegadas ? "..." : "↻ Actualizar"}
                </button>
                <button onClick={() => setPanelOpen(false)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Route filter chips */}
            {rutas.length > 1 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px", scrollbarWidth: "none" }}>
                <Chip label="Todas" active={!selectedRuta} onClick={() => setSelectedRuta(null)} />
                {rutas.map((r) => (
                  <Chip key={r.id || r.codigo} label={r.nombre} active={selectedRuta?.codigo === r.codigo} onClick={() => setSelectedRuta(r)} />
                ))}
              </div>
            )}
          </div>

          {/* Arrivals list */}
          <div style={{ overflowY: "auto", padding: "8px 16px 24px", flex: 1 }}>
            {loadingLlegadas && llegadas.length === 0 ? (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 24 }}>Consultando llegadas...</div>
            ) : filteredLlegadas.length === 0 ? (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 24 }}>Sin buses en este momento</div>
            ) : (
              filteredLlegadas.map((l, i) => (
                <ArrivalCard key={i} llegada={l} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: "4px 12px", borderRadius: 20,
      background: active ? "var(--accent)" : "var(--surface2)",
      border: "none", color: "var(--text)", fontSize: 12, fontWeight: active ? 700 : 400,
      cursor: "pointer", whiteSpace: "nowrap",
    }}>
      {label}
    </button>
  );
}

function ArrivalCard({ llegada }: { llegada: Llegada }) {
  const ruta = String(llegada.ruta_extraida || llegada.ruta_sae || "?");
  const destino = llegada.destino_limpio || "";
  const tiempo = llegada.labeltiempo || "?";
  const distancia = llegada.distancia;

  return (
    <div style={{
      background: "var(--surface2)", borderRadius: 10, padding: "12px 14px",
      marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{ruta}</div>
        {destino && <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>→ {destino}</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: tiempo.toLowerCase().includes("ahora") ? "var(--green)" : "var(--text)" }}>
          {tiempoLabel(tiempo)}
        </div>
        {distancia && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>📏 {distancia}</div>}
      </div>
    </div>
  );
}
