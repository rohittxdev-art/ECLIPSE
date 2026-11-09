import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { LockKeyhole, ShieldCheck, Eye, EyeOff, ArrowRight } from "lucide-react";
import VaultGate from "./VaultGate";
import { supabase } from "./lib/supabase";

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message);
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.session) {
          setMessage("Account created. Check your email to confirm it, then sign in.");
        } else {
          setUser(data.user);
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        setUser(data.user);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: "local" });
    setUser(null);
    setEmail("");
    setPassword("");
  }

  if (!ready) return <div className="auth-loading"><div className="auth-mark"><ShieldCheck size={25}/></div><span>Preparing your private space…</span></div>;

  if (user) {
    return <><VaultGate user={user} onSignOut={signOut} /></>;
  }

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><div className="auth-mark"><ShieldCheck size={22}/></div><div><b>ECLIPSE</b><span>PERSONAL DIGITAL VAULT</span></div></div>
        <div className="auth-heading"><div className="auth-kicker">YOUR PRIVATE DIGITAL WORLD</div><h1>{mode === "signin" ? "Welcome back." : "Create your space."}</h1><p>{mode === "signin" ? "Sign in to continue to your workspace." : "Create an account to get started with ECLIPSE."}</p></div>
        <form onSubmit={submit} className="auth-form">
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
          <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {message && <div className="auth-message" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={16}/></button>
        </form>
        <div className="auth-switch">{mode === "signin" ? "New to ECLIPSE?" : "Already have an account?"}<button onClick={() => {setMode(v => v === "signin" ? "signup" : "signin");setError("");setMessage("");}}>{mode === "signin" ? "Create account" : "Sign in"}</button></div>
        <div className="auth-foot"><LockKeyhole size={13}/> Authentication powered by Supabase</div>
      </div>
      <div className="auth-bottom">EVERYTHING PROTECTED. EVERYTHING YOURS.</div>
    </main>
  );
}
