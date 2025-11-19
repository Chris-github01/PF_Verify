# LLM Primary Parser

## What It Does

The system uses OpenAI GPT-4o-mini as the **PRIMARY parser** for all PDF quotes, with pattern-based parsers as reliable fallbacks.

## How It Works

### Parsing Strategy

The parser tries methods in this order:

1. **🤖 LLM Parser (PRIMARY)** - AI-powered parsing using GPT-4o-mini
2. **OptimalFire Parser** - Pattern matching fallback for Optimal Fire quotes
3. **PassiveFire Parser** - Pattern matching fallback for Passive Fire NZ quotes
4. **GlobalFire Parser** - Pattern matching fallback for Global Fire quotes
5. **SimpleTable Parser** - Generic table-based fallback parser
6. **Columnar Extraction** - Last resort coordinate-based extraction

### LLM Parser Features

- **Intelligent Extraction**: Understands construction terminology and quote formats
- **Schema-Enforced**: Returns structured JSON matching our data model
- **Confidence Scoring**: Reports how confident the AI is in its extraction
- **Warning System**: Flags potential issues (mismatched totals, missing data)
- **Cost Efficient**: Uses GPT-4o-mini (cheap and fast)

## Edge Function Details

**Function Name**: `parse_quote_llm_fallback`

**Location**: `/supabase/functions/parse_quote_llm_fallback/index.ts`

**Request Format**:
```json
{
  "text": "Full PDF text content...",
  "supplierName": "Passive Fire NZ",
  "documentType": "quote"
}
```

**Response Format**:
```json
{
  "success": true,
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
    "date": "08/03/2022",
    "reference": "Quote-12345"
  },
  "confidence": 0.95,
  "warnings": ["Items total matches subtotal"],
  "tokensUsed": 8456
}
```

## System Prompt

The LLM is instructed as:

> You are an expert construction quantity surveyor specializing in parsing quotes and BOQs for passive fire protection work in New Zealand.

It understands:
- NZ construction units (Nr, EA, LM, M2, Sum)
- Passive fire terminology (penetrations, intumescent, fire rated)
- Quote structures (sections, line items, subtotals)
- GST calculations (15% in NZ)

## Cost Estimates

**GPT-4o-mini Pricing** (as of Nov 2024):
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

**Typical Quote Parsing**:
- Input: ~20,000 tokens (5-page PDF)
- Output: ~2,000 tokens (JSON response)
- **Cost per parse: ~$0.0042 (less than half a cent)**

For 1,000 quotes: ~$4.20

## When LLM Fallback Triggers

The LLM parser is only called when:
1. All 4 pattern-based parsers return 0 items
2. PDF has text content (after OCR if needed)
3. OpenAI API key is configured in Supabase

## Configuration

The OpenAI API key is automatically configured in Supabase Edge Functions as `OPENAI_API_KEY`.

No manual configuration needed - it just works!

## Logging

Check browser console for:
```
[LLM Parser] Calling edge function...
[LLM Parser] Success: 23 items, confidence: 0.92
✓ LLM parser succeeded: 23 items (confidence: 0.92)
```

Check edge function logs for:
```
[LLM Fallback] Calling OpenAI with 18456 chars
[LLM Fallback] OpenAI response length: 3245
[LLM Fallback] Extracted 23 items, confidence: 0.92
```

## Benefits

1. **Higher Success Rate**: Can parse documents that pattern matchers miss
2. **Flexible**: Handles variations in quote formats
3. **Self-Improving**: As OpenAI models improve, parsing improves
4. **Validated Output**: Returns structured, validated JSON
5. **Cost Effective**: Only used when needed, costs less than $0.01 per parse

## Future Enhancements

Potential improvements:
- Cache results to avoid re-parsing same documents
- Fine-tune on NZ construction quotes for better accuracy
- Use embeddings to identify similar quote formats
- Store corrections to improve prompts over time
