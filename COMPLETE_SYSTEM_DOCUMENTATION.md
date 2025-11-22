# PassiveFire Verify+ - Complete System Documentation

## Executive Summary

PassiveFire Verify+ is a comprehensive web application designed for the construction and fire safety industry. It automates the analysis, comparison, and validation of passive fire protection quotes from multiple suppliers. The system uses intelligent parsing, attribute extraction, system mapping, and comparative analysis to help users make informed procurement decisions.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [User Authentication & Multi-Tenancy](#user-authentication--multi-tenancy)
4. [Core Workflow](#core-workflow)
5. [Database Schema](#database-schema)
6. [Feature Modules](#feature-modules)
7. [AI/ML Integration](#aiml-integration)
8. [Security Implementation](#security-implementation)
9. [API & Edge Functions](#api--edge-functions)
10. [File Processing Pipeline](#file-processing-pipeline)
11. [Deployment Architecture](#deployment-architecture)

---

## 1. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │ Project  │  Import  │  Review  │  Scope   │ Reports  │   │
│  │Dashboard │  Quotes  │ & Clean  │  Matrix  │   Hub    │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS/REST
┌─────────────────────────────────────────────────────────────┐
│              Supabase Backend (PostgreSQL + Auth)            │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐   │
│  │   Auth   │   RLS    │  Edge    │  Real-   │ Storage  │   │
│  │  System  │ Policies │Functions │   time   │  Bucket  │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│         Python PDF Service (Render.com)                      │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐  │
│  │PyMuPDF   │PDFPlumber│  Textract│  Ensemble            │  │
│  │Parser    │Parser    │  Parser  │  Coordinator         │  │
│  └──────────┴──────────┴──────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### System Components

1. **Frontend Application**: Single-page React application with TypeScript
2. **Backend Database**: Supabase PostgreSQL with Row-Level Security
3. **Authentication**: Supabase Auth with email/password
4. **Edge Functions**: Serverless functions for backend logic
5. **PDF Processing Service**: Dedicated Python microservice for PDF extraction
6. **File Storage**: Supabase Storage for quote PDFs and documents

---

## 2. Technology Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript 5.9.3
- **Build Tool**: Vite 5.4.21
- **Styling**: Tailwind CSS 3.4.18
- **Icons**: Lucide React 0.344.0
- **Animations**: Framer Motion 12.23.24
- **State Management**: React Hooks (useState, useEffect, useContext)
- **PDF Handling**: pdfjs-dist 5.4.394
- **OCR**: Tesseract.js 6.0.1
- **Spreadsheet**: XLSX 0.18.5
- **Validation**: Zod 3.23.8

### Backend
- **Database**: Supabase (PostgreSQL 15+)
- **Authentication**: Supabase Auth
- **API**: Supabase Client SDK (@supabase/supabase-js 2.57.4)
- **Edge Functions**: Deno runtime
- **File Storage**: Supabase Storage

### Python Microservice
- **Framework**: Flask 3.1.0
- **PDF Libraries**:
  - PyMuPDF (fitz) 1.24.14
  - pdfplumber 0.11.4
  - pytesseract 0.3.13
  - pdf2image 1.17.0
- **Deployment**: Render.com
- **Environment**: Python 3.11+

### Development Tools
- **Package Manager**: npm
- **Linting**: ESLint 9.9.1
- **Type Checking**: TypeScript strict mode
- **Version Control**: Git

---

## 3. User Authentication & Multi-Tenancy

### Authentication Flow

```
User Login → Supabase Auth → Session Token → RLS Enforcement
```

### Multi-Tenancy Model

The system implements a three-tier organizational structure:

1. **Organisations**: Top-level entities (companies)
2. **Projects**: Belong to organisations
3. **Users**: Members of organisations with role-based access

### Organization Structure

```sql
organisations
├── id (uuid, primary key)
├── name (text)
├── slug (text, unique)
├── subscription_status (text: 'trial', 'active', 'cancelled')
├── licensed_trades (text[])
├── created_at (timestamptz)
└── updated_at (timestamptz)

organisation_members
├── id (uuid, primary key)
├── organisation_id (uuid, foreign key)
├── user_id (uuid, foreign key to auth.users)
├── role (text: 'owner', 'admin', 'member', 'viewer')
├── joined_at (timestamptz)
└── status (text: 'active', 'invited', 'removed')
```

### Row-Level Security (RLS)

Every table has RLS policies enforcing:
- Users can only access data from their organization
- Role-based permissions (owner/admin/member/viewer)
- Project-specific access control

Example RLS Policy:
```sql
CREATE POLICY "Users can view projects in their organisation"
ON projects FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_members.organisation_id = projects.organisation_id
    AND organisation_members.user_id = auth.uid()
    AND organisation_members.status = 'active'
  )
);
```

### Authentication Security Features

1. **Session Management**: JWT tokens with automatic refresh
2. **Password Security**: Bcrypt hashing via Supabase Auth
3. **Session Timeout**: Automatic logout after inactivity
4. **CORS Protection**: Strict origin validation
5. **SQL Injection Prevention**: Parameterized queries only

---

## 4. Core Workflow

### Complete User Journey

```
1. Project Creation
   ↓
2. Import Quotes (PDF/Excel)
   ↓
3. Automated Parsing & Extraction
   ↓
4. Review & Clean (Manual Verification)
   ↓
5. Attribute Extraction
   ↓
6. System Mapping
   ↓
7. Scope Matrix Generation
   ↓
8. Award Report Generation
   ↓
9. Export & Documentation
```

### Detailed Workflow Stages

#### Stage 1: Project Creation
- User creates a new project
- Assigns project name, client, reference number
- Project stored with unique UUID
- Linked to organization via `organisation_id`

#### Stage 2: Import Quotes
**Supported Formats**:
- PDF documents (single or multi-page)
- Excel spreadsheets (.xlsx, .xls)

**Import Process**:
1. File uploaded to Supabase Storage
2. Quote record created with status='uploaded'
3. File sent to parsing service
4. Parsing job initiated

#### Stage 3: Automated Parsing & Extraction

**PDF Processing Pipeline**:
```
PDF Upload
  ↓
Chunking (by page)
  ↓
Ensemble Parsing (3 parsers in parallel)
  ├── PyMuPDF Parser
  ├── PDFPlumber Parser
  └── Textract Parser
  ↓
Confidence Scoring
  ↓
Best Result Selection
  ↓
Table Extraction
  ↓
Line Item Creation
```

**Excel Processing**:
- Direct table reading via XLSX library
- Column mapping detection
- Header row identification
- Data normalization

**Extracted Data Fields**:
- Description (item description)
- Quantity (numeric)
- Unit (e.g., "m", "m²", "each")
- Unit Price (rate per unit)
- Total Price (calculated)

#### Stage 4: Review & Clean

**Data Normalization**:
```javascript
// Quantity normalization
normaliseNumber(value) → float

// Unit normalization
normaliseUnit("metres") → { canonical: "m", conversion: 1.0 }

// Price calculation validation
total === quantity × unit_price (within tolerance)
```

**Validation Rules**:
- All numeric fields must be positive
- Total price should match qty × rate (±2% tolerance)
- Units must be canonical (standardized)
- Descriptions cannot be empty

**Confidence Scoring**:
Each line item receives a confidence score (0-1) based on:
- All required fields present (0.3)
- Valid numeric values (0.2)
- Canonical unit found (0.2)
- Total price matches calculation (0.2)
- Attributes successfully extracted (0.1)

**User Actions**:
- Manual editing of any field
- Exclude/include items
- Override system mappings
- Add missing quantities
- Normalize units

#### Stage 5: Attribute Extraction

**Automated Extraction** (`attributeExtractor.ts`):

```javascript
extractAttributes(description) → {
  size: string,        // "100mm", "6 inch", "DN100"
  frr: string,         // "FRL120", "90/90/90", "120 minutes"
  service: string,     // "Electrical", "Mechanical", "Plumbing"
  subclass: string,    // "Cables", "Pipes", "Ducts"
  material: string,    // "Steel", "PVC", "Copper"
  confidence: number   // 0-1 (proportion of attributes found)
}
```

**Extraction Patterns**:

**Size Detection**:
- `/(\d+(?:\.\d+)?)\s*(?:mm|millimeter|millimetre)/gi`
- `/(\d+(?:\.\d+)?)\s*(?:inch|in|")/gi`
- `/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/gi` (dimensions)
- `/DN\s*(\d+)/gi` (nominal diameter)
- `/NB\s*(\d+)/gi` (nominal bore)

**FRR (Fire Resistance Rating) Detection**:
- `/FRL\s*[-/]?\s*(\d+)(?:\s*[-/]\s*(\d+)(?:\s*[-/]\s*(\d+))?)?/gi`
- `/(\d+)\s*[-/]\s*(\d+)\s*[-/]\s*(\d+)/g` (120/120/120)
- `/(\d+)\s*min(?:ute)?s?\s*fire\s*rat(?:ing|ed)/gi`

**Service Keywords**:
- Electrical: electrical, electric, power, cable, wiring, conduit
- Mechanical: mechanical, hvac, duct, ventilation
- Fire: fire, sprinkler, fire protection
- Plumbing: plumbing, pipe, piping, water, drainage
- Data: data, telecom, network, fibre, fiber
- Gas: gas, natural gas, lpg

**Subclass Keywords**:
- Cables, Conduit, Ducts, Pipes, Tray, Penetration, Seal, Batt, Board, Collar, Block, Damper

**Material Keywords**:
- Steel, PVC, Copper, Aluminium, Concrete, Plasterboard, Ceramic, Intumescent, Mineral Wool

#### Stage 6: System Mapping

**System Matching Algorithm** (`systemMatcher.ts`):

```javascript
matchLineToSystem(item) → {
  systemId: string | null,
  systemLabel: string,
  confidence: number,
  needsReview: boolean,
  matchedFactors: string[],
  missedFactors: string[]
}
```

**Scoring System**:
- Service match: +30 points
- Size within range: +25 points
- FRR exact match: +20 points
- Subclass match: +15 points
- **Maximum**: 90 points (confidence = score/90)

**Confidence Thresholds**:
- `>= 0.7` (63+ points): High confidence (green)
- `0.5 - 0.7` (45-62 points): Medium confidence (amber)
- `< 0.5` (<45 points): Low confidence, needs review (red)

**System Templates** (52 predefined systems):

Categories:
1. **Electrical Systems**
   - Cables (FRL 90/120, Small/Medium/Large)
   - Conduit (FRL 90/120, Small/Medium/Large)
   - Cable Tray (FRL 90/120)

2. **Mechanical Systems**
   - Ducts (FRL 90/120, Small/Medium/Large)
   - Fire Dampers (FRL 90/120)

3. **Plumbing Systems**
   - Pipes (FRL 90/120, Small/Medium/Large)

4. **Fire Systems**
   - Sprinkler Pipes (FRL 120, Small/Medium/Large)

5. **Data Systems**
   - Data Cables (FRL 120, Small/Medium/Large)

6. **Gas Systems**
   - Gas Pipes (FRL 120, Small/Medium)

7. **Passive Fire Systems**
   - Penetration Seals (FRL 90/120, Small/Medium/Large)
   - Linear Joints (FRL 90/120)
   - Fire Collars (FRL 120, Small/Medium/Large)
   - Fire Batts/Wraps (FRL 90/120)
   - Fire Rated Boards (FRL 90/120)

**Example System Template**:
```javascript
{
  id: 'ELEC_CABLE_120_MD',
  label: 'Electrical Cables - Medium (FRL 120)',
  service: 'Electrical',
  frr: 120,
  size_min: 51,
  size_max: 150,
  subclass: 'Cables'
}
```

**Mapping Process**:
1. Extract attributes from description
2. For each system template, calculate match score
3. Select highest scoring template (if score >= 20)
4. Save mapping to database with confidence score
5. Flag for review if confidence < 0.7

#### Stage 7: Scope Matrix Generation

**Matrix Purpose**: Compare quotes side-by-side across systems

**Data Structure**:
```javascript
MatrixRow {
  systemId: string,
  systemLabel: string,
  section: string,
  service: string,
  subclass: string,
  frr: string,
  sizeBucket: string,
  cells: {
    [supplierName]: {
      unitRate: number,
      flag: 'GREEN' | 'AMBER' | 'RED' | 'NA',
      modelRate: number | null,
      variancePct: number | null,
      componentCount: number,
      quoteId: string,
      quoteItemId: string
    }
  }
}
```

**Matrix Generation Algorithm**:
```
1. Load all quote items for selected quotes
2. Filter to only items with system_id (mapped items)
3. Group by system_id
4. For each system:
   - Aggregate quantities
   - Calculate weighted average unit rates
   - Compare to model rate (if available)
   - Calculate variance percentage
   - Assign flag (GREEN/AMBER/RED)
5. Build matrix rows with supplier columns
6. Apply filters (section, service, FRR, size)
```

**Variance Calculation**:
```javascript
variancePct = ((supplierRate - modelRate) / modelRate) × 100

Flags:
- GREEN: |variance| <= 10%
- AMBER: 10% < |variance| <= 25%
- RED: |variance| > 25%
- NA: No model rate available
```

**Filtering Options**:
- Section (Building area)
- Service Type (Electrical, Mechanical, etc.)
- Subclass (Cables, Pipes, etc.)
- FRR (Fire Rating)
- Size Bucket

**Export Options**:
- CSV download (matrix format)
- Excel export (formatted)
- Print view

#### Stage 8: Award Report Generation

**Report Computation** (Edge Function: `compute_award_report`):

```javascript
Input:
- projectId: UUID
- selectedQuotes: UUID[]
- equalisationMode: 'none' | 'per-system' | 'global'

Process:
1. Load all comparison data from Scope Matrix
2. Calculate totals per supplier
3. Apply equalisation strategy
4. Calculate risk scores
5. Rank suppliers
6. Generate coverage analysis
7. Create recommendation

Output:
- Award report with supplier rankings
- Detailed breakdown by system
- Risk analysis
- Coverage percentages
- Total pricing
```

**Equalisation Modes**:

1. **None**: Raw totals, no adjustments
   ```
   Total = Σ(quantity × unit_rate)
   ```

2. **Per-System**: Equalise each system independently
   ```
   For each system:
     - Find lowest rate among suppliers
     - Award 100% to lowest
     - Others get proportion based on rate
   Total = Σ(system_totals)
   ```

3. **Global**: Equalise across all systems together
   ```
   - Find supplier with lowest global total
   - Award 100% to lowest
   - Others proportional to their total
   ```

**Risk Scoring**:
```javascript
riskScore = (
  pricingRisk × 0.4 +          // Based on variance from model
  coverageRisk × 0.3 +         // Based on % of scope quoted
  flagCountRisk × 0.3          // Based on RED/AMBER flags
)

Factors:
- High variance items (>25%): +risk
- Low coverage (<80%): +risk
- Many RED flags: +risk
- Missing items: +risk
```

**Supplier Ranking**:
```
Rank suppliers by:
1. Adjusted Total (ascending)
2. Risk Score (ascending)
3. Coverage % (descending)
```

**Report Sections**:
1. **Executive Summary**
   - Recommended supplier
   - Total contract value
   - Key metrics

2. **Supplier Rankings**
   - Position, name, total, risk score, coverage%

3. **System-by-System Breakdown**
   - Each system with supplier comparisons
   - Quantities, rates, totals, variances

4. **Risk Analysis**
   - High-risk items flagged
   - Pricing anomalies
   - Coverage gaps

5. **Award Recommendation**
   - Primary recommendation with justification
   - Alternative scenarios
   - Value engineering opportunities

#### Stage 9: Export & Documentation

**Export Formats**:

1. **PDF Report**
   - Executive summary
   - Full detail tables
   - Charts and visualizations
   - Professional formatting

2. **CSV/Excel**
   - Scope Matrix data
   - Award report data
   - Line item details
   - All supplier pricing

3. **Print View**
   - Browser-optimized layout
   - Page breaks
   - Header/footer

**Audit Trail**:
All actions logged:
- User actions (edit, delete, approve)
- System actions (parse, map, calculate)
- Timestamps and user IDs
- Before/after values for edits

---

## 5. Database Schema

### Core Tables

#### `organisations`
```sql
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_status TEXT DEFAULT 'trial',
  licensed_trades TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `organisation_members`
```sql
CREATE TABLE organisation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organisation_id, user_id)
);
```

#### `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client TEXT,
  reference TEXT,
  status TEXT DEFAULT 'active',
  approved_quote_id UUID,
  review_clean_done BOOLEAN DEFAULT FALSE,
  created_by_user_id UUID REFERENCES auth.users(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);
```

#### `quotes`
```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  quote_date DATE,
  quote_reference TEXT,
  status TEXT DEFAULT 'uploaded',
  total_amount NUMERIC(12,2),
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  page_count INTEGER,
  parsing_method TEXT,
  parsing_confidence NUMERIC(3,2),
  parsing_completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `quote_items`
```sql
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  line_number INTEGER,
  section TEXT,
  description TEXT NOT NULL,
  raw_description TEXT,
  normalized_description TEXT,
  quantity NUMERIC(12,4) DEFAULT 0,
  unit TEXT,
  raw_unit TEXT,
  normalized_unit TEXT,
  canonical_unit TEXT,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total_price NUMERIC(12,2) DEFAULT 0,

  -- Extracted Attributes
  size TEXT,
  frr TEXT,
  service TEXT,
  subclass TEXT,
  material TEXT,

  -- System Mapping
  system_id TEXT,
  system_label TEXT,
  system_confidence NUMERIC(3,2),
  system_needs_review BOOLEAN DEFAULT FALSE,
  system_manual_override BOOLEAN DEFAULT FALSE,
  matched_factors JSONB,
  missed_factors JSONB,

  -- Metadata
  confidence NUMERIC(3,2),
  issues JSONB,
  is_excluded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `award_reports`
```sql
CREATE TABLE award_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'computing' CHECK (status IN ('computing', 'ready', 'failed')),
  result_json JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by_user_id UUID REFERENCES auth.users(id),
  selected_quote_ids UUID[],
  equalisation_mode TEXT,
  notes TEXT
);
```

### Supporting Tables

#### `parsing_jobs`
```sql
CREATE TABLE parsing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  progress NUMERIC(3,2) DEFAULT 0,
  current_chunk INTEGER DEFAULT 0,
  total_chunks INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `parsing_chunks`
```sql
CREATE TABLE parsing_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parsing_job_id UUID REFERENCES parsing_jobs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_type TEXT CHECK (chunk_type IN ('page', 'table', 'section')),
  raw_text TEXT,
  structured_data JSONB,
  parser_used TEXT,
  confidence NUMERIC(3,2),
  metadata JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `model_rates`
```sql
CREATE TABLE model_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  system_id TEXT NOT NULL,
  system_label TEXT,
  section TEXT,
  service TEXT,
  subclass TEXT,
  frr TEXT,
  size_bucket TEXT,
  rate NUMERIC(12,2) NOT NULL,
  component_count INTEGER,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `embeddings`
```sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  source_type TEXT,
  source_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Advanced Features Tables

#### `blockchain_audit_trail`
```sql
CREATE TABLE blockchain_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id UUID REFERENCES quote_items(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_hash TEXT,
  current_hash TEXT NOT NULL,
  data_snapshot JSONB NOT NULL,
  performed_by_user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  blockchain_verified BOOLEAN DEFAULT FALSE,
  icp_canister_id TEXT,
  icp_transaction_id TEXT
);
```

#### `ensemble_parsing_results`
```sql
CREATE TABLE ensemble_parsing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parsing_job_id UUID REFERENCES parsing_jobs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  parser_name TEXT NOT NULL,
  raw_output TEXT,
  structured_result JSONB,
  confidence_score NUMERIC(3,2),
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `supplier_template_fingerprints`
```sql
CREATE TABLE supplier_template_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  template_signature JSONB NOT NULL,
  column_patterns JSONB,
  learned_from_quotes UUID[],
  accuracy_score NUMERIC(3,2),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `human_review_queue`
```sql
CREATE TABLE human_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id UUID REFERENCES quote_items(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  automated_suggestion JSONB,
  human_decision JSONB,
  reviewed_by_user_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

Key indexes for performance:
```sql
-- Fast project lookups
CREATE INDEX idx_projects_org ON projects(organisation_id);
CREATE INDEX idx_projects_user ON projects(user_id);

-- Fast quote queries
CREATE INDEX idx_quotes_project ON quotes(project_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- Fast item lookups
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX idx_quote_items_system ON quote_items(system_id);

-- Fast organisation member lookups
CREATE INDEX idx_org_members_user ON organisation_members(user_id);
CREATE INDEX idx_org_members_org ON organisation_members(organisation_id);

-- Parsing job tracking
CREATE INDEX idx_parsing_jobs_quote ON parsing_jobs(quote_id);
CREATE INDEX idx_parsing_jobs_status ON parsing_jobs(status);

-- Embedding similarity search
CREATE INDEX idx_embeddings_vector ON embeddings
  USING ivfflat (embedding vector_cosine_ops);
```

---

## 6. Feature Modules

### 6.1 Project Dashboard

**File**: `src/pages/NewProjectDashboard.tsx`, `src/pages/ProjectDashboard.tsx`

**Features**:
- Project overview cards
- Workflow progress tracking
- Quick actions (import, review, analyze)
- Project metrics
- Recent activity

**Key Components**:
- Summary cards (quotes, items, systems, suppliers)
- Status indicators
- Navigation to workflow steps
- Project creation modal

### 6.2 Import Quotes

**File**: `src/pages/ImportQuotes.tsx`, `src/pages/EnhancedImportQuotes.tsx`

**Features**:
1. **File Upload**
   - Drag & drop support
   - Multi-file selection
   - Progress tracking

2. **Supplier Information**
   - Manual entry or extraction
   - Quote date and reference
   - Notes field

3. **Preview & Validation**
   - Pre-import data preview
   - Column mapping for Excel
   - Error detection

4. **Parsing Job Management**
   - Real-time progress
   - Retry on failure
   - Cancel jobs

**Parsing Methods**:
- **PDF**: Ensemble parsing (PyMuPDF + PDFPlumber + Textract)
- **Excel**: Direct table reading with column detection
- **OCR**: Tesseract.js for scanned documents

### 6.3 Review & Clean

**File**: `src/pages/ReviewClean.tsx`

**Features**:
1. **Quote Selection**
   - List of imported quotes
   - Status indicators
   - Select quote for review

2. **Line Item Table**
   - Editable fields (description, qty, unit, rate, total)
   - Inline editing
   - Bulk actions

3. **Smart Clean Function**
   - Normalizes quantities and units
   - Validates pricing consistency
   - Extracts attributes
   - Maps to systems
   - Calculates confidence scores

4. **Attribute Display**
   - Size, FRR, Service, Subclass, Material
   - Color-coded badges
   - Bold, readable text

5. **System Mapping Display**
   - Suggested system with confidence
   - Dropdown to override
   - Match details (matched/missed factors)
   - Manual override flag

6. **Validation & Confidence**
   - Visual confidence indicators
   - Issue flags (missing qty, price mismatch, etc.)
   - Exclude/include items
   - Status badges

**Actions**:
- **Clean & Map Quote**: Runs full normalization + attribute extraction + system mapping
- **Normalize**: Just normalizes data
- **Map to Systems**: Just performs mapping
- **Edit Item**: Inline editing
- **Exclude Item**: Soft delete

### 6.4 Scope Matrix

**File**: `src/pages/ScopeMatrix.tsx`

**Features**:
1. **Quote Selection**
   - Multi-select checkboxes
   - Only shows quotes with mapped items
   - "Select All" functionality

2. **Matrix Generation**
   - Aggregates items by system
   - Creates supplier columns
   - Calculates averages and totals

3. **Filtering**
   - Section
   - Service
   - Subclass
   - FRR
   - Size Bucket

4. **Matrix Display**
   - System rows
   - Supplier columns
   - Unit rate display
   - Variance flags (GREEN/AMBER/RED)
   - Model rate comparison

5. **Cell Details**
   - Click cell for item details
   - View component breakdown
   - See variance calculation

6. **Export**
   - CSV download
   - Excel export
   - Print view

**Diagnostic Features**:
- Shows why matrix is empty (no quotes, no mappings, no overlap)
- Item count per quote
- Mapped item count per quote
- Overlapping systems count

### 6.5 Reports Hub

**File**: `src/pages/ReportsHub.tsx`, `src/pages/EnhancedReportsHub.tsx`

**Features**:
1. **Project Filtering**
   - Only shows workflow-complete projects
   - Search by name or client
   - Status categorization

2. **Project Cards**
   - "Needs Report" section (workflow complete, no report yet)
   - "With Report" section (reports already generated)

3. **Report Generation**
   - Select project
   - Generate new report
   - Regenerate existing report

4. **Report Metadata**
   - Generated date
   - Quote count
   - Coverage percentage
   - Recommended supplier

5. **Actions**
   - View report
   - Export PDF
   - Print
   - Refresh data

**Workflow Validation**:
Projects must meet these criteria to appear:
- Has quotes uploaded
- Quotes are processed
- `review_clean_done` flag is true
- At least some items have `system_id` (mapped)

### 6.6 Award Report

**File**: `src/pages/AwardReport.tsx`, `src/pages/AwardReportV2.tsx`

**Features**:
1. **Report Header**
   - Project name and client
   - Generation date
   - Equalisation mode
   - Selected quotes

2. **Executive Summary**
   - Recommended supplier
   - Total contract value
   - Risk score
   - Coverage percentage
   - Key findings

3. **Supplier Rankings Table**
   - Rank, supplier name
   - Raw total
   - Adjusted total (after equalisation)
   - Risk score
   - Coverage %
   - Status badge

4. **System-by-System Breakdown**
   - Accordion sections per system
   - Supplier comparison table
   - Quantities, rates, totals
   - Variance from model
   - Flags

5. **Risk Analysis**
   - High-risk items highlighted
   - Pricing anomalies
   - Coverage gaps
   - Missing items

6. **Recommendation**
   - Detailed justification
   - Alternative scenarios
   - Value engineering suggestions

**Export Options**:
- PDF (formatted report)
- Excel (detailed data)
- Print view

### 6.7 Quote Intelligence

**File**: `src/pages/QuoteIntelligence.tsx`, `src/pages/QuoteIntelligenceReport.tsx`

**Features**:
1. **Smart Quote Analysis**
   - Outlier detection
   - Pricing pattern recognition
   - Risk assessment

2. **Trade Analysis**
   - Per-trade pricing comparison
   - Variance analysis
   - Cost distribution

3. **Supplier Intelligence**
   - Historical pricing
   - Performance metrics
   - Risk indicators

4. **Natural Language Insights**
   - Plain-English findings
   - Key takeaways
   - Recommendations

### 6.8 Contract Manager

**File**: `src/pages/ContractManager.tsx`

**Features**:
- Contract tracking
- Variation management
- Claims tracking
- Progress monitoring
- Export capability

### 6.9 Settings

**File**: `src/pages/Settings.tsx`, `src/pages/OrganisationSettings.tsx`

**Features**:
1. **User Profile**
   - Name, email
   - Password change
   - Preferences

2. **Organisation Settings**
   - Organisation name and details
   - Member management
   - Role assignments
   - Subscription status

3. **Trade Licensing**
   - Licensed trades display
   - Upgrade options
   - Billing information

4. **Model Rates Configuration**
   - Upload custom rate libraries
   - Set default rates
   - Import/export rates

### 6.10 Admin Center

**File**: `src/pages/admin/SuperAdminDashboard.tsx`, `src/pages/AdminApp.tsx`

**Super Admin Features**:
- View all organisations
- Create organisations
- Manage subscriptions
- View system-wide metrics
- Access global PDF vault
- Monitor parsing jobs
- Review audit logs

**Dashboards**:
- Organisation list
- Client management
- Global statistics
- System health monitoring

---

## 7. AI/ML Integration

### 7.1 Ensemble Parsing System

**Purpose**: Extract tabular data from PDFs with high accuracy

**Architecture**:
```
PDF Input
  ↓
Chunking (by page)
  ↓
┌─────────────┬─────────────┬─────────────┐
│  PyMuPDF    │ PDFPlumber  │  Textract   │
│   Parser    │   Parser    │   Parser    │
└─────────────┴─────────────┴─────────────┘
  ↓              ↓              ↓
┌─────────────────────────────────────────┐
│      Ensemble Coordinator               │
│  - Compare results                      │
│  - Score confidence                     │
│  - Select best output                   │
└─────────────────────────────────────────┘
  ↓
Best Result → Database
```

**Parser Details**:

1. **PyMuPDF Parser** (`parsers/pymupdf_parser.py`)
   - Best for: Standard PDFs with text layers
   - Method: Direct text extraction
   - Speed: Fast
   - Accuracy: High for native PDFs

2. **PDFPlumber Parser** (`parsers/pdfplumber_parser.py`)
   - Best for: Complex table layouts
   - Method: Table structure detection
   - Speed: Medium
   - Accuracy: High for structured tables

3. **Textract Parser** (`parsers/textract_parser.py`)
   - Best for: Scanned PDFs, OCR needed
   - Method: AWS Textract API
   - Speed: Slow (API calls)
   - Accuracy: High for scanned documents

**Confidence Scoring**:
```python
def calculate_confidence(result):
    score = 0.0

    # Has table structure
    if has_table_structure(result):
        score += 0.3

    # Column headers detected
    if has_headers(result):
        score += 0.2

    # Consistent column count
    if has_consistent_columns(result):
        score += 0.2

    # Numeric values in expected columns
    if has_numeric_values(result):
        score += 0.15

    # No extraction errors
    if no_errors(result):
        score += 0.15

    return score
```

**Result Selection**:
- Compare confidence scores
- Choose highest confidence result
- If tie, prefer PDFPlumber (best table handling)
- Store all results for auditing

### 7.2 Attribute Extraction

**Implementation**: `src/lib/normaliser/attributeExtractor.ts`

**Regex-Based Extraction**:
Uses pattern matching to identify:
- Sizes (dimensions, diameters)
- Fire ratings (FRL, FRR)
- Service types (keywords)
- Subclasses (keywords)
- Materials (keywords)

**Future Enhancement Opportunity**: LLM-based extraction
```javascript
// Future implementation
async function extractAttributesWithLLM(description) {
  const prompt = `Extract attributes from this passive fire item:
  "${description}"

  Return JSON with: size, frr, service, subclass, material`;

  const response = await callOpenAI(prompt);
  return JSON.parse(response);
}
```

### 7.3 System Matching

**Implementation**: `src/lib/mapping/systemMatcher.ts`

**Rule-Based Matching**:
Current implementation uses scoring algorithm (described in Stage 6).

**Future LLM Integration**:
```javascript
// Future enhancement
async function matchWithLLM(item, templates) {
  const prompt = `Given this line item:
  Description: ${item.description}
  Size: ${item.size}
  FRR: ${item.frr}
  Service: ${item.service}

  Match to one of these systems:
  ${JSON.stringify(templates)}

  Return: { systemId, confidence, reasoning }`;

  const response = await callOpenAI(prompt);
  return JSON.parse(response);
}
```

### 7.4 Quote Intelligence (Hybrid AI)

**Implementation**: `src/lib/quoteIntelligence/hybridAnalyzer.ts`

**Current Approach**: Statistical analysis
- Outlier detection (z-score)
- Variance calculation
- Pattern recognition

**LLM Integration Potential**:
- Natural language insights
- Context-aware recommendations
- Anomaly explanations
- Risk narrative generation

### 7.5 Embeddings & Similarity Search

**Table**: `embeddings`
**Vector Dimensions**: 1536 (OpenAI ada-002)

**Use Cases**:
1. **Similar Item Matching**
   - Find similar line items across quotes
   - Group similar descriptions
   - Detect duplicates

2. **Historical Pricing Lookup**
   - Search previous quotes for similar items
   - Price benchmarking
   - Cost estimation

3. **Template Learning**
   - Learn supplier-specific formats
   - Improve parsing accuracy over time

**Implementation Example**:
```javascript
async function findSimilarItems(description) {
  // Generate embedding
  const embedding = await getEmbedding(description);

  // Search similar
  const { data } = await supabase.rpc('match_items', {
    query_embedding: embedding,
    match_threshold: 0.8,
    match_count: 10
  });

  return data;
}
```

---

## 8. Security Implementation

### 8.1 Authentication Security

**Supabase Auth Features**:
- bcrypt password hashing (10 rounds minimum)
- JWT token-based sessions
- Automatic token refresh
- Session expiry (configurable)
- Password complexity requirements (can be enforced)

**Session Management**:
```typescript
// Session listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // User logged in
    setSession(session);
  } else if (event === 'SIGNED_OUT') {
    // User logged out
    clearSession();
  }
});
```

### 8.2 Row-Level Security (RLS)

**Principle**: Every query is automatically filtered by user's organization membership.

**Example Policies**:

**Projects Table**:
```sql
-- SELECT policy
CREATE POLICY "Users can view org projects"
ON projects FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = projects.organisation_id
    AND user_id = auth.uid()
    AND status = 'active'
  )
);

-- INSERT policy
CREATE POLICY "Admins can create projects"
ON projects FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = projects.organisation_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND status = 'active'
  )
);

-- UPDATE policy
CREATE POLICY "Members can update projects"
ON projects FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = projects.organisation_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'member')
    AND status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = projects.organisation_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin', 'member')
    AND status = 'active'
  )
);

-- DELETE policy
CREATE POLICY "Only owners can delete projects"
ON projects FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = projects.organisation_id
    AND user_id = auth.uid()
    AND role = 'owner'
    AND status = 'active'
  )
);
```

**Helper Functions** (to avoid recursion):
```sql
CREATE FUNCTION public.user_has_org_access(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = org_id
    AND user_id = auth.uid()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.3 Input Validation

**Client-Side**:
```typescript
import { z } from 'zod';

const quoteSchema = z.object({
  supplier_name: z.string().min(1).max(255),
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quote_reference: z.string().max(100).optional(),
  total_amount: z.number().positive().optional(),
});

// Validate before submission
const result = quoteSchema.safeParse(formData);
if (!result.success) {
  // Show validation errors
  handleErrors(result.error);
}
```

**Server-Side** (Edge Functions):
```typescript
// Validate request body
if (!projectId || typeof projectId !== 'string') {
  return new Response(
    JSON.stringify({ error: 'Invalid project ID' }),
    { status: 400 }
  );
}

// Verify user has access
const { data: project } = await supabase
  .from('projects')
  .select('organisation_id')
  .eq('id', projectId)
  .single();

if (!project) {
  return new Response(
    JSON.stringify({ error: 'Project not found' }),
    { status: 404 }
  );
}
```

### 8.4 SQL Injection Prevention

**Parameterized Queries**:
```typescript
// SAFE - parameterized
const { data } = await supabase
  .from('quotes')
  .select('*')
  .eq('project_id', projectId)
  .eq('supplier_name', supplierName);

// NEVER DO THIS - vulnerable to SQL injection
const query = `SELECT * FROM quotes WHERE project_id = '${projectId}'`;
```

### 8.5 XSS Prevention

**React Auto-Escaping**: React automatically escapes all values rendered in JSX.

**Manual Sanitization** (when needed):
```typescript
import DOMPurify from 'dompurify';

// Sanitize user input before rendering as HTML
const safeHtml = DOMPurify.sanitize(userInput);
```

### 8.6 CORS Configuration

**Edge Functions**:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific domain
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// Handle OPTIONS preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders, status: 200 });
}

// Include in all responses
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

### 8.7 API Key Security

**Environment Variables**:
```bash
# .env (never committed)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Backend Service Keys** (never exposed to client):
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

**Edge Function Environment Variables**:
- Automatically injected by Supabase
- Not accessible from client
- Used for privileged operations

### 8.8 File Upload Security

**File Type Validation**:
```typescript
const allowedTypes = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

if (!allowedTypes.includes(file.type)) {
  throw new Error('Invalid file type');
}
```

**File Size Limits**:
```typescript
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

if (file.size > MAX_FILE_SIZE) {
  throw new Error('File too large');
}
```

**Storage Bucket Policies**:
```sql
-- Only authenticated users can upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quotes' AND
  auth.uid() IS NOT NULL
);

-- Users can only access their org's files
CREATE POLICY "Users can access org files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quotes' AND
  -- Path format: org_id/project_id/file.pdf
  (storage.foldername(name))[1] IN (
    SELECT organisation_id::text
    FROM organisation_members
    WHERE user_id = auth.uid()
  )
);
```

### 8.9 Audit Trail

**Blockchain Integration** (`blockchain_audit_trail` table):
```typescript
// Record action with hash chain
async function recordAction(quoteItemId, action, data) {
  // Get previous hash
  const { data: previous } = await supabase
    .from('blockchain_audit_trail')
    .select('current_hash')
    .eq('quote_item_id', quoteItemId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();

  // Calculate new hash
  const currentHash = sha256(
    JSON.stringify({
      previous_hash: previous?.current_hash || 'genesis',
      action,
      data,
      timestamp: Date.now()
    })
  );

  // Insert record
  await supabase.from('blockchain_audit_trail').insert({
    quote_item_id: quoteItemId,
    action,
    previous_hash: previous?.current_hash || 'genesis',
    current_hash: currentHash,
    data_snapshot: data,
    performed_by_user_id: user.id
  });
}
```

### 8.10 Rate Limiting

**Supabase Built-In**: Automatic rate limiting on API endpoints

**Custom Rate Limiting** (Edge Functions):
```typescript
// Simple in-memory rate limiting
const rateLimits = new Map<string, number>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimits.get(userId) || 0;

  if (now - lastRequest < 1000) { // 1 request per second
    return false;
  }

  rateLimits.set(userId, now);
  return true;
}
```

---

## 9. API & Edge Functions

### Edge Function Overview

All edge functions use Deno runtime and are deployed to Supabase Edge Network.

**Common Structure**:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 })
  }

  try {
    // Parse request
    const { param1, param2 } = await req.json()

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Business logic here
    const result = await doSomething(param1, param2)

    // Return response
    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Edge Functions Catalog

#### 1. `chunk_pdf`
**Purpose**: Split PDF into chunks (pages) for parallel processing

**Input**:
```json
{
  "quoteId": "uuid",
  "fileUrl": "https://..."
}
```

**Process**:
1. Download PDF from storage
2. Split into individual pages
3. Create parsing_job record
4. Create parsing_chunks for each page
5. Return job ID

**Output**:
```json
{
  "jobId": "uuid",
  "chunkCount": 15
}
```

#### 2. `chunk_xlsx`
**Purpose**: Split Excel file into processable chunks

**Input**:
```json
{
  "quoteId": "uuid",
  "fileUrl": "https://..."
}
```

**Process**:
1. Download Excel file
2. Read sheets and tables
3. Detect headers
4. Create chunks per table/sheet
5. Return parsed data

**Output**:
```json
{
  "chunks": [
    {
      "chunkIndex": 0,
      "headers": ["Description", "Qty", "Unit", "Rate", "Total"],
      "rows": [...]
    }
  ]
}
```

#### 3. `parse_quote_production`
**Purpose**: Main parsing endpoint with retry logic

**Input**:
```json
{
  "quoteId": "uuid",
  "parsingMethod": "auto" | "pdf" | "excel"
}
```

**Process**:
1. Determine file type
2. Call appropriate chunking function
3. Parse each chunk
4. Aggregate results
5. Save to quote_items table
6. Update quote status

**Output**:
```json
{
  "success": true,
  "itemsCreated": 145,
  "parsingMethod": "pdf"
}
```

#### 4. `parse_quote_ensemble`
**Purpose**: Parse PDF using ensemble of 3 parsers

**Input**:
```json
{
  "quoteId": "uuid",
  "chunkIndex": 0,
  "pdfUrl": "https://..."
}
```

**Process**:
1. Send chunk to Python service
2. Python service runs 3 parsers in parallel:
   - PyMuPDF
   - PDFPlumber
   - Textract (if enabled)
3. Compare results
4. Select best result
5. Return structured data

**Output**:
```json
{
  "parser_used": "pdfplumber",
  "confidence": 0.92,
  "tables": [
    {
      "headers": ["Description", "Qty", "Unit", "Rate", "Total"],
      "rows": [...]
    }
  ]
}
```

#### 5. `parse_quote_llm_fallback`
**Purpose**: Use LLM when standard parsers fail

**Input**:
```json
{
  "quoteId": "uuid",
  "chunkText": "raw text..."
}
```

**Process**:
1. Construct prompt with instructions
2. Call OpenAI API (GPT-4)
3. Parse LLM response
4. Validate structure
5. Return normalized data

**Prompt Example**:
```
Extract line items from this quote text:
[TEXT]

Return a JSON array with objects containing:
- description (string)
- quantity (number)
- unit (string)
- unit_price (number)
- total_price (number)
```

**Output**:
```json
{
  "items": [
    {
      "description": "Electrical cable penetration seal 100mm",
      "quantity": 25,
      "unit": "each",
      "unit_price": 120.50,
      "total_price": 3012.50
    }
  ]
}
```

#### 6. `compute_award_report`
**Purpose**: Generate award recommendation report

**Input**:
```json
{
  "projectId": "uuid",
  "selectedQuoteIds": ["uuid1", "uuid2"],
  "equalisationMode": "none" | "per-system" | "global",
  "force": false
}
```

**Process**:
1. Check for existing report (if not force)
2. Load all quote items for selected quotes
3. Filter to mapped items only
4. Group by system
5. Calculate totals per supplier
6. Apply equalisation strategy
7. Calculate risk scores
8. Rank suppliers
9. Generate recommendation
10. Save report to database

**Output**:
```json
{
  "reportId": "uuid",
  "awardSummary": {
    "recommendedSupplier": "Supplier A",
    "totalValue": 1250000.00,
    "equalisationMode": "per-system",
    "suppliers": [
      {
        "rank": 1,
        "name": "Supplier A",
        "rawTotal": 1300000.00,
        "adjustedTotal": 1250000.00,
        "riskScore": 0.15,
        "coveragePercent": 98.5
      }
    ]
  },
  "systemBreakdown": [...]
}
```

#### 7. `get_embedding`
**Purpose**: Generate OpenAI embedding for text

**Input**:
```json
{
  "text": "Electrical cable penetration seal 100mm FRL 120"
}
```

**Process**:
1. Call OpenAI embeddings API
2. Return vector (1536 dimensions)

**Output**:
```json
{
  "embedding": [0.123, -0.456, ...] // 1536 numbers
}
```

#### 8. `start_parsing_job`
**Purpose**: Initialize a new parsing job

**Input**:
```json
{
  "quoteId": "uuid"
}
```

**Process**:
1. Create parsing_job record
2. Trigger chunking
3. Start processing chunks
4. Return job ID

**Output**:
```json
{
  "jobId": "uuid",
  "status": "processing"
}
```

#### 9. `process_parsing_job`
**Purpose**: Process a single chunk of a parsing job

**Input**:
```json
{
  "jobId": "uuid",
  "chunkIndex": 0
}
```

**Process**:
1. Load chunk data
2. Parse with appropriate method
3. Update chunk record
4. Update job progress
5. Check if job complete

**Output**:
```json
{
  "success": true,
  "chunkIndex": 0,
  "progress": 0.20
}
```

#### 10. `resume_parsing_job`
**Purpose**: Resume a failed or paused job

**Input**:
```json
{
  "jobId": "uuid"
}
```

**Process**:
1. Find incomplete chunks
2. Retry parsing
3. Update status

**Output**:
```json
{
  "resumed": true,
  "remainingChunks": 3
}
```

#### 11. `export_contract_manager`
**Purpose**: Export contract data to Excel

**Input**:
```json
{
  "projectId": "uuid"
}
```

**Process**:
1. Load contract data
2. Generate Excel workbook
3. Format tables
4. Return download URL

**Output**:
```json
{
  "downloadUrl": "https://..."
}
```

#### 12. `ai_health`
**Purpose**: Health check for AI services

**Input**: None (GET request)

**Output**:
```json
{
  "status": "healthy",
  "services": {
    "openai": "ok",
    "python_service": "ok",
    "textract": "ok"
  }
}
```

---

## 10. File Processing Pipeline

### 10.1 PDF Processing Flow

```
1. User uploads PDF
   ↓
2. File saved to Supabase Storage
   Path: quotes/{org_id}/{project_id}/{filename}
   ↓
3. Quote record created (status='uploaded')
   ↓
4. Edge function 'chunk_pdf' called
   - Downloads PDF
   - Counts pages
   - Creates parsing_job
   ↓
5. For each page:
   - Create parsing_chunk record
   - Call 'parse_quote_ensemble'
   ↓
6. Python service (Render) processes chunk:
   - Runs PyMuPDF parser
   - Runs PDFPlumber parser
   - Runs Textract parser (optional)
   - Compares results
   - Selects best result
   ↓
7. Ensemble result returned to edge function
   ↓
8. Edge function processes result:
   - Extracts table data
   - Maps to quote_items structure
   - Validates data
   ↓
9. Quote items inserted to database
   ↓
10. Parsing job marked complete
    ↓
11. Quote status updated to 'processed'
    ↓
12. User notified (real-time subscription)
```

### 10.2 Excel Processing Flow

```
1. User uploads Excel file
   ↓
2. File saved to Supabase Storage
   ↓
3. Quote record created
   ↓
4. Edge function 'chunk_xlsx' called
   - Downloads Excel file
   - Reads sheets
   - Detects tables
   - Identifies headers
   ↓
5. For each table/sheet:
   - Extract rows
   - Map columns
   - Validate data
   ↓
6. Create quote_items directly
   (No chunking needed)
   ↓
7. Quote status updated to 'processed'
   ↓
8. User notified
```

### 10.3 OCR Processing Flow

```
1. User uploads scanned PDF
   ↓
2. Initial parsing fails (no text layer)
   ↓
3. System detects low confidence
   ↓
4. Trigger OCR processing:
   - Convert PDF pages to images
   - Run Tesseract.js OCR
   - Extract text
   ↓
5. Re-run parsing on OCR text
   ↓
6. Continue with normal flow
```

### 10.4 Error Handling & Retry

```
If parsing fails:
  ↓
1. Mark parsing_job status='failed'
   ↓
2. Log error message
   ↓
3. User can click 'Retry'
   ↓
4. Call 'resume_parsing_job'
   ↓
5. Re-attempt failed chunks
   ↓
6. If still fails:
   - Offer manual upload
   - Suggest LLM fallback
   - Request format clarification
```

---

## 11. Deployment Architecture

### 11.1 Frontend Deployment

**Platform**: Netlify / Vercel (recommended)

**Build Configuration**:
```yaml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Environment Variables**:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 11.2 Backend Deployment (Supabase)

**Components**:
1. PostgreSQL database (managed)
2. Auth service (managed)
3. Storage (managed)
4. Edge Functions (managed)
5. Real-time subscriptions (managed)

**Deployment Steps**:
1. Create Supabase project
2. Run migrations (via Supabase CLI or dashboard)
3. Deploy edge functions:
   ```bash
   supabase functions deploy function-name
   ```
4. Set environment variables
5. Enable RLS on all tables
6. Configure storage buckets

### 11.3 Python Service Deployment (Render.com)

**Platform**: Render.com (Web Service)

**Configuration**:
```yaml
# render.yaml
services:
  - type: web
    name: passivefire-pdf-service
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "gunicorn app:app"
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
```

**Environment Variables**:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
AWS_ACCESS_KEY_ID=your-aws-key (for Textract)
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
```

**Scaling**:
- Horizontal scaling: Multiple instances
- Auto-scaling based on CPU/memory
- Health checks every 30 seconds

### 11.4 Database Migrations

**Process**:
1. Create migration file:
   ```bash
   supabase migration new migration_name
   ```

2. Write SQL in migration file:
   ```sql
   -- migration_name.sql
   CREATE TABLE new_table (...);
   ALTER TABLE existing_table ADD COLUMN ...;
   CREATE INDEX ...;
   ```

3. Apply migration:
   ```bash
   supabase db push
   ```

4. Verify migration:
   ```bash
   supabase migration list
   ```

### 11.5 Monitoring & Logging

**Supabase Monitoring**:
- Dashboard shows:
  - API requests per second
  - Database connections
  - Storage usage
  - Edge function invocations
  - Error rates

**Render Monitoring**:
- Service metrics:
  - Request count
  - Response time
  - Error rate
  - CPU/memory usage

**Custom Logging**:
```typescript
// Frontend
console.log('User action:', { action, user, timestamp });

// Edge Function
console.log('Processing job:', { jobId, progress, timestamp });

// Python Service
import logging
logging.info(f'Parsing chunk {chunk_index} with {parser_name}')
```

### 11.6 Backup & Recovery

**Database Backups**:
- Supabase automatic backups (daily)
- Point-in-time recovery (PITR) available
- Manual backups via pg_dump

**File Storage Backups**:
- Replicate to external storage (S3)
- Version control for important documents

**Disaster Recovery Plan**:
1. Database restore from backup
2. File restore from S3
3. Redeploy edge functions
4. Verify all services operational

---

## Conclusion

PassiveFire Verify+ is a comprehensive quote analysis platform that combines:
- **Robust multi-tenancy** with organization-based access control
- **Intelligent parsing** using ensemble methods and OCR
- **Automated attribute extraction** from complex descriptions
- **Rule-based system matching** with confidence scoring
- **Comparative analysis** across suppliers and systems
- **Advanced reporting** with equalisation strategies
- **Enterprise-grade security** with RLS and audit trails

The system is built on modern, scalable technologies:
- React + TypeScript frontend
- Supabase PostgreSQL backend
- Python microservice for PDF processing
- Edge functions for serverless compute
- OpenAI integration ready for future LLM enhancements

All data is protected by:
- Row-level security policies
- Multi-factor authentication support
- Blockchain-style audit trails
- Encrypted storage
- CORS and XSS protection

The platform is production-ready and deployed across:
- Frontend: Netlify/Vercel
- Backend: Supabase
- PDF Service: Render.com

For audit purposes, all code, database schemas, and security policies are documented in this comprehensive guide.

---

**Document Version**: 1.0
**Last Updated**: November 22, 2025
**Authors**: Development Team
**Status**: Complete & Auditable
