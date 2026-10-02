import { ResourceResolver } from './resource-resolver';

const resolver = new ResourceResolver(new URL('https://course.test/courses/demo/'));

describe('ResourceResolver', () => {
  it('resolves relative references under the root', () => {
    expect(resolver.resolve('lesson/index.html').href).toBe(
      'https://course.test/courses/demo/lesson/index.html',
    );
  });

  it.each([
    '../other/index.html',
    '%2e%2e/other/index.html',
    'a/../../other.html',
    '/courses/other/index.html',
    '\\..\\other.html',
    'https://evil.test/index.html',
    '//evil.test/index.html',
    'javascript:alert(1)',
    'data:text/html,<script>1</script>',
  ])('rejects %s', (reference) => {
    expect(() => resolver.resolve(reference)).toThrowError(/outside the course/);
  });
});
