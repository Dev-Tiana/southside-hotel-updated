import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { PhotoFrame } from "@/components/SouthsideShell";

type Room = { slug: string; name: string; lead: string; amount: number; image?: string; imageAlt?: string; imageDetail?: string };

export function RoomCard({ room, compact = false }: { room: Room; compact?: boolean }) {
  return <article className={`room-card ${compact ? "room-card-compact" : ""}`}>
    <PhotoFrame src={room.image} alt={room.imageAlt} label={room.name} detail={room.imageDetail ?? ""} variant={room.slug.includes("premium") ? "moss" : room.slug.includes("royal") ? "ink" : "copper"} />
    <div className="room-card-body"><span className="room-card-kicker">SouthSide catalogue</span><h3>{room.name}</h3><p>{room.lead}</p><div className="room-card-foot"><strong>{room.amount ? `From ₦${room.amount.toLocaleString()} per night` : "Ask for the current rate"}</strong><Link className="text-link" href={`/rooms/${room.slug}`}>View details <ArrowUpRight size={15} /></Link></div></div>
  </article>;
}
