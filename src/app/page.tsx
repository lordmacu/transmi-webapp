"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import SearchBar from "@/components/SearchBar";
import type { Station } from "@/lib/api";
import type { MapBounds } from "@/components/MapView";
import { stationsInBounds, nearestStations } from "@/lib/api";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [stations, setStations] = useState<Station[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [showSearchHere, setShowSearchHere] = useState(false);
  const [loadingBounds, setLoadingBounds] = useState(false);
  const lastBoundsRef = useRef<MapBounds | null>(null);
  const selectFromMap = useRef<((s: Station) => void) | null>(null);

  const fetchBounds = useCallback(async (b: MapBounds) => {
    setLoadingBounds(true);
    try {
      const result = await stationsInBounds(b.latMin, b.latMax, b.lonMin, b.lonMax);
      setStations(result);
    } finally {
      setLoadingBounds(false);
    }
  }, []);

  const hasLocatedRef = useRef(false);

  const handleMapMoved = useCallback((bounds: MapBounds, userInitiated: boolean) => {
    lastBoundsRef.current = bounds;
    if (userInitiated) {
      // Solo mostrar el botón si ya geolocalizó alguna vez
      if (hasLocatedRef.current) setShowSearchHere(true);
    } else {
      // Movimiento programático (geolocalización) → auto-fetch
      if (hasLocatedRef.current) {
        fetchBounds(bounds);
        setShowSearchHere(false);
      }
    }
  }, [fetchBounds]);

  const handleSearchHere = useCallback(() => {
    if (!lastBoundsRef.current) return;
    setShowSearchHere(false);
    fetchBounds(lastBoundsRef.current);
  }, [fetchBounds]);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        hasLocatedRef.current = true;
        setUserPos([lat, lon]);
        setLocating(false);
        setShowSearchHere(false);
        // Abrir el paradero más cercano
        try {
          const nearest = await nearestStations(lat, lon, 1);
          if (nearest.length > 0) selectFromMap.current?.(nearest[0]);
        } catch {}
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSelectStation = useCallback((st: Station) => {
    selectFromMap.current?.(st);
  }, []);

  return (
    <main style={{ position: "relative", width: "100%", height: "100dvh" }}>
      <MapView
        stations={stations}
        onLocate={locate}
        locating={locating}
        userPos={userPos}
        onStationClickRef={selectFromMap}
        onMapMoved={handleMapMoved}
      />

      {/* Search bar */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 70, zIndex: 1000 }}>
        <SearchBar onSelectStation={handleSelectStation} />
      </div>

      {/* Botón "Buscar en esta zona" */}
      {showSearchHere && (
        <div style={{
          position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000,
        }}>
          <button
            onClick={handleSearchHere}
            disabled={loadingBounds}
            style={{
              padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: "var(--surface)", color: "var(--text)",
              border: "1px solid var(--border)", cursor: "pointer",
              boxShadow: "0 2px 10px rgba(0,0,0,.5)",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {loadingBounds ? "Buscando..." : "🔍 Buscar en esta zona"}
          </button>
        </div>
      )}

      {/* Hint inicial */}
      {!userPos && !locating && stations.length === 0 && (
        <div style={{
          position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 1000, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "10px 18px", fontSize: 13, color: "var(--text-muted)",
          whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,.4)",
          pointerEvents: "none",
        }}>
          Toca 📍 para ver paraderos cercanos
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 16, left: 16, zIndex: 500,
        background: "var(--surface)", borderRadius: 8, padding: "6px 10px",
        fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 12,
        border: "1px solid var(--border)",
      }}>
        <span>🔴 Troncal</span>
        <span>🟠 Zonal</span>
        {userPos && <span>🔵 Mi posición</span>}
      </div>
    </main>
  );
}
