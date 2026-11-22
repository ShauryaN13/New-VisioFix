import type { EngineStats } from '@/repair/engine';
import type { PageReport } from './report';

/**
 * Messages to the content script.
 *
 *   - One-off: the popup sends { type: 'visiofix:status' } with
 *     tabs.sendMessage; the content script replies with a StatusReply. A
 *     failure means there's no content script in the tab (needs a reload).
 *   - Focus Mode: the popup ('open') and the keyboard shortcut in the
 *     background ('toggle') send a FocusMessage; the reply says whether
 *     Focus Mode is open afterwards.
 *   - Read-aloud: the popup's Read aloud ('start') and the shortcuts
 *     ('toggle', 'next', 'previous') send a SpeechMessage. 'start' and
 *     'toggle' open Focus Mode first if needed. Same reply as FocusMessage.
 *   - Live: the popup opens a port named REPORT_PORT with tabs.connect; the
 *     content script posts a StatusReply right away and again whenever the
 *     page's fixes change, until the popup closes.
 */

export const REPORT_PORT = 'visiofix-report';

export interface StatusMessage {
  type: 'visiofix:status';
}

export interface FocusMessage {
  type: 'visiofix:focus';
  action: 'open' | 'toggle' | 'close';
}

export interface SpeechMessage {
  type: 'visiofix:speech';
  action: 'start' | 'toggle' | 'next' | 'previous';
}

export type VisioFixMessage = StatusMessage | FocusMessage | SpeechMessage;

export interface FocusReply {
  ok: boolean;
  open: boolean;
}

export interface StatusReply {
  ok: true;
  /** Hostname the content script is running on. */
  host: string;
  /** True while repairs are running on this page. */
  repairsActive: boolean;
  /** What VisioFix fixed and found; null while repairs are off. */
  report: PageReport | null;
  /** Timing numbers, for checking performance (not shown in the UI). */
  stats: EngineStats;
}

export function isVisioFixMessage(value: unknown): value is VisioFixMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    (value as { type: string }).type.startsWith('visiofix:')
  );
}
