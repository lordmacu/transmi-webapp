export interface Station {
  codigo: string;
  nombre: string;
  direccion?: string;
  coordenada?: string;
  _distancia_m?: number;
}

export interface Llegada {
  ruta_extraida?: string;
  ruta_sae?: string | number;
  destino_limpio?: string;
  labeltiempo?: string;
  distancia?: string;
}

export interface Ruta {
  id: string;
  codigo: string;
  nombre: string;
  color?: string;
}

const BASE = "/api";

export async function searchStations(q: string): Promise<Station[]> {
  const r = await fetch(`${BASE}/stations?search=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("Error buscando estaciones");
  return r.json();
}

export async function nearestStations(lat: number, lon: number, limit = 5): Promise<Station[]> {
  const r = await fetch(`${BASE}/stations/nearest?lat=${lat}&lon=${lon}&limit=${limit}`);
  if (!r.ok) throw new Error("Error buscando paraderos cercanos");
  return r.json();
}

export async function stationsInBounds(
  latMin: number, latMax: number, lonMin: number, lonMax: number
): Promise<Station[]> {
  const r = await fetch(
    `${BASE}/stations/bounds?lat_min=${latMin}&lat_max=${latMax}&lon_min=${lonMin}&lon_max=${lonMax}`
  );
  if (!r.ok) throw new Error("Error cargando paraderos en zona");
  return r.json();
}

export async function getAllStations(): Promise<Station[]> {
  const r = await fetch(`${BASE}/stations`);
  if (!r.ok) throw new Error("Error cargando estaciones");
  return r.json();
}

export async function getLlegadas(codigo: string): Promise<Llegada[]> {
  const r = await fetch(`${BASE}/llegadas/${codigo}`);
  if (!r.ok) throw new Error("Error consultando llegadas");
  return r.json();
}

export async function getRutas(codigo: string, troncal = false): Promise<Ruta[]> {
  const r = await fetch(`${BASE}/rutas/${codigo}?troncal=${troncal}`);
  if (!r.ok) throw new Error("Error consultando rutas");
  return r.json();
}

export async function searchRutas(q: string): Promise<Ruta[]> {
  const r = await fetch(`${BASE}/rutas?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("Error buscando rutas");
  return r.json();
}

export function parseCoord(coordenada?: string): [number, number] | null {
  if (!coordenada) return null;
  const parts = coordenada.replace(/[()]/g, "").split(",");
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lon = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lon)) return null;
  return [lat, lon];
}

export function tiempoLabel(t: string): string {
  const tl = t.trim().toLowerCase();
  if (["ahora", "llegando", "en estación"].includes(tl)) return "🟢 Llegando ahora";
  return `🕐 Llega en ${t}`;
}
