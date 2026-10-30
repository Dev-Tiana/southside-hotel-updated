import { ArrowRight, MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { hotelProfile } from "@shared/hotel";

const quickQuestions = ["Which room is right for me?", "What are the room prices?", "What facilities can I use?", "How do I reserve a room?"];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "", privacyAccepted: false });
  const [sent, setSent] = useState(false);
  const submit = trpc.contact.submit.useMutation({ onSuccess: () => { setSent(true); setForm({ name: "", email: "", message: "", privacyAccepted: false }); }, onError: () => setSent(false) });
  const whatsapp = `${hotelProfile.social.whatsapp}&text=${encodeURIComponent(question || "Hello SouthSide Hotel and Suites. I would like to make an enquiry about accommodation.")}`;
  return <>
    <div className={`chat-panel ${open ? "chat-panel-open" : ""}`} aria-hidden={!open}>
      <div className="chat-panel-head"><div><strong>SouthSide chat</strong><span>A quick way to get an answer started</span></div><button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button></div>
      <div className="chat-panel-body"><div className="chat-welcome">Hello. Ask about rooms, rates, facilities, or your next stay. The hotel team can continue the conversation on WhatsApp.</div><div className="chat-quick-list">{quickQuestions.map(item => <button type="button" key={item} onClick={() => setQuestion(item)}>{item}<ArrowRight size={14} /></button>)}</div>{question && <div className="chat-selected"><span>{question}</span><a href={whatsapp} target="_blank" rel="noreferrer">Continue on WhatsApp <ArrowRight size={14} /></a></div>}<button type="button" className="chat-enquiry-toggle" onClick={() => setShowForm(value => !value)}>{showForm ? "Hide enquiry form" : "Leave an enquiry"}</button>{showForm && <form className="chat-form" onSubmit={event => { event.preventDefault(); if (!form.privacyAccepted) return; submit.mutate({ name: form.name, email: form.email, phone: "Chat enquiry", enquiryType: "Website chat enquiry", message: form.message, privacyAccepted: true }); }}><input aria-label="Your name" placeholder="Your name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /><input aria-label="Your email" type="email" placeholder="Your email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /><textarea aria-label="Your question" placeholder="How can the hotel help?" value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} minLength={10} required /><label><input type="checkbox" checked={form.privacyAccepted} onChange={event => setForm({ ...form, privacyAccepted: event.target.checked })} required />I understand that the hotel will use these details to reply.</label><button className="button button-copper" type="submit" disabled={submit.isPending}><Send size={14} />{submit.isPending ? "Sending" : "Send enquiry"}</button>{sent && <span className="chat-success" role="status">Your enquiry was received. The hotel team can reply through its configured workflow.</span>}</form>}<Link className="chat-book-link" href="/booking" onClick={() => setOpen(false)}>Open the booking page <ArrowRight size={14} /></Link></div>
    </div>
    <button type="button" className="chat-launcher" onClick={() => setOpen(value => !value)} aria-label={open ? "Close SouthSide chat" : "Open SouthSide chat"}><MessageCircle size={21} /><span>Chat</span></button>
  </>;
}
