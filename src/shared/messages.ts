/**
 * Messages between the popup / background and the content script.
 * Every message has a `type` so handlers can ignore anything that isn't theirs.
 */

export interface PingMessage {
  type: 'visiofix:ping';
}

export interface PingReply {
  ok: true;
  /** Hostname the content script is running on, for a sanity check in the popup. */
  host: string;
}

export type VisioFixMessage = PingMessage;

export function isVisioFixMessage(value: unknown): value is VisioFixMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    (value as { type: string }).type.startsWith('visiofix:')
  );
}
