import { CourseNode } from '../types';

/** What a navigation request leads to: an activity to launch, or a refusal with its reason as text. */
export type NavigationDecision =
  | { readonly kind: 'launch'; readonly id: string }
  | { readonly kind: 'denied'; readonly reason: string }
  /** The current activity ends and nothing else is delivered until the learner navigates. */
  | { readonly kind: 'exit' }
  /** The attempt on the course ends; suspended when the learner may resume it later. */
  | { readonly kind: 'end'; readonly suspended: boolean };

/** What the learner has done in the course so far, as sequencing needs it. */
export interface Tracking {
  readonly activities: Readonly<Record<string, ActivityTracking>>;
}

export interface ActivityTracking {
  readonly attempts: number;
}

export const NO_TRACKING: Tracking = { activities: {} };

const FIRST = 'This is the first activity.';
const LAST = 'This is the last activity.';
const NO_FLOW = 'Choose the next activity from the course outline.';
const NO_CHOICE = 'Take this course in order using Next.';
const LIMIT = 'You have used every attempt at this activity.';

/**
 * Applies a course's sequencing rules to navigation requests. SCORM 1.2 courses arrive with free choice
 * and flow, so the same rules give their linear lesson order.
 */
export class SequencingEngine {
  private readonly parents = new Map<CourseNode, CourseNode>();
  private readonly nodes = new Map<string, CourseNode>();

  constructor(
    private readonly tree: CourseNode,
    private readonly tracking: Tracking = NO_TRACKING,
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
  delivered(currentId: string | null, targetId: string): Tracking {
    const active = new Set(currentId ? this.path(this.node(currentId)) : []);
    const activities = { ...this.tracking.activities };
    for (const node of this.path(this.node(targetId))) {
      if (node.id === targetId || !active.has(node)) {
        activities[node.id] = { attempts: this.attempts(node) + 1 };
      }
    }
    return { activities };
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
      const blocked = this.check(node);
      if (blocked) return blocked;
    }
    return null;
  }

  /** Why the rules stop the activity being delivered, whichever way it is reached; null when nothing does. */
  private check(node: CourseNode): string | null {
    const limit = node.sequencing.attemptLimit;
    return limit !== undefined && this.attempts(node) >= limit ? LIMIT : null;
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
