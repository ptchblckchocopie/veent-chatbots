## Printed Tickets

### Printed Ticket Management

Access via: **Event Page > Printed Tickets** (if enabled)

#### Feature Toggle
- Enabled by admin per event
- Controlled by `printedTicketsEnabled` setting

### Allocation
| Action | Description |
|--------|-------------|
| **Allocate** | Reserve tickets for printing |
| **Return** | Return unprinted tickets to stock |
| **Void** | Cancel printed tickets |
| **Mark Printed** | Confirm tickets printed |

### Ticket Statuses
| Status | Description |
|--------|-------------|
| **pending_print** | Allocated, not yet printed |
| **printed** | Physically printed |
| **voided** | Cancelled |
| **returned** | Returned to online stock |

### Fee Settings
| Setting | Description | Default |
|---------|-------------|---------|
| **Printing Fee Per Ticket** | Fee for physical tickets | ₱20 |
| **Printing Fee Enabled** | Charge printing fee | true |
| **Print Allocation Limit %** | Max % allocatable | 20% |

### Seat Selection for Printed Tickets
- Select specific seats when allocating
- View seat availability
- Assign to specific registrants
