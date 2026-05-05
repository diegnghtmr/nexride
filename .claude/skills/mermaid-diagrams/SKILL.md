---
name: mermaid-diagrams
description: >
  Generate professional-quality, syntactically valid Mermaid.js diagrams that render correctly across
  platforms. Use this skill whenever the user asks for ANY kind of diagram, flowchart, sequence diagram,
  class diagram, state machine, ER diagram, Gantt chart, git graph, mindmap, timeline, pie chart, C4
  architecture diagram, or block diagram — whether they mention "Mermaid" explicitly or not. Also trigger
  when the user says "diagram this", "visualize this flow", "draw the architecture", "show the process",
  "map this out", "create a chart of", or any similar request for a visual representation of processes,
  systems, data models, or relationships. This skill prevents the most common AI-generated diagram failures:
  hallucinated syntax, unquoted special characters, reserved word conflicts, over-complexity, and
  platform-incompatible features. Every diagram produced must be complete, validated, and ready to render.
license: Apache-2.0
metadata:
  author: will
  version: "1.0"
  mermaid-version: "11.x (cross-platform safe subset)"
---

# Mermaid Diagrams — Professional Quality Skill

This skill produces Mermaid diagrams that are **complete**, **syntactically valid**, and **render correctly**
on GitHub, GitLab, Notion, Obsidian, and self-hosted environments. Every diagram follows proven patterns
that prevent the ~23% failure rate typical of AI-generated Mermaid output.

---

## Critical Rules — These Prevent Broken Diagrams

### Rule 1: Always Quote Labels with Special Characters

Any label containing parentheses, colons, brackets, slashes, ampersands, or other non-alphanumeric
characters requires double quotes. This is the single most common cause of parse errors:

```
%% ❌ BREAKS: parentheses parsed as shape syntax
A(getData(userId))

%% ✅ WORKS: quoted label
A["getData(userId)"]

%% ❌ BREAKS: colon in label
B[Step: Initialize]

%% ✅ WORKS: quoted
B["Step: Initialize"]
```

When in doubt, quote the label. Unnecessary quotes never cause errors; missing quotes always do.

### Rule 2: Never Use Reserved Words as Bare Node IDs

These words are parsed as Mermaid keywords and will break the diagram if used as unquoted node IDs:
`end`, `default`, `graph`, `subgraph`, `style`, `class`, `click`, `linkStyle`, `classDef`.

```
%% ❌ BREAKS: "end" is a keyword
end --> start

%% ✅ WORKS: capitalized or quoted
End["end"] --> Start
```

### Rule 3: Separate Node Definitions from Connections

For any diagram with more than 5 nodes, define nodes first, then connections. This prevents
accidental redefinition, improves readability, and makes the diagram maintainable:

```
flowchart LR
  %% Nodes
  input[User Input]
  validate{Valid?}
  process[Process Data]
  output[Response]
  err[Error Handler]

  %% Connections
  input --> validate
  validate -->|Yes| process
  validate -->|No| err
  process --> output
```

### Rule 4: Use Descriptive Node IDs with Display Labels

Node IDs should be readable code identifiers. Display labels go in brackets for human-facing text:

```
%% ❌ BAD: meaningless IDs
A --> B --> C

%% ✅ GOOD: self-documenting
userReq[User Request] --> authCheck{Authenticated?}
authCheck -->|Yes| processOrder[Process Order]
```

### Rule 5: Keep Diagrams Under 50 Nodes

Mermaid's layout algorithm is O(n²) with edge count. Beyond 50 nodes or 100 edges, diagrams become
unreadable and slow to render. When complexity grows beyond this threshold, split into multiple
focused diagrams — one idea per diagram.

### Rule 6: Validate Before Delivering

Every diagram produced must be mentally parsed against these checks before delivery:

1. Does every label with special characters use double quotes?
2. Are all node IDs free of reserved words?
3. Is every edge arrow syntactically correct (`-->`, `-.->`, `==>`, not `->` or `-->`)?
4. Do subgraphs all have matching `end` keywords?
5. Are edge labels using pipe syntax (`-->|label|`) or the `-- label -->` form consistently?
6. Is the diagram under 50 nodes? If not, propose splitting it.

### Rule 7: Use Cross-Platform Safe Features Only

Unless the user explicitly targets a self-hosted environment, avoid these features that fail on
GitHub, GitLab, Notion, and Obsidian:

- ELK layout engine (`layout: elk`)
- Font Awesome icons (`fa:fa-*`)
- Click events and links (`click nodeId href`)
- Emoji characters in labels
- The `@{ shape }` syntax (requires v11.3+)
- Theme overrides on GitHub (GitHub auto-handles dark/light mode)

---

## Diagram Type Selection

Choose the right diagram type for the user's intent:

```
What does the user want to show?
│
├── Process / Flow / Pipeline / Decision logic?
│   └── flowchart (LR for sequential, TD for hierarchical)
│       → Read references/flowchart.md
│
├── Communication between actors over time?
│   └── sequenceDiagram
│       → Read references/sequence.md
│
├── Object structure / Inheritance / Interfaces?
│   └── classDiagram
│       → Read references/structural.md § Class Diagrams
│
├── Lifecycle / States and transitions?
│   └── stateDiagram-v2
│       → Read references/structural.md § State Diagrams
│
├── Database schema / Data model / Entity relationships?
│   └── erDiagram
│       → Read references/structural.md § ER Diagrams
│
├── Project timeline / Task dependencies / Schedule?
│   └── gantt
│       → Read references/specialized.md § Gantt Charts
│
├── Git branching strategy / Release flow?
│   └── gitGraph
│       → Read references/specialized.md § Git Graphs
│
├── System architecture (C4 model)?
│   └── C4Context / C4Container / C4Component
│       → Read references/specialized.md § C4 Diagrams
│
├── Brainstorming / Concept hierarchy?
│   └── mindmap
│       → Read references/specialized.md § Mindmaps
│
├── Historical events / Chronological milestones?
│   └── timeline
│       → Read references/specialized.md § Timeline
│
├── Proportions / Distribution / Market share?
│   └── pie
│       → Read references/specialized.md § Pie Charts
│
└── Architecture with precise manual positioning?
    └── block-beta
        → Read references/specialized.md § Block Diagrams
```

---

## Direction Choice (for Flowcharts)

Direction communicates meaning — choose intentionally:

| Direction | Best for | Example |
|-----------|----------|---------|
| `LR` | Sequential processes, pipelines, data flow, CI/CD | Request → Process → Response |
| `TD` / `TB` | Hierarchies, decision trees, org charts, inheritance | Parent → Children |
| `RL` | Reverse dependency flow (rare) | Output ← Source |
| `BT` | Bottom-up aggregation (rare) | Details → Summary |

Default to `LR` for most diagrams. Use `TD` when there's a clear top-down hierarchy.

---

## Node Shape Semantics

Shapes carry meaning — use them consistently:

| Shape | Syntax | Semantic meaning |
|-------|--------|-----------------|
| Rectangle | `[text]` | Process step, action, service |
| Rounded | `(text)` | Start/end event, terminal |
| Stadium | `([text])` | Terminal, entry/exit point |
| Diamond | `{text}` | Decision, condition, branch |
| Circle | `((text))` | Connector, junction |
| Cylinder | `[(text)]` | Database, data store |
| Parallelogram | `[/text/]` | Input/output, data |
| Hexagon | `{{text}}` | Preparation, setup step |
| Trapezoid | `[/text\]` | Manual operation |
| Double circle | `(((text)))` | Critical event, milestone |

---

## Edge Types and Labels

| Edge | Syntax | Meaning |
|------|--------|---------|
| Solid arrow | `-->` | Direct flow, dependency |
| Solid line | `---` | Association, connection |
| Dotted arrow | `-.->` | Optional flow, async message |
| Dotted line | `-.-` | Weak association |
| Thick arrow | `==>` | Important/primary flow |
| Thick line | `===` | Strong association |
| Invisible | `~~~` | Layout control (no visible line) |

Edge labels use two equivalent syntaxes:
```
A -->|"label text"| B     %% pipe syntax
A -- "label text" --> B   %% inline syntax
```

Use pipes (`|label|`) for short labels, inline for longer descriptions. Quote labels containing
special characters. Extra dashes extend link length: `A ---->  B` spans more ranks.

---

## Quality Patterns

### Pattern 1: Consistent Styling with classDef

Define reusable style classes instead of inline `style` directives:

```
flowchart LR
  classDef primary fill:#4a90d9,stroke:#2c5ea0,color:#fff
  classDef success fill:#c8e6c9,stroke:#388e3c,color:#000
  classDef danger fill:#ffcdd2,stroke:#c62828,color:#000
  classDef neutral fill:#f5f5f5,stroke:#666,color:#000

  start([Start]):::primary --> check{Valid?}
  check -->|Yes| ok[Process]:::success
  check -->|No| fail[Error]:::danger
```

### Pattern 2: Subgraph Organization

Group related nodes in named subgraphs. Keep subgraph names descriptive:

```
flowchart TB
  subgraph frontend["Frontend Layer"]
    web[Web App]
    mobile[Mobile App]
  end
  subgraph backend["Backend Services"]
    direction LR
    api[API Gateway]
    auth[Auth Service]
    data[Data Service]
  end
  subgraph storage["Data Layer"]
    db[(PostgreSQL)]
    cache[(Redis)]
  end

  frontend --> backend
  backend --> storage
```

Important caveat: if any node inside a subgraph connects to a node outside it, the subgraph's
`direction` override is silently ignored. Design connections accordingly.

### Pattern 3: YAML Frontmatter for Configuration

Use frontmatter (not `%%{init}%%`) for theme and config:

```
---
config:
  theme: neutral
---
flowchart LR
  A --> B
```

Never override themes on GitHub — it auto-handles light/dark mode.

### Pattern 4: Accessibility

Include `accTitle` and `accDescr` in every diagram for screen reader support:

```
flowchart LR
  accTitle: User Authentication Flow
  accDescr: Shows the steps from login request through token validation to access grant
  A[Login Request] --> B{Credentials Valid?}
  B -->|Yes| C[Generate Token]
  B -->|No| D[Reject]
```

---

## Anti-Patterns to Avoid

1. **Meaningless node IDs** — `A --> B --> C` tells nobody anything. Use descriptive IDs.
2. **Hardcoded colors without classDef** — `style A fill:#f00` scattered everywhere is unmaintainable. Use classes.
3. **Giant monolithic diagrams** — If it needs scrolling, it needs splitting.
4. **Missing edge labels on decision branches** — Every diamond should have labeled outgoing edges.
5. **Inconsistent arrow types** — Pick solid vs dotted vs thick and use them consistently for the same semantic meaning throughout the diagram.
6. **Node label redefinition** — Defining `A[First label]` and later `A[Second label]` silently takes the last definition. Define each node once.
7. **Hallucinating syntax** — Never invent Mermaid features. If uncertain about a syntax, use the simplest known-working alternative.
8. **Bare `end` as a node ID** — Always capitalize or quote: `End["end"]`.

---

## Completeness Checklist

Before delivering any diagram, verify:

- [ ] Diagram type declaration is present and correct
- [ ] All labels with special characters are double-quoted
- [ ] No reserved words used as bare node IDs
- [ ] Node IDs are descriptive (not `A`, `B`, `C`)
- [ ] Every decision diamond has labeled outgoing edges
- [ ] Subgraphs have matching `end` keywords
- [ ] Node count is under 50 (or diagram is split)
- [ ] Direction choice matches content structure
- [ ] `accTitle` and `accDescr` are included
- [ ] Edge types are used consistently
- [ ] No platform-incompatible features (unless user specified target)
- [ ] The diagram tells ONE clear story

---

## Reference Files

Read the appropriate reference file BEFORE generating a diagram of that type.
Each file contains complete, production-ready examples and type-specific best practices:

| Diagram Type | Reference File | When to Read |
|-------------|----------------|--------------|
| Flowcharts | `references/flowchart.md` | Any flow, process, pipeline, decision tree, architecture overview |
| Sequence diagrams | `references/sequence.md` | API flows, authentication, service communication, protocol exchanges |
| Class, State, ER | `references/structural.md` | Data models, OOP design, state machines, database schemas |
| Gantt, Git, C4, Mindmap, Timeline, Pie, Block | `references/specialized.md` | Project planning, branching strategies, system architecture, brainstorming |
| Theming, platforms, accessibility | `references/styling-platform.md` | Custom colors, dark mode, GitHub/GitLab compatibility, WCAG compliance |

Always read the reference before writing code for that diagram type — the examples prevent the
most common errors specific to each type.
