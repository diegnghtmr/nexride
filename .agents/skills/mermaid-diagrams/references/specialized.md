# Specialized Diagrams — Gantt, Git, C4, Mindmap, Timeline, Pie & Block

## Table of Contents
1. [Gantt Charts](#gantt-charts)
2. [Git Graphs](#git-graphs)
3. [C4 Diagrams](#c4-diagrams)
4. [Mindmaps](#mindmaps)
5. [Timeline Diagrams](#timeline-diagrams)
6. [Pie Charts](#pie-charts)
7. [Block Diagrams](#block-diagrams)

---

## Gantt Charts

### Anatomy

Gantt charts visualize project schedules with tasks, durations, dependencies, and milestones.
Always specify `dateFormat` and group tasks into `section` blocks.

### Task status keywords

| Keyword | Effect |
|---------|--------|
| `done` | Task completed (grayed out) |
| `active` | Currently in progress (highlighted) |
| `crit` | Critical path (red) |
| `milestone` | Zero-duration milestone marker |
| `after taskId` | Dependency on another task |

### Complete Example: Software Release Plan

```mermaid
gantt
  accTitle: Sprint Release Plan
  accDescr: Six-week sprint plan from planning through release

  title Sprint 24 Release Plan
  dateFormat YYYY-MM-DD
  excludes weekends

  section Planning
    Sprint planning      :done, plan, 2025-06-02, 1d
    Requirements review  :done, req, after plan, 2d
    Architecture design  :done, arch, after req, 3d

  section Development
    Backend API          :active, api, after arch, 8d
    Frontend UI          :active, ui, after arch, 10d
    Database migrations  :crit, db, after arch, 3d
    Integration layer    :integ, after api, 4d

  section Testing
    Unit tests           :test1, after api, 3d
    Integration tests    :crit, test2, after integ, 4d
    E2E tests            :test3, after ui, 3d
    Performance testing  :perf, after test2, 2d

  section Release
    Staging deploy       :stage, after test3, 1d
    UAT                  :uat, after stage, 3d
    Production deploy    :crit, milestone, prod, after uat, 0d
    Monitoring           :monitor, after prod, 5d
```

### Gantt Best Practices

- Always include `dateFormat` — `YYYY-MM-DD` is the most unambiguous
- Use `excludes weekends` for realistic timelines
- Mark critical path tasks with `crit`
- Use `after taskId` for dependencies instead of hardcoded dates
- Group logically with `section` blocks
- Milestones use `milestone` keyword with `0d` duration
- The `until` keyword (v10.9+) handles tasks running until another starts

---

## Git Graphs

### Anatomy

Git graphs visualize branching strategies, merges, and release flows.

### Complete Example: GitFlow Strategy

```mermaid
gitGraph
  accTitle: GitFlow Branching Strategy
  accDescr: Shows feature, release, and hotfix branching from develop and main

  commit id: "init"
  branch develop order: 1
  commit id: "dev-setup"

  branch feature/auth order: 2
  commit id: "auth-model"
  commit id: "auth-service"
  commit id: "auth-tests"
  checkout develop
  merge feature/auth id: "merge-auth"

  branch feature/payments order: 3
  commit id: "payment-model"
  commit id: "payment-api"
  checkout develop
  merge feature/payments id: "merge-payments"

  branch release/1.0 order: 4
  commit id: "bump-version" tag: "v1.0.0-rc1"
  commit id: "fix-docs"
  checkout main
  merge release/1.0 id: "release-1.0" tag: "v1.0.0" type: HIGHLIGHT
  checkout develop
  merge release/1.0 id: "back-merge"

  checkout main
  branch hotfix/security order: 5
  commit id: "patch-vuln" type: REVERSE
  checkout main
  merge hotfix/security id: "hotfix-merge" tag: "v1.0.1"
  checkout develop
  merge hotfix/security id: "hotfix-to-dev"
```

### Git Graph Best Practices

- Use descriptive commit IDs: `id: "auth-model"` not `id: "c1"`
- Tag releases: `tag: "v1.0.0"`
- Use `type: HIGHLIGHT` for important commits, `type: REVERSE` for reverts
- Control branch ordering with `order: N`
- Keep branch count to 5–6 for readability
- `parallelCommits: true` in config clarifies parallel development

---

## C4 Diagrams

C4 diagrams are experimental in Mermaid. They model system architecture at four abstraction levels.

### Complete Example: System Context

```mermaid
C4Context
  accTitle: E-Commerce System Context
  accDescr: High-level view of the e-commerce system and its external dependencies

  title E-Commerce System - Context Diagram

  Person(customer, "Customer", "Browses and purchases products")
  Person(admin, "Admin", "Manages products, orders, and inventory")

  System(ecommerce, "E-Commerce Platform", "Handles product catalog, orders, and payments")

  System_Ext(payment, "Payment Gateway", "Processes credit card and PayPal payments")
  System_Ext(shipping, "Shipping Provider", "Handles logistics and delivery tracking")
  System_Ext(email, "Email Service", "Sends transactional and marketing emails")

  Rel(customer, ecommerce, "Uses", "HTTPS")
  Rel(admin, ecommerce, "Manages", "HTTPS")
  Rel(ecommerce, payment, "Processes payments", "HTTPS/API")
  Rel(ecommerce, shipping, "Creates shipments", "HTTPS/API")
  Rel(ecommerce, email, "Sends emails", "SMTP")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

### C4 Container Level

```mermaid
C4Container
  accTitle: E-Commerce Containers
  accDescr: Container-level view showing web app, API, and databases

  title E-Commerce Platform - Container Diagram

  Person(customer, "Customer", "End user")

  System_Boundary(platform, "E-Commerce Platform") {
    Container(webapp, "Web Application", "React", "Single page application")
    Container(api, "API Server", "Spring Boot", "REST API, business logic")
    Container(worker, "Worker Service", "Spring Boot", "Async processing")
    ContainerDb(db, "Database", "PostgreSQL", "Products, orders, users")
    ContainerDb(cache, "Cache", "Redis", "Sessions, product cache")
    Container(queue, "Message Queue", "RabbitMQ", "Async events")
  }

  Rel(customer, webapp, "Uses", "HTTPS")
  Rel(webapp, api, "Calls", "HTTPS/JSON")
  Rel(api, db, "Reads/Writes", "JDBC")
  Rel(api, cache, "Reads/Writes", "Redis protocol")
  Rel(api, queue, "Publishes", "AMQP")
  Rel(worker, queue, "Consumes", "AMQP")
  Rel(worker, db, "Reads/Writes", "JDBC")
```

### C4 Best Practices

- Start with Context (highest level), drill into Container and Component
- Position is determined by statement order — no auto-layout
- Use `UpdateLayoutConfig` to control items per row
- `System_Ext` for external systems, `System_Boundary` for boundaries
- Keep descriptions concise (role, not implementation details)

---

## Mindmaps

### Anatomy

Mindmaps use **indentation-based hierarchy**. Deeper indentation = child node.
Keep to 3–4 levels maximum.

### Complete Example: Project Planning Mindmap

```mermaid
mindmap
  accTitle: Project Planning
  accDescr: Mindmap showing all aspects of a software project plan

  root((Project Plan))
    Requirements
      Functional
        User stories
        Acceptance criteria
      Non-Functional
        Performance
        Security
        Scalability
    Architecture
      Frontend
        React SPA
        Mobile app
      Backend
        REST API
        Event processing
      Infrastructure
        Kubernetes
        CI/CD pipeline
    Team
      Backend devs
      Frontend devs
      QA engineers
      DevOps
    Timeline
      Phase 1: MVP
      Phase 2: Scale
      Phase 3: Optimize
```

### Node shapes in mindmaps

```
mindmap
  Default shape
  [Square shape]
  (Rounded shape)
  ((Circle shape))
  ))Bang shape((
  )Cloud shape(
  {{Hexagon shape}}
```

### Mindmap Best Practices

- Root node uses `((text))` (circle) for visual distinction
- Keep 3–4 levels deep maximum — deeper nesting loses readability
- Each branch should represent one coherent category
- Use shapes to differentiate node types (decisions, actions, categories)

---

## Timeline Diagrams

### Complete Example: Product Evolution

```mermaid
timeline
  accTitle: Product Evolution Timeline
  accDescr: Major milestones in the product development lifecycle

  title Product Evolution

  2023 Q1 : Project kickoff
           : Team assembled
           : Requirements gathered

  2023 Q2 : Architecture defined
           : Tech stack chosen
           : Development begins

  2023 Q3 : Alpha release
           : Internal testing
           : First user feedback

  2023 Q4 : Beta release
           : Performance optimization
           : Security audit

  2024 Q1 : GA Release v1.0
           : Marketing launch
           : Customer onboarding

  2024 Q2 : Feature expansion
           : Mobile app launch
           : International rollout
```

### Timeline Best Practices

- Time periods can be any text — not restricted to dates
- Multiple events per period use indented lines after the colon
- Sections auto-color-code by group
- Keep to 6–8 time periods for readability

---

## Pie Charts

### Complete Example

```mermaid
pie showData
  accTitle: Technology Stack Distribution
  accDescr: Breakdown of technologies used in the project codebase

  title Codebase by Technology
  "Java" : 42
  "TypeScript" : 28
  "Python" : 15
  "SQL" : 10
  "Shell Scripts" : 5
```

### Pie Chart Best Practices

- Use `showData` to display actual values alongside percentages
- Limit to **5–7 slices** — too many slices become unreadable
- Order slices from largest to smallest
- Values are proportional — they don't need to sum to 100

---

## Block Diagrams

### Anatomy

Block diagrams (`block-beta`) provide **author-controlled positioning** using a column-based grid.
Use when automatic layout produces unsatisfactory results.

### Complete Example: System Architecture Block

```mermaid
block-beta
  accTitle: Three-Tier Architecture
  accDescr: Block diagram showing frontend, backend, and data layers

  columns 3

  block:frontend["Frontend"]:3
    columns 3
    webApp["Web App"] mobileApp["Mobile App"] adminPanel["Admin Panel"]
  end

  space:3

  block:backend["Backend Services"]:3
    columns 4
    apiGw["API Gateway"] authSvc["Auth"] orderSvc["Orders"] productSvc["Products"]
  end

  space:3

  block:data["Data Layer"]:3
    columns 3
    postgres[("PostgreSQL")] redis[("Redis")] s3[("S3 Storage")]
  end

  webApp --> apiGw
  mobileApp --> apiGw
  adminPanel --> apiGw
  apiGw --> authSvc
  apiGw --> orderSvc
  apiGw --> productSvc
  orderSvc --> postgres
  productSvc --> postgres
  authSvc --> redis
  productSvc --> s3
```

### Block Diagram Best Practices

- `columns N` controls the grid width
- `:N` after a block name spans N columns
- `space` creates empty cells for layout control
- `space:N` spans N empty columns
- Blocks can nest inside other blocks
- Use when flowchart auto-layout doesn't produce the desired visual arrangement
