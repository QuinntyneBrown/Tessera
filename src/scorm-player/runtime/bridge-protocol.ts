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
    }
  | { readonly v: 1; readonly kind: 'start'; readonly url: string };

/** Messages the course wrapper sends to the host application. */
export type WrapperMessage = { readonly v: 1; readonly kind: 'ready' };

/** Returns the message when it is well formed, within the size bound and of a known kind; otherwise null. */
export function parseWrapperMessage(data: unknown): WrapperMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  if (JSON.stringify(data).length > MAX_MESSAGE_BYTES) return null;
  const keys = Object.keys(data);
  const message = data as { v?: unknown; kind?: unknown };
  if (message.v === BRIDGE_PROTOCOL_VERSION && message.kind === 'ready' && keys.length === 2) {
    return { v: 1, kind: 'ready' };
  }
  return null;
}
