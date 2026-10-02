/** Resolves manifest references against the course root. */
export class ResourceResolver {
  constructor(readonly root: URL) {}

  resolve(reference: string): URL {
    return new URL(reference, this.root);
  }
}
