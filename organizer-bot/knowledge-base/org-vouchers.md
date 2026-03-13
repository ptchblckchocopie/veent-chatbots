## Vouchers & Promotions

### Creating Vouchers

Access via: **Event Page > Promotion**

#### Basic Settings
| Field | Description |
|-------|-------------|
| **Group Name** | Display name for voucher batch |
| **Code/Prefix** | Voucher code or prefix for bulk |
| **Status** | active/inactive/expired |

#### Usage Types
| Type | Description |
|------|-------------|
| **Single-Use** | Each code works once (bulk generated) |
| **Multiple-Use** | One code with limited uses |
| **Unlimited** | One code with no use limit |
| **Target Price** | Sets ticket to specific price |

#### Discount Types
| Type | Field | Example |
|------|-------|---------|
| **Percentage** | discountPercentage | 0.30 = 30% off |
| **Fixed Amount** | discountValue | 50000 = ₱500 off |
| **Target Price** | targetPrice | 11100 = ₱111 final price |

#### Validity Settings
| Field | Description |
|-------|-------------|
| **Valid From** | When voucher becomes active |
| **Valid Until** | When voucher expires |
| **Minimum Order Amount** | Minimum cart total required |

#### Restrictions
| Field | Description |
|-------|-------------|
| **Applicable Ticket Types** | Limit to specific tickets |
| **Event** | Limit to specific events |
| **Stock** | Total uses available |

### Voucher Examples

**Early Bird 20% Off:**
```
Code: EARLYBIRD
Type: Percentage
Discount: 0.20 (20%)
Valid Until: 2025-05-01
Stock: 100 uses
```

**VIP ₱500 Off:**
```
Code: VIP500
Type: Fixed Amount
Discount: 50000 cents (₱500)
Minimum Order: ₱2,000
```

**11.11 Flash Sale:**
```
Code: 1111SALE
Type: Target Price
Target: ₱111.00
Stock: 50 uses
```
