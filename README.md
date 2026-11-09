# ECLIPSE

ECLIPSE is a privacy-first personal digital vault built with React, TypeScript, Vite, Supabase Auth, PostgreSQL, private Supabase Storage and libsodium.

## Current web app features

- Email/password account authentication and a separate master-passphrase vault unlock.
- Client-side key derivation with Argon2id and authenticated encryption with XChaCha20-Poly1305.
- Encrypted password entries, email credentials, secure notes, files and images.
- Encrypted file upload/download, favorites, search, edit, restore and permanent delete.
- Recycle Bin with a 30-day expiry timestamp and a scheduled hourly cleanup Edge Function.
- Offline recovery-kit export/import for master-passphrase reset.
- Encrypted backup export and restore.
- Five-minute inactivity lock.
- Owner-scoped Row Level Security and private Storage policies.

## Stack

- React + TypeScript + Vite
- Supabase Auth, PostgreSQL, Edge Functions, pg_cron and private Storage
- libsodium-wrappers-sumo (Argon2id + XChaCha20-Poly1305)
- Vercel web deployment

## Important security notes

- Supabase stores encrypted item payloads and encrypted file blobs; it does not receive the master passphrase or the unlocked vault key.
- Recovery kits contain the material needed to recover the vault. Keep them offline and never share them.
- Backups contain encrypted records and encrypted file blobs. Store backup files securely.
- The browser app is not a substitute for an independent security audit. Do not use it as the only copy of important credentials until end-to-end tests and an independent security review are complete.
- Device/session administration, native Windows/Android/iOS packaging, file version history, and a full security-center dashboard are not included in the current web release.
- Enable Supabase Auth leaked-password protection in the Supabase Dashboard under Authentication → Security and Protection.

## Environment

Create a `.env.local` file using `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Never place a Supabase service-role or secret key in a `VITE_` variable or browser bundle.

## Development

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Production deployment

The web app is deployed on Vercel from the `main` branch. The recycle cleanup Edge Function runs through Supabase Cron and uses a server-only shared secret stored in a restricted database table.
