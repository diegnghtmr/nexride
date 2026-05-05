# Structural Diagrams — Class, State & ER Reference

## Table of Contents
1. [Class Diagrams](#class-diagrams)
2. [State Diagrams](#state-diagrams)
3. [ER Diagrams](#er-diagrams)

---

## Class Diagrams

### Anatomy

Class diagrams model object structure: classes, attributes, methods, and relationships.
Always include visibility modifiers and return types for professional quality.

### Visibility modifiers

| Symbol | Meaning |
|--------|---------|
| `+` | Public |
| `-` | Private |
| `#` | Protected |
| `~` | Package / Internal |

### Relationship types

| Relationship | Syntax | Meaning |
|-------------|--------|---------|
| Inheritance | `<\|--` | "is a" (extends) |
| Composition | `*--` | "has a" (strong ownership, lifecycle bound) |
| Aggregation | `o--` | "has a" (weak ownership, independent lifecycle) |
| Association | `-->` | "uses" / "knows about" |
| Dependency | `..>` | "depends on" (transient) |
| Realization | `..\|>` | "implements" (interface) |

### Complete Example: E-Commerce Domain Model

```mermaid
classDiagram
  accTitle: E-Commerce Domain Model
  accDescr: Class diagram showing core entities and relationships for an e-commerce system

  direction LR

  class Customer {
    -Long id
    -String email
    -String name
    -Address shippingAddress
    +placeOrder(items) Order
    +getOrderHistory() List~Order~
  }

  class Order {
    -Long id
    -LocalDateTime createdAt
    -OrderStatus status
    -BigDecimal totalAmount
    +addItem(product, quantity) void
    +removeItem(itemId) void
    +calculateTotal() BigDecimal
    +cancel() void
  }

  class OrderItem {
    -Long id
    -int quantity
    -BigDecimal unitPrice
    +getSubtotal() BigDecimal
  }

  class Product {
    -Long id
    -String name
    -String description
    -BigDecimal price
    -int stockQuantity
    +isAvailable() boolean
    +reduceStock(quantity) void
  }

  class OrderStatus {
    <<enumeration>>
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
  }

  class PaymentStrategy {
    <<interface>>
    +processPayment(amount) PaymentResult
    +refund(transactionId) RefundResult
  }

  class CreditCardPayment {
    -String cardNumber
    -String expiryDate
    +processPayment(amount) PaymentResult
    +refund(transactionId) RefundResult
  }

  class PayPalPayment {
    -String paypalEmail
    +processPayment(amount) PaymentResult
    +refund(transactionId) RefundResult
  }

  Customer "1" --> "*" Order : places
  Order "1" *-- "1..*" OrderItem : contains
  OrderItem "*" --> "1" Product : references
  Order --> OrderStatus : has
  Order --> PaymentStrategy : uses
  PaymentStrategy <|.. CreditCardPayment : implements
  PaymentStrategy <|.. PayPalPayment : implements
```

### Class Diagram Best Practices

- Use `direction LR` for wide hierarchies, default `TB` for deep inheritance trees
- Include cardinality on ALL associations: `"1" --> "*"`, `"0..1" --> "1..*"`
- Use `<<interface>>`, `<<abstract>>`, `<<enumeration>>` annotations
- Generics use tildes: `List~Order~`, `Map~String, Object~`
- Group related classes with `namespace` blocks
- Methods should include parameter types and return types
- Keep to 8–10 classes maximum per diagram; split large models

---

## State Diagrams

### Use `stateDiagram-v2`

Always use `stateDiagram-v2` (the newer renderer with better features). The original
`stateDiagram` is legacy and should not be used.

### Core syntax

```
[*] --> State1            %% Start state
State1 --> State2 : event %% Transition with trigger
State2 --> [*]            %% End state
```

### Complete Example: Order Lifecycle

```mermaid
stateDiagram-v2
  accTitle: Order State Machine
  accDescr: Shows all possible states and transitions for an order

  [*] --> Draft : create order

  Draft --> Pending : submit
  Draft --> [*] : discard

  Pending --> Confirmed : payment received
  Pending --> Cancelled : payment timeout

  Confirmed --> Processing : begin fulfillment
  Confirmed --> Cancelled : customer cancels

  Processing --> Shipped : dispatch
  Processing --> OnHold : stock issue

  OnHold --> Processing : stock resolved
  OnHold --> Cancelled : cannot fulfill

  Shipped --> Delivered : delivery confirmed
  Shipped --> Returned : delivery refused

  Delivered --> Returned : return requested
  Delivered --> [*] : completed

  Returned --> Refunded : refund processed
  Refunded --> [*]

  Cancelled --> Refunded : refund if paid
  Cancelled --> [*] : no refund needed
```

### Composite (Nested) States

```mermaid
stateDiagram-v2
  accTitle: Authentication States
  accDescr: Nested states for user authentication flow

  [*] --> LoggedOut

  state LoggedOut {
    [*] --> Idle
    Idle --> Authenticating : login attempt
    Authenticating --> Failed : invalid credentials
    Failed --> Idle : retry
  }

  LoggedOut --> LoggedIn : auth success

  state LoggedIn {
    [*] --> Active
    Active --> SessionExpiring : timeout warning
    SessionExpiring --> Active : user activity
    SessionExpiring --> SessionExpired : no activity
  }

  LoggedIn --> LoggedOut : logout
  LoggedIn --> LoggedOut : session expired
```

### Choice, Fork, and Join

```mermaid
stateDiagram-v2
  accTitle: Parallel Processing States
  accDescr: Shows fork/join for concurrent state execution

  [*] --> Received

  Received --> Processing

  state processingFork <<fork>>
  Processing --> processingFork

  processingFork --> ValidatePayment
  processingFork --> CheckInventory
  processingFork --> VerifyAddress

  state processingJoin <<join>>
  ValidatePayment --> processingJoin
  CheckInventory --> processingJoin
  VerifyAddress --> processingJoin

  processingJoin --> AllChecked

  state checkResult <<choice>>
  AllChecked --> checkResult

  checkResult --> Approved : all passed
  checkResult --> Rejected : any failed

  Approved --> [*]
  Rejected --> [*]
```

### State Diagram Best Practices

- Always include `[*]` start state and at least one `[*]` end state
- Label EVERY transition with its trigger event
- Use composite states when state count exceeds 15
- `classDef` cannot be applied to `[*]` or composite states (known limitation)
- Concurrent regions use `--` separator inside a state
- Keep nesting to 2 levels maximum

---

## ER Diagrams

### Crow's Foot Notation

ER diagrams use Crow's Foot notation for cardinality:

| Notation | Meaning |
|----------|---------|
| `\|\|` | Exactly one |
| `o\|` | Zero or one |
| `\|{` or `}\|` | One or more |
| `o{` or `}o` | Zero or more |

Line types:
- `--` solid line = identifying relationship (child depends on parent for identity)
- `..` dashed line = non-identifying relationship

### Syntax pattern

```
ENTITY1 ||--o{ ENTITY2 : "relationship verb"
```

Read as: "one ENTITY1 is associated with zero or more ENTITY2"

### Complete Example: E-Commerce Database Schema

```mermaid
erDiagram
  accTitle: E-Commerce Database Schema
  accDescr: Entity relationship diagram for a complete e-commerce database

  CUSTOMER {
    bigint id PK
    varchar email UK
    varchar first_name
    varchar last_name
    varchar phone
    timestamp created_at
    timestamp updated_at
  }

  ADDRESS {
    bigint id PK
    bigint customer_id FK
    varchar street
    varchar city
    varchar state
    varchar zip_code
    varchar country
    boolean is_default
  }

  PRODUCT {
    bigint id PK
    bigint category_id FK
    varchar name
    text description
    decimal price
    int stock_quantity
    varchar sku UK
    boolean is_active
  }

  CATEGORY {
    bigint id PK
    bigint parent_id FK
    varchar name
    varchar slug UK
  }

  ORDER {
    bigint id PK
    bigint customer_id FK
    bigint shipping_address_id FK
    varchar status
    decimal total_amount
    decimal tax_amount
    timestamp placed_at
    timestamp shipped_at
  }

  ORDER_ITEM {
    bigint id PK
    bigint order_id FK
    bigint product_id FK
    int quantity
    decimal unit_price
    decimal subtotal
  }

  PAYMENT {
    bigint id PK
    bigint order_id FK
    varchar method
    varchar transaction_id UK
    decimal amount
    varchar status
    timestamp processed_at
  }

  REVIEW {
    bigint id PK
    bigint customer_id FK
    bigint product_id FK
    int rating
    text comment
    timestamp created_at
  }

  CUSTOMER ||--o{ ADDRESS : "has"
  CUSTOMER ||--o{ ORDER : "places"
  CUSTOMER ||--o{ REVIEW : "writes"
  ORDER ||--|{ ORDER_ITEM : "contains"
  ORDER ||--o| PAYMENT : "has"
  ORDER }o--|| ADDRESS : "ships to"
  ORDER_ITEM }o--|| PRODUCT : "references"
  PRODUCT }o--|| CATEGORY : "belongs to"
  CATEGORY ||--o{ CATEGORY : "has subcategories"
  PRODUCT ||--o{ REVIEW : "receives"
```

### ER Diagram Best Practices

- Use **singular nouns** for entity names: CUSTOMER not CUSTOMERS
- **CAPITALIZE** entity names by convention
- Mark keys explicitly: `PK` (primary), `FK` (foreign), `UK` (unique)
- Include data types for all attributes: `varchar`, `bigint`, `decimal`, `timestamp`, etc.
- Use identifying relationships (`--`) when the child's identity depends on the parent
- Use non-identifying relationships (`..`) when the child can exist independently
- Relationship labels should be verbs: "places", "contains", "has", "writes"
- Keep to 10–15 entities max per diagram; split large schemas by domain boundary
