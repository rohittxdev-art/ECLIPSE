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
  restoreVaultKeyFromKit,
  wrapExistingVaultKey,
  type RecoveryKit,
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
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryFile, setRecoveryFile] = useState<File | null>(null);

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
        setMessage("Your vault key is ready. After unlocking, create an offline recovery kit from the workspace so you can reset your master passphrase if needed.");
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


  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !recoveryFile) return;
    if (masterPassword.length < 12) { setError("Choose a new master passphrase with at least 12 characters."); return; }
    if (masterPassword !== confirmPassword) { setError("The new master passphrases do not match."); return; }
    setBusy(true); setError(""); setMessage("");
    let recoveredKey: Uint8Array | null = null;
    try {
      const kit = JSON.parse(await recoveryFile.text()) as RecoveryKit;
      recoveredKey = await restoreVaultKeyFromKit(kit, user.id);
      const params = await createKdfParameters();
      const wrapped = await wrapExistingVaultKey(masterPassword, params, user.id, recoveredKey);
      const nextSettings = {
        kdf_salt: params.salt,
        kdf_algorithm: "Argon2id",
        kdf_memory_kib: Math.round(params.memlimit / 1024),
        kdf_iterations: params.opslimit,
        kdf_parallelism: 1,
        wrapped_vault_key: JSON.stringify(wrapped),
        key_version: (settings?.key_version ?? 1) + 1,
      };
      const { error: updateError } = await supabase.from("vault_settings").update(nextSettings).eq("user_id", user.id);
      if (updateError) throw updateError;
      setSettings({ ...nextSettings });
      setConfigured(true);
      setVaultKey(recoveredKey);
      recoveredKey = null;
      setRecoveryFile(null);
      setMasterPassword(""); setConfirmPassword(""); setRecoveryMode(false);
      setMessage("Vault recovered. Your new master passphrase is now active.");
    } catch (cause) {
      if (recoveredKey) clearVaultKey(recoveredKey);
      setError(cause instanceof Error ? cause.message : "Recovery failed. Check your recovery file.");
    } finally { setBusy(false); }
  }

  function lockVault() {
    clearVaultKey(vaultKey);
    setVaultKey(null);
    setMasterPassword("");
    setConfirmPassword("");
  }

  if (vaultKey) return <><App onSignOut={lockVault} vaultKey={vaultKey} userId={user.id} /></>;

  if (loading) return <div className="auth-loading"><div className="auth-mark"><ShieldCheck size={25}/></div><span>Checking your vault…</span></div>;

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><div className="auth-mark"><ShieldCheck size={22}/></div><div><b>ECLIPSE</b><span>PERSONAL DIGITAL VAULT</span></div></div>
        <div className="auth-heading"><div className="auth-kicker">SECOND LAYER OF PROTECTION</div><h1>{configured ? "Unlock your vault." : "Create your master key."}</h1><p>{configured ? "Your account is signed in. Enter your separate master passphrase to unlock encrypted data." : "Choose a strong, memorable passphrase. It is separate from your account password."}</p></div>
        <form onSubmit={recoveryMode ? recover : submit} className="auth-form">
          {recoveryMode ? <>
            <label>Offline recovery file<input type="file" accept=".eclrecovery,application/json" onChange={e => setRecoveryFile(e.target.files?.[0] ?? null)} required /></label>
            <label>New master passphrase<input type={showPassword ? "text" : "password"} value={masterPassword} onChange={e => setMasterPassword(e.target.value)} placeholder="At least 12 characters" minLength={12} autoComplete="new-password" required /></label>
            <label>Confirm new passphrase<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it again" minLength={12} autoComplete="new-password" required /></label>
          </> : <>
            <label>Master passphrase<div className="password-field"><input type={showPassword ? "text" : "password"} value={masterPassword} onChange={e => setMasterPassword(e.target.value)} placeholder="At least 12 characters" autoComplete="off" minLength={12} required/><button type="button" aria-label={showPassword ? "Hide passphrase" : "Show passphrase"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
            {!configured && <label>Confirm master passphrase<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it again" autoComplete="off" minLength={12} required /></label>}
          </>}
          {error && <div className="auth-error" role="alert">{error}</div>}
          {message && <div className="auth-message" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Securing your vault…" : recoveryMode ? "Recover and set new passphrase" : configured ? "Unlock vault" : "Create master key"} <ArrowRight size={16}/></button>
        </form>
        <div className="vault-security-note"><KeyRound size={15}/><span>Argon2id key derivation · XChaCha20-Poly1305 authenticated encryption</span></div>
        <div className="auth-switch"><button onClick={onSignOut}>Sign out of account</button></div>
        <div className="auth-foot"><LockKeyhole size={13}/> Your master passphrase is never sent to Supabase.</div>
      </div>
      <div className="auth-bottom">EVERYTHING PROTECTED. EVERYTHING YOURS.</div>
    </main>
  );
}
