export async function hashToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashAccessCode(code: string, salt = crypto.randomUUID()) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100_000 }, material, 256);
  const hash = Array.from(new Uint8Array(bits)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${salt}:${hash}`;
}

export async function verifyAccessCode(code: string, stored: string) {
  const separator = stored.indexOf(":");
  if (separator < 1) return false;
  const salt = stored.slice(0, separator);
  const expected = stored.slice(separator + 1);
  const calculated = (await hashAccessCode(code, salt)).slice(separator + 1);
  if (calculated.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ calculated.charCodeAt(index);
  return difference === 0;
}

export function createSixDigitCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}
