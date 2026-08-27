const TRACKING_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function createTrackingReference(prefix: "ATS" | "ART" | "PRO" | "MSG" | "REQ") {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes, (byte) => TRACKING_ALPHABET[byte & 31]).join("");
  return `${prefix}-${value.slice(0, 5)}-${value.slice(5)}`;
}
