import { ArrowRight, Check, ChevronLeft, MessageCircle } from "lucide-react";
import { Link, useParams } from "wouter";
import { BookingWidget } from "@/components/BookingWidget";
import { PhotoFrame, SectionLabel, SouthsideShell } from "@/components/SouthsideShell";
import { hotelProfile, provisionalRooms } from "@shared/hotel";
import NotFound from "./NotFound";
import { useRoomCatalogue } from "@/hooks/useRoomCatalogue";

import MediaGallery from '@/components/MediaGallery';

type RoomMedia = { image?: string; imageAlt?: string };

export default function RoomDetail() {
  const { slug } = useParams<{ slug: string }>();
  const catalogue = useRoomCatalogue();
  if (catalogue.isLoading) return <SouthsideShell><section className="page-content page-width" role="status">Loading room details…</section></SouthsideShell>;
  if (catalogue.error) return <SouthsideShell><section className="page-content page-width" role="alert">Room details are temporarily unavailable. <button className="text-link" onClick={() => void catalogue.refetch()}>Try again</button></section></SouthsideShell>;
  const room = catalogue.rooms.find(item => item.slug === slug);
  if (!room) return <NotFound />;
  const media = room as typeof room & RoomMedia;
  const whatsapp = `${hotelProfile.social.whatsapp}&text=${encodeURIComponent(`Hello SouthSide Hotel and Suites. I would like to ask about the ${room.name}.`)}`;
  return <SouthsideShell><section className="page-content" style={{ paddingTop: 64 }}><div className="page-width"><Link className="text-link" href="/accommodation"><ChevronLeft size={15} /> Back to accommodation</Link><div className="detail-layout" style={{ marginTop: 36 }}><div className="detail-art"><MediaGallery label={`${room.name} photographs`} items={room.images.length ? room.images : media.image ? [{url:media.image,alt:media.imageAlt??room.name}] : []}/>{!room.images.length&&!media.image&&<PhotoFrame label={room.name} detail=""/>}</div><div className="detail-copy"><SectionLabel>SouthSide room</SectionLabel><h1>{room.name}</h1><p>{room.description}</p><div className="detail-price"><strong>{room.amount ? `₦${room.amount.toLocaleString()}` : "Ask for the current rate"}</strong><span>{room.amount ? "Public guide rate per night. Call the hotel for your dates." : "Call the hotel for the current nightly rate."}</span></div><div className="detail-facts"><div className="detail-fact"><small>Room setting</small><span>{room.bedConfiguration || room.lead}</span></div><div className="detail-fact"><small>Included story</small><span>{room.evidence}</span></div><div className="detail-fact"><small>Best next step</small><span>{room.maxOccupancy ? `Up to ${room.maxOccupancy} guests per room` : "Share your dates with the hotel"}</span></div><div className="detail-fact"><small>Contact</small><span>Telephone, email, or WhatsApp</span></div></div><div className="room-note"><strong>Plan the right stay</strong>Tell the hotel your dates, number of guests, and what matters most. The team can guide you to the room that fits the visit.</div><div className="room-detail-actions"><Link className="button button-copper" href="/booking">Start a booking <ArrowRight size={16} /></Link><a className="button button-outline" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Ask on WhatsApp</a></div><div className="room-amenities"><small className="eyebrow">Room notes</small><div style={{ display: "grid", gap: 9, marginTop: 9 }}>{room.amenities.map(item => <span key={item} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 14 }}><Check size={14} color="var(--copper)" />{item}</span>)}</div></div></div></div></div></section><BookingWidget compact initialSlug={room.slug} /></SouthsideShell>;
}
