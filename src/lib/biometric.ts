import { base64ToBytes, bytesToBase64, decryptBytes, encryptBytes, importAes, randomBytes, toArrayBuffer } from '@/lib/crypto';

const PRF = Uint8Array.from({ length: 32 }, (_, index) => index + 3);

function readPrf(credential: PublicKeyCredential): Uint8Array | null {
  const results = credential.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } };
  };
  const first = results.prf?.results?.first;
  return first ? new Uint8Array(first) : null;
}

export async function supportsBiometric(): Promise<boolean> {
  if (!window.isSecureContext || !window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function enrollBiometric(rawKey: Uint8Array): Promise<{ credentialId: string; iv: string; ciphertext: string }> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(32)),
      rp: { name: 'Folio' },
      user: {
        id: toArrayBuffer(randomBytes(16)),
        name: 'folio',
        displayName: 'Folio',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: toArrayBuffer(PRF) } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Biometric setup was cancelled.');
  const secret = readPrf(credential);
  if (!secret) throw new Error('This device cannot encrypt the vault with biometrics. Your PIN still works.');
  const wrapKey = await importAes(secret);
  const wrapped = await encryptBytes(wrapKey, rawKey);
  secret.fill(0);
  return {
    credentialId: bytesToBase64(new Uint8Array(credential.rawId)),
    iv: wrapped.iv,
    ciphertext: wrapped.ciphertext,
  };
}

export async function unlockBiometricSecret(credentialId: string): Promise<Uint8Array> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(32)),
      allowCredentials: [{ type: 'public-key', id: toArrayBuffer(base64ToBytes(credentialId)) }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: toArrayBuffer(PRF) } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error('Biometric unlock was cancelled.');
  const secret = readPrf(assertion);
  if (!secret) throw new Error('Biometric key was not available. Use your PIN.');
  return secret;
}

export async function unwrapVaultKey(secret: Uint8Array, iv: string, ciphertext: string): Promise<CryptoKey> {
  const wrapKey = await importAes(secret);
  const raw = await decryptBytes(wrapKey, iv, ciphertext);
  const key = await importAes(raw);
  raw.fill(0);
  secret.fill(0);
  return key;
}
