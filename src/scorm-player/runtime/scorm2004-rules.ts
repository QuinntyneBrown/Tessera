/** SCORM 2004 run-time data model: element catalog, access rules and value validation. */
import { ElementRule } from './scorm12-rules';

const characterString = (limit: number) => (value: string) => value.length <= limit;

const readWrite = (valid: (value: string) => boolean): ElementRule => ({ access: 'rw', valid });

/** Element rules keyed by normalized name: the first array index is `n`, the second is `m`. */
const CATALOG: Readonly<Record<string, ElementRule>> = {
  'cmi.location': readWrite(characterString(1000)),
};

export function ruleFor2004(key: string): ElementRule | undefined {
  return CATALOG[key];
}
