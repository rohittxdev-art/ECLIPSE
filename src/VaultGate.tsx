import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import App from "./App";
import { supabase } from "./lib/supabase";
import {
  clearVaultKey,
  createKdfParameters,
  unwrapVaultKey,
  wrapNewVaultKey,
  type KdfParameters,
  type WrappedVaultKey,
} from "./lib/vaultCrypto";

type SettingsRow = {
  kdf_salt: string;
  kdf_algorithm: string;
  kdf_memory_kib: number;
  kdf_iterations: number;
  wrapped_vault_key: string | null;
  key_version: number;
};

export default function VaultGate({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) { setError("Supabase configuration is missing."); setLoading(false); return; }
      const { data, error: queryError } = await supabase
        .from("vault_settings")
        .select("kdf_salt,kdf_algorithm,kdf_memory_kib,kdf_iterations,wrapped_vault_key,key_version")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (queryError) setError(queryError.message);
      else if (data) { setSettings(data as SettingsRow); setConfigured(true); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [user.id]);

  useEffect(() => () => clearVaultKey(vaultKey), [vaultKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setMessage("");
    let generatedKey: Uint8Array | null = null;
    try {
      if (!configured) {
        if (masterPassword.length < 12) throw new Error("Use a master passphrase with at least 12 characters.");
        if (masterPassword !== confirmPassword) throw new Error("The master passphrases do not match.");
        const params = await createKdfParameters();
        const result = await wrapNewVaultKey(masterPassword, params, user.id);
        generatedKey = result.vaultKey;
        const { error: insertError } = await supabase.from("vault_settings").insert({
          user_id: user.id,
          kdf_salt: params.salt,
          kdf_algorithm: "Argon2id",
          kdf_memory_kib: Math.round(params.memlimit / 1024),
          kdf_iterations: params.opslimit,
          kdf_parallelism: 1,
          wrapped_vault_key: JSON.stringify(result.wrapped),
          key_version: 1,
        });
        if (insertError) throw insertError;
        setSettings({
          kdf_salt: params.salt, kdf_algorithm: "Argon2id",
          kdf_memory_kib: Math.round(params.memlimit / 1024),
          kdf_iterations: params.opslimit,
          wrapped_vault_key: JSON.stringify(result.wrapped), key_version: 1,
        });
        setConfigured(true);
        setMessage("Your vault key has been created and wrapped. Keep your master passphrase safe; recovery is not configured yet.");
      } else {
        if (!settings?.wrapped_vault_key) throw new Error("Vault key metadata is incomplete. Contact support before continuing.");
        const params: KdfParameters = {
          salt: settings.kdf_salt,
          opslimit: settings.kdf_iterations,
          memlimit: settings.kdf_memory_kib * 1024,
        };
        const wrapped = JSON.parse(settings.wrapped_vault_key) as WrappedVaultKey;
        generatedKey = await unwrapVaultKey(masterPassword, params, wrapped, user.id);
      }
      setVaultKey(generatedKey);
      generatedKey = null;
      setMasterPassword(""); setConfirmPassword("");
    } catch (cause) {
      if (generatedKey) clearVaultKey(generatedKey);
      setError(cause instanceof Error ? (configured ? "Incorrect master passphrase, or vault data could not be verified." : cause.message) : "Unable to unlock vault. Please try again.");
    } finally { setBusy(false); }
  }

  function lockVault() {
    clearVaultKey(vaultKey);
    setVaultKey(null);
    setMasterPassword("");
    setConfirmPassword("");
  }

  if (vaultKey) return <><div className="prototype-notice"><LockKeyhole size={15}/><span><b>Encryption foundation enabled:</b> Vault key is unlocked in memory. Item forms, file encryption pipeline and recovery are still under development; don’t store real secrets yet.</span><button onClick={lockVault}>Lock vault</button><button onClick={onSignOut}>Sign out</button></div><App onSignOut={lockVault} /></>;

  if (loading) return <div className="auth-loading"><div className="auth-mark"><ShieldCheck size={25}/></div><span>Checking your vault…</span></div>;

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><div className="auth-mark"><ShieldCheck size={22}/></div><div><b>ECLIPSE</b><span>PERSONAL DIGITAL VAULT</span></div></div>
        <div className="auth-heading"><div className="auth-kicker">SECOND LAYER OF PROTECTION</div><h1>{configured ? "Unlock your vault." : "Create your master key."}</h1><p>{configured ? "Your account is signed in. Enter your separate master passphrase to unlock encrypted data." : "Choose a strong, memorable passphrase. It is separate from your account password."}</p></div>
        <form onSubmit={submit} className="auth-form">
          <label>Master passphrase<div className="password-field"><input type={showPassword ? "text" : "password"} value={masterPassword} onChange={e => setMasterPassword(e.target.value)} placeholder="At least 12 characters" autoComplete="off" minLength={12} required/><button type="button" aria-label={showPassword ? "Hide passphrase" : "Show passphrase"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
          {!configured && <label>Confirm master passphrase<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it again" autoComplete="off" minLength={12} required /></label>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          {message && <div className="auth-message" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Securing your vault…" : configured ? "Unlock vault" : "Create master key"} <ArrowRight size={16}/></button>
        </form>
        <div className="vault-security-note"><KeyRound size={15}/><span>Argon2id key derivation · XChaCha20-Poly1305 authenticated encryption</span></div>
        <div className="auth-switch"><button onClick={onSignOut}>Sign out of account</button></div>
        <div className="auth-foot"><LockKeyhole size={13}/> Your master passphrase is never sent to Supabase.</div>
      </div>
      <div className="auth-bottom">EVERYTHING PROTECTED. EVERYTHING YOURS.</div>
    </main>
  );
}
