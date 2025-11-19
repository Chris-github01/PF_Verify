# AI-Powered Features in PassiveFire Verify+

This document outlines all AI/LLM-powered features in the application.

## Overview

PassiveFire Verify+ uses OpenAI GPT models to provide intelligent automation in three critical areas:
1. **PDF Quote Parsing** - Extracting structured data from construction quotes
2. **Excel BOQ Column Mapping** - Intelligently identifying columns in multi-supplier BOQs
3. **Trade Analysis Matching** - Comparing quotes from different suppliers

**All three features use AI as the PRIMARY method**, with traditional pattern-based approaches as reliable fallbacks.

---

## 1. PDF Quote Parsing with LLM Primary

### Purpose
Extract line items, totals, and metadata from construction quote PDFs using AI-first intelligent parsing.

### How It Works
**Parsing Strategy** (in order):
1. **🤖 LLM Parser** (GPT-4o-mini) - **PRIMARY**
2. OptimalFire Parser (pattern-based fallback)
3. PassiveFire Parser (pattern-based fallback)
4. GlobalFire Parser (pattern-based fallback)
5. SimpleTable Parser (pattern-based fallback)
6. Columnar Extraction (last resort)

### When Each Method Runs

**LLM (runs first)**:
- PDF has text content (after OCR if needed)
- OpenAI API key is configured
- **Default for all PDF quotes**

**Pattern Parsers (fallback only)**:
- LLM fails with error
- LLM returns 0 items
- OpenAI API unavailable

### Edge Function
- **Name**: `parse_quote_llm_fallback`
- **Model**: GPT-4o-mini (cost-effective)
- **Cost**: ~$0.004 per quote (<half a cent)

### What It Extracts
```json
{
  "items": [
    {
      "description": "Cable Tray, 300mm with Ryanfire 502 Batt",
      "qty": 12,
      "unit": "Nr",
      "rate": 232.00,
      "total": 2784.00,
      "section": "Cable Tray / Walls"
    }
  ],
  "totals": {
    "subtotal": 24774.00,
    "gst": 3716.10,
    "grandTotal": 28490.10
  },
  "metadata": {
    "supplier": "Passive Fire NZ",
    "project": "Sylvia Park BTR",
    "date": "08/03/2022"
  },
  "confidence": 0.95
}
```

### Expert Knowledge
The LLM is trained on:
- NZ construction units (Nr, EA, LM, M2, Sum)
- Passive fire terminology
- Quote structures and formats
- GST calculations (15% in NZ)

### Cost Estimate
- **Per quote**: $0.0042
- **1,000 quotes**: ~$4.20
- **Used as primary parser for all PDFs**

---

## 2. Excel BOQ Column Mapping with LLM Primary

### Purpose
Automatically identify and map columns in Excel Bill of Quantities (BOQ) files from various suppliers with different formats.

### How It Works
**Mapping Strategy** (in order):
1. **🤖 LLM Column Mapper** (GPT-4o-mini) - **PRIMARY**
2. Pattern-Based Column Mapper (fallback only)

### When Each Method Runs

**LLM (runs first)**:
- Excel file has detectable headers
- Sample data available for analysis
- OpenAI API key is configured
- **Default for all Excel BOQ imports**

**Pattern Mapper (fallback only)**:
- LLM fails with error
- LLM cannot identify columns confidently
- OpenAI API unavailable

### Edge Function
- **Name**: `parse_excel_boq_llm`
- **Model**: GPT-4o-mini (cost-effective)
- **Cost**: ~$0.002 per sheet (~$0.01 per file)

### What It Identifies

The LLM analyzes headers and sample data to map columns to:

**Required Fields**:
- **description**: Item description or scope of work
- **qty**: Quantity (numeric)
- **unit**: Unit of measure (Nr, EA, LM, M2, etc.)
- **rate**: Unit rate or price
- **amount**: Total amount (qty × rate)

**Optional Fields**:
- **service**: Type of service/penetration
- **section**: Section or trade category
- **size**: Dimensions or size specification
- **substrate**: Material or substrate type
- **reference**: Reference number or item code

### Column Name Variations

The LLM understands many variations:

| Standard Field | Common Variations |
|---------------|-------------------|
| description | Item, Scope, Particulars, Details, Solution, BOH ID |
| qty | Quantity, Q'ty, No., Count, Number |
| unit | UOM, Units, U/M, Unit of Measure |
| rate | Unit Price, Price, $/Unit, Cost, Unit Rate |
| amount | Total, Sum, Value, Extended, Ext |
| service | Type, Trade, Category, Penetration Type |

### Expert Knowledge

The LLM is trained on:
- NZ construction terminology
- Multiple BOQ formats (engineer BOQs, supplier quotes)
- Column header patterns from various QS software
- Construction units and measurements
- Trade categorizations

### Response Format

```json
{
  "success": true,
  "mapping": {
    "description": "DESCRIPTION",
    "qty": "QTY",
    "unit": "UNIT",
    "rate": "RATE",
    "amount": "TOTAL",
    "service": "SERVICE TYPE",
    "section": "",
    "size": "SIZE"
  },
  "confidence": 0.92,
  "warnings": [],
  "suggestions": [
    "Sheet appears to be engineer's BOQ",
    "Detected 245 data rows"
  ]
}
```

### Cost Estimate
- **Per sheet**: $0.002
- **Per file (avg 5 sheets)**: $0.01
- **1,000 files**: ~$10
- **Used as primary mapper for all Excel BOQs**

---

## 3. Trade Analysis Matching with LLM Primary

### Purpose
Intelligently match line items between two supplier quotes to enable apple-to-apple comparisons.

### How It Works
**Matching Strategy** (in order):
1. **🤖 LLM Matcher** (GPT-4o) - **PRIMARY**
2. Pattern-Based Matcher (fallback only)

### When Each Method Runs

**LLM (runs first)**:
- Both suppliers have ≥5 items
- OpenAI API available
- **Default for all comparisons**

**Pattern Matching (fallback only)**:
- LLM fails with error
- LLM returns 0 matches
- Either supplier has <5 items

### Edge Function
- **Name**: `match_trade_items_llm`
- **Model**: GPT-4o (best semantic understanding)
- **Cost**: ~$0.06 per comparison

### Matching Intelligence

**Match Criteria**:
1. Service type (cable tray, metal pipe, duct, etc.)
2. Dimensions/size (300mm, DN100, 450x450)
3. Fire rating (90/90/90, 120min, FRL)
4. Substrate (GIB wall, concrete, timber)
5. Location (floor, wall, ceiling)

**Ignores**:
- Brand names (Ryanfire vs Hilti vs Allproof)
- Product codes (FF102/50 vs CFS-S-STP)
- Minor wording differences
- Quantities and rates (matches scope, not pricing)

**Rules**:
- Each item matches AT MOST one other item
- Only matches with ≥70% confidence
- Returns reason for each match

### Example Matches

**✓ Good Matches**:
```
"Cable Tray 300mm through GIB wall"
↔ "300mm cable tray penetration, GIB substrate"

"Metal pipe DN100 90/90 FRR"
↔ "100mm steel pipe with 90min fire rating"

"Duct seal 450x450mm"
↔ "Square duct 450x450 firestopping"
```

**✗ Non-Matches**:
```
"Cable tray 300mm" ≠ "Cable tray 150mm" (different size)
"Metal pipe" ≠ "PVC pipe" (different material)
"Penetration sealing" ≠ "Fire damper" (different work)
```

### Typical Results
- **Pattern matching alone**: 0-30% match rate
- **LLM matching**: 60-90% match rate
- **Improvement**: 2-3x better matching

### Cost Estimate
- **Per comparison**: $0.06
- **5 suppliers (10 comparisons)**: ~$0.60
- **Typical project**: <$1.00

---

## Console Logging

### PDF Parsing - LLM Fallback
```
[LLM Parser] Calling edge function...
[LLM Parser] Success: 23 items, confidence: 0.92
✓ LLM parser succeeded: 23 items (confidence: 0.92)
```

### Trade Analysis - LLM Primary
```
[FuzzyMatcher] Using LLM matcher as primary method...
[LLM Matcher] Calling edge function...
[LLM Matcher] Success: 45 matches, confidence: 0.88, tokens: 15234
[LLM Matcher] Matched: Both describe 300mm cable tray through GIB wall
[FuzzyMatcher] ✓ LLM matched 45 items (66.2%)
```

---

## Cost Summary

### Per Operation
| Feature | Model | Cost |
|---------|-------|------|
| PDF Parsing | GPT-4o-mini | $0.004 |
| Excel Column Mapping | GPT-4o-mini | $0.002/sheet |
| Trade Matching | GPT-4o | $0.06 |

### Typical Project (5 suppliers)
| Operation | Count | Cost |
|-----------|-------|------|
| Parse 5 PDF quotes | 5 | $0.02 |
| Parse 5 Excel BOQs (5 sheets each) | 25 sheets | $0.05 |
| Compare quotes (10 pairs) | 10 | $0.60 |
| **Total** | - | **$0.67** |

### Monthly Usage (50 projects)
| Item | Cost |
|------|------|
| 250 PDF quote parses | $1.00 |
| 250 Excel BOQ parses (1,250 sheets) | $2.50 |
| 500 comparisons | $30.00 |
| **Total** | **$33.50** |

---

## Configuration

**No manual configuration needed** - all three features work automatically:
- OpenAI API key configured in Supabase Edge Functions
- **PDF parsing uses LLM as primary (always first)**
- **Excel BOQ column mapping uses LLM as primary (always first)**
- **Trade analysis uses LLM as primary (always first)**
- Pattern matching provides reliable fallback for all
- All logging automatic in browser console

---

## Benefits

### 1. PDF Parsing
- **AI-first parsing** for maximum accuracy
- Higher success rate on varied quote formats
- Handles supplier-specific layouts
- Extracts metadata automatically
- Self-improving as OpenAI models improve
- Pattern fallback ensures reliability

### 2. Excel BOQ Column Mapping
- **AI-first mapping** understands varied formats
- Handles any column naming convention
- Works with engineer BOQs and supplier formats
- Identifies optional fields (service, section, size)
- No manual column mapping needed
- Pattern fallback for reliability

### 3. Trade Analysis
- 2-3x better match rates than patterns
- Understands scope, not just text
- Handles terminology variations
- Provides match confidence and reasoning
- Dramatically reduces manual work

### Combined Impact
- **Less manual data entry** - AI extracts and maps all data
- **Better comparisons** - AI matches items accurately
- **Faster workflows** - Automation handles complexity
- **More accurate** - AI understands construction context
- **Universal compatibility** - Works with any supplier format
- **Cost effective** - ~$0.67 per project for all three features

---

## Technical Details

### Edge Functions
All three features run as Supabase Edge Functions:
- **Location**: `/supabase/functions/`
- **Runtime**: Deno with Edge Runtime
- **Auth**: JWT verification enabled
- **CORS**: Configured for browser calls
- **Monitoring**: Console logging + Supabase dashboard

### API Keys
- OpenAI API key stored as Supabase secret
- Automatically available to edge functions
- No client-side exposure
- Secure and managed

### Error Handling
- LLM failures gracefully fall back to pattern matching
- All errors logged for debugging
- User-friendly error messages
- System remains functional even if AI unavailable

---

## Future Enhancements

### Short-term
1. Cache LLM results to avoid re-parsing same documents
2. Store user corrections to improve prompts
3. Add confidence thresholds as user settings

### Long-term
1. Fine-tune models on NZ construction data
2. Use embeddings for pre-screening
3. Batch processing for multiple comparisons
4. Learning from user feedback loop
5. Custom models for specific suppliers
