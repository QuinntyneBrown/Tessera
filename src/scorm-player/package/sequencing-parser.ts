import { ScormEdition, SequencingDefinition } from '../types';

function child(parent: Element | undefined, name: string): Element | undefined {
  return Array.from(parent?.children ?? []).find((each) => each.localName === name);
}

function flag(element: Element | undefined, name: string, fallback: boolean): boolean {
  const value = element?.getAttribute(name);
  return value === null || value === undefined ? fallback : value === 'true';
}

/**
 * Reads an activity's `imsss:sequencing` element, applying the specified defaults for anything it omits.
 * SCORM 1.2 has no sequencing, so its courses get free choice and flow, as its linear lesson order implies.
 */
export function parseSequencing(
  element: Element | undefined,
  edition: ScormEdition,
): SequencingDefinition {
  const controlMode = child(element, 'controlMode');
  return {
    controlMode: {
      choice: flag(controlMode, 'choice', true),
      choiceExit: flag(controlMode, 'choiceExit', true),
      flow: flag(controlMode, 'flow', edition === '1.2'),
      forwardOnly: flag(controlMode, 'forwardOnly', false),
    },
  };
}
