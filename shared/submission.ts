// Stable booking intent. Quote/terms versions are checked on first creation,
// not treated as a new intent when a saved booking is retried later.
export function bookingIntent(input: { roomCategoryId: number; checkIn: string; checkOut: string; rooms: number; adults: number; children: number; name: string; email: string; phone: string; holdToken?: string }) {
  return JSON.stringify({ roomCategoryId: input.roomCategoryId, checkIn: input.checkIn, checkOut: input.checkOut, rooms: input.rooms, adults: input.adults, children: input.children, name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim(), holdToken: input.holdToken ?? null });
}
