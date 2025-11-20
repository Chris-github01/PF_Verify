# Multi-Parser Ensemble Validation System

## Overview

The ensemble parsing system runs PDFs through multiple extraction engines simultaneously and intelligently combines their results to achieve higher accuracy and confidence than any single parser alone.

## Architecture

### Three-Tier Parser Strategy

1. **External Python Extractor** (pdfplumber + PyMuPDF)
   - Table-based extraction optimized for structured documents
   - Confidence: ~85%
   - Best for: Well-formatted quotes with clear table structures

2. **Multi-Model AI** (GPT-4o + Claude 3.5 Sonnet)
   - Dual AI model extraction with consensus building
   - Confidence: ~80-90%
   - Best for: Complex documents with narrative elements

3. **Production Parser** (Regex + Ontology)
   - Pattern-based extraction with domain-specific rules
   - Confidence: ~75%
   - Best for: Standardized quote formats from known suppliers

## How It Works

### 1. Parallel Extraction

All three parsers run simultaneously on the uploaded PDF:

```typescript
const results = await Promise.all([
  callExternalExtractor(file, apiKey),
  callMultiModelExtractor(text, metadata),
  callProductionParser(text, supplierName)
]);
```

### 2. Confidence Scoring

Each parser returns:
- **Line items** extracted from the document
- **Metadata** (supplier name, quote date, etc.)
- **Financials** (subtotal, tax, grand total)
- **Confidence score** (0-1) based on validation checks
- **Extraction time** for performance tracking

### 3. Consensus Building

The system builds consensus by:
- **Matching items** across parsers using fuzzy matching
- **Averaging values** when multiple parsers agree
- **Preferring high-confidence** sources for disagreements
- **Flagging outliers** for manual review

### 4. Best Result Selection

Selection criteria:
- 70% weight on confidence score
- 30% weight on item count
- Automatic fallback if primary parser fails

## Confidence Breakdown

### Overall Confidence Components

1. **Parser Success Rate**: How many parsers succeeded
2. **Cross-Model Agreement**: % of items agreed upon by multiple parsers
3. **Arithmetic Consistency**: Do line items sum to subtotal?
4. **Format Validity**: Are required fields present?
5. **Validation Checks**: Financial arithmetic, data types, etc.

### Confidence Levels

- **90-100%**: HIGH_CONFIDENCE_MULTI_PARSER
  - 2+ parsers succeeded
  - High cross-model agreement
  - All validation checks passed
  - Action: Auto-approve for import

- **70-89%**: MODERATE_CONFIDENCE_SINGLE_PARSER
  - 1 parser succeeded with good confidence
  - Some validation warnings
  - Action: Quick review recommended

- **<70%**: LOW_CONFIDENCE_MANUAL_REVIEW
  - No parsers succeeded or very low confidence
  - Multiple validation errors
  - Action: Manual review required

## Database Schema

### `parsing_ensemble_runs`

Tracks each multi-parser extraction attempt:

```sql
CREATE TABLE parsing_ensemble_runs (
  id uuid PRIMARY KEY,
  quote_id uuid REFERENCES quotes(id),
  file_name text,
  parsers_attempted integer,
  parsers_succeeded integer,
  best_parser text,
  confidence_score numeric(5,4),
  cross_model_agreement numeric(5,4),
  recommendation text,
  extraction_time_ms integer,
  results_json jsonb,  -- All parser results
  consensus_items_json jsonb,  -- Merged items
  metadata jsonb,
  created_at timestamptz
);
```

### `parser_performance_metrics`

Aggregate performance metrics per parser:

```sql
CREATE TABLE parser_performance_metrics (
  parser_name text UNIQUE,
  success_rate numeric(5,4),
  avg_confidence numeric(5,4),
  avg_extraction_time_ms integer,
  total_runs integer,
  successful_runs integer,
  failed_runs integer,
  last_updated timestamptz
);
```

Auto-updates via trigger after each ensemble run.

## Usage

### Backend: Edge Function

```typescript
// POST /functions/v1/parse_quote_ensemble
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('projectId', projectId);
formData.append('supplierName', supplierName);

const response = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}` },
  body: formData
});

const result = await response.json();
// Returns: EnsembleResult with all parser outputs
```

### Frontend: React Component

```tsx
import EnsembleParsingPanel from '@/components/EnsembleParsingPanel';

<EnsembleParsingPanel quoteId={quote.id} />
```

Displays:
- Parser success/failure status
- Individual confidence scores
- Cross-model agreement percentage
- Extraction timing data
- Best parser recommendation

## Benefits Over Single-Parser Approach

1. **Higher Accuracy**: Multiple parsers catch different aspects
2. **Better Coverage**: If one parser fails, others may succeed
3. **Error Detection**: Disagreements flag potential issues
4. **Confidence Metrics**: Quantifiable trust in extraction
5. **Continuous Learning**: Performance metrics improve over time

## Performance Metrics Tracking

The system automatically tracks:
- Success rate per parser type
- Average confidence scores
- Extraction timing
- Most reliable parser for each document type

Query current metrics:

```sql
SELECT
  parser_name,
  success_rate,
  avg_confidence,
  total_runs
FROM parser_performance_metrics
ORDER BY success_rate DESC;
```

## Future Enhancements

### Phase 1 (Current)
- [x] Multi-parser parallel extraction
- [x] Confidence scoring
- [x] Consensus building
- [x] Performance tracking

### Phase 2 (Planned)
- [ ] OCR fallback for scanned PDFs
- [ ] AWS Textract integration
- [ ] Google Document AI integration
- [ ] Supplier-specific parser selection based on historical performance

### Phase 3 (Future)
- [ ] Active learning: retrain parsers based on user corrections
- [ ] Custom parser plugins for specific quote formats
- [ ] Real-time confidence updates as users review items
- [ ] A/B testing different parser configurations

## API Reference

### Edge Functions

#### `parse_quote_ensemble`
Runs multi-parser extraction with ensemble validation.

**Input**: FormData with `file`, `projectId`, `supplierName`

**Output**: EnsembleResult
```typescript
{
  best_result: ParserResult,
  all_results: ParserResult[],
  consensus_items: LineItem[],
  confidence_breakdown: {
    overall: number,
    parsers_succeeded: number,
    parsers_attempted: number,
    cross_model_agreement: number,
    best_parser: string,
    best_parser_confidence: number
  },
  recommendation: string,
  extraction_metadata: object
}
```

#### `extract_quote_multi_model`
Existing function - uses GPT-4 + Claude ensemble.

**Input**: `{ text: string, metadata: object }`

**Output**: Multi-model extraction result with consensus

## Testing

### Manual Testing

1. Upload a PDF quote
2. Check ensemble panel for parser results
3. Verify confidence scores are reasonable
4. Compare extracted items with PDF source
5. Check consensus items for accuracy

### Automated Testing

```bash
# Run ensemble extraction test
curl -X POST https://your-project.supabase.co/functions/v1/parse_quote_ensemble \
  -H "Authorization: Bearer $ANON_KEY" \
  -F "file=@test-quote.pdf" \
  -F "projectId=test-project-id" \
  -F "supplierName=Test Supplier"
```

## Troubleshooting

### All Parsers Failed
- Check PDF is not corrupted
- Verify API keys are configured
- Check function logs for errors
- Try OCR fallback for scanned documents

### Low Confidence Score
- Document may have unusual format
- Missing required fields (supplier name, totals)
- Arithmetic inconsistencies detected
- Manual review recommended

### Slow Extraction
- Multiple parsers run in parallel, but each takes time
- External extractor may be slow (~3-5s)
- AI models can take 2-10s depending on document size
- Consider caching for repeat extractions

## Compliance with Must-Include Features

✅ **Multi-model Extraction**: 3 parsers (external, AI, production)
✅ **Ensemble Logic**: Consensus building with confidence scores
✅ **Confidence Tracking**: Per-parser and overall confidence
✅ **Performance Metrics**: Auto-tracked in database
✅ **Best Result Selection**: Intelligent weighted scoring

This system forms the foundation for robust quote extraction and sets the stage for adding trade-specific ontology mapping, risk detection, and comparison analytics.
