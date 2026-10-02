export const commitMessage = {
  maxLineLength: 120,
  minBodyLength: 0,
  types: {
    build: { description: 'Changes to the build system or dependencies' },
    ci: { description: 'Changes to CI configuration' },
    docs: { description: 'Documentation only changes' },
    feat: { description: 'A new feature' },
    fix: { description: 'A bug fix' },
    perf: { description: 'A performance improvement' },
    refactor: { description: 'A change that neither fixes a bug nor adds a feature' },
    test: { description: 'Adding or correcting tests' },
  },
  scopes: ['scorm-player', 'dev-app', 'e2e-app', 'docs'],
};
