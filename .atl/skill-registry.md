# Skill Registry — nexride

**Generated**: 2026-05-04
**Mode**: engram (artifact store)
**Strict TDD**: enabled

## Project Conventions
- `~/.claude/CLAUDE.md` — global user instructions (Engram protocol, response contract, language, personality)
- `docs/guia-implementacion.md` — SDD scope contract (binding for this project)
- `docs/TRD - NexRide.md`, `docs/RFC - NexRide.md`, `docs/PRD - NexRide.md`, `docs/Design Doc DD-01 - NexRide.md`, `docs/Design Doc DD-02 - NexRide.md` — technical contracts (do not break)

## Compact Rules (auto-resolved for sub-agents)

### nestjs-typescript-monolith
**Triggers**: `*.ts` under `src/`, NestJS modules, controllers, providers, DTOs.
- Use NestJS DI for all wiring. Domain services are framework-agnostic (no decorators in `domain/`).
- DTOs validated with `class-validator` + `ValidationPipe` (whitelist + forbidNonWhitelisted).
- Errors via Nest exception filters; domain errors thrown as typed `DomainError` subclasses, mapped to HTTP in a global filter.
- Logging via `nestjs-pino` JSON logger. Required fields: timestamp, level, module, request_id, trip_id, user_id, zone_id, message, metadata.
- No magic numbers — all dispatch thresholds in `src/common/config/dispatch.config.ts` driven by env vars.

### testing-jest-tdd
**Triggers**: `*.spec.ts`, `test/**`.
- TDD red→green→refactor. Unit tests target pure domain (no Nest container).
- Integration tests boot a `TestingModule` with Testcontainers Postgres+PostGIS and Redis. NO mocked DB.
- ≥20 unit scenarios for Dispatch engine. Coverage gate ≥85% statements, ≥80% branches in dispatch/safe-points.
- One assertion per test concept. `describe` blocks reflect business behavior, not class names.

### architecture-rules
**Triggers**: any file under `src/`.
- `src/dispatch/**` MUST NOT import from other feature modules directly. Only `common/interfaces/**` and `common/events/**` allowed for ports/events. **Exception**: `*.module.ts` files MAY import other `*.module.ts` files for NestJS DI composition at the composition root — this is NOT a domain dependency and is explicitly allowed by the `pathNot` clause in `.dependency-cruiser.cjs`. The rule enforces only the `domain/`↔`domain/` and `application/`↔`application/` boundary, NOT module-to-module wiring imports.
- Reverse: no other module may import from `dispatch/domain/**` or `dispatch/application/**`.
- CI job `architecture-rules` blocks merge on violation.

### ci-github-actions
**Triggers**: `.github/workflows/*.yml`.
- One workflow `ci.yml`. Jobs: lint-typecheck, architecture-rules, unit-tests, integration-tests, performance-smoke, security-static, build-openapi.
- Each job is independent and named. All blocking on PR.
- Real thresholds: coverage gate, perf p95/p99, audit high/critical, gitleaks zero, openapi.json must build.

### skill-git-pr-conventional-commits
**Triggers**: commits, PRs.
- Conventional Commits. NO "Co-Authored-By" or AI attribution.
- One concern per commit. Tests beside code they verify.

## User Skills Available (not auto-injected; orchestrator decides)
- `nextjs-15`, `react-19`, `tailwind-4`, `typescript`, `playwright`, `pytest`, `zod-4`, `zustand-5`, `ai-sdk-5`, `angular-20`, `django-drf`, `interface-design`, `mermaid-diagrams`, `cognitive-doc-design`, `chained-pr`, `work-unit-commits`, `comment-writer`, `simplify`, etc.
- For this project, primary skills: `typescript`, `skill-git-pr-conventional-commits`, `chained-pr`, `work-unit-commits`, `cognitive-doc-design`.
