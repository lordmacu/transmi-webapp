"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import SearchBar from "@/components/SearchBar";
import type { Station } from "@/lib/api";
import { getAllStations, nearestStations, parseCoord } from "@/lib/api";

// Leaflet must be client-only
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [stations, setStations] = useState<Station[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const selectFromMap = useRef<((s: Station) => void) | null>(null);

  // Load all stations for the map
  useEffect(() => {
    getAllStations().then(setStations).catch(console.error);
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setUserPos([lat, lon]);
        setLocating(false);
        // also show nearest stations in the panel via map click simulation
        try {
          const nearest = await nearestStations(lat, lon);
          if (nearest.length > 0) {
            setSelectedStation(nearest[0]);
            selectFromMap.current?.(nearest[0]);
          }
        } catch {}
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSelectStation = useCallback((st: Station) => {
    setSelectedStation(st);
    // Pan map to station
    selectFromMap.current?.(st);
  }, []);

  return (
    <main style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Map fills the screen */}
      <MapView
        stations={stations}
        onLocate={locate}
        locating={locating}
        userPos={userPos}
        onStationClickRef={selectFromMap}
      />

      {/* Search bar floats top-left */}
      <div style={{
        position: "absolute", top: 16, left: 16, right: 70, zIndex: 1000,
      }}>
        <SearchBar onSelectStation={handleSelectStation} />
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 16, left: 16, zIndex: 500,
        background: "var(--surface)", borderRadius: 8, padding: "6px 10px",
        fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 12,
        border: "1px solid var(--border)",
      }}>
        <span>🔴 Troncal</span>
        <span>🟠 Zonal</span>
        <span>🔵 Mi posición</span>
      </div>
    </main>
  );
}
