import WebsiteMedia from '@/components/WebsiteMedia';
import { Link } from "wouter";
import { ArrowRight, MessageCircle } from "lucide-react";
import { RoomCard } from "@/components/RoomCard";
import { SectionLabel, SouthsideShell } from "@/components/SouthsideShell";
import { hotelProfile, provisionalRooms } from "@shared/hotel";
import { useRoomCatalogue } from "@/hooks/useRoomCatalogue";

export default function Accommodation() {
  const catalogue = useRoomCatalogue();
  return <SouthsideShell><section className="page-hero"><div className="page-width"><SectionLabel>Accommodation</SectionLabel><h1>Choose the room that fits your stay.</h1><p>From a calm room for a focused visit to a suite with more space, the SouthSide collection gives you a clear place to begin.</p><div className="page-hero-actions"><Link className="button button-copper" href="/booking">Book now <ArrowRight size={16} /></Link><a className="button button-light" href={hotelProfile.social.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Ask on WhatsApp</a></div></div></section><section className="page-content"><div className="page-width"><div className="catalogue-intro"><div><span className="room-card-kicker">SouthSide room collection</span><h2>Find the right rhythm for your visit.</h2></div><p>Rates shown are public guide rates. Call the hotel for the best current answer for your dates, guests, and preferred room.</p></div><div className="catalogue-grid">{catalogue.isLoading && <p role="status">Loading rooms…</p>}{catalogue.error && <p role="alert">Room details are temporarily unavailable. <button className="text-link" onClick={() => void catalogue.refetch()}>Try again</button></p>}{!catalogue.isLoading && !catalogue.error && !catalogue.rooms.length && <p>No active room categories are currently published. Please contact the hotel.</p>}{catalogue.rooms.map(room => <RoomCard key={room.slug} room={room} />)}</div><WebsiteMedia target="accommodation.gallery"/></div></section></SouthsideShell>;
}

