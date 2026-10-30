import { trpc } from "@/lib/trpc";
import { provisionalRooms } from "@shared/hotel";

export function useRoomCatalogue() {
  const query = trpc.hotel.rooms.useQuery(undefined, { retry: false });
  const rooms = query.data?.map(row => {
    const original = provisionalRooms.find(r => r.slug === row.slug);
    let amenities: string[] = [];
    try { amenities = row.amenities ? JSON.parse(row.amenities) : original?.amenities ?? []; }
    catch { amenities = row.amenities ? [row.amenities] : []; }
    return {
      slug: row.slug, name: row.name, description: row.description ?? original?.description ?? "",
      lead: original?.lead ?? row.description ?? "Choose your dates to check this room.",
      evidence: original?.evidence ?? "Hotel-managed room category", verification: row.verification,
      amount: original?.amount ?? 0, image: row.images[0]?.url ?? original?.image ?? "",
      imageAlt: row.images[0]?.alt ?? original?.imageAlt ?? row.name, imageDetail: original?.imageDetail ?? "",
      amenities, maxOccupancy: row.maxOccupancy, bedConfiguration: row.bedConfiguration, images: row.images,
    };
  }) ?? [];
  return { ...query, rooms };
}
