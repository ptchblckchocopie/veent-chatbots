## Ticket Types & Pricing

### Creating Ticket Types

Access via: **Event Page > Form Builder > Create Ticket**

#### Core Fields
| Field | Type | Description |
|-------|------|-------------|
| **Name** | Text | Ticket type name (e.g., "VIP", "General Admission") |
| **Description** | Textarea | Detailed ticket description |
| **Price** | Number | Price in cents (e.g., 100000 = ₱1,000.00) |
| **Total Stock** | Number | Total tickets available |
| **Color** | Color picker | Ticket badge color |
| **Status** | Select | "active" or "inactive" |

#### Stock Management
| Field | Description |
|-------|-------------|
| **Total Stock** | Initial inventory count |
| **Sold Count** | Tickets sold (system-managed) |
| **Reserved Stock** | Tickets in pending orders (system-managed) |
| **Print Allocated** | Tickets allocated for physical printing |

**Available Stock Formula:**
```
Available = Total Stock - Sold Count - Reserved Stock - Print Allocated
```

#### Order Limits
| Field | Description | Default |
|-------|-------------|---------|
| **Min Order Quantity** | Minimum tickets per order | 1 |
| **Max Order Quantity** | Maximum tickets per order | 10 |

#### Sales Window
| Field | Description |
|-------|-------------|
| **Sales Start** | When ticket sales begin |
| **Sales End** | When ticket sales end |
| **Show Sales Start Time** | Display exact start time | false |
| **Show Sales End Time** | Display exact end time | false |

### Package Tickets

Package tickets bundle multiple child tickets together.

| Field | Description |
|-------|-------------|
| **Is Package** | Enable package mode |
| **Package Components** | Child ticket types included |
| **Included Qty Per Package** | How many of each child per package |
| **Max Qty Per Package** | Maximum child tickets per package unit |

#### Package Example
- **VIP Package** (parent)
  - Includes: 1x VIP Entry + 2x Drink Voucher + 1x Meet & Greet

### Ticket Properties (Custom Fields)
Add custom metadata to tickets displayed on the ticket card:
```json
{
  "properties": [
    { "key": "Date", "value": "June 15, 2025" },
    { "key": "Venue", "value": "Main Stage" }
  ]
}
```
