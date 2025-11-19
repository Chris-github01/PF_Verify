# PassiveFire Verify+ - Complete Application Functionality Guide

## Application Overview

PassiveFire Verify+ is an intelligent construction quote analysis platform designed specifically for passive fire protection procurement. The system uses advanced AI and machine learning to automate the evaluation, comparison, and award recommendation process for construction quotes - transforming what traditionally takes weeks of manual work into minutes of intelligent analysis.

## Core Intelligence Features

### Hybrid AI System
The application uses a sophisticated three-tier intelligence approach:

1. **Local Rule-Based Processing** (instant) - Pattern matching and deterministic analysis
2. **Machine Learning Classification** (milliseconds) - High-confidence automated categorization
3. **AI-Enhanced Analysis** (seconds) - OpenAI GPT-4 for complex items requiring deep understanding

**Performance**: 80% faster than traditional methods, 80% cost reduction, with intelligent caching that makes repeat analyses near-instant.

---

## Complete Workflow: Step-by-Step

### 1. Import Quotes

**Purpose**: Upload and automatically parse supplier quote documents

**Intelligence Used**:
- **Dual LLM Parsing System**: Uses two parsing strategies simultaneously
  - Primary: GPT-4-based intelligent extraction for complex layouts
  - Fallback: Rules-based parser for structured documents
  - Background job processing with real-time status monitoring
- **PDF OCR with Tesseract**: Extracts text from scanned/image-based PDFs
- **Excel Parser**: Intelligently detects and extracts BOQ data from spreadsheets
- **Automatic Supplier Detection**: Identifies supplier names from document content

**What It Does**:
- Accepts PDF and Excel file uploads
- Uses computer vision and OCR to extract text from any document format
- Runs multiple parsing strategies in parallel to maximize success rate
- Automatically structures unstructured data into line items with:
  - Item descriptions
  - Quantities
  - Units of measurement
  - Unit prices
  - Total prices
  - Sections/categories
- Creates supplier quote records with full metadata
- Handles complex table layouts, multi-column formats, and inconsistent structures

**Parsing Intelligence**:
- Identifies table boundaries and column headers automatically
- Handles merged cells, wrapped text, and irregular formatting
- Extracts hidden patterns (e.g., "1000mm x 500mm" becomes size: 1000x500)
- Detects and preserves section groupings
- Resilient to formatting variations across different suppliers

**User Actions**:
- Drag and drop quote files
- Monitor parsing progress with real-time status updates
- Preview extracted data before confirming import
- Edit supplier names if needed
- Handle parsing errors with automatic fallback strategies

---

### 2. Review & Clean

**Purpose**: Normalize, validate, and enrich imported quote data with intelligent mapping

**Intelligence Used**:
- **Unit Normalization Engine**:
  - Converts "m", "metre", "meter", "mtrs" all to canonical "m"
  - Handles 50+ unit variations automatically
  - Validates quantity calculations
- **Attribute Extraction AI**:
  - Identifies Size (e.g., "150mm" → size: 150)
  - Detects FRR (Fire Resistance Rating: "120/120/120" → frr: 120)
  - Extracts Service type (penetration, joint, wrap, etc.)
  - Determines Subclass (seal type, material class)
  - Material identification (intumescent, mineral wool, etc.)
- **Confidence Scoring**:
  - Each item gets 0-100% confidence score
  - Flags low-confidence items for human review
  - Tracks data quality issues
- **System Mapping Intelligence**:
  - Uses 30+ passive fire system templates
  - Multi-factor matching algorithm considers:
    - Service type
    - FRR requirements
    - Size ranges
    - Material specifications
    - Subclass characteristics
  - Confidence-weighted matching with manual override capability

**What It Does**:
- **Smart Clean** (one-click automation):
  1. Normalizes all units and numbers
  2. Extracts technical attributes from descriptions
  3. Maps line items to passive fire system templates
  4. Flags quality issues and missing data
  5. Calculates confidence scores
- **Manual Editing**:
  - Edit any field inline
  - Override system mappings
  - Exclude irrelevant items
  - Delete incorrect entries
- **Batch Processing**:
  - Process all quotes sequentially
  - Apply normalization and mapping to entire project
- **Quality Indicators**:
  - Green: High confidence (>80%)
  - Amber: Medium confidence (60-80%)
  - Red: Needs review (<60%)
  - Special flags for items missing quantities

**System Mapping**:
The app includes 30+ pre-configured passive fire system templates:
- PE_50_PEN (50mm penetration seal)
- PE_150_PEN (150mm penetration seal)
- LJ_25_PERIMETER (25mm linear joint)
- BOARD_600_16_FR (600x16mm fire-rated board)
- And many more with specific FRR, size, and material requirements

**Confidence Factors**:
- Complete technical attributes (+20%)
- Valid quantity and rate (+20%)
- Canonical unit match (+15%)
- Description quality (+15%)
- Calculation accuracy (+30%)

---

### 3. Quote Intelligence

**Purpose**: AI-powered analysis identifying risks, gaps, and opportunities across all quotes

**Intelligence Used**:
- **Hybrid Analysis System**:
  - Local pattern detection (80% of items, instant)
  - AI classification for ambiguous items (20%, seconds)
  - 30-minute intelligent caching
  - Parallel batch processing
- **Red Flag Detection**:
  - Critical: Missing scope, invalid pricing, spec violations
  - High: Large variances, incomplete items, compliance issues
  - Medium: Minor discrepancies, clarifications needed
  - Low: Informational notices
- **Coverage Gap Analysis**:
  - Missing systems: Items quoted by some suppliers but not others
  - Scope differences: Variations in quantities or specifications
  - Technical gaps: Missing technical details or certifications
- **Supplier Insights**:
  - Positive indicators (competitive pricing, complete scope)
  - Cost outliers (significantly over/under market)
  - Scope differences (unique inclusions/exclusions)
  - Quality concerns (ambiguous specs, low detail)
  - Completeness issues (missing items, partial scope)
- **System Detection**:
  - Automatically categorizes all line items into system types
  - Calculates value breakdown by system
  - Identifies unusual system distributions

**What It Does**:
- Analyzes every quote simultaneously in 3-5 seconds
- Generates comprehensive intelligence report with:
  - **Overview Dashboard**:
    - Coverage score (0-100%)
    - Critical issues count
    - Systems detected
    - Best value supplier
    - Most complete supplier
  - **Red Flags Tab**:
    - Severity-sorted warnings
    - Detailed descriptions and recommendations
    - Affected item counts
  - **Coverage Gaps Tab**:
    - System-by-system gap analysis
    - Present/missing supplier breakdown
    - Impact estimations
  - **Supplier Insights Tab**:
    - Comparative strengths and weaknesses
    - Pricing position analysis
    - Completeness metrics
  - **Systems Tab**:
    - Value breakdown by system type
    - Item count per system
    - Confidence scores

**Example Red Flags**:
- "Supplier A missing 15 critical penetration seal systems (estimated impact: $12,500)"
- "Supplier B pricing 40% above market average for joints - requires clarification"
- "Supplier C incomplete technical specifications for fire-rated board systems"

**Example Insights**:
- "Supplier A offers best value: 95% scope coverage at competitive pricing"
- "Supplier B most complete submission: 142/145 items quoted with detailed specs"
- "Supplier C cost outlier: 25% lower on seals but missing joint systems"

---

### 4. Scope Matrix

**Purpose**: Visual comparison matrix showing which suppliers quoted which systems and at what price

**Intelligence Used**:
- **Hybrid Comparison Engine**:
  - Batched model rate lookups (50 items per batch)
  - Intelligent caching (80% deduplication)
  - Parallel processing for sub-second performance
- **System Aggregation**:
  - Groups line items by passive fire system ID
  - Calculates unit rates per system
  - Aggregates quantities across similar items
- **Model Rate Comparison**:
  - Compares each supplier's price against configured model rates
  - Calculates variance percentages
  - Assigns color-coded flags:
    - Green: ≤10% variance (market-aligned)
    - Amber: ≤20% variance (acceptable range)
    - Red: >20% variance (requires investigation)
- **Missing Item Detection**:
  - Identifies gaps where suppliers didn't quote systems
  - Flags items with missing quantity data
  - Highlights scope inconsistencies

**What It Does**:
- Creates comprehensive matrix with:
  - Rows: Each passive fire system
  - Columns: Each supplier
  - Cells: Unit rate with color-coded variance flag
- **Interactive Features**:
  - Hover to see:
    - Unit rate vs model rate comparison
    - Variance percentage
    - Component count
    - Quantity missing warnings
  - Filter by:
    - Section (if specified in BOQ)
    - Service type (penetration, joint, wrap, etc.)
    - Subclass (seal type, material)
    - FRR rating (60, 120, 240 min)
    - Size bucket (small, medium, large)
- **Export to CSV**:
  - Full matrix with all variance data
  - Includes metadata columns
  - Timestamp and project identification

**Suggested Systems Panel**:
- AI identifies systems present in quotes but not in template library
- Suggests creating new system templates
- One-click creation with auto-populated attributes
- Updates matrix in real-time when new systems added

**Visual Indicators**:
- Green cells: Competitive pricing, within 10% of model
- Amber cells: Acceptable range, within 20% of model
- Red cells: Significant variance, needs investigation
- Gray cells: No quote provided (scope gap)
- Warning icon: Quantity data missing in source quote

**Example Scenario**:
```
System PE_50_PEN (50mm Penetration Seal):
- Supplier A: $45.00 (Green - 8% below model)
- Supplier B: $52.00 (Amber - 12% above model)
- Supplier C: $68.00 (Red - 40% above model)
- Supplier D: - (Not quoted)
```

---

### 5. Equalisation

**Purpose**: Create fair "apples-to-apples" comparison by filling scope gaps with model or peer rates

**Intelligence Used**:
- **Two Equalisation Modes**:

  **MODEL Mode**:
  - Uses configured model rates from project settings
  - Based on historical data, market rates, or consultant rates
  - Provides consistent benchmark across all suppliers
  - Best when accurate model rates are available

  **PEER_MEDIAN Mode**:
  - Calculates median rate from suppliers who quoted that system
  - Uses actual competitive market pricing
  - Self-adjusting based on quotes received
  - Best when model rates aren't available or market is volatile

- **Smart Gap Filling**:
  - Identifies every system each supplier didn't quote
  - Calculates equalisation rate (model or peer median)
  - Multiplies by standard quantity
  - Adds to supplier total with full audit trail

**What It Does**:
- **Supplier Totals Comparison Table**:
  - Original Total: As submitted by supplier
  - Equalised Total: With gaps filled in
  - Adjustment: Dollar amount added
  - Adjustment %: Percentage increase
  - Items Added: Count of equalised systems
- **Equalisation Audit Log**:
  - Every gap-fill entry with:
    - Supplier name
    - System ID and label
    - Reason (e.g., "System missing from quote")
    - Source (MODEL or PEER_MEDIAN)
    - Rate used
    - Quantity applied
    - Total added
- **Export Capabilities**:
  - CSV export of full audit log
  - Includes all metadata for verification
  - Timestamped filename

**Mode Selection**:
Persisted per project, users can switch modes and see instant recalculation

**Example**:
```
Supplier A Original: $125,000
- Missing PE_50_PEN (10 items @ $45 model rate): +$450
- Missing LJ_25_PERIMETER (20 items @ $32 model rate): +$640
Supplier A Equalised: $126,090 (+0.9%)

Supplier B Original: $118,000
- Missing BOARD_600_16_FR (50 items @ $28 model rate): +$1,400
- Missing HVAC_COLLAR_200 (8 items @ $95 model rate): +$760
Supplier B Equalised: $120,160 (+1.8%)
```

**Why Equalisation Matters**:
Without equalisation, a supplier who "forgets" to quote expensive systems appears cheaper but will claim those costs later via variations. Equalisation reveals the true complete project cost.

---

### 6. Award Report

**Purpose**: Generate professional board-level recommendation report with complete analysis

**Intelligence Used**:
- **Multi-Criteria Scoring Algorithm**:
  - **Price Score** (40% weighting):
    - 10 points for lowest price
    - Linear scaling to 0 for highest price
    - Uses equalised totals for fair comparison
  - **Compliance Score** (25% weighting):
    - Based on inverse of risk score
    - Technical specification adherence
    - Quality of submission
  - **Scope Coverage Score** (20% weighting):
    - Percentage of items quoted out of total
    - Linear scaling: 100% coverage = 10 points
  - **Risk Score** (15% weighting):
    - Inverse of identified risk count
    - Critical risks weighted heavily
    - Missing data penalties
  - **Weighted Total**: Combines all criteria for final 0-10 score

- **Quote Intelligence Integration**:
  - Automatically imports all red flags
  - Incorporates coverage gap analysis
  - Includes supplier insights
  - Links to detailed Quote Intelligence report

**What It Does**:
Generates comprehensive multi-section professional report:

**1. Cover Page**:
- Project name and client
- Recommended supplier with score
- Generation date

**2. Executive Summary**:
- Quick overview paragraph
- Key metrics (suppliers evaluated, recommended price, coverage)
- High-level findings

**3. Quote Intelligence Summary**:
- Red flags overview (if any)
- Coverage gaps analysis (if any)
- Best value and most complete supplier identification
- Critical issues highlighted

**4. How to Interpret This Report**:
- Explanation of scoring criteria
- Weighting breakdown
- Definitions of metrics

**5. Supplier Comparison Summary Table**:
- Rank, Supplier Name, Weighted Score
- Individual criterion scores (Price, Compliance, Coverage, Risk)
- Total price (equalised)

**6. Detailed Supplier Commentary**:
- Individual section per supplier
- Price, coverage %, items quoted
- Key notes and observations
- Rank badge for recommended supplier

**7. Identified Risks & Clarifications**:
- Supplier-by-supplier breakdown
- Risk items (missing systems, variances, concerns)
- Required clarifications (spec confirmations, verifications)

**8. Weighted Score Breakdown**:
- Visual bar charts per supplier
- Shows contribution of each criterion
- Transparent scoring visualization

**9. Award Recommendation**:
- Clear recommendation with rationale
- Detailed justification of choice
- Key metrics of recommended supplier
- Explanation of value proposition

**10. Conditions of Award**:
- Numbered list of contract conditions
- Spec compliance requirements
- Schedule and claim procedures
- Clarification resolution requirements
- Gap pricing confirmation (if applicable)

**11. Appendices**:
- Reference to methodology documentation
- Links to source documents
- Scope matrix reference

**Export Options**:
- **Print**: Browser print dialog with optimized layout
- **HTML Export**: Formatted HTML file for PDF conversion
- **Excel Export**: Data-focused spreadsheet with all scoring

**Approval Workflow**:
After report generation:
1. **Approve Supplier**: Formal approval action with reason
2. **Generate RFI**: Creates Request for Information document for clarifications
3. **Generate Unsuccessful Letters**: Creates formal letters for non-awarded suppliers

**RFI Generator**:
- Professional letterhead template
- Lists all clarifications needed from Quote Intelligence
- Itemizes coverage gaps requiring pricing
- Deadline for response
- Export as Word/PDF

**Unsuccessful Letters Generator**:
- Personalized letters per supplier
- Appreciation for submission
- Brief feedback (kept high-level)
- Encouragement for future opportunities
- Professional and respectful tone

---

## Additional Features

### Project Dashboard
- Overview of project progress through workflow
- Completion indicators for each stage
- Quick stats (quotes imported, items analyzed, recommended supplier)
- Recent activity log

### Settings & Configuration
- **Project Settings**:
  - Project name and client
  - Reference numbers
  - Date ranges
- **Model Rate Configuration**:
  - Upload CSV of model/benchmark rates
  - Map systems to rates
  - Set rates by size, FRR, service type combinations
- **Threshold Configuration**:
  - Define variance thresholds for Green/Amber/Red flags
  - Customize tolerance levels per project

### System Configuration
- Browse all 30+ passive fire system templates
- Create new system templates
- Edit existing systems
- Define matching criteria (service, FRR, size ranges, materials)

### Multi-Project Management
- Project switcher in top navigation
- Archive completed projects
- Clone project settings to new projects
- Filter and search projects

---

## Technical Architecture Highlights

### Parsing Architecture
- **Background Job System**: Long-running parse jobs don't block UI
- **Status Polling**: Real-time updates via Supabase subscriptions
- **Chunking Strategy**: Breaks large documents into manageable chunks
- **Resilient Parser**: Multiple fallback strategies ensure high success rate

### Intelligence Stack
- **Hybrid AI**: 80% local processing, 20% OpenAI for hard cases
- **Caching Layer**: 30-minute intelligent cache eliminates redundant API calls
- **Batch Processing**: Parallel execution for 3-5x speed improvement
- **Confidence Scoring**: Every AI decision includes confidence metric

### Comparison Engine
- **Model Rate Cache**: Deduplicates lookups (typically 80% cache hits)
- **Batch Querying**: 50 items per batch for optimal database performance
- **Parallel Execution**: Multiple batches processed simultaneously
- **Sub-second Performance**: Matrix of 500 items loads in <1 second

### Data Model
- **PostgreSQL** via Supabase
- **Row Level Security** for multi-tenancy
- **Real-time Subscriptions** for live updates
- **JSON columns** for flexible metadata storage

---

## User Experience Highlights

### Intelligent Defaults
- Auto-detects best parser for each document
- Suggests system mappings with confidence scores
- Pre-fills equalisation mode based on available data
- Recommends export formats based on use case

### Guided Workflow
- Step-by-step workflow navigation
- Progress indicators show completion status
- "Next Step" buttons guide through process
- Can jump to any step once data is available

### Visual Feedback
- Color-coded confidence and variance indicators
- Toast notifications for actions
- Loading states with descriptive messages
- Error messages with actionable guidance

### Responsive Design
- Mobile-friendly navigation
- Touch-optimized controls
- Adaptive layouts for different screen sizes
- Print-optimized report layouts

---

## Business Value

### Time Savings
- **Traditional Process**: 2-3 weeks of manual spreadsheet work
- **With Verify+**: 30-60 minutes end-to-end
- **ROI**: 95%+ time reduction

### Improved Accuracy
- Eliminates human calculation errors
- Consistent application of scoring criteria
- Catches scope gaps that humans miss
- Validates data quality automatically

### Better Decisions
- Transparent, auditable scoring
- Comprehensive risk identification
- Fair apples-to-apples comparison
- AI-powered insights reveal hidden patterns

### Professional Deliverables
- Board-ready award reports
- Detailed audit trails
- Export-ready formats
- Defensible recommendations

---

## Summary

PassiveFire Verify+ transforms construction quote analysis from a manual, error-prone, weeks-long process into an intelligent, automated, accurate workflow that delivers professional recommendations in under an hour. By combining local rule-based processing with selective AI enhancement, the platform achieves unprecedented speed without sacrificing accuracy or depth of analysis.

The platform's hybrid intelligence approach - using pattern matching for routine items and GPT-4 for complex cases - ensures both rapid processing (3-5 seconds for typical projects) and deep understanding of technical construction specifications. Every step of the workflow is designed to surface insights, identify risks, and guide users toward optimal procurement decisions.

From initial document upload through parsing, normalization, intelligent mapping, coverage analysis, fair comparison, and final award recommendation, Verify+ handles the complete procurement evaluation lifecycle with transparency, auditability, and professional-grade output.
