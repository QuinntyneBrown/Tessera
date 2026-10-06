import {
  ActivityTracking,
  CourseNode,
  ObjectiveTracking,
  RollupStatus,
  SequencingTracking,
  ObjectiveDefinition,
  PreconditionRule,
  RollupRule,
  RuleCondition,
} from '../types';

/** What a navigation request leads to: an activity to launch, or a refusal with its reason as text. */
export type NavigationDecision =
  | { readonly kind: 'launch'; readonly id: string }
  | { readonly kind: 'denied'; readonly reason: string }
  /** The current activity ends and nothing else is delivered until the learner navigates. */
  | { readonly kind: 'exit' }
  /** The attempt on the course ends; suspended when the learner may resume it later. */
  | { readonly kind: 'end'; readonly suspended: boolean };

export const NO_TRACKING: SequencingTracking = { activities: {} };

/** A three-valued result: undefined is unknown, which never makes a rule apply. */
type Truth = boolean | undefined;

const FIRST = 'This is the first activity.';
const LAST = 'This is the last activity.';
const NO_FLOW = 'Choose the next activity from the course outline.';
const NO_CHOICE = 'Take this course in order using Next.';
const LIMIT = 'You have used every attempt at this activity.';
const DISABLED = 'This activity is locked until its prerequisites are met.';

/**
 * Applies a course's sequencing rules to navigation requests. SCORM 1.2 courses arrive with free choice
 * and flow, so the same rules give their linear lesson order.
 */
export class SequencingEngine {
  private readonly parents = new Map<CourseNode, CourseNode>();
  private readonly nodes = new Map<string, CourseNode>();
  /** Global objectives being derived, so a module that reads what it writes cannot recurse forever. */
  private readonly resolving = new Set<string>();

  constructor(
    readonly tree: CourseNode,
    private readonly tracking: SequencingTracking = NO_TRACKING,
  ) {
    const index = (node: CourseNode): void => {
      this.nodes.set(node.id, node);
      for (const child of node.children) {
        this.parents.set(child, node);
        index(child);
      }
    };
    index(tree);
  }

  /** Starts at the first activity flow delivers or, where the course does not flow, the first it lets the learner choose. */
  start(): NavigationDecision {
    const flowed = this.enter(this.tree, 1);
    if (flowed?.kind === 'launch') return flowed;
    const chosen = Array.from(this.nodes.values()).find(
      (node) => node.activity && !this.unavailableReason(null, node.id),
    );
    return chosen
      ? { kind: 'launch', id: chosen.id }
      : (flowed ?? { kind: 'denied', reason: NO_FLOW });
  }

  next(currentId: string): NavigationDecision {
    return this.flow(this.node(currentId), 1);
  }

  previous(currentId: string): NavigationDecision {
    return this.flow(this.node(currentId), -1);
  }

  choose(currentId: string | null, targetId: string): NavigationDecision {
    const reason = this.unavailableReason(currentId, targetId);
    return reason ? { kind: 'denied', reason } : { kind: 'launch', id: targetId };
  }

  /** The tracking after launching the target: it and every activity newly entered on the way begin an attempt. */
  delivered(currentId: string | null, targetId: string): SequencingTracking {
    const active = new Set(currentId ? this.path(this.node(currentId)) : []);
    const activities = { ...this.tracking.activities };
    for (const node of this.path(this.node(targetId))) {
      if (node.id === targetId || !active.has(node)) {
        activities[node.id] = { attempts: this.attempts(node) + 1 };
      }
    }
    return { ...this.tracking, activities };
  }

  /** The tracking after a SCORM 2004 SCO reports its run-time values: completion and objectives. */
  reported(id: string, values: Readonly<Record<string, string>>): SequencingTracking {
    const node = this.node(id);
    const objectives: Record<string, ObjectiveTracking> = {};
    const globals = { ...this.tracking.globals };
    for (const objective of objectivesOf(node)) {
      const prefix = objective.primary ? 'cmi' : this.runtimeObjective(values, objective.id);
      if (!prefix) continue;
      const status = objectiveStatus(values, prefix, objective);
      objectives[objective.id] = status;
      for (const map of objective.maps) {
        const global = { ...globals[map.target] };
        if (map.writeSatisfied && status.satisfied !== undefined)
          global.satisfied = status.satisfied;
        if (map.writeMeasure && status.measure !== undefined) global.measure = status.measure;
        globals[map.target] = global;
      }
    }
    const completion = values['cmi.completion_status'];
    const activity: ActivityTracking = {
      attempts: this.attempts(node),
      objectives,
      ...(completion === 'completed' && { completion: 'completed' }),
      ...((completion === 'incomplete' || completion === 'not attempted') && {
        completion: 'incomplete',
      }),
    };
    return { activities: { ...this.tracking.activities, [id]: activity }, globals };
  }

  /** Processes the `adl.nav.request` a SCO left when its session ended; null when there is none to act on. */
  request(currentId: string, request: string): NavigationDecision | null {
    const target = /^\{target=([^}]+)\}(choice|jump)$/.exec(request);
    if (target) {
      if (!this.nodes.get(target[1])?.activity) return null;
      return target[2] === 'jump'
        ? { kind: 'launch', id: target[1] }
        : this.choose(currentId, target[1]);
    }
    switch (request) {
      case 'continue':
        return this.next(currentId);
      case 'previous':
        return this.previous(currentId);
      case 'exit':
      case 'abandon':
        return { kind: 'exit' };
      case 'exitAll':
      case 'abandonAll':
        return { kind: 'end', suspended: false };
      case 'suspendAll':
        return { kind: 'end', suspended: true };
      default:
        return null;
    }
  }

  /** Why the learner cannot choose the target now, or null when they can. */
  unavailableReason(_currentId: string | null, targetId: string): string | null {
    for (const node of this.path(this.node(targetId)).slice(1)) {
      if (!this.parents.get(node)!.sequencing.controlMode.choice) return NO_CHOICE;
      if (this.applies(node, 'hiddenFromChoice')) return DISABLED;
      const blocked = this.check(node);
      if (blocked) return blocked;
    }
    return null;
  }

  /** Why the rules stop the activity being delivered, whichever way it is reached; null when nothing does. */
  private check(node: CourseNode): string | null {
    if (this.applies(node, 'disabled')) return DISABLED;
    return this.limitExceeded(node) ? LIMIT : null;
  }

  /** Whether the course hides the activity from the learner's choices. */
  hidden(id: string): boolean {
    return this.path(this.node(id)).some((node) => this.applies(node, 'hiddenFromChoice'));
  }

  private limitExceeded(node: CourseNode): boolean {
    const limit = node.sequencing.attemptLimit;
    return limit !== undefined && this.attempts(node) >= limit;
  }

  /** Whether a precondition rule with this action applies to the activity now. */
  private applies(node: CourseNode, action: PreconditionRule['action']): boolean {
    return node.sequencing.preconditions.some(
      (rule) => rule.action === action && this.ruleHolds(node, rule),
    );
  }

  private ruleHolds(node: CourseNode, rule: PreconditionRule): boolean {
    const results = rule.conditions.map((condition) => {
      const result = this.condition(node, condition);
      return condition.negate && result !== undefined ? !result : result;
    });
    if (rule.combination === 'any') return results.some((result) => result === true);
    return results.length > 0 && results.every((result) => result === true);
  }

  private condition(
    node: CourseNode,
    { condition, objective, measureThreshold = 0 }: RuleCondition,
  ): Truth {
    const status = () => this.objective(node, objective);
    switch (condition) {
      case 'satisfied':
        return status().satisfied;
      case 'objectiveStatusKnown':
        return status().satisfied !== undefined;
      case 'objectiveMeasureKnown':
        return status().measure !== undefined;
      case 'objectiveMeasureGreaterThan':
        return status().measure === undefined ? undefined : status().measure! > measureThreshold;
      case 'objectiveMeasureLessThan':
        return status().measure === undefined ? undefined : status().measure! < measureThreshold;
      case 'completed':
        return this.completion(node) === undefined
          ? undefined
          : this.completion(node) === 'completed';
      case 'activityProgressKnown':
        return this.completion(node) !== undefined;
      case 'attempted':
        return this.attempts(node) > 0;
      case 'attemptLimitExceeded':
        return this.limitExceeded(node);
      case 'always':
        return true;
      default:
        // Time limits and availability windows are not tracked, so those conditions never hold.
        return false;
    }
  }

  /** The activity's status: for an item, what its SCO reported; for a module, rolled up from its children. */
  status(id: string): RollupStatus {
    const node = this.node(id);
    return { ...this.objective(node, undefined), ...this.progress(node) };
  }

  /** An objective's status, read from its global objective where the course maps it. */
  private objective(node: CourseNode, id: string | undefined): ObjectiveTracking {
    const definition = objectivesOf(node).find((each) =>
      id === undefined ? each.primary : each.id === id,
    );
    const local =
      node.activity || (definition && !definition.primary)
        ? (this.tracking.activities[node.id]?.objectives?.[definition?.id ?? ''] ?? {})
        : this.rolledUpObjective(node);
    const status = { ...local };
    for (const map of definition?.maps ?? []) {
      const global = this.global(map.target);
      if (map.readSatisfied && global.satisfied !== undefined) status.satisfied = global.satisfied;
      if (map.readMeasure && global.measure !== undefined) status.measure = global.measure;
    }
    return status;
  }

  private completion(node: CourseNode): 'completed' | 'incomplete' | undefined {
    return this.progress(node).completion;
  }

  private progress(node: CourseNode): { completion?: 'completed' | 'incomplete' } {
    const completion = node.activity
      ? this.tracking.activities[node.id]?.completion
      : this.rolledUpCompletion(node);
    return completion ? { completion } : {};
  }

  /** A global objective: as SCOs wrote it, or as the rollup of a module that writes it. */
  private global(target: string): ObjectiveTracking {
    const status = { ...this.tracking.globals?.[target] };
    if (this.resolving.has(target)) return status;
    this.resolving.add(target);
    for (const node of this.nodes.values()) {
      const primary = node.sequencing.objectives.find((each) => each.primary);
      const map = primary?.maps.find((each) => each.target === target);
      if (node.activity || !map) continue;
      const rolled = this.rolledUpObjective(node);
      if (map.writeSatisfied && rolled.satisfied !== undefined) status.satisfied = rolled.satisfied;
      if (map.writeMeasure && rolled.measure !== undefined) status.measure = rolled.measure;
    }
    this.resolving.delete(target);
    return status;
  }

  /** A module's measure (weighted average) and satisfaction: by measure, by its rules, or by default. */
  private rolledUpObjective(node: CourseNode): ObjectiveTracking {
    let counted = 0;
    let total = 0;
    let valid = false;
    for (const child of node.children) {
      const weight = child.sequencing.rollup.objectiveMeasureWeight;
      if (weight <= 0) continue;
      counted += weight;
      const measure = this.objective(child, undefined).measure;
      if (measure !== undefined) {
        total += measure * weight;
        valid = true;
      }
    }
    const measure = valid && counted > 0 ? total / counted : undefined;
    const primary = node.sequencing.objectives.find((each) => each.primary);
    const satisfied =
      primary?.satisfiedByMeasure && measure !== undefined
        ? measure >= primary.minNormalizedMeasure
        : this.rolledUp(node, 'satisfied', 'notSatisfied', (child) => {
            return this.objective(child, undefined).satisfied;
          });
    return {
      ...(satisfied !== undefined && { satisfied }),
      ...(measure !== undefined && { measure }),
    };
  }

  private rolledUpCompletion(node: CourseNode): 'completed' | 'incomplete' | undefined {
    const completed = this.rolledUp(node, 'completed', 'incomplete', (child) => {
      const completion = this.completion(child);
      return completion === undefined ? undefined : completion === 'completed';
    });
    return completed === undefined ? undefined : completed ? 'completed' : 'incomplete';
  }

  /**
   * Rolls one status up from the children that contribute to it. With rules for it, a holding positive
   * rule wins, then a holding negative one, else the status is unknown. Without rules, the ADL default
   * applies: negative if any child is known negative, positive if every child is known positive.
   */
  private rolledUp(
    node: CourseNode,
    positive: RollupRule['action'],
    negative: RollupRule['action'],
    childStatus: (child: CourseNode) => Truth,
  ): Truth {
    const satisfaction = positive === 'satisfied';
    const contributors = node.children.filter((child) =>
      satisfaction
        ? child.sequencing.rollup.objectiveSatisfied
        : child.sequencing.rollup.progressCompletion,
    );
    const rules = node.sequencing.rollup.rules;
    if (rules.some((rule) => rule.action === positive || rule.action === negative)) {
      const holds = (action: RollupRule['action']) =>
        rules.some((rule) => rule.action === action && this.rollupRuleHolds(rule, contributors));
      return holds(positive) ? true : holds(negative) ? false : undefined;
    }
    if (contributors.length === 0) return undefined;
    const statuses = contributors.map(childStatus);
    if (statuses.includes(false)) return false;
    return statuses.every((status) => status === true) ? true : undefined;
  }

  private rollupRuleHolds(rule: RollupRule, children: readonly CourseNode[]): boolean {
    const results = children.map((child) => {
      const each = rule.conditions.map((condition) => {
        const result = this.condition(child, condition);
        return condition.negate && result !== undefined ? !result : result;
      });
      if (rule.combination === 'all') {
        return each.includes(false) ? false : each.every((result) => result === true) || undefined;
      }
      return each.includes(true)
        ? true
        : each.every((result) => result === false)
          ? false
          : undefined;
    });
    const held = results.filter((result) => result === true).length;
    switch (rule.childActivitySet) {
      case 'all':
        return results.length > 0 && held === results.length;
      case 'any':
        return held > 0;
      case 'none':
        return results.length > 0 && results.every((result) => result === false);
      case 'atLeastCount':
        return held >= rule.minimumCount;
      case 'atLeastPercent':
        return results.length > 0 && held / results.length >= rule.minimumPercent;
    }
  }

  /** The `cmi.objectives.n` prefix the SCO used for the objective, if it reported it. */
  private runtimeObjective(values: Readonly<Record<string, string>>, id: string): string | null {
    const entry = Object.entries(values).find(
      ([element, value]) => /^cmi\.objectives\.\d+\.id$/.test(element) && value === id,
    );
    return entry ? entry[0].slice(0, -'.id'.length) : null;
  }

  private attempts(node: CourseNode): number {
    return this.tracking.activities[node.id]?.attempts ?? 0;
  }

  /** The activities from the root down to `node`, inclusive. */
  private path(node: CourseNode): CourseNode[] {
    const path = [node];
    while (this.parents.has(path[0])) path.unshift(this.parents.get(path[0])!);
    return path;
  }

  /** Moves from `from` to the next (1) or previous (-1) activity the rules deliver. */
  private flow(from: CourseNode, direction: 1 | -1): NavigationDecision {
    for (let node = from; ;) {
      const parent = this.parents.get(node);
      if (!parent) return { kind: 'denied', reason: direction > 0 ? LAST : FIRST };
      if (!parent.sequencing.controlMode.flow) return { kind: 'denied', reason: NO_FLOW };
      if (direction > 0 && this.applies(node, 'stopForwardTraversal')) {
        return { kind: 'denied', reason: DISABLED };
      }
      const siblings = parent.children;
      for (
        let i = siblings.indexOf(node) + direction;
        i >= 0 && i < siblings.length;
        i += direction
      ) {
        const decision = this.enter(siblings[i], direction);
        if (decision) return decision;
      }
      node = parent;
    }
  }

  /** The first (or, going back, last) activity inside `node`, or null when it holds none. */
  private enter(node: CourseNode, direction: 1 | -1): NavigationDecision | null {
    if (this.applies(node, 'skip')) return null;
    const blocked = this.check(node);
    if (blocked) return { kind: 'denied', reason: blocked };
    if (node.activity) return { kind: 'launch', id: node.id };
    if (!node.sequencing.controlMode.flow) return { kind: 'denied', reason: NO_FLOW };
    const children = direction > 0 ? node.children : [...node.children].reverse();
    for (const child of children) {
      const decision = this.enter(child, direction);
      if (decision) return decision;
    }
    return null;
  }

  private node(id: string): CourseNode {
    return this.nodes.get(id)!;
  }
}

/** An activity's objectives, primary first; an activity that declares no primary objective has an implicit one. */
function objectivesOf(node: CourseNode): readonly ObjectiveDefinition[] {
  const declared = node.sequencing.objectives;
  if (declared.some((objective) => objective.primary)) return declared;
  const implicit = {
    id: '',
    primary: true,
    satisfiedByMeasure: false,
    minNormalizedMeasure: 1,
    maps: [],
  };
  return [implicit, ...declared];
}

/** What the SCO reported for one objective: its success status, scaled score, and satisfaction by measure. */
function objectiveStatus(
  values: Readonly<Record<string, string>>,
  prefix: string,
  objective: ObjectiveDefinition,
): ObjectiveTracking {
  const success = values[`${prefix}.success_status`];
  const scaled = values[`${prefix}.score.scaled`];
  const measure = scaled === undefined ? undefined : Number(scaled);
  const satisfied =
    objective.satisfiedByMeasure && measure !== undefined
      ? measure >= objective.minNormalizedMeasure
      : success === 'passed'
        ? true
        : success === 'failed'
          ? false
          : undefined;
  return {
    ...(satisfied !== undefined && { satisfied }),
    ...(measure !== undefined && { measure }),
  };
}
