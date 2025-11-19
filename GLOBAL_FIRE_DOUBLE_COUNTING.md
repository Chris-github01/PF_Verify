# Global Fire Quote Double-Counting Issue

## The Problem

Global Fire quotes show **EXACTLY DOUBLE** the true contract value because they include:
1. **Category lump sums** (the TRUE totals)
2. **Detailed line items** (that roll up into those categories)

**Example**:
- Total parsed: **$4,480,144**
- True contract value: **$2,240,072** (exactly half!)

## Quote Structure

### Tier 1: Category Lump Sums (KEEP)
These are the ACTUAL contract totals by category:

| Description | Qty | Unit | Amount |
|-------------|-----|------|--------|
| Compressive Seal | 1 | Sum | $809,497 |
| Collar | 1 | Sum | $540,242 |
| Cavity Barrier | 1 | Sum | $309,869 |
| Cable Bundle | 1 | Sum | $228,344 |
| Insulation | 1 | Sum | $121,023 |
| Door Perimeter Seal | 1 | Sum | $71,772 |
| Mastic | 1 | Sum | $46,732 |
| Fire Protection | 1 | Sum | $43,742 |
| Mechanical | 1 | Sum | $11,287 |
| GIB Patches | 1 | Sum | $10,624 |
| Cable Tray: Batt | 1 | Sum | $24,149 |
| Cable Tray: Foam | 1 | Sum | $8,527 |

**Tier 1 Total**: ~$2.2M

### Tier 2: Detailed Line Items (DELETE - duplicates!)
These break down the categories into individual items:

| Description | Qty | Unit | Amount |
|-------------|-----|------|--------|
| PVC Pipe 100mm Concrete Floor | 812 | Nr/EA | $105,057 |
| Cable Bundle 2x 13mm GIB Wall | 1726 | Nr/EA | $67,573 |
| PVC Pipe 65mm Concrete Floor | 448 | Nr/EA | $36,817 |
| PVC Pipe 40mm Concrete Floor | 432 | Nr/EA | $33,169 |
| ... (100+ more detailed items) | | | |

**Tier 2 Total**: ~$2.2M (DUPLICATES Tier 1!)

### The Doubling

**If you include both tiers**:
$2.2M (category totals) + $2.2M (detailed items) = **$4.4M WRONG!**

**Correct approach**:
Keep ONLY Tier 1 = **$2.2M ✓**

## Detection Strategy

### How to Identify Category Lump Sums (KEEP):
- **Generic category names**: "Collar", "Seal", "Insulation", "Mastic", "Fire Protection", "Mechanical"
- **Unit**: "Sum"
- **Large amounts**: Usually >$40,000
- **Quantity**: Always 1
- **Count**: Typically 10-15 categories

### How to Identify Detailed Items (DELETE):
- **Specific technical names**: "PVC Pipe 100mm Concrete Floor", "Cable Bundle Up to 40mm 2x 13mm GIB Wall"
- **Unit**: "Nr", "Nr/EA", "LM", "ea"
- **Medium amounts**: $1K - $100K each
- **Realistic quantities**: 50-2000 pieces
- **Count**: Typically 100-200 items

## Solution Logic

```typescript
// Step 1: Detect if quote has category structure
const categoryLumpSums = items.filter(item =>
  item.unit === 'Sum' &&
  item.quantity === 1 &&
  item.total > 10000 &&
  /^(collar|seal|insulation|mastic|fire protection|cavity barrier|cable bundle|mechanical|gib patches|cable tray|door perimeter)/i.test(item.description)
);

// Step 2: If 5+ category lump sums found, this is a two-tier quote
if (categoryLumpSums.length >= 5) {
  console.log('Two-tier Global Fire quote detected - keeping only category totals');

  // Keep ONLY:
  // - Category lump sums (the true totals)
  // - Small misc items <$5K (gaps, patches, single items)
  return items.filter(item =>
    categoryLumpSums.includes(item) || // Category totals
    item.total < 5000 || // Small misc items
    item.description.match(/gap|patch|box|xl collar/i) // Specific small items
  );
}

// Step 3: Otherwise, keep all items (standard quote format)
return items;
```

## Implementation

### Update parse_quote_llm_fallback
Add post-processing after LLM parse:

```typescript
// After filtering and deduplication
const categoryLumpSums = dedupedItems.filter(item =>
  item.unit === 'Sum' &&
  (item.qty === 1 || !item.qty) &&
  item.total > 10000 &&
  /^(collar|seal|insulation|mastic|fire protection|cavity barrier|cable bundle|mechanical|gib|cable tray|door)/i.test(item.description.trim())
);

if (categoryLumpSums.length >= 5) {
  console.log(`[Two-Tier Detection] Found ${categoryLumpSums.length} category lump sums - removing detailed items`);

  // Keep only category totals + small items
  const finalItems = dedupedItems.filter(item =>
    categoryLumpSums.some(cat => cat.description === item.description) ||
    item.total < 5000
  );

  console.log(`[Two-Tier Filter] Reduced from ${dedupedItems.length} to ${finalItems.length} items`);
  return finalItems;
}

return dedupedItems;
```

## Expected Results After Fix

### Before (Wrong):
- **Items**: 267
- **Total**: $4,480,144
- **Structure**: Category lump sums + detailed items (double-counted)

### After (Correct):
- **Items**: ~100
- **Total**: ~$2,240,072
- **Structure**: Category lump sums + small misc items only

## How to Test

1. **Re-upload Global Test 3 PDF**
2. **Expected console logs**:
   ```
   [Two-Tier Detection] Found 12 category lump sums - removing detailed items
   [Two-Tier Filter] Reduced from 267 to 98 items
   ```
3. **Verify results**:
   - Item count: 90-110 items
   - Total: $2.2M - $2.4M (approximately half of original)
   - Items are mostly category lump sums + small individual items
   - NO detailed pipe/cable items (those are included in lump sums)

## Key Learnings

1. **Global Fire uses a two-tier structure** - category totals + detailed breakdowns
2. **Both tiers show the SAME work** - including both = exact double
3. **Category lump sums are the source of truth** - keep those, delete details
4. **Detection is reliable** - 5+ large "Sum" items with generic names = two-tier quote
5. **This is by design** - the detailed items are for reference/transparency, not for summing

## Files to Update

- [ ] `supabase/functions/parse_quote_llm_fallback/index.ts` - Add two-tier detection
- [ ] `supabase/functions/process_parsing_job_v2/index.ts` - Add two-tier detection
- [ ] `src/lib/parsing/rowFilter.ts` - Add `detectTwoTierStructure()` function

## SQL Cleanup for Existing Quote

```sql
-- For Global Test 3, manually clean up
DELETE FROM quote_items WHERE quote_id = '45e4afa7-4688-48c1-aa93-0d8c1b87881a';
DELETE FROM quotes WHERE id = '45e4afa7-4688-48c1-aa93-0d8c1b87881a';

-- Then re-upload with updated parser
```
