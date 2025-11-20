# Python PDF Parser Ensemble - Deployment Guide

## Overview

You now have a production-ready Python microservice with 5 PDF parsers (pdfplumber, PyMuPDF, OCR, AWS Textract, Google DocAI) that works with your Supabase edge functions.

## Architecture

```
PDF Upload → Supabase Edge Function → Python Microservice → Multiple Parsers
                                                            ↓
                                                    Consensus Building
                                                            ↓
                                            Store in parsing_ensemble_runs
                                                            ↓
                                                    Return to Frontend
```

## Step 1: Deploy Python Service

### Option A: Render.com (Recommended)

1. **Create Account**: Go to [render.com](https://render.com)

2. **New Web Service**: Click "New +" → "Web Service"

3. **Connect Repository**:
   - Push the `python-pdf-service` folder to your GitHub repo
   - Or upload directly from local

4. **Configure Service**:
   - **Name**: `pdf-parser-ensemble`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `python-pdf-service`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 4 --timeout 120 app:app`

5. **Environment Variables**:
   ```
   API_KEY=<generate-secure-random-key>
   PORT=5000
   ```

   Optional (for cloud parsers):
   ```
   AWS_ACCESS_KEY_ID=<your-aws-key>
   AWS_SECRET_ACCESS_KEY=<your-aws-secret>
   AWS_REGION=us-east-1
   GOOGLE_APPLICATION_CREDENTIALS=<path-to-json>
   GOOGLE_CLOUD_PROJECT_ID=<your-project-id>
   GOOGLE_CLOUD_LOCATION=us
   GOOGLE_DOCAI_PROCESSOR_ID=<processor-id>
   ```

6. **Create Service**: Click "Create Web Service"

7. **Wait for Deployment**: Takes ~5-10 minutes

8. **Copy Service URL**: e.g., `https://pdf-parser-ensemble.onrender.com`

### Option B: Railway.app

1. Create account at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select `python-pdf-service` folder
4. Add same environment variables
5. Deploy

### Option C: Heroku

```bash
cd python-pdf-service
heroku create pdf-parser-ensemble
heroku config:set API_KEY=<your-key>
git push heroku main
```

## Step 2: Configure Supabase

### Add API Key to Database

```sql
-- Run this in Supabase SQL Editor
INSERT INTO system_config (key, value, description, is_sensitive)
VALUES (
  'PYTHON_PARSER_API_KEY',
  'your-generated-api-key-here',  -- Same as API_KEY in Python service
  'API key for Python PDF parser ensemble service',
  true
);
```

### Add Service URL Environment Variable

In your Supabase project settings:

1. Go to Project Settings → Edge Functions
2. Add environment variable:
   - **Name**: `PYTHON_PARSER_SERVICE_URL`
   - **Value**: `https://your-service.onrender.com` (without trailing slash)

## Step 3: Test the Integration

### Test Python Service Directly

```bash
# Test health endpoint
curl https://your-service.onrender.com/health

# Expected response:
# {
#   "status": "healthy",
#   "service": "pdf-parser-ensemble",
#   "parsers": {
#     "pdfplumber": true,
#     "pymupdf": true,
#     "ocr": true,
#     "textract": false,
#     "docai": false
#   }
# }

# Test ensemble endpoint
curl -X POST https://your-service.onrender.com/parse/ensemble \
  -H "X-API-Key: your-api-key" \
  -F "file=@test-quote.pdf"
```

### Test Via Edge Function

```bash
# Get your Supabase anon key
ANON_KEY="your-supabase-anon-key"

# Upload a PDF
curl -X POST https://your-project.supabase.co/functions/v1/parse_quote_ensemble \
  -H "Authorization: Bearer $ANON_KEY" \
  -F "file=@quote.pdf" \
  -F "projectId=<project-uuid>" \
  -F "supplierName=Test Supplier"
```

## Step 4: Monitor Performance

### Check Parser Metrics

```sql
-- View parser performance
SELECT
  parser_name,
  success_rate,
  avg_confidence,
  total_runs,
  avg_extraction_time_ms
FROM parser_performance_metrics
ORDER BY success_rate DESC;
```

### Check Recent Ensemble Runs

```sql
-- View recent ensemble parsing runs
SELECT
  file_name,
  parsers_succeeded || '/' || parsers_attempted as success_ratio,
  ROUND(confidence_score * 100, 1) || '%' as confidence,
  recommendation,
  extraction_time_ms || 'ms' as time,
  created_at
FROM parsing_ensemble_runs
ORDER BY created_at DESC
LIMIT 10;
```

## Step 5: Frontend Integration

### Add to Import Flow

Update your quote import to use ensemble parsing:

```typescript
// In your upload handler
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('projectId', projectId);
formData.append('supplierName', supplierName);
formData.append('parsers', 'pdfplumber,pymupdf,ocr'); // Choose parsers

const response = await supabase.functions.invoke('parse_quote_ensemble', {
  body: formData
});

const { data, error } = response;

if (error) {
  console.error('Ensemble parsing failed:', error);
  return;
}

// data contains:
// - ensemble_run_id: UUID of the run
// - best_result: Best parser's output
// - all_results: All parser results
// - consensus_items: Merged line items
// - confidence_breakdown: Detailed metrics
// - recommendation: HIGH/MODERATE/LOW confidence
```

### Show Confidence to Users

```tsx
import EnsembleParsingPanel from '@/components/EnsembleParsingPanel';

// In your quote review page
<EnsembleParsingPanel quoteId={quote.id} />
```

## Troubleshooting

### Python Service Won't Start

**Error**: `ModuleNotFoundError: No module named 'pdfplumber'`
- **Fix**: Check requirements.txt is in root and build command is correct

**Error**: `Tesseract not found`
- **Fix**: Add to Dockerfile or use Render's Tesseract-enabled environment

### Edge Function Fails

**Error**: "Python parser service not configured"
- **Fix**: Add `PYTHON_PARSER_API_KEY` to system_config table

**Error**: "Python parser service error (500)"
- **Fix**: Check Python service logs on Render/Railway
- Verify API key matches between services

### Low Confidence Scores

**Issue**: All parsers return <50% confidence
- **Cause**: Document may be scanned/poor quality
- **Solution**: Try OCR parser explicitly or improve PDF quality

**Issue**: Parsers disagree significantly
- **Cause**: Complex document format
- **Solution**: Review consensus items manually, may need custom parser

## Cost Optimization

### Free Tier Limits

- **Render**: 750 hours/month free (enough for 1 service)
- **Railway**: $5 credit/month free
- **Heroku**: 550 hours/month free

### Scaling Strategy

1. **Start with 3 parsers**: pdfplumber, pymupdf, ocr (no cloud costs)
2. **Add Textract**: If accuracy improves significantly (~$1.50 per 1000 pages)
3. **Add DocAI**: For specialized documents (~$1.50 per 1000 pages)

### Parser Selection

For cost-effective parsing:
- Use `/parse/auto` endpoint - tries parsers in order, stops when confident
- Only use ensemble mode for critical documents
- Cache results in database to avoid re-parsing

## Production Checklist

- [ ] Python service deployed and accessible
- [ ] API key configured in system_config
- [ ] Service URL added to edge function environment
- [ ] Health check passes
- [ ] Test upload successful
- [ ] Parser metrics table populating
- [ ] Frontend displays confidence scores
- [ ] Error handling tested
- [ ] Monitoring/logging set up

## Advanced Configuration

### Enable AWS Textract

1. Create AWS IAM user with Textract permissions
2. Generate access keys
3. Add to Python service environment variables
4. Update parsers parameter: `parsers=pdfplumber,pymupdf,ocr,textract`

### Enable Google Document AI

1. Enable Document AI API in Google Cloud
2. Create service account and download JSON key
3. Create processor (Form Parser or Custom)
4. Add credentials to environment
5. Update parsers parameter to include `docai`

### Custom Parser Priority

Edit `ensemble_coordinator.py` to change parser order:

```python
# Try parsers in order of reliability for your documents
parser_order = ['textract', 'pdfplumber', 'docai', 'pymupdf', 'ocr']
```

## Support

- **Python Service Issues**: Check Render/Railway logs
- **Edge Function Issues**: Check Supabase function logs
- **Database Issues**: Check Supabase SQL logs
- **Parser Issues**: Review parser_performance_metrics table

## Next Steps

1. Deploy Python service
2. Configure Supabase
3. Test with sample PDFs
4. Monitor performance metrics
5. Adjust parser selection based on results
6. Consider enabling cloud parsers for production
