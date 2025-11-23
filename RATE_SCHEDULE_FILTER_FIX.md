# Rate Schedule Filter Fix

## Problem
The PDF parser was extracting rate schedule pages (pages 3-6 in Global Fire quotes) as actual line items, resulting in items with $0.00 values appearing in the quote review interface. These are reference pricing tables, not actual quoted work.

## Solution
Added intelligent page filtering to detect and skip rate schedule pages during PDF extraction.

### Changes Made

#### 1. PDFPlumber Parser (`python-pdf-service/parsers/pdfplumber_parser.py`)
- Added `_is_rate_schedule_page()` method that detects rate schedule pages by looking for:
  - Keywords like "RATES SCHEDULE", "RATE GROUP", "Tier 1/2/3"
  - Pattern matching for pricing table formats (e.g., "GROUP 1.1... $26.31 ea.")
  - Page title patterns in the first 10 lines
- Modified page extraction loop to skip pages identified as rate schedules

#### 2. PyMuPDF Parser (`python-pdf-service/parsers/pymupdf_parser.py`)
- Added identical `_is_rate_schedule_page()` method
- Modified page extraction loop to skip rate schedule pages

### Detection Logic
A page is classified as a rate schedule if it meets any of these criteria:

1. **Multiple indicators present** (≥2 of):
   - "rates schedule" / "rate schedule"
   - "pricing schedule" / "price schedule"
   - "rate group"
   - "tier 1" / "tier 2" / "tier 3"

2. **GROUP pattern match**:
   - Contains pattern: `GROUP \d+\.\d+ ... $ \d+\.\d{2} ea.`
   - Example: "GROUP 1.1 Single Cables & Metal Pipes Up to 40mm $ 26.31 ea."

3. **Title at top**:
   - First 10 lines contain "RATES\nSCHEDULE" or "RATE\nSCHEDULE"

### Impact
- Rate schedule pages (typically pages 3-6 in Global Fire quotes) are now skipped during extraction
- Only actual quote breakdown pages (pages 8-15) are processed
- Eliminates $0.00 reference items from appearing in the quote review interface
- Quote totals remain accurate as rate schedules never contributed to totals

### Testing
To verify the fix works:
1. Upload a Global Fire quote PDF
2. Check that only actual quoted items appear (not rate table references)
3. Verify total matches the PDF's GRAND TOTAL

### Example Pages Filtered
From Global Fire quote format:
- Page 3: "RATES SCHEDULE" - GROUP 1.1, 1.2, 1.3 pricing
- Page 4: "RATES SCHEDULE" - GROUP 3.2, 3.3, 4.1, 4.2, 4.3 pricing
- Page 5: "RATES SCHEDULE" - GROUP 5.1, 5.2, 5.3, 5.4, 6.1, 6.2 pricing
- Page 6: "RATES SCHEDULE" - GROUP 7.1, 7.2, 7.3, 7.4 pricing

### Future Enhancements
Consider adding detection for other reference page types:
- Terms & Conditions pages
- Exclusions & Assumptions pages
- Quote diagrams/illustrations
- Cover pages without line items
