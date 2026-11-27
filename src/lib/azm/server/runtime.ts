/* Azm — server runtime for the Chrome-extension bridge.
 *
 * Commands destined for the extension are queued per profile; the extension
 * drains them on its short sync loop (POST /api/ext/sync). Nothing here is
 * needed by the web UI — it renders server responses directly.
 */

export type ExtCommand =
  | { type: "intervene"; id: string; tabId: number; domain: string; title: string; status: "asking" | "thinking" | "granted" | "denied"; message: string; deadline: number | null; totalMs: number; lang: "ar" | "en" }
  | { type: "dismiss"; id: string; tabId: number }
  | { type: "close_tab"; id: string; tabId: number; domain: string }
  | { type: "recheck" };

const queues = new Map<string, ExtCommand[]>();

export function queueCommand(profileId: string, cmd: ExtCommand): void {
  const q = queues.get(profileId) ?? [];
  q.push(cmd);
  if (q.length > 50) q.splice(0, q.length - 50);
  queues.set(profileId, q);
}

export function drainCommands(profileId: string): ExtCommand[] {
  const q = queues.get(profileId);
  queues.set(profileId, []);
  return q ?? [];
}

/* ------------------- extension connection bookkeeping ---------------------- */

const extSeen = new Map<string, number>();

export function markExtSeen(profileId: string): void {
  extSeen.set(profileId, Date.now());
}

export function extLastSeen(profileId: string): number | null {
  return extSeen.get(profileId) ?? null;
}
