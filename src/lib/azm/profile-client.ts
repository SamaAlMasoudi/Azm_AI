/* Azm — profile client: isolated workspace identity stored in localStorage.
 * The code is sent with every request so each user/session sees only its own
 * data. It doubles as a recovery key (enter it on another device to restore). */

const KEY = "azm-profile-code";

export function readProfileCode(): string {
  if (typeof window === "undefined") return "";
  const v = window.localStorage.getItem(KEY) ?? "";
  return /^[A-Z0-9]{8}$/.test(v.toUpperCase()) ? v.toUpperCase() : "";
}

export function storeProfileCode(code: string): void {
  if (typeof window === "undefined") return;
  if (/^[A-Z0-9]{8}$/.test(code.toUpperCase())) {
    window.localStorage.setItem(KEY, code.toUpperCase());
  }
}

/** Switch to another workspace (imported recovery code). */
export function importProfileCode(raw: string): boolean {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{8}$/.test(code)) return false;
  window.localStorage.setItem(KEY, code);
  return true;
}

export function forgetProfileCode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

const TOKEN_KEY = "azm-pairing-token";
export function readPairingToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}
export function storePairingToken(t: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, t);
}
