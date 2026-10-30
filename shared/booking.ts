export function parseHotelDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function nightsBetween(checkIn: string, checkOut: string) {
  const start = parseHotelDate(checkIn).getTime();
  const end = parseHotelDate(checkOut).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
}

export function validateStayDates(checkIn: string, checkOut: string, today = new Date()) {
  const start = parseHotelDate(checkIn);
  const end = parseHotelDate(checkOut);
  const floorToday = new Date(today);
  floorToday.setUTCHours(0, 0, 0, 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { valid: false, message: "Please choose valid dates." };
  if (start < floorToday) return { valid: false, message: "Please choose a future check in date." };
  if (end <= start) return { valid: false, message: "Check out must be later than check in." };
  return { valid: true, message: "" };
}

export function calculateStayTotal(nightlyRate: number, nights: number, rooms: number, tax = 0) {
  const subtotal = Math.round(nightlyRate * nights * rooms * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}
