# Contingency Amount Implementation

## Overview

This document describes the implementation of contingency amount tracking for supplier quotes. When a quote document shows a total that exceeds the sum of line items, the difference is now captured as a contingency amount.

## Problem Statement

Previously, when importing quotes, the system calculated the quote total by summing all line items. However, many quotes include additional costs (contingency, margin, fees, etc.) that make the actual quoted total higher than the line items sum. This caused the displayed quote values to be lower than the actual quotes, leading to inaccurate financial reporting.

## Solution

### Database Changes

**New Columns in `quotes` Table:**

1. **`quoted_total`** (numeric, nullable)
   - Stores the actual total from the quote document
   - Can be null if not explicitly provided during import
   - User-editable via the UI

2. **`contingency_amount`** (numeric, default 0)
   - Automatically calculated as: `quoted_total - SUM(line_items.total_price)`
   - Always >= 0 (enforced by check constraint)
   - Represents the difference between quoted total and line items

### Calculation Logic

```
quoted_total = Value from quote document (user-provided or extracted)
line_items_total = SUM of all quote_items.total_price
contingency_amount = MAX(0, quoted_total - line_items_total)
total_amount = quoted_total (if provided) OR line_items_total
```

### UI Changes

**Quotes Table (`QuotesTable.tsx`):**

1. **Quote Value Display:**
   - Shows the quoted total (if available) or calculated total from line items
   - Displays contingency breakdown when present:
     ```
     $2,118,291.71
     Line items: $2,100,000
     Contingency: $18,291.71
     ```

2. **Editable Quote Totals:**
   - Click the edit icon next to any quote value
   - Enter the actual quoted total from the document
   - System automatically calculates and stores contingency
   - Changes are saved immediately to the database

### Backend Changes

**BOQ Saver (`boqSaver.ts`):**

- Added optional `quotedTotals` parameter: `Map<string, number>`
- Accepts supplier name → quoted total mappings
- Automatically calculates contingency when creating quotes
- Logs all calculations for debugging

**Example Usage:**
```typescript
const quotedTotals = new Map<string, number>();
quotedTotals.set("Passive Fire NZ Test", 672046);
quotedTotals.set("Global BTR 4", 2118291.71);

await saveBOQToDatabase(projectId, boqData, quotedTotals);
```

## Migration

The migration automatically:
1. Adds both new columns to the `quotes` table
2. Adds performance index on `quoted_total`
3. Adds check constraint ensuring `contingency_amount >= 0`
4. Backfills existing quotes with calculated contingency amounts

**Migration File:** `supabase/migrations/[timestamp]_add_contingency_to_quotes.sql`

## User Workflow

### For Existing Quotes

1. View quotes in the Quotes Table
2. Click the edit icon next to the quote value
3. Enter the actual quoted total from the document
4. Press Enter or click the checkmark to save
5. The system displays the breakdown:
   - Total quote value
   - Line items sum
   - Contingency amount

### For New Quotes

When importing new quotes:
1. The system will sum all line items by default
2. If the import process provides a `quoted_total`, it will be used instead
3. Contingency is automatically calculated
4. The quote value shown will always match the actual document

## Benefits

1. **Accurate Financial Reporting:** Quote totals now match the actual quoted amounts
2. **Transparency:** Users can see exactly how much is contingency vs. line items
3. **Flexibility:** Totals can be edited post-import if needed
4. **Data Integrity:** Check constraints prevent negative contingencies
5. **Audit Trail:** All changes are tracked in the database

## Examples

### Example 1: Passive Fire NZ Test
- Line Items Total: $650,000
- Quoted Total: $672,046
- **Contingency: $22,046**

### Example 2: Global BTR 4
- Line Items Total: $2,100,000
- Quoted Total: $2,118,291.71
- **Contingency: $18,291.71**

## Technical Details

### Database Schema

```sql
ALTER TABLE quotes ADD COLUMN quoted_total numeric DEFAULT NULL;
ALTER TABLE quotes ADD COLUMN contingency_amount numeric DEFAULT 0;
ALTER TABLE quotes ADD CONSTRAINT quotes_contingency_positive
  CHECK (contingency_amount >= 0);
```

### TypeScript Types

```typescript
interface Quote {
  id: string;
  supplier: string;
  quoteValue: number;              // Display value (quoted_total or total_amount)
  quotedTotal: number | null;      // User-provided/extracted total
  contingencyAmount: number;       // Calculated difference
  lineItemsTotal: number;          // Sum of line items
  // ... other fields
}
```

## Future Enhancements

1. **Automatic Extraction:** Parse quoted totals from PDF documents during import
2. **Contingency Breakdown:** Allow users to categorize contingency (margin, fees, etc.)
3. **Reporting:** Add contingency analysis to award reports
4. **Validation:** Warn users if contingency percentage seems unusually high
5. **Bulk Edit:** Allow editing multiple quote totals at once

## Testing

To test the implementation:

1. Navigate to a project with imported quotes
2. Check if existing quotes show correct totals
3. Edit a quote value to add contingency
4. Verify the breakdown appears correctly
5. Refresh the page and confirm the values persist
6. Check that the award report uses the correct totals
