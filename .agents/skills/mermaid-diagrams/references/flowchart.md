# Flowchart Diagrams — Complete Reference

## Table of Contents
1. [Anatomy of a Flowchart](#anatomy)
2. [Complete Examples](#complete-examples)
3. [Subgraph Techniques](#subgraph-techniques)
4. [Layout Control](#layout-control)
5. [Common Pitfalls](#common-pitfalls)

---

## Anatomy

Every flowchart has: a type declaration with direction, node definitions, edge connections,
and optional subgraphs and styling. Use `flowchart` (not `graph`) to access all modern features.

```mermaid
flowchart LR
  accTitle: Basic Flowchart Structure
  accDescr: Shows the fundamental components of a Mermaid flowchart

  %% Node definitions
  start([Start])
  process[Process Step]
  decision{Decision?}
  output[/Output/]
  finish([End])

  %% Connections
  start --> process
  process --> decision
  decision -->|"Yes"| output
  decision -->|"No"| process
  output --> finish
```

---

## Complete Examples

### Example 1: CI/CD Pipeline (LR — sequential process)

```mermaid
flowchart LR
  accTitle: CI/CD Pipeline
  accDescr: Continuous integration and deployment pipeline from commit to production

  classDef stage fill:#e3f2fd,stroke:#1565c0,color:#000
  classDef check fill:#fff3e0,stroke:#e65100,color:#000
  classDef success fill:#e8f5e9,stroke:#2e7d32,color:#000
  classDef fail fill:#ffebee,stroke:#c62828,color:#000

  commit([Commit]):::stage
  build[Build]:::stage
  unitTest[Unit Tests]:::check
  lint[Lint & Format]:::check
  intTest[Integration Tests]:::check
  secScan[Security Scan]:::check
  staging[Deploy Staging]:::stage
  e2e[E2E Tests]:::check
  approve{Approved?}
  prod[Deploy Production]:::success
  rollback[Rollback]:::fail

  commit --> build
  build --> unitTest & lint
  unitTest --> intTest
  lint --> intTest
  intTest --> secScan
  secScan --> staging
  staging --> e2e
  e2e --> approve
  approve -->|"Yes"| prod
  approve -->|"No"| rollback
```

### Example 2: Decision Tree (TD — hierarchical)

```mermaid
flowchart TD
  accTitle: Tech Stack Decision Tree
  accDescr: Decision process for choosing a backend technology stack

  classDef question fill:#fff9c4,stroke:#f57f17,color:#000
  classDef answer fill:#e8f5e9,stroke:#2e7d32,color:#000

  q1{Need real-time?}:::question
  q2{Team size?}:::question
  q3{Data complexity?}:::question
  q4{Performance critical?}:::question

  ws[WebSocket + Node.js]:::answer
  spring[Spring Boot + Java]:::answer
  django[Django + Python]:::answer
  go[Go + gRPC]:::answer
  rails[Ruby on Rails]:::answer
  express[Express.js]:::answer

  q1 -->|"Yes"| ws
  q1 -->|"No"| q2
  q2 -->|"Large (10+)"| q3
  q2 -->|"Small (1-5)"| q4
  q3 -->|"High"| spring
  q3 -->|"Medium"| django
  q4 -->|"Yes"| go
  q4 -->|"No"| rails
```

### Example 3: Microservice Architecture (TB with subgraphs)

```mermaid
flowchart TB
  accTitle: Microservice Architecture
  accDescr: E-commerce platform microservice architecture with API gateway

  classDef client fill:#e3f2fd,stroke:#1565c0,color:#000
  classDef gateway fill:#f3e5f5,stroke:#7b1fa2,color:#000
  classDef service fill:#e8f5e9,stroke:#2e7d32,color:#000
  classDef data fill:#fff3e0,stroke:#e65100,color:#000

  subgraph clients["Clients"]
    web[Web App]:::client
    mobile[Mobile App]:::client
    partner[Partner API]:::client
  end

  gw[API Gateway]:::gateway

  subgraph services["Backend Services"]
    direction LR
    userSvc[User Service]:::service
    orderSvc[Order Service]:::service
    productSvc[Product Service]:::service
    paymentSvc[Payment Service]:::service
    notifySvc[Notification Service]:::service
  end

  subgraph datastores["Data Stores"]
    direction LR
    userDb[(Users DB)]:::data
    orderDb[(Orders DB)]:::data
    productDb[(Products DB)]:::data
    cache[(Redis Cache)]:::data
    queue[(Message Queue)]:::data
  end

  clients --> gw
  gw --> services
  userSvc --> userDb
  orderSvc --> orderDb
  productSvc --> productDb
  orderSvc -.->|"async"| queue
  queue -.-> notifySvc
  productSvc --> cache
```

### Example 4: Error Handling Flow

```mermaid
flowchart LR
  accTitle: API Error Handling Flow
  accDescr: Shows how API errors are classified and handled

  classDef normal fill:#e8f5e9,stroke:#333,color:#000
  classDef warn fill:#fff3e0,stroke:#333,color:#000
  classDef error fill:#ffebee,stroke:#333,color:#000

  req[Incoming Request]:::normal
  validate{Input Valid?}
  auth{Authorized?}
  process[Process Request]:::normal
  result{Success?}

  res200[200 OK]:::normal
  res400[400 Bad Request]:::warn
  res401[401 Unauthorized]:::error
  res500[500 Server Error]:::error
  retry{Retryable?}
  retryLogic[Retry with Backoff]:::warn
  deadLetter[Dead Letter Queue]:::error

  req --> validate
  validate -->|"No"| res400
  validate -->|"Yes"| auth
  auth -->|"No"| res401
  auth -->|"Yes"| process
  process --> result
  result -->|"Yes"| res200
  result -->|"No"| retry
  retry -->|"Yes"| retryLogic
  retry -->|"No"| res500
  retryLogic -.->|"max retries"| deadLetter
  retryLogic -.->|"retry"| process
```

---

## Subgraph Techniques

### Nested subgraphs for layered architectures

```mermaid
flowchart TB
  subgraph cloud["Cloud Infrastructure"]
    subgraph k8s["Kubernetes Cluster"]
      pod1[Pod: API]
      pod2[Pod: Worker]
    end
    lb[Load Balancer]
    storage[(Object Storage)]
  end
  user[User] --> lb
  lb --> k8s
  pod2 --> storage
```

### Subgraph direction caveat

When a node inside a subgraph connects to a node outside, the subgraph's direction override is
**silently ignored**. Design your connections to avoid this, or accept the parent direction.

### Invisible subgraphs for grouping without visible borders

```
subgraph invisible[" "]
  style invisible fill:none,stroke:none
  A --> B
end
```

---

## Layout Control

### Invisible links for adjacent placement

Force two nodes to appear near each other without a visible connection:

```
A ~~~ B
```

### Extended links for spacing

Extra dashes add ranks of separation:

```
A ----> B      %% spans 2 extra ranks
A ------> C    %% spans 4 extra ranks
```

### Parallel edges with `&` operator

Send one node to multiple targets in a single line:

```
A --> B & C & D
```

Or create multiple parallel connections:

```
A & B --> C & D
```

This creates 4 edges: A→C, A→D, B→C, B→D.

---

## Common Pitfalls

### Pitfall 1: Subgraph with node named `end`

```
%% ❌ Subgraph never closes properly
subgraph section
  end --> start
end

%% ✅ Fixed
subgraph section
  endNode["end"] --> startNode
end
```

### Pitfall 2: Nodes starting with `o` or `x` after edge syntax

```
%% ❌ Parsed as circle/cross edge, not a node
A---oNode
A---xNode

%% ✅ Add space or quote
A--- oNode
A --> xNode[Exit Node]
```

### Pitfall 3: Redefining node labels

```
%% ❌ Second definition silently wins
A[First Label]
A --> B
A[Second Label]   %% "Second Label" is displayed

%% ✅ Define once, reference by ID
A[First Label]
A --> B
```

### Pitfall 4: Missing edge labels on decisions

```
%% ❌ Unlabeled decision branches
check{Valid?}
check --> process
check --> error

%% ✅ Always label decision outputs
check{Valid?}
check -->|"Yes"| process
check -->|"No"| error
```
