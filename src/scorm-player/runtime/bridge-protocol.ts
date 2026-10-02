import { ScormEdition } from '../types';

export const BRIDGE_PROTOCOL_VERSION = 1;

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
