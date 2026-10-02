import { CourseLoadError } from './course-load-error';

/** Resolves manifest references against the course root and confines them to it. */
export class ResourceResolver {
  constructor(readonly root: URL) {}

  resolve(reference: string): URL {
    const url = new URL(reference, this.root);
    if (url.origin !== this.root.origin || !url.pathname.startsWith(this.root.pathname)) {
      throw new CourseLoadError(
        'resource-outside-root',
        'The course manifest references a resource outside the course.',
        false,
      );
    }
    return url;
  }
}
