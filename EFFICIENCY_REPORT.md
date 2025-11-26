# Efficiency Improvements Report

This report identifies several areas in the codebase where performance could be improved through algorithmic optimizations.

## 1. O(n*m) Lookup in hybridCompareAgainstModel.ts (HIGH IMPACT)

**File:** `src/lib/comparison/hybridCompareAgainstModel.ts`  
**Line:** 50  
**Current Code:**
```typescript
for (const line of normalisedLines) {
  const mapping = mappings.find(m => m.quoteItemId === line.quoteItemId);
  // ...
}
```

**Issue:** Using `Array.find()` inside a loop creates O(n*m) time complexity where n is the number of lines and m is the number of mappings. For large datasets with thousands of items, this becomes a significant bottleneck.

**Solution:** Pre-build a Map for O(1) lookups, reducing overall complexity to O(n+m).

```typescript
const mappingsByQuoteItemId = new Map(mappings.map(m => [m.quoteItemId, m]));
for (const line of normalisedLines) {
  const mapping = mappingsByQuoteItemId.get(line.quoteItemId);
  // ...
}
```

**Estimated Impact:** For 1000 lines and 1000 mappings, this reduces from ~1,000,000 comparisons to ~2,000 operations.

---

## 2. Inefficient Common Sections Calculation in computeComparison.ts (MEDIUM IMPACT)

**File:** `src/lib/comparison/computeComparison.ts`  
**Lines:** 74-75  
**Current Code:**
```typescript
const commonSections = Array.from(new Set(filtLeft.map(x => String(x.section ?? ""))
  .filter(s => filtRight.some(y => String(y.section ?? "") === s))));
```

**Issue:** The `.some()` call inside `.filter()` creates O(n*m) complexity for finding common sections.

**Solution:** Use a Set for the right-side sections first:
```typescript
const rightSections = new Set(filtRight.map(y => String(y.section ?? "")));
const commonSections = Array.from(new Set(filtLeft.map(x => String(x.section ?? ""))
  .filter(s => rightSections.has(s))));
```

---

## 3. Levenshtein Distance Memory Usage in fuzzyMatcher.ts (MEDIUM IMPACT)

**File:** `src/lib/tradeAnalysis/fuzzyMatcher.ts`  
**Lines:** 333-359  
**Current Code:**
```typescript
const dp: number[][] = Array(m + 1)
  .fill(0)
  .map(() => Array(n + 1).fill(0));
```

**Issue:** The current implementation uses O(m*n) space for the full DP matrix. For strings of length 200, this allocates 40,000+ array elements.

**Solution:** Use space-optimized version with only two rows (O(min(m,n)) space):
```typescript
let prev = Array(n + 1).fill(0).map((_, i) => i);
let curr = Array(n + 1).fill(0);
for (let i = 1; i <= m; i++) {
  curr[0] = i;
  for (let j = 1; j <= n; j++) {
    const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
    curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
  }
  [prev, curr] = [curr, prev];
}
return prev[n];
```

---

## 4. Repeated Item Filtering in hybridAnalyzer.ts (MEDIUM IMPACT)

**File:** `src/lib/quoteIntelligence/hybridAnalyzer.ts`  
**Multiple Functions**  
**Current Pattern:**
```typescript
function detectRedFlags(quotes: QuoteData[], items: QuoteItemData[]): RedFlag[] {
  for (const quote of quotes) {
    const quoteItems = items.filter(i => i.quote_id === quote.id);
    // ...
  }
}

function generateSupplierInsights(quotes: QuoteData[], items: QuoteItemData[]): SupplierInsight[] {
  for (const quote of quotes) {
    const quoteItems = items.filter(i => i.quote_id === quote.id);
    // ...
  }
}
```

**Issue:** Multiple functions independently filter items by quote_id, resulting in O(n*m) operations repeated across functions.

**Solution:** Pre-group items by quote_id once and pass the grouped data:
```typescript
const itemsByQuoteId = new Map<string, QuoteItemData[]>();
for (const item of items) {
  if (!itemsByQuoteId.has(item.quote_id)) {
    itemsByQuoteId.set(item.quote_id, []);
  }
  itemsByQuoteId.get(item.quote_id)!.push(item);
}
// Then use itemsByQuoteId.get(quote.id) || [] in each function
```

---

## 5. Sequential Database Queries in ScopeMatrix.tsx (LOW-MEDIUM IMPACT)

**File:** `src/pages/ScopeMatrix.tsx`  
**Lines:** 116-165  
**Current Code:**
```typescript
const quotesWithStatus = await Promise.all(
  quotesData.map(async (quote) => {
    const { data: jobData } = await supabase.from('parsing_jobs')...
    const { count: totalCount } = await supabase.from('quote_items')...
    const { count: mappedCount } = await supabase.from('quote_items')...
    // ...
  })
);
```

**Issue:** For each quote, three separate database queries are made. While `Promise.all` parallelizes across quotes, the queries within each quote are sequential.

**Solution:** Batch queries where possible or use database joins/aggregations to reduce round trips.

---

## 6. Repeated Regex Compilation in attributeExtractor.ts (LOW IMPACT)

**File:** `src/lib/normaliser/attributeExtractor.ts`  
**Multiple Functions**  

**Issue:** Regex patterns are defined inside functions and recompiled on every call.

**Solution:** Move regex patterns to module-level constants so they're compiled once:
```typescript
const SIZE_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*(?:mm|millimeter|millimetre)/gi,
  // ...
];
```

---

## Summary

| Issue | File | Complexity | Impact |
|-------|------|------------|--------|
| Array.find in loop | hybridCompareAgainstModel.ts | O(n*m) -> O(n) | High |
| Common sections filter | computeComparison.ts | O(n*m) -> O(n) | Medium |
| Levenshtein space | fuzzyMatcher.ts | O(m*n) -> O(n) space | Medium |
| Repeated filtering | hybridAnalyzer.ts | O(n*m*k) -> O(n*m) | Medium |
| Sequential DB queries | ScopeMatrix.tsx | Network latency | Low-Medium |
| Regex recompilation | attributeExtractor.ts | Minor CPU | Low |

## Recommendation

The highest impact fix is **Issue #1** - the O(n*m) lookup in `hybridCompareAgainstModel.ts`. This function is called during the core comparison workflow and processes all quote items. Converting to a Map-based lookup will provide immediate performance benefits for projects with many line items.
