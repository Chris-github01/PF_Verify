# Trade Analysis LLM Matcher

## Overview

The Trade Analysis Report uses **AI-powered matching as the PRIMARY method** to intelligently match items between suppliers, with pattern-based matching as a fallback only when needed.

## How It Works

### Matching Strategy

When comparing quotes from two suppliers:

1. **LLM Matching** (Primary - Runs First)
   - Uses GPT-4o for intelligent semantic matching
   - Understands construction terminology and variations
   - Matches by scope and intent, not exact wording
   - Required: Both quotes have 5+ items
   - **Always attempted first**

2. **Pattern-Based Fallback** (Only if LLM unavailable)
   - Token similarity
   - Levenshtein distance
   - Service/size/unit matching
   - Used when LLM fails or API unavailable
   - Used for small lists (<5 items)

### When Each Method Runs

**LLM runs first when**:
- Both suppliers have ≥5 items ✓
- OpenAI API is available ✓
- **This is the default for all comparisons**

**Pattern matching only runs if**:
- LLM fails with error
- LLM returns 0 matches
- Either supplier has <5 items

**Example Flow**:
- Supplier A: 68 items
- Supplier B: 68 items
- **→ LLM runs first (primary)**
- LLM matcher: 45 matches (66%)
- ✓ Done! Returns LLM results
- Pattern matching never called

## Edge Function

**Function Name**: `match_trade_items_llm`

**Model**: GPT-4o (for best semantic understanding)

**Input**:
```json
{
  "supplier1Items": [
    {
      "id": "item-1",
      "description": "Cable Tray 300mm through GIB wall",
      "section": "Cable Tray / Walls",
      "size": "300mm",
      "service": "Cable Tray",
      "qty": 12,
      "unit": "Nr",
      "rate": 232.00,
      "total": 2784.00
    }
  ],
  "supplier2Items": [...],
  "supplier1Name": "Global Fire",
  "supplier2Name": "Passive Fire NZ"
}
```

**Output**:
```json
{
  "success": true,
  "matches": [
    {
      "supplier1Id": "item-1",
      "supplier2Id": "item-45",
      "confidence": 0.95,
      "reason": "Both describe 300mm cable tray through GIB wall"
    }
  ],
  "unmatched1": ["item-2", "item-3"],
  "unmatched2": ["item-46"],
  "stats": {
    "total1": 68,
    "total2": 68,
    "matched": 45,
    "unmatched1": 23,
    "unmatched2": 23
  },
  "confidence": 0.88,
  "tokensUsed": 15234
}
```

## Matching Logic

The LLM is instructed to match items based on:

### Match Criteria
1. **Service Type**: Cable tray, metal pipe, PVC pipe, duct, etc.
2. **Dimensions/Size**: 300mm, DN100, 450x450, etc.
3. **Fire Rating**: 90/90/90, 120min, FRL, etc.
4. **Substrate**: GIB wall, concrete, timber, etc.
5. **Location**: Floor, wall, ceiling penetrations

### Ignore Differences
- Brand names (Ryanfire vs Hilti vs Allproof)
- Product codes (FF102/50 vs CFS-S-STP)
- Minor wording variations
- Quantities and rates (we match scope, not pricing)

### Match Rules
- Each item from Supplier 1 matches AT MOST ONE item from Supplier 2
- Only match if confidence >= 0.7 (70%)
- Returns reason for each match

## Examples

### Good Matches
```
"Cable Tray 300mm through GIB wall"
↔ "300mm cable tray penetration, GIB substrate"
(Same scope, different wording)

"Metal pipe DN100 90/90 FRR"
↔ "100mm steel pipe with 90min fire rating"
(Same pipe size and fire rating)

"Duct seal 450x450mm"
↔ "Square duct 450x450 firestopping"
(Same duct size)
```

### Non-Matches
```
"Cable tray 300mm"
≠ "Cable tray 150mm"
(Different sizes)

"Metal pipe"
≠ "PVC pipe"
(Different materials)

"Penetration sealing"
≠ "Fire damper"
(Different work types)
```

## Cost Analysis

**GPT-4o Pricing** (Nov 2024):
- Input: $2.50 per 1M tokens
- Output: $10.00 per 1M tokens

**Typical Trade Analysis**:
- 68 items × 2 suppliers = 136 items
- Input: ~12,000 tokens
- Output: ~3,000 tokens
- **Cost per comparison: ~$0.06**

**When Used**:
- **PRIMARY**: All comparisons with 5+ items per supplier
- Most comparisons use LLM matching
- Typical project (5 suppliers, 10 comparisons): ~$0.60

## Console Logging

Watch for these logs in browser console:

### LLM Primary (Normal Flow)
```
[FuzzyMatcher] Starting match process
  supplier1Count: 68
  supplier2Count: 68
[FuzzyMatcher] Using LLM matcher as primary method...
[LLM Matcher] Calling edge function...
[LLM Matcher] Success: 45 matches, confidence: 0.88, tokens: 15234
[LLM Matcher] Matched: Both describe 300mm cable tray through GIB wall
[LLM Matcher] Matched: Both describe 100mm metal pipe penetration
...
[FuzzyMatcher] ✓ LLM matched 45 items (66.2%)
```

### Pattern Fallback (LLM Failed)
```
[FuzzyMatcher] LLM matching failed, falling back to pattern matching: API error
[FuzzyMatcher] Using pattern matching...
[FuzzyMatcher] Pattern match results
  matchedCount: 32
  unmatchedCount: 36
  matchRate: 47.1%
```

### Small Lists (Pattern Only)
```
[FuzzyMatcher] Too few items for LLM (need 5+ each), using pattern matching
[FuzzyMatcher] Using pattern matching...
```

## Benefits

1. **Primary Intelligence**: AI understands scope, not just text patterns
2. **Handles Variation**: Different suppliers use different terminology seamlessly
3. **Semantic Understanding**: Knows "300mm" = "DN300" = "300 diameter"
4. **Context Aware**: Considers section, service type, substrate together
5. **Quality Control**: Only matches with 70%+ confidence
6. **Transparent**: Logs reason for each match
7. **Better Results**: Typically achieves 60-90% match rates vs 0-30% with patterns

## Configuration

No configuration needed - works automatically:
- OpenAI API key is configured in Supabase
- LLM runs first for all comparisons (5+ items)
- Pattern fallback if LLM fails
- Min items for LLM: 5 per supplier
- Confidence threshold: 0.7 (70%)

## Edge Cases

### When Pattern Matching Runs Instead
- Very short item lists (<5 items each)
- LLM API unavailable or errors
- OpenAI API key not configured

### When Both Methods Struggle
- Completely different scopes (one quotes HVAC, other quotes electrical)
- Missing critical info (no sizes, services, or descriptions)
- Inconsistent or incomplete data

## Future Enhancements

Potential improvements:
1. **Learning**: Store corrections to improve prompts
2. **Caching**: Cache similar comparisons to save cost
3. **Confidence Tuning**: Adjust 0.7 threshold based on results
4. **Batch Processing**: Match multiple supplier pairs in one call
5. **Embeddings**: Pre-screen with vector similarity before LLM
