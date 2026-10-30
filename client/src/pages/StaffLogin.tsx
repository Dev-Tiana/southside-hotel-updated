import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { SouthsideShell } from "@/components/SouthsideShell";
import { trpc } from "@/lib/trpc";

export default function StaffLogin() {
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({ onSuccess: () => window.location.assign("/admin") });
  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
    setPassword("");
  }
  const code = login.error?.data?.code;
  return <SouthsideShell><section className="admin-shell"><div className="page-width" style={{ maxWidth: 590 }}><div className="admin-panel"><ShieldCheck size={34} color="var(--copper)" /><h1 style={{ font: "400 44px var(--serif)", margin: "14px 0 8px" }}>Staff sign in</h1><p>Use your authorized SouthSide staff account.</p><form className="booking-form staff-login-form" onSubmit={submit}><label>Email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>{login.error && <p role="alert">{code === "UNAUTHORIZED" ? "Email or password is incorrect." : code === "TOO_MANY_REQUESTS" ? "Too many attempts. Please try again later." : "Sign-in is unavailable. Please try again."}</p>}<button className="button button-copper" disabled={login.isPending} type="submit">{login.isPending ? "Signing in…" : "Sign in"}</button></form><div className="admin-note">Accounts are provisioned by an authorized hotel administrator. Contact them if you need access or password recovery.</div></div></div></section></SouthsideShell>;
}
