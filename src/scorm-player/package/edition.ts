import { ScormEdition } from '../types';

export const EDITION_LABELS: Record<ScormEdition, string> = {
  '1.2': 'SCORM 1.2',
  '2004-2nd': 'SCORM 2004 2nd Edition',
  '2004-3rd': 'SCORM 2004 3rd Edition',
  '2004-4th': 'SCORM 2004 4th Edition',
};

const SCHEMA_VERSIONS: Record<string, ScormEdition> = {
  '1.2': '1.2',
  'CAM 1.3': '2004-2nd',
  '2004 3rd Edition': '2004-3rd',
  '2004 4th Edition': '2004-4th',
};

/** Reads the edition from the manifest's `schemaversion`, or null when it names none that is supported. */
export function detectEdition(document: Document): ScormEdition | null {
  const version = document.getElementsByTagNameNS('*', 'schemaversion')[0]?.textContent?.trim();
  return (version && SCHEMA_VERSIONS[version]) || null;
}
