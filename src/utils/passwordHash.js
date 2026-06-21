function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPasswordSha256(password) {
  const text = String(password || '');

  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return bufferToHex(digest);
  }

  if (typeof require === 'function') {
    try {
      const { createHash } = require('crypto');
      return createHash('sha256').update(text, 'utf8').digest('hex');
    } catch (_e) {
      // brak crypto w przeglądarce
    }
  }

  throw new Error('Brak wsparcia SHA-256 w tym środowisku.');
}

export async function verifyPasswordSha256(password, expectedHash) {
  if (!expectedHash) {
    return false;
  }

  const actual = await hashPasswordSha256(password);
  if (actual.length !== String(expectedHash).length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < actual.length; i += 1) {
    mismatch |= actual.charCodeAt(i) ^ String(expectedHash).charCodeAt(i);
  }

  return mismatch === 0;
}
