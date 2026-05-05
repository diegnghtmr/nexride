module.exports = {
  forbidden: [
    {
      name: 'dispatch-no-cross-module-imports',
      severity: 'error',
      comment: 'CT-05/CT-06: Dispatch may only consume sibling modules via common/interfaces or common/events.',
      from: { path: '^src/dispatch/' },
      to: {
        path: '^src/(fleet|safe-points|trip|analytics|rider)/',
        pathNot: '^src/(fleet|safe-points|trip|analytics|rider)/[^/]+\\.module\\.ts$',
      },
    },
    {
      name: 'siblings-no-import-dispatch-internals',
      severity: 'error',
      from: { path: '^src/(fleet|safe-points|trip|analytics|rider)/' },
      to: { path: '^src/dispatch/(domain|application|infrastructure)/' },
    },
    {
      name: 'domain-framework-agnostic',
      severity: 'error',
      comment: 'Domain layer must not depend on NestJS or infrastructure.',
      from: { path: '^src/dispatch/domain/' },
      to: { path: '^(@nestjs|src/dispatch/infrastructure|src/.*\\.module\\.ts)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: '\\.(spec|test)\\.ts$' },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
