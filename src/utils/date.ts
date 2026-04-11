export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateES(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function parseDateES(dateStr: string): Date {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`Invalid date format: "${dateStr}". Expected DD/MM/YYYY`);
  }
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    throw new Error(`Invalid date values: "${dateStr}"`);
  }
  return date;
}

export function getPreviousBusinessDay(date: Date): Date {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  const day = prev.getDay();
  if (day === 6) prev.setDate(prev.getDate() - 1); // Sat -> Fri
  if (day === 0) prev.setDate(prev.getDate() - 2); // Sun -> Fri
  return prev;
}

export function getLastDayOfMonth(year: number, month: number): Date {
  const last = new Date(year, month + 1, 0);
  const day = last.getDay();
  if (day === 6) last.setDate(last.getDate() - 1);
  if (day === 0) last.setDate(last.getDate() - 2);
  return last;
}

export function getLastBusinessDayOfPreviousMonth(referenceDate: Date): Date {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  return getLastDayOfMonth(prevYear, prevMonth);
}
