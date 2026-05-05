# Styling, Theming, Platform Compatibility & Accessibility

## Table of Contents
1. [Styling with classDef](#styling-with-classdef)
2. [Theming](#theming)
3. [Color Semantics](#color-semantics)
4. [Platform Compatibility](#platform-compatibility)
5. [Accessibility](#accessibility)
6. [Advanced Techniques](#advanced-techniques)

---

## Styling with classDef

### Define reusable classes (preferred over inline `style`)

```
classDef primary fill:#4a90d9,stroke:#2c5ea0,color:#fff
classDef success fill:#c8e6c9,stroke:#388e3c,color:#000
classDef danger fill:#ffcdd2,stroke:#c62828,color:#000
classDef warning fill:#fff3e0,stroke:#e65100,color:#000
classDef neutral fill:#f5f5f5,stroke:#666,color:#000
classDef disabled fill:#e0e0e0,stroke:#999,color:#999,stroke-dasharray:5 5
```

### Apply classes to nodes

```
A[Process]:::primary
B{Decision}:::warning
C[Success]:::success
```

### Default class (applies to all unstyled nodes)

```
classDef default fill:#f5f5f5,stroke:#333,color:#000
```

### Style individual links by index

```
linkStyle 0 stroke:#ff3,stroke-width:4px
linkStyle 1,2 stroke:#0f0,stroke-width:2px
linkStyle default stroke:#999,stroke-width:1px
```

### Subgraph styling

```
style subgraphId fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
```

### Why classDef over inline style

Inline `style A fill:#f00` scattered through a diagram is:
- Hard to maintain (colors duplicated everywhere)
- Hard to update (change one color = change every instance)
- Hard to read (visual noise mixed with structure)

`classDef` centralizes style definitions at the top, just like CSS.

---

## Theming

### Built-in themes

| Theme | Best for |
|-------|----------|
| `default` | General use, balanced colors |
| `neutral` | Print, documentation, B&W contexts |
| `dark` | Dark background environments |
| `forest` | Green-toned, nature aesthetic |
| `base` | Custom theming (the ONLY customizable theme) |

### Applying themes via frontmatter

```yaml
---
config:
  theme: neutral
---
flowchart LR
  A --> B
```

### Custom theme with `base`

Only the `base` theme supports `themeVariables`:

```yaml
---
config:
  theme: base
  themeVariables:
    primaryColor: "#4a90d9"
    primaryTextColor: "#ffffff"
    primaryBorderColor: "#2c5ea0"
    lineColor: "#666666"
    secondaryColor: "#e8f4fd"
    tertiaryColor: "#f5f5f5"
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
---
```

### Key theme variables

| Variable | Controls |
|----------|---------|
| `primaryColor` | Main node fill |
| `primaryTextColor` | Text on primary nodes |
| `primaryBorderColor` | Primary node borders |
| `secondaryColor` | Secondary node fill |
| `tertiaryColor` | Tertiary/background fill |
| `lineColor` | All edges/lines |
| `fontFamily` | Typography |
| `fontSize` | Base font size |

### Edge curve styles

```yaml
---
config:
  flowchart:
    curve: basis    # smooth curves (default)
    # curve: linear    # straight segments
    # curve: stepAfter  # right-angle steps
---
```

### Hand-drawn look (v11+)

```yaml
---
config:
  look: handDrawn
  handDrawnSeed: 42    # reproducible sketch style
---
```

---

## Color Semantics

Use colors consistently to carry meaning across all diagrams:

### Recommended semantic palette

| Semantic | Fill | Stroke | Use for |
|----------|------|--------|---------|
| Primary/Info | `#e3f2fd` | `#1565c0` | Main process steps, information |
| Success | `#e8f5e9` | `#2e7d32` | Completed, approved, valid |
| Warning | `#fff3e0` | `#e65100` | Pending, attention needed |
| Danger/Error | `#ffebee` | `#c62828` | Failed, rejected, critical |
| Neutral | `#f5f5f5` | `#666666` | Background, optional, inactive |
| Highlight | `#f3e5f5` | `#7b1fa2` | Special attention, gateway |

### Dark mode considerations

- Never specify themes on GitHub — it auto-handles light/dark switching
- When targeting dark backgrounds, use lighter fill colors with dark text
- The `dark` theme works well for self-hosted dark-mode environments
- Test diagrams in both light and dark modes when possible

### WCAG contrast guidelines

- Minimum 4.5:1 contrast ratio for normal text
- Minimum 3:1 for large text (>18pt)
- Never use color alone to convey meaning — pair with labels, shapes, or text patterns
- Use a contrast checker tool when defining custom colors

---

## Platform Compatibility

### Version matrix

| Platform | Approx. Mermaid Version | Last updated |
|----------|------------------------|--------------|
| npm (latest) | 11.13.0 | March 2026 |
| GitHub | ~11.4.1 | Lags npm by months |
| GitLab | Varies by instance | Admin-controlled |
| Notion | ~11.3.0 | Proprietary updates |
| Obsidian | ~11.4.1 | Plugin-dependent |
| VS Code (ext.) | ~11.4.0 | Extension updates |
| Confluence | Via paid plugins | Plugin-dependent |

### Cross-platform safe features (use these always)

- All core diagram types: flowchart, sequence, class, state, ER, gantt, pie, git, mindmap, timeline
- Node shapes: `[]`, `()`, `([])`, `{}`, `(())`, `[()]`, `[//]`, `{{}}`, `[[]]`
- Edge types: `-->`, `---`, `-.->`, `==>`, `~~~`
- `classDef` and `style` directives
- Subgraphs with `end`
- YAML frontmatter configuration
- `accTitle` and `accDescr`
- Comments with `%%`
- Edge labels with `|text|` or `-- text -->`

### Features to AVOID for cross-platform compatibility

| Feature | Issue |
|---------|-------|
| `layout: elk` | Only works in self-hosted / VS Code |
| `fa:fa-*` (Font Awesome icons) | Requires icon font loaded; fails on GitHub, GitLab |
| `click nodeId href "url"` | Blocked by GitHub's iframe sandbox |
| `click nodeId callback` | JavaScript disabled on all hosted platforms |
| Emoji in labels | Parse errors on some platforms |
| `@{ shape: ... }` syntax | Requires v11.3+; most platforms are older |
| Theme overrides on GitHub | GitHub auto-manages themes; overrides cause issues |
| Markdown strings with classDef | Known interaction bug breaks color styling |

### Platform-specific limits

| Platform | Max characters | Max edges | Notes |
|----------|---------------|-----------|-------|
| GitHub | ~50,000 | ~100 (practical) | Renders via Viewscreen iframe |
| GitLab | ~50,000 | ~100 | Configurable by admin |
| Obsidian | ~50,000 | ~280 (hard limit) | Local rendering |
| Mermaid Live Editor | Unlimited | Unlimited | Best for testing |

### How to embed in Markdown (GitHub, GitLab)

````markdown
```mermaid
flowchart LR
  A --> B
```
````

GitHub and GitLab automatically render Mermaid code blocks. No plugins needed.

---

## Accessibility

### Required elements for every diagram

```
flowchart LR
  accTitle: Descriptive Title Here
  accDescr: A longer description explaining what the diagram shows and its purpose
```

These generate `<title>` and `<desc>` SVG elements with proper `aria-labelledby` and
`aria-describedby` attributes.

### Multi-line descriptions

```
accDescr {
  This diagram shows the authentication flow
  from user login through token validation.
  Red nodes indicate error states.
  Green nodes indicate success states.
}
```

### Beyond ARIA: supplementary text

Screen readers cannot meaningfully parse SVG node-and-edge relationships. For critical
information, ALSO provide a text description outside the Mermaid block:

```markdown
**Figure 1: Authentication Flow** — The user submits credentials to the auth service,
which validates against the database. On success, a JWT token is returned; on failure,
an error message is displayed after 3 failed attempts.

```mermaid
flowchart LR
  ...
```
```

### Accessibility checklist

- [ ] `accTitle` present with concise, descriptive title
- [ ] `accDescr` present explaining the diagram's purpose and key elements
- [ ] Colors are not the sole means of conveying information
- [ ] Text contrast meets WCAG 4.5:1 minimum
- [ ] Supplementary text description provided for critical diagrams

---

## Advanced Techniques

### Invisible links for layout control

Force two nodes to be adjacent without a visible connection:

```
A ~~~ B
```

### Invisible subgraphs for visual grouping

```
subgraph hidden[" "]
  style hidden fill:none,stroke:none
  A --> B
end
```

### Edge IDs for targeted styling (v11+)

```
A e1@--> B
A e2@-.-> C

style e1 stroke:#f00,stroke-width:3px
style e2 stroke:#00f,stroke-width:2px
```

### Multi-line labels with Markdown

```
A["`**Title**
Description text
that wraps`"]
```

Note: Markdown strings have a known interaction issue with `classDef` color styling —
test thoroughly when combining both features.

### Configuration via frontmatter

```yaml
---
config:
  flowchart:
    nodeSpacing: 50      # horizontal spacing between nodes
    rankSpacing: 80      # vertical spacing between ranks
    curve: basis         # edge curve style
    padding: 20          # padding inside nodes
    defaultRenderer: dagre  # or elk (self-hosted only)
---
```

### Testing and validation

- **Mermaid Live Editor** (https://mermaid.live) — the authoritative testing tool
- Copy-paste your diagram and verify it renders before delivering
- For CLI validation, `mermaid.parse()` returns syntax errors
- For CI/CD, the `@mermaid-js/mermaid-cli` npm package can render to SVG/PNG
