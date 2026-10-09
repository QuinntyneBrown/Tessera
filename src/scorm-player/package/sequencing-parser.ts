import {
  ObjectiveDefinition,
  PreconditionRule,
  RollupDefinition,
  RollupRule,
  RuleCondition,
  ScormEdition,
  SequencingDefinition,
} from '../types';

function child(parent: Element | undefined, name: string): Element | undefined {
  return Array.from(parent?.children ?? []).find((each) => each.localName === name);
}

function all(parent: Element | undefined, name: string): Element[] {
  return Array.from(parent?.children ?? []).filter((each) => each.localName === name);
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
  const attemptLimit = Number(child(element, 'limitConditions')?.getAttribute('attemptLimit') ?? 0);
  return {
    ...(attemptLimit > 0 && { attemptLimit }),
    controlMode: {
      choice: flag(controlMode, 'choice', true),
      choiceExit: flag(controlMode, 'choiceExit', true),
      flow: flag(controlMode, 'flow', edition === '1.2'),
      forwardOnly: flag(controlMode, 'forwardOnly', false),
    },
    preconditions: all(child(element, 'sequencingRules'), 'preConditionRule').map(precondition),
    objectives: objectives(child(element, 'objectives')),
    rollup: rollup(child(element, 'rollupRules')),
  };
}

function rollup(element: Element | undefined): RollupDefinition {
  return {
    rules: all(element, 'rollupRule').map(rollupRule),
    objectiveSatisfied: flag(element, 'rollupObjectiveSatisfied', true),
    progressCompletion: flag(element, 'rollupProgressCompletion', true),
    objectiveMeasureWeight: Number(element?.getAttribute('objectiveMeasureWeight') ?? 1),
  };
}

function rollupRule(rule: Element): RollupRule {
  const rollupConditions = child(rule, 'rollupConditions');
  return {
    childActivitySet: (rule.getAttribute('childActivitySet') ??
      'all') as RollupRule['childActivitySet'],
    minimumCount: Number(rule.getAttribute('minimumCount') ?? 0),
    minimumPercent: Number(rule.getAttribute('minimumPercent') ?? 0),
    // Unlike precondition rules, rollup conditions combine with "any" by default.
    combination: rollupConditions?.getAttribute('conditionCombination') === 'all' ? 'all' : 'any',
    conditions: all(rollupConditions, 'rollupCondition').map((condition) => ({
      condition: condition.getAttribute('condition') ?? '',
      negate: condition.getAttribute('operator') === 'not',
    })),
    action: (child(rule, 'rollupAction')?.getAttribute('action') ??
      'satisfied') as RollupRule['action'],
  };
}

function conditions(element: Element | undefined): readonly RuleCondition[] {
  return all(element, 'ruleCondition').map((condition) => ({
    condition: condition.getAttribute('condition') ?? '',
    negate: condition.getAttribute('operator') === 'not',
    ...(condition.hasAttribute('referencedObjective') && {
      objective: condition.getAttribute('referencedObjective')!,
    }),
    ...(condition.hasAttribute('measureThreshold') && {
      measureThreshold: Number(condition.getAttribute('measureThreshold')),
    }),
  }));
}

function precondition(rule: Element): PreconditionRule {
  const ruleConditions = child(rule, 'ruleConditions');
  return {
    combination: ruleConditions?.getAttribute('conditionCombination') === 'any' ? 'any' : 'all',
    conditions: conditions(ruleConditions),
    action: (child(rule, 'ruleAction')?.getAttribute('action') ??
      'skip') as PreconditionRule['action'],
  };
}

function objectives(element: Element | undefined): readonly ObjectiveDefinition[] {
  return [...all(element, 'primaryObjective'), ...all(element, 'objective')].map((objective) => ({
    id: objective.getAttribute('objectiveID') ?? '',
    primary: objective.localName === 'primaryObjective',
    satisfiedByMeasure: flag(objective, 'satisfiedByMeasure', false),
    minNormalizedMeasure: Number(child(objective, 'minNormalizedMeasure')?.textContent ?? 1),
    maps: all(objective, 'mapInfo').map((map) => ({
      target: map.getAttribute('targetObjectiveID') ?? '',
      readSatisfied: flag(map, 'readSatisfiedStatus', true),
      readMeasure: flag(map, 'readNormalizedMeasure', true),
      writeSatisfied: flag(map, 'writeSatisfiedStatus', false),
      writeMeasure: flag(map, 'writeNormalizedMeasure', false),
    })),
  }));
}
