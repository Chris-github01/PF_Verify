# Python PDF Parser Service - Complete Setup Guide

This guide will get your multi-parser PDF service working in production.

## 🎯 What You're Setting Up

A Python microservice with 5 PDF parsers (pdfplumber, PyMuPDF, OCR, AWS Textract, Google DocAI) that:
- Runs in parallel for speed
- Builds consensus from multiple results
- Returns confidence scores
- Integrates with your Supabase edge functions

## 📋 Prerequisites

- GitHub account (free)
- Render.com account (free tier available)
- Supabase project (you already have this)

## 🚀 Step-by-Step Deployment

### Step 1: Test Service Locally (Optional but Recommended)

```bash
# Navigate to service directory
cd python-pdf-service

# Install dependencies
pip install -r requirements.txt

# Run tests
python test_service.py

# If tests pass, you're ready to deploy!
```

### Step 2: Push to GitHub

```bash
# Initialize git (if not already done)
cd python-pdf-service
git init

# Add files
git add .
git commit -m "PDF parser ensemble service"

# Create repo on GitHub and push
git remote add origin https://github.com/yourusername/pdf-parser-service.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Render.com

#### Method A: Automatic (Recommended)

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Select the repository you just created
5. Render detects `render.yaml` automatically
6. Click **"Apply"**
7. Wait 5-10 minutes for deployment
8. **IMPORTANT**: Copy the auto-generated `API_KEY` from environment variables

#### Method B: Manual

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub and select your repository
4. Configure:
   - **Name**: `pdf-parser-ensemble`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: (leave blank if repo is just the service)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 4 --timeout 120 app:app`

5. **Environment Variables**:
   - Click "Advanced" → "Add Environment Variable"
   - Add: `API_KEY` = (generate a secure random string, e.g., `openssl rand -hex 32`)
   - Add: `PORT` = `5000`

6. Click **"Create Web Service"**

7. Wait for deployment (5-10 minutes)

### Step 4: Get Your Service URL

After deployment completes:

1. Go to your service dashboard on Render
2. Find the URL at the top (e.g., `https://pdf-parser-ensemble-abc123.onrender.com`)
3. **Copy this URL** - you'll need it next

### Step 5: Test Your Deployed Service

```bash
# Test health endpoint (no auth needed)
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
```

If you get this response, your service is working! ✅

### Step 6: Configure Supabase Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Add Python parser API key to system_config
INSERT INTO system_config (key, value, description, is_sensitive)
VALUES (
  'PYTHON_PARSER_API_KEY',
  'your-api-key-from-render',  -- Replace with actual API key from Render
  'API key for Python PDF parser ensemble service',
  true
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

**IMPORTANT**: Replace `your-api-key-from-render` with the actual `API_KEY` value from Render's environment variables.

### Step 7: Configure Supabase Edge Functions

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Add environment variable:
   - **Key**: `PYTHON_PARSER_SERVICE_URL`
   - **Value**: `https://your-service.onrender.com` (your actual Render URL, no trailing slash)
4. Click **"Add"** and **"Save"**

### Step 8: Test Full Integration

Now test the complete flow from your app:

```bash
# Get your Supabase credentials
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-supabase-anon-key"

# Test ensemble parsing
curl -X POST "$SUPABASE_URL/functions/v1/parse_quote_ensemble" \
  -H "Authorization: Bearer $ANON_KEY" \
  -F "file=@test.pdf" \
  -F "projectId=$(uuidgen)" \
  -F "supplierName=Test Supplier"
```

Expected response structure:
```json
{
  "best_result": {
    "parser_name": "pdfplumber",
    "success": true,
    "items": [...],
    "confidence_score": 0.85
  },
  "all_results": [...],
  "consensus_items": [...],
  "confidence_breakdown": {
    "overall": 0.87,
    "parsers_succeeded": 2,
    "parsers_attempted": 3,
    "cross_model_agreement": 0.75
  },
  "recommendation": "HIGH_CONFIDENCE_MULTI_PARSER"
}
```

## ✅ Verification Checklist

- [ ] Python service deployed to Render
- [ ] Health endpoint returns `"status": "healthy"`
- [ ] API key copied from Render environment variables
- [ ] API key added to Supabase `system_config` table
- [ ] Service URL added to Supabase edge function environment
- [ ] Test PDF upload returns ensemble results
- [ ] Data appears in `parsing_ensemble_runs` table

## 🔧 Troubleshooting

### Issue: "Python parser service not configured"

**Cause**: API key not in system_config table

**Fix**:
```sql
SELECT * FROM system_config WHERE key = 'PYTHON_PARSER_API_KEY';
```
If no result, re-run Step 6.

### Issue: "Python parser service unavailable"

**Cause**: Service URL not configured or incorrect

**Fix**:
1. Check Supabase Edge Functions environment variables
2. Verify `PYTHON_PARSER_SERVICE_URL` exists
3. Test the URL directly with curl

### Issue: Service works but then stops responding

**Cause**: Render free tier spins down after 15 minutes of inactivity

**Effect**: First request after spin-down takes 30-60 seconds

**Solutions**:
- Accept the delay (free tier limitation)
- Upgrade to paid plan ($7/month for always-on)
- Keep service warm with periodic health checks

### Issue: OCR parser fails

**Cause**: Tesseract not available in Render environment

**Fix**: For production OCR, you need to use Docker deployment:

1. Update Render to use Docker:
   - Runtime: `Docker`
   - Dockerfile Path: `Dockerfile`
2. The provided Dockerfile includes Tesseract installation

### Issue: "No number after minus sign in JSON"

**Cause**: Python service returned HTML error page instead of JSON

**Fix**:
1. Check Render logs: Dashboard → Your Service → Logs
2. Look for Python errors
3. Verify all dependencies installed correctly
4. Check that gunicorn is starting properly

### Issue: Parsers return low confidence

**Cause**: Document format not suitable for selected parsers

**Solutions**:
- For scanned PDFs, use: `parsers=ocr`
- For table-heavy quotes, use: `parsers=pdfplumber`
- For text PDFs, use: `parsers=pymupdf`
- Let ensemble decide: `parsers=pdfplumber,pymupdf,ocr`

## 📊 Monitoring Performance

### Check Parser Success Rates

```sql
SELECT
  parser_name,
  COUNT(*) as total_runs,
  AVG(confidence_score) as avg_confidence,
  SUM(CASE WHEN parsers_succeeded > 0 THEN 1 ELSE 0 END) as successful_runs
FROM parsing_ensemble_runs
GROUP BY parser_name
ORDER BY avg_confidence DESC;
```

### Check Recent Runs

```sql
SELECT
  file_name,
  best_parser,
  ROUND(confidence_score * 100, 1) || '%' as confidence,
  recommendation,
  extraction_time_ms || 'ms' as time,
  created_at
FROM parsing_ensemble_runs
ORDER BY created_at DESC
LIMIT 10;
```

### View Parser Breakdown

```sql
SELECT
  best_parser,
  COUNT(*) as times_selected,
  AVG(confidence_score) as avg_confidence
FROM parsing_ensemble_runs
GROUP BY best_parser
ORDER BY times_selected DESC;
```

## 🎛️ Configuration Options

### Change Parser Priority

Edit `python-pdf-service/parsers/ensemble_coordinator.py`:

```python
# Line 192 - Change parser order for your document types
parser_order = ['pdfplumber', 'pymupdf', 'textract', 'docai', 'ocr']
```

### Enable AWS Textract (Optional)

In Render dashboard, add environment variables:
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_REGION`: `us-east-1` (or your region)

Cost: ~$1.50 per 1000 pages

### Enable Google Document AI (Optional)

In Render dashboard, add environment variables:
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to credentials JSON
- `GOOGLE_CLOUD_PROJECT_ID`: Your project ID
- `GOOGLE_CLOUD_LOCATION`: `us`
- `GOOGLE_DOCAI_PROCESSOR_ID`: Your processor ID

Cost: ~$1.50 per 1000 pages

## 💰 Cost Breakdown

### Free Tier (Render)
- 750 hours/month free
- Enough for 1 service running 24/7
- Spins down after 15 min inactivity
- **Total: $0/month**

### Paid (Recommended for Production)
- Render Starter: $7/month
- Always-on, no spin-down
- Better performance
- **Total: $7/month** (plus any cloud parser costs)

## 🎉 Success!

If you've completed all steps, you now have:

✅ Multi-parser PDF extraction with ensemble validation
✅ Confidence scoring for every extraction
✅ Automatic fallback if parsers fail
✅ Performance metrics tracking
✅ Production-ready deployment

Your users can now upload PDFs and get highly accurate extraction results backed by multiple parsers!

## 📚 Next Steps

1. **Monitor Performance**: Check parser metrics after 10-20 uploads
2. **Tune Parsers**: Adjust parser priority based on your document types
3. **Add Cloud Parsers**: Consider Textract/DocAI for critical documents
4. **Optimize Costs**: Review usage and upgrade Render if needed

## 🆘 Still Having Issues?

1. Check Render logs: Dashboard → Logs
2. Check Supabase logs: Dashboard → Edge Functions → Logs
3. Verify API keys match between services
4. Test health endpoint first: `curl https://your-service.onrender.com/health`
5. Review the error message in the response

Common fixes solve 90% of issues:
- API key mismatch
- Wrong service URL
- Service not deployed yet
- Environment variable typo
