export const HORA_INICIO = 7;
export const HORA_FIM = 20;
export const MINUTOS_SLOT = 30;
export const ALTURA_SLOT = 40;

export const hojeISO = () => localISO(new Date());

export function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

export function somarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return localISO(new Date(y, m - 1, d + n));
}

export function horaLocal(isoInstante: string): string {
  return new Date(isoInstante).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function instanteDe(dataISO: string, hhmm: string): string {
  const [y, m, d] = dataISO.split("-").map(Number) as [number, number, number];
  const [h, min] = hhmm.split(":").map(Number) as [number, number];
  return new Date(y, m - 1, d, h, min).toISOString();
}

export function hhmmLocal(isoInstante: string): string {
  const d = new Date(isoInstante);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function minutosDoDia(isoInstante: string): number {
  const d = new Date(isoInstante);
  return d.getHours() * 60 + d.getMinutes();
}

export function topoPx(isoInstante: string): number {
  return ((minutosDoDia(isoInstante) - HORA_INICIO * 60) * ALTURA_SLOT) / MINUTOS_SLOT;
}

export function rotuloCurto(isoInstante: string): string {
  return new Date(isoInstante).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function rotuloData(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export function duracaoLegivel(inicioISO: string, fimISO: string): string {
  const min = Math.round((Date.parse(fimISO) - Date.parse(inicioISO)) / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

export function somarMinutos(hhmm: string, n: number): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const total = h * 60 + m + n;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
