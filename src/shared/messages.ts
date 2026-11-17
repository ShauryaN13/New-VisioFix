import type { EngineStats } from '@/repair/engine';
import type { PageReport } from './report';

/**
 * Messages between the popup and the content script.
 *
 *   - One-off: the popup sends { type: 'visiofix:status' } with
 *     tabs.sendMessage; the content script replies with a StatusReply. A
 *     failure means there's no content script in the tab (needs a reload).
 *   - Live: the popup opens a port named REPORT_PORT with tabs.connect; the
 *     content script posts a StatusReply right away and again whenever the
 *     page's fixes change, until the popup closes.
 */

export const REPORT_PORT = 'visiofix-report';

export interface StatusMessage {
  type: 'visiofix:status';
}

export type VisioFixMessage = StatusMessage;

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
