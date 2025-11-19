# Quote Total Reconciliation Fix

## Problem Summary

The parsed quote total **$3,745,659.20** is significantly higher than the actual quote total because:

1. **Section subtotals were parsed as line items** (disguised with small qty values like 5.2, 5.4)
2. **Contingency/allowance lines were included** ($89,084.96)
3. **Arithmetic mismatches** indicate subtotals (qty × rate ≠ total)

## Identified Overcount

### Section Subtotals Incorrectly Included:
| Description | Qty | Rate | Stated Total | Calculated (qty×rate) | Type |
|-------------|-----|------|--------------|----------------------|------|
| Ryanfire Ryanspan with Fixing brackets | 5.4 | $128.41 | **$237,789.64** | $693.41 | SUBTOTAL |
| Ryanfire Ryanspan with Fixing brakets | 5.4 | $128.41 | **$154,477.23** | $693.41 | SUBTOTAL |
| Tenmat FF102/50 | 5.2 | $93.23 | **$119,475.18** | $484.80 | SUBTOTAL |
| Tenmat FF102/50 | 5.2 | $93.23 | **$81,417.76** | $484.80 | SUBTOTAL |
| Ryanfire Ryanspan | 5.2 | $62.69 | **$87,646.89** | $325.99 | SUBTOTAL |
| Ryanfire Ryanspan | 5.2 | $62.69 | **$56,740.72** | $325.99 | SUBTOTAL |

### Contingency Line:
| Description | Amount |
|-------------|--------|
| POTENCIAL COST INCREASE FOR LABOUR AND MATERIALS (4%) | **$89,084.96** |

### Total Overcount:
- Section subtotals: $237,789 + $154,477 + $119,475 + $81,417 + $87,646 + $56,740 = **$737,544**
- Contingency: **$89,084**
- **Total overcount**: **$826,628**

### Corrected Total:
- Parsed total: $3,745,659
- Minus overcount: -$826,628
- **Expected correct total**: **~$2,919,031**

## Root Causes

### 1. Subtotals Disguised as Line Items
PDFs often show section summaries like:
```
Ryanfire Ryanspan    5.2 LM    $62.69    $87,646.89
```

This looks like a line item but:
- The qty (5.2) is actually a **page reference** or **section number**
- The rate ($62.69) is an **average** or **representative rate**
- The total ($87,646.89) is the **actual section subtotal**
- **Arithmetic doesn't match**: 5.2 × $62.69 = $325 ≠ $87,646

### 2. Contingency Lines
Lines like "POTENTIAL COST INCREASE (4%)" are:
- **Optional add-ons**, not base work
- Often shown separately but **not included in base totals**
- Should be filtered out during parsing

## Solution Implemented

### 1. Enhanced LLM Prompt
Updated system prompt to explicitly exclude:
- Subtotals, section totals, block totals
- Contingencies, allowances, escalations
- Any line containing "total", "summary", "allowance", etc.

### 2. Post-Processing Filters (Edge Function)
Added server-side filtering that removes:
- Lines matching `/\b(subtotal|total|summary|contingency|allowance)\b/i`
- Header rows
- Empty descriptions
- Duplicates

### 3. Arithmetic Validation (Client-side)
Created `src/lib/parsing/rowFilter.ts` with:
- **Number parser** for NZ currency format
- **Arithmetic validation**: flags items where `qty × rate ≠ total` (>1% tolerance)
- **Row key generator** for stable deduplication
- **Smart filtering** for totals, headers, contingencies

### 4. Detection Rules

```typescript
// Flag items with arithmetic mismatches
const calculated = qty * rate;
const diff = Math.abs(stated_total - calculated);
const tolerance = Math.max(calculated * 0.01, 0.01);

if (diff > tolerance) {
  // Likely a subtotal, not a line item
  EXCLUDE();
}
```

## Implementation Files

### Created:
- `src/lib/parsing/rowFilter.ts` - Client-side filtering & validation
- `src/lib/parsing/intelligentChunker.ts` - Token-based chunking
- `src/lib/parsing/resilientParser.ts` - Retry logic & parallel processing
- `src/lib/parsing/jsonValidator.ts` - JSON validation & repair

### Updated:
- `supabase/functions/parse_quote_llm_fallback/index.ts` - Added filtering
- `supabase/functions/resume_parsing_job/index.ts` - Completion threshold

## Testing Steps

1. **Delete the bad quote**:
```sql
DELETE FROM quote_items WHERE quote_id = '802e0b2d-fb48-4b1c-b11c-c1dddba3f6d7';
DELETE FROM quotes WHERE id = '802e0b2d-fb48-4b1c-b11c-c1dddba3f6d7';
```

2. **Re-upload the Global Test 2 PDF**

3. **Expected results**:
   - No items with description containing "contingency", "allowance", "cost increase"
   - No items where `qty × rate` is wildly different from `total` (>5% off)
   - Total should be ~$2.9M instead of $3.7M

4. **Validation queries**:
```sql
-- Check for arithmetic mismatches (potential subtotals)
SELECT description, quantity, unit_price, total_price,
       (quantity::numeric * unit_price::numeric) as calculated,
       total_price - (quantity::numeric * unit_price::numeric) as diff
FROM quote_items
WHERE quote_id = 'NEW_QUOTE_ID'
  AND ABS(total_price - (quantity::numeric * unit_price::numeric)) >
      GREATEST(quantity::numeric * unit_price::numeric * 0.05, 1)
ORDER BY ABS(total_price - (quantity::numeric * unit_price::numeric)) DESC;

-- Check for excluded patterns
SELECT description, total_price
FROM quote_items
WHERE quote_id = 'NEW_QUOTE_ID'
  AND (
    LOWER(description) ~ '\\y(subtotal|total|summary|contingency|allowance|escalation)\\y'
  );
```

## Deployment Checklist

- [x] Update LLM prompt to exclude totals/contingencies
- [x] Add post-processing filters to Edge Function
- [x] Create client-side validation utilities
- [x] Build project successfully
- [ ] Deploy updated `parse_quote_llm_fallback` Edge Function
- [ ] Test with Global Test 2 quote
- [ ] Verify totals match

## Key Learnings

### Signs of Subtotals vs Real Line Items:

**Subtotals (EXCLUDE):**
- Description uses plural or collective nouns ("COLLAR" for all collars)
- Qty is a small decimal (1.0, 5.2, 5.4) - likely page/section reference
- Rate seems averaged or representative
- Total is very large relative to qty × rate
- **Arithmetic mismatch > 5%**

**Real Line Items (INCLUDE):**
- Specific description ("Fire collar 50mm, wall penetration")
- Realistic qty for the item (e.g., 432 collars, not 5.4)
- Rate matches the item type
- **Arithmetic matches**: qty × rate ≈ total (within 1%)

### GST Handling:
- NZ quotes typically show: Subtotal excl GST + GST (15%) + Total incl GST
- When reconciling, compare **like with like** (excl vs excl, or incl vs incl)
- Look for labels: "Total excl GST", "GST 15%", "Total incl GST"

### Contingency Treatment:
- Lines with "contingency", "allowance", "cost increase", "escalation" are **optional**
- They're shown for transparency but typically **not included in base contract total**
- Should be flagged separately, not added to main total

## Next Steps

1. Deploy the updated Edge Function
2. Re-parse Global Test 2 quote
3. Verify the total drops to ~$2.9M
4. If still off, investigate remaining items with arithmetic mismatches
5. Consider adding a "Warnings" panel in UI showing:
   - Items with arithmetic mismatches
   - Items that were filtered out (for transparency)
   - Suggested manual review items
