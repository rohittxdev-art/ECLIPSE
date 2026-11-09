import sodium from "libsodium-wrappers-sumo";

export type KdfParameters = {
  salt: string;
  opslimit: number;
  memlimit: number;
};

export type WrappedVaultKey = {
  nonce: string;
  ciphertext: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function ready() {
  await sodium.ready;
}

export async function createKdfParameters(): Promise<KdfParameters> {
  await ready();
  return {
    salt: sodium.to_base64(sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)),
    opslimit: sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    memlimit: sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  };
}

async function deriveWrappingKey(password: string, params: KdfParameters): Promise<Uint8Array> {
  await ready();
  return sodium.crypto_pwhash(
    sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    password,
    sodium.from_base64(params.salt),
    params.opslimit,
    params.memlimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

export async function wrapNewVaultKey(
  masterPassword: string,
  params: KdfParameters,
  userId: string,
): Promise<{ vaultKey: Uint8Array; wrapped: WrappedVaultKey }> {
  await ready();
  const vaultKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  const wrappingKey = await deriveWrappingKey(masterPassword, params);
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const aad = encoder.encode(`ECLIPSE|vault-key|v1|${userId}`);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(vaultKey, aad, null, nonce, wrappingKey);
  sodium.memzero(wrappingKey);
  return {
    vaultKey,
    wrapped: {
      nonce: sodium.to_base64(nonce),
      ciphertext: sodium.to_base64(ciphertext),
    },
  };
}

export async function unwrapVaultKey(
  masterPassword: string,
  params: KdfParameters,
  wrapped: WrappedVaultKey,
  userId: string,
): Promise<Uint8Array> {
  await ready();
  const wrappingKey = await deriveWrappingKey(masterPassword, params);
  try {
    const aad = encoder.encode(`ECLIPSE|vault-key|v1|${userId}`);
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      sodium.from_base64(wrapped.ciphertext),
      aad,
      sodium.from_base64(wrapped.nonce),
      wrappingKey,
    );
  } finally {
    sodium.memzero(wrappingKey);
  }
}

export async function encryptVaultValue<T>(value: T, vaultKey: Uint8Array, userId: string): Promise<{ ciphertext: string; nonce: string }> {
  await ready();
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const aad = encoder.encode(`ECLIPSE|item|v1|${userId}`);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, nonce, vaultKey);
  sodium.memzero(plaintext);
  return { ciphertext: sodium.to_base64(ciphertext), nonce: sodium.to_base64(nonce) };
}

export async function decryptVaultValue<T>(ciphertext: string, nonce: string, vaultKey: Uint8Array, userId: string): Promise<T> {
  await ready();
  const aad = encoder.encode(`ECLIPSE|item|v1|${userId}`);
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    sodium.from_base64(ciphertext),
    aad,
    sodium.from_base64(nonce),
    vaultKey,
  );
  try {
    return JSON.parse(decoder.decode(plaintext)) as T;
  } finally {
    sodium.memzero(plaintext);
  }
}

export function clearVaultKey(key: Uint8Array | null) {
  if (key) sodium.memzero(key);
}


export async function encryptVaultBytes(bytes: Uint8Array, vaultKey: Uint8Array, userId: string): Promise<{ ciphertext: Uint8Array; nonce: string }> {
  await ready();
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const aad = encoder.encode(`ECLIPSE|file|v1|${userId}`);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(bytes, aad, null, nonce, vaultKey);
  return { ciphertext, nonce: sodium.to_base64(nonce) };
}

export async function decryptVaultBytes(ciphertext: Uint8Array, nonce: string, vaultKey: Uint8Array, userId: string): Promise<Uint8Array> {
  await ready();
  const aad = encoder.encode(`ECLIPSE|file|v1|${userId}`);
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, ciphertext, aad, sodium.from_base64(nonce), vaultKey,
  );
}
