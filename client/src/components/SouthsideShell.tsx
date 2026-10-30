import { Link } from "wouter";
import '../media.css';
import { ArrowUpRight, Instagram, MapPin, Menu, MessageCircle, Phone, X } from "lucide-react";
import { useState } from "react";
import { hotelProfile } from "@shared/hotel";
import { ChatWidget } from "@/components/ChatWidget";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`brand-mark ${compact ? "brand-mark-compact" : ""}`} aria-label="SouthSide Hotel and Suites home"><img className="brand-mark-image" src="/southside-hotel-logo.jpg" alt="SouthSide Hotel and Suites" /></Link>;
}

export function StatusPill({ children, tone = "warm" }: { children: React.ReactNode; tone?: "warm" | "ink" | "pale" }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

export function PhotoFrame({ label, detail, className = "", variant = "copper", src, alt, href, priority = false }: { label: string; detail: string; className?: string; variant?: "copper" | "moss" | "ink"; src?: string; alt?: string; href?: string; priority?: boolean }) {
  const [failedSrc,setFailedSrc]=useState<string>();
  const content = <div className={`photo-frame photo-${variant} ${src ? "photo-frame-image" : ""} ${className}`} role="img" aria-label={`${label}. ${alt ?? "SouthSide Hotel and Suites image"}`}>
    {src&&failedSrc!==src ? <img src={src} alt={alt ?? label} decoding="async" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} onError={()=>setFailedSrc(src)} /> : <><span className="photo-shape photo-shape-one" /><span className="photo-shape photo-shape-two" /><span className="photo-shape photo-shape-three" /><span className="media-unavailable">Photograph unavailable</span></>}
    <div className="photo-frame-wash" />
    <div className="photo-frame-copy"><strong>{label}</strong></div>
  </div>;
  return href ? <a className="photo-frame-link" href={href} target="_blank" rel="noreferrer" aria-label={`${label}. Open source`}>{content}</a> : content;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label"><span />{children}</div>;
}

export function SouthsideShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const links = [{ href: "/accommodation", label: "Stay" }, { href: "/facilities", label: "Spaces" }, { href: "/gallery", label: "Gallery" }, { href: "/discover", label: "Abraka" }, { href: "/contact", label: "Contact" }];
  return <div className="site-shell">
    <header className="site-header">
      <div className="site-header-inner">
        <BrandMark compact />
        <nav className={`main-nav ${open ? "nav-open" : ""}`} aria-label="Primary navigation">
          {links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
          <Link href="/faq" onClick={() => setOpen(false)}>Questions</Link>
        </nav>
        <div className="header-actions"><a className="header-phone" href={`tel:${hotelProfile.phone.replaceAll(" ", "")}`}><Phone size={15} /> Call the hotel</a><a className="header-whatsapp" href={hotelProfile.social.whatsapp} target="_blank" rel="noreferrer" aria-label="Message SouthSide on WhatsApp"><MessageCircle size={16} /> WhatsApp</a><Link className="button button-small button-copper" href="/booking">Book now <ArrowUpRight size={15} /></Link></div>
        <button className="menu-toggle" type="button" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X size={21} /> : <Menu size={21} />}</button>
      </div>
    </header>
    <main>{children}</main>
    <footer className="site-footer">
      <div className="footer-grid page-width">
        <div><BrandMark /><p className="footer-intro">A warm place to arrive in Abraka. Explore the rooms, discover the spaces, and speak with the hotel when you are ready.</p><div className="footer-social"><a href={hotelProfile.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a><a href={hotelProfile.social.maps} target="_blank" rel="noreferrer" aria-label="Google Maps"><MapPin size={17} /></a><a href={hotelProfile.social.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={17} /></a></div></div>
        <div><small className="footer-heading">Explore</small><Link href="/accommodation">Accommodation</Link><Link href="/facilities">Spaces and facilities</Link><Link href="/gallery">Gallery</Link><Link href="/discover">Abraka guide</Link><Link href="/faq">Questions</Link></div>
        <div><small className="footer-heading">Speak with us</small><a href={`tel:${hotelProfile.phone.replaceAll(" ", "")}`}>{hotelProfile.phone}</a><a href={`mailto:${hotelProfile.email}`}>{hotelProfile.email}</a><a href={hotelProfile.social.whatsapp} target="_blank" rel="noreferrer">WhatsApp the hotel</a><span>{hotelProfile.location}</span></div>
        <div><small className="footer-heading">Plan your stay</small><Link href="/booking">Book a room</Link><Link href="/booking/manage">Change a request</Link><Link href="/contact">Contact and directions</Link><span className="footer-note">Room rates are shown as public guides. Call the hotel for the best current answer.</span></div>
      </div>
      <div className="footer-bottom page-width"><span>© {new Date().getFullYear()} SouthSide Hotel and Suites</span><span>Made for clear, direct stays</span></div>
    </footer>
    <a className="whatsapp-float" href={hotelProfile.social.whatsapp} target="_blank" rel="noreferrer" aria-label="Open SouthSide WhatsApp"><MessageCircle size={22} /><span>WhatsApp</span></a>
    <ChatWidget />
  </div>;
}
