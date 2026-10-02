import { ScormEdition } from '../types';

export const BRIDGE_PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 64 * 1024;

/** Messages the host application sends to the course wrapper. */
export type HostMessage =
  | {
      readonly v: 1;
      readonly kind: 'prepare';
      readonly edition: ScormEdition;
      readonly sco: boolean;
      /** Values saved for this SCO by an earlier session, if any. */
      readonly state: Readonly<Record<string, string>> | null;
    }
  | { readonly v: 1; readonly kind: 'start'; readonly url: string }
  /** Asks the wrapper to confirm that every earlier message has been delivered. */
  | { readonly v: 1; readonly kind: 'flush' };

/** A state-changing API call a SCO made; the host replays it through its own session. */
export type RuntimeOperation =
  | { readonly kind: 'initialize' }
  | { readonly kind: 'set'; readonly element: string; readonly value: string }
  | { readonly kind: 'commit' }
  | { readonly kind: 'terminate' };

/** Messages the course wrapper sends to the host application. */
export type WrapperMessage =
  | { readonly v: 1; readonly kind: 'ready' }
  | { readonly v: 1; readonly kind: 'launch-failed' }
  | { readonly v: 1; readonly kind: 'flushed' }
  | { readonly v: 1; readonly kind: 'operation'; readonly operation: RuntimeOperation };

/** Returns the message when it is well formed, within the size bound and of a known kind; otherwise null. */
export function parseWrapperMessage(data: unknown): WrapperMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  if (JSON.stringify(data).length > MAX_MESSAGE_BYTES) return null;
  const keys = Object.keys(data);
  const message = data as { v?: unknown; kind?: unknown };
  if (message.v === BRIDGE_PROTOCOL_VERSION && keys.length === 2) {
    if (message.kind === 'ready') return { v: 1, kind: 'ready' };
    if (message.kind === 'launch-failed') return { v: 1, kind: 'launch-failed' };
    if (message.kind === 'flushed') return { v: 1, kind: 'flushed' };
  }
  if (message.v === BRIDGE_PROTOCOL_VERSION && message.kind === 'operation' && keys.length === 3) {
    const operation = parseOperation((message as { operation?: unknown }).operation);
    if (operation) return { v: 1, kind: 'operation', operation };
  }
  return null;
}

function parseOperation(data: unknown): RuntimeOperation | null {
  if (typeof data !== 'object' || data === null) return null;
  const { kind, element, value } = data as Record<string, unknown>;
  const keys = Object.keys(data).length;
  if (keys === 1 && (kind === 'initialize' || kind === 'commit' || kind === 'terminate'))
    return { kind };
  if (keys === 3 && kind === 'set' && typeof element === 'string' && typeof value === 'string') {
    return { kind, element, value };
  }
  return null;
}
