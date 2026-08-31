"use client";

import { useState, useRef } from "react";
import type { Station, Ruta } from "@/lib/api";
import { searchStations, searchRutas } from "@/lib/api";

interface Props {
  onSelectStation: (s: Station) => void;
}

export default function SearchBar({ onSelectStation }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(Station | Ruta)[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paradero" | "ruta">("paradero");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = mode === "paradero" ? await searchStations(q) : await searchRutas(q);
        setResults(data.slice(0, 8));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const isStation = (r: Station | Ruta): r is Station => "coordenada" in r || ("nombre" in r && !("color" in r));

  return (
    <div style={{ position: "relative" }}>
      {/* Mode toggle + input */}
      <div style={{
        display: "flex", gap: 6, background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: 6, boxShadow: "0 2px 12px rgba(0,0,0,.4)",
      }}>
        <button onClick={() => { setMode("paradero"); setResults([]); setQuery(""); }}
          style={{ padding: "6px 10px", borderRadius: 8, border: "none", fontSize: 12, cursor: "pointer",
            background: mode === "paradero" ? "var(--accent)" : "transparent", color: "var(--text)", fontWeight: mode === "paradero" ? 700 : 400 }}>
          🚏 Paradero
        </button>
        <button onClick={() => { setMode("ruta"); setResults([]); setQuery(""); }}
          style={{ padding: "6px 10px", borderRadius: 8, border: "none", fontSize: 12, cursor: "pointer",
            background: mode === "ruta" ? "var(--accent)" : "transparent", color: "var(--text)", fontWeight: mode === "ruta" ? 700 : 400 }}>
          🚌 Ruta
        </button>
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={mode === "paradero" ? "Buscar paradero o estación..." : "Buscar ruta (ej. B903)"}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "var(--text)", fontSize: 14, minWidth: 0,
          }}
        />
        {loading && <span style={{ color: "var(--text-muted)", fontSize: 13, alignSelf: "center" }}>...</span>}
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,.5)",
          zIndex: 2000, maxHeight: 300, overflowY: "auto",
        }}>
          {results.map((r, i) => (
            <button key={i} onClick={() => {
              if (isStation(r)) { onSelectStation(r as Station); }
              setOpen(false); setQuery((r as Station).nombre || "");
            }}
              style={{
                width: "100%", padding: "10px 14px", background: "none", border: "none",
                borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none",
                color: "var(--text)", textAlign: "left", cursor: "pointer", display: "block",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{"nombre" in r ? r.nombre : ""}</div>
              {"codigo" in r && <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>{(r as Station).codigo}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
