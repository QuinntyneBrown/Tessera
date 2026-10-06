import { CourseNode } from '../types';

/** What a navigation request leads to: an activity to launch, or a refusal with its reason as text. */
export type NavigationDecision =
  | { readonly kind: 'launch'; readonly id: string }
  | { readonly kind: 'denied'; readonly reason: string };

const FIRST = 'This is the first activity.';
const LAST = 'This is the last activity.';
const NO_FLOW = 'Choose the next activity from the course outline.';
const NO_CHOICE = 'Take this course in order using Next.';

/**
 * Applies a course's sequencing rules to navigation requests. SCORM 1.2 courses arrive with free choice
 * and flow, so the same rules give their linear lesson order.
 */
export class SequencingEngine {
  private readonly parents = new Map<CourseNode, CourseNode>();
  private readonly nodes = new Map<string, CourseNode>();

  constructor(private readonly tree: CourseNode) {
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

  /** Why the learner cannot choose the target now, or null when they can. */
  unavailableReason(_currentId: string | null, targetId: string): string | null {
    for (let node = this.node(targetId); this.parents.has(node); node = this.parents.get(node)!) {
      if (!this.parents.get(node)!.sequencing.controlMode.choice) return NO_CHOICE;
    }
    return null;
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
