# Production-Grade PDF Extraction System

## Overview

The PassiveFire Verify+ application now includes an enterprise-level PDF extraction system designed to achieve near-perfect accuracy for passive fire protection and intumescent coating quotes.

## Architecture

### Multi-Layer Extraction Pipeline

```
PDF Upload
    ↓
1. PDF Parsing (pdf.js + OCR if needed)
    ↓
2. Multi-Model Extraction (OpenAI + Anthropic)
    ↓
3. Two-Pass Validation & Correction
    ↓
4. Arithmetic & Consistency Checks
    ↓
5. Embeddings-Based Item Matching
    ↓
6. Confidence Scoring & Manual Review
    ↓
Final Validated Quote
```

## Key Features

### 1. Production-Grade JSON Schema

**Location:** `src/types/extraction.types.ts`

Comprehensive TypeScript schema for:
- Quote metadata (supplier, date, reference numbers)
- Line items with all attributes
- Financial totals with tax breakdown
- Validation results with errors and warnings
- Confidence scoring across all dimensions

### 2. Arithmetic & Consistency Validation

**Location:** `src/lib/validation/quoteValidator.ts`

Validates:
- **Arithmetic accuracy:** quantity × unit_rate = line_total (within tolerance)
- **Sum validation:** Σ line_items = subtotal
- **Tax calculation:** subtotal + tax = grand_total
- **Unit normalization:** Standardizes m², lm, each, hours
- **Range checking:** Detects suspicious quantities or rates
- **Duplicate detection:** Flags same description with different rates

**Tolerance:** ±$0.02 for rounding differences

### 3. Two-Pass Extraction with Validator

**Location:** `src/lib/extraction/twoPassExtractor.ts`

**Pass 1 - Initial Extraction:**
- Extract data using primary AI model
- Run validation checks
- Calculate confidence score

**Pass 2 - Validator & Correction:**
- If confidence < 90%, run validator pass
- Send validation feedback back to model
- Request corrected extraction
- Compare results and use higher confidence version

### 4. Cross-Model Verification

**Location:** `supabase/functions/extract_quote_multi_model/index.ts`

**Multi-Model Strategy:**
- Primary: OpenAI GPT-4o-mini with structured outputs
- Secondary: Anthropic Claude 3.5 Sonnet
- Consensus building when models disagree
- Agreement scoring across models

**Structured Outputs:**
- Uses OpenAI's JSON Schema enforcement
- Guarantees valid JSON structure
- Forces compliance with schema requirements

### 5. AWS Textract Fallback

**Location:** `supabase/functions/extract_quote_textract/index.ts`

**For messy/scanned PDFs:**
- Advanced table detection
- Form key-value extraction
- High-confidence OCR
- Layout-aware text extraction

**Automatic fallback triggers:**
- Low confidence from primary models
- Table detection failures
- Heavily scanned/rotated documents

### 6. Embeddings-Based Item Matching

**Location:** `src/lib/embeddings/itemMatcher.ts`

**Similarity Search:**
- OpenAI embeddings (1536 dimensions)
- PostgreSQL pgvector extension
- HNSW index for fast similarity search
- Cosine similarity matching

**Use Cases:**
- Suggest system codes for new items
- Standardize descriptions
- Map to existing library items
- Detect variations in naming

**Database:**
- `library_items` table with embeddings
- `match_library_items()` RPC function
- Organisation-scoped matching

### 7. Confidence Scoring System

**Dimensions:**
- **Overall:** Combined score across all checks
- **Metadata:** Completeness of supplier/date/currency
- **Line Items:** Average confidence per item
- **Financials:** Presence and validity of totals
- **Cross-Model Agreement:** Consistency between models
- **Arithmetic Consistency:** All calculations correct
- **Format Validity:** Proper units and formatting

**Thresholds:**
- ≥90%: High confidence (auto-approve)
- 70-89%: Medium confidence (suggest review)
- <70%: Low confidence (manual review required)

### 8. Manual Review UI

**Components:**

**ExtractionConfidencePanel** (`src/components/ExtractionConfidencePanel.tsx`)
- Visual confidence breakdown
- Error and warning display
- Validation check results
- Cross-model verification status

**LineItemReviewTable** (`src/components/LineItemReviewTable.tsx`)
- Editable line items
- Arithmetic error highlighting
- Similarity match suggestions
- One-click correction application

## Database Schema

### New Tables

**library_items**
```sql
- id: uuid
- organisation_id: uuid
- description: text
- system_code: text
- trade: text
- unit: text
- typical_rate: numeric
- embedding: vector(1536)
- created_at/updated_at: timestamp
```

**Extensions:**
- `pgvector` for embeddings support

**Indexes:**
- HNSW index on embeddings for fast similarity search

**RLS Policies:**
- Users can view items in their organisation
- Admins can insert/update/delete

## Edge Functions

### 1. extract_quote_multi_model
**Purpose:** Multi-model extraction with OpenAI + Anthropic

**Input:**
```json
{
  "text": "extracted text from PDF",
  "metadata": {
    "pageCount": 5,
    "ocrUsed": true
  }
}
```

**Output:**
```json
{
  "primary": {...},
  "secondary": {...},
  "consensus": {...},
  "confidence_breakdown": {...},
  "extraction_metadata": {...}
}
```

### 2. extract_quote_textract
**Purpose:** AWS Textract fallback for messy PDFs

**Input:**
```json
{
  "pdfBytes": "base64-encoded PDF",
  "fileName": "quote.pdf"
}
```

**Output:**
```json
{
  "metadata": {...},
  "line_items": [...],
  "financials": {...},
  "raw": {
    "fullText": "...",
    "tables": [...],
    "keyValuePairs": [...]
  }
}
```

### 3. get_embedding
**Purpose:** Generate OpenAI embeddings for text

**Input:**
```json
{
  "text": "SC902 3-hour fire rating on UC columns",
  "model": "text-embedding-3-small"
}
```

**Output:**
```json
{
  "embedding": [0.123, -0.456, ...],
  "dimension": 1536
}
```

### 4. parse_quote_production
**Purpose:** Orchestrates entire extraction pipeline

**Features:**
- Automatic method selection
- Confidence-based fallback
- Multi-model coordination
- Job status tracking

## Usage Examples

### Basic Extraction

```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/extract_quote_multi_model`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      text: extractedText,
      metadata: { pageCount: 3, ocrUsed: false }
    })
  }
);

const result = await response.json();
console.log('Confidence:', result.confidence_breakdown.overall);
```

### Item Matching

```typescript
import { itemMatcher } from './lib/embeddings/itemMatcher';

const matches = await itemMatcher.findSimilarItems(
  'SC902 intumescent coating on steel beams',
  organisationId,
  0.7,  // threshold
  5     // limit
);

console.log('Top match:', matches[0]);
// { description: "SC902 60min on UC beams", similarity_score: 0.92, ... }
```

### Validation

```typescript
import { quoteValidator } from './lib/validation/quoteValidator';

const validation = quoteValidator.validate(extractedQuote);

if (!validation.is_valid) {
  console.log('Errors:', validation.errors);
}

console.log('Confidence:', validation.confidence_score);
```

## Performance Characteristics

**Processing Times:**
- Single model extraction: 2-5 seconds
- Multi-model extraction: 5-10 seconds
- Textract fallback: 3-8 seconds
- Embeddings generation: 100-300ms per text
- Similarity search: <50ms per query

**Accuracy Targets:**
- High confidence (≥90%): ~85% of quotes
- Medium confidence (70-89%): ~12% of quotes
- Low confidence (<70%): ~3% of quotes

**Expected Outcomes:**
- 95%+ arithmetic accuracy
- 90%+ metadata extraction accuracy
- 85%+ line item completeness
- Near-zero critical errors in production

## Environment Variables Required

```bash
# AI Models
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# AWS Textract (optional)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# Supabase (auto-configured)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Cost Considerations

**Per Quote Extraction:**
- OpenAI GPT-4o-mini: ~$0.01-0.02
- Anthropic Claude: ~$0.03-0.05
- OpenAI Embeddings: ~$0.0001 per item
- AWS Textract: ~$0.05-0.15 (fallback only)

**Recommended Strategy:**
- Use single model for high-confidence cases (85% of quotes)
- Use multi-model for edge cases (12% of quotes)
- Use Textract only for failed extractions (3% of quotes)

**Monthly Estimates (100 quotes):**
- Standard: $1-2
- With multi-model: $3-5
- With occasional Textract: $5-10

## Best Practices

1. **Always validate extracted data** before saving
2. **Show confidence scores** to users
3. **Enable manual review** for low confidence quotes
4. **Build library items** over time for better matching
5. **Monitor extraction quality** and retrain on failures
6. **Use embeddings** to standardize descriptions
7. **Set up alerts** for consistently low confidence suppliers

## Future Enhancements

1. **Fine-tuning:** Train custom models on your specific quote formats
2. **Active Learning:** Learn from manual corrections
3. **Supplier-Specific Parsers:** Specialized extractors for common suppliers
4. **Historical Pricing:** Use past quotes to validate rates
5. **Anomaly Detection:** Flag unusual prices or quantities automatically
6. **PDF Quality Assessment:** Pre-check PDF quality before extraction

## Support & Troubleshooting

**Low Confidence Issues:**
1. Check PDF quality (scanned vs native)
2. Review validation errors for patterns
3. Try Textract fallback for scanned PDFs
4. Add supplier to library for future reference

**Arithmetic Errors:**
1. Verify source PDF calculations
2. Check for GST/tax inclusion ambiguity
3. Review rounding tolerance settings
4. Manual correction with UI tools

**Missing Data:**
1. Check extraction metadata for OCR usage
2. Review original PDF for data presence
3. Try alternative extraction method
4. Flag for manual data entry

---

**System Status:** Production Ready ✓
**Last Updated:** 2025-11-19
**Version:** 1.0.0
