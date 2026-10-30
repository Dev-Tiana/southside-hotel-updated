import { trpc } from "@/lib/trpc";
export default function NotificationsPanel(){
  const query=trpc.admin.notifications.useQuery(undefined,{retry:false});
  return <section className="admin-panel notifications-panel" style={{marginTop:17}}><h2>Booking acknowledgements</h2><p className="admin-note">Delivery is disabled until an email provider, verified sender and administrator recipient are authorized. No email has been sent by this workflow. Previews use the current saved reservation status.</p><button type="button" className="text-link" onClick={()=>void query.refetch()}>Refresh notification queue</button>
    {query.isLoading&&<p role="status">Loading notification queue…</p>}{query.error&&<p role="alert">Notification queue unavailable. Please try again.</p>}
    {query.data?.rows.length===0&&<p>No notifications queued for new reservations.</p>}
    {query.data?.rows.map(row=><details key={row.id} className="booking-summary"><summary>{row.reference} · {row.audience} · {row.state} · {row.reservationStatus}</summary><p>Recipient: {row.recipient}</p><strong>{row.subject}</strong><p style={{whiteSpace:"pre-wrap"}}>{row.text}</p></details>)}
  </section>;
}
