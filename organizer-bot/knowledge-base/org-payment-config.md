## Payment Configuration

### Payment Gateways

#### Supported Gateways
| Gateway | Currency | Market |
|---------|----------|--------|
| **Maya** | PHP | Philippines |
| **Stripe** | SGD, USD | Singapore, International |

### Fee Settings

Access via: **Event Page > Edit > Settings**

#### Transaction Fees
| Setting | Description | Default |
|---------|-------------|---------|
| **Transaction Fee** | Payment gateway fee percentage | 0.07 (7%) |
| **Pass On Transaction Fee** | Buyer pays the fee | false |

#### Convenience Fees
| Setting | Description | Default |
|---------|-------------|---------|
| **Convenience Fee (Cents)** | Fixed fee per ticket | 2000 (₱20) |
| **Pass On Convenience Fee** | Buyer pays the fee | false |

### Fee Calculation Examples

**Scenario 1: Seller Absorbs All Fees**
- Ticket Price: ₱1,000
- Transaction Fee (7%): ₱70 (seller pays)
- Convenience Fee: ₱20 (seller pays)
- Buyer Pays: ₱1,000
- Seller Receives: ₱910

**Scenario 2: Buyer Pays All Fees**
- Ticket Price: ₱1,000
- Transaction Fee (7%): ₱75.27 (grossed up)
- Convenience Fee: ₱20
- Buyer Pays: ₱1,095.27
- Seller Receives: ₱1,000

### Order Timeout
| Setting | Description | Default |
|---------|-------------|---------|
| **Reservation Expiry (Minutes)** | Time before unpaid orders timeout | 15 |

### Free Orders
- Orders with ₱0 total skip payment gateway
- Still require form completion
- Marked as `is_free_order: true`
