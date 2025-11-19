# VerifyPlus Web Application

A comprehensive construction project management and quote analysis platform built with React, TypeScript, and Supabase.

## Overview

VerifyPlus is a web-based application designed to streamline construction project management by providing tools for quote analysis, scope matrix management, trade analysis, and project tracking. The platform uses AI-powered features to extract and analyze data from quotes, identify variances, and provide intelligent insights.

## Features

### Core Functionality
- **Project Dashboard** - Centralized view of all projects with quick access to key metrics
- **Quote Management** - Upload, parse, and analyze construction quotes from multiple suppliers
- **Scope Matrix** - Compare quotes against model rates and identify variances
- **Trade Analysis** - Analyze quotes by trade and identify pricing anomalies
- **Quote Intelligence** - AI-powered analysis of quote coverage, red flags, and recommendations
- **Award Report** - Generate comprehensive award recommendations
- **Base Tracker** - Track base scope items and variations
- **Claims & Variations** - Manage project claims and variation orders
- **Library System** - Store and search historical project data with AI-powered similarity search

### AI-Powered Features
- **Multi-Model Extraction** - Uses multiple AI models (GPT-4, Claude) for robust data extraction
- **Intelligent Parsing** - Automatic detection of quote structure and data extraction
- **Similarity Search** - Find similar historical items using vector embeddings
- **Copilot Audit** - AI assistant for reviewing extraction accuracy
- **Hybrid Analysis** - Combines rule-based and AI-powered analysis for best results

### Import & Export
- **PDF Import** - Extract data from PDF quotes with OCR support
- **Excel Import** - Parse Excel/XLSX quote files
- **Chunked Processing** - Handle large files efficiently with background processing
- **Multiple Export Formats** - Export to Excel, CSV, and PDF

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Lucide React** - Icon library

### Backend & Database
- **Supabase** - PostgreSQL database with real-time capabilities
- **Supabase Auth** - User authentication and authorization
- **Supabase Storage** - File storage for quotes and documents
- **Row Level Security (RLS)** - Database-level security policies

### AI & Processing
- **OpenAI GPT-4** - Primary extraction model
- **Anthropic Claude** - Fallback extraction model
- **Supabase Edge Functions** - Serverless functions for AI processing
- **Vector Embeddings** - Semantic search using pgvector extension
- **PDF.js** - Client-side PDF parsing
- **Tesseract.js** - OCR for scanned documents
- **XLSX** - Excel file parsing

## Project Structure

```
project/
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/              # Main application pages
│   ├── lib/                # Utilities and business logic
│   │   ├── api/           # API client functions
│   │   ├── claims/        # Claims management logic
│   │   ├── comparison/    # Quote comparison algorithms
│   │   ├── embeddings/    # Vector search functionality
│   │   ├── extraction/    # AI extraction logic
│   │   ├── import/        # Import/export utilities
│   │   ├── mapping/       # System mapping logic
│   │   ├── matching/      # Item matching algorithms
│   │   ├── normaliser/    # Data normalization
│   │   ├── parsers/       # File parsers (PDF, Excel)
│   │   ├── parsing/       # Quote parsing logic
│   │   ├── quoteIntelligence/ # AI analysis
│   │   ├── snapshot/      # Project snapshot management
│   │   ├── tradeAnalysis/ # Trade-level analysis
│   │   ├── validation/    # Data validation
│   │   └── variations/    # Variation detection
│   ├── types/             # TypeScript type definitions
│   ├── importer/          # Legacy importer logic
│   └── config/            # Configuration files
├── supabase/
│   ├── functions/         # Edge Functions
│   │   ├── chunk_pdf/           # PDF chunking
│   │   ├── chunk_xlsx/          # Excel chunking
│   │   ├── extract_quote_multi_model/ # Multi-model extraction
│   │   ├── extract_quote_textract/    # Textract extraction
│   │   ├── get_embedding/             # Generate embeddings
│   │   ├── parse_quote_llm_fallback/  # LLM fallback parser
│   │   ├── parse_quote_production/    # Production parser
│   │   ├── parse_quote_with_extractor/ # Extractor with auth
│   │   └── process_parsing_job/       # Background job processor
│   └── migrations/        # Database migrations
└── public/               # Static assets

```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- OpenAI API key (for AI features)
- Anthropic API key (optional, for fallback)

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Edge Functions require additional environment variables (set in Supabase Dashboard):
```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run database migrations:
```bash
# Migrations are applied via Supabase CLI or MCP tools
```

3. Deploy Edge Functions (if needed):
```bash
# Edge Functions are deployed via the mcp__supabase__deploy_edge_function tool
```

4. Start development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## Recent Updates

### Bug Fixes (Latest)
- Fixed "Project Files Missing" error by removing corrupted archive file
- Created missing `public/` directory required by Vite
- Added missing `vite.svg` favicon referenced in index.html
- Improved error handling in OrganisationContext to prevent crashes
- Added loading timeout mechanism to prevent infinite loading states
- Enhanced Supabase client configuration with explicit auth options
- Added comprehensive error logging throughout the application

### Error Handling Improvements
- Added ErrorBoundary component to catch and display React errors gracefully
- Wrapped async operations in try-catch blocks with proper error logging
- Improved database query error handling with fallback states
- Added user-friendly error messages for common failure scenarios

### Performance Improvements
- Implemented chunked file processing for large PDFs and Excel files
- Added background job processing via Edge Functions
- Optimized database queries with proper indexing
- Implemented caching for frequently accessed data

### Security Enhancements
- Row Level Security (RLS) enabled on all tables
- Proper authentication checks on all database operations
- Secure Edge Function authentication
- Input validation and sanitization

## Database Schema

### Core Tables
- `organisations` - Multi-tenant organization management
- `organisation_members` - User membership and roles
- `projects` - Construction projects
- `quotes` - Supplier quotes
- `line_items` - Individual quote line items
- `snapshots` - Project state snapshots
- `model_rates` - Reference pricing data
- `library_items` - Historical item library with embeddings
- `parsing_jobs` - Background parsing job tracking
- `parsing_chunks` - Chunked file data for processing

### Security
All tables have Row Level Security (RLS) policies to ensure:
- Users can only access data from their organization
- Proper authentication required for all operations
- Admin users have elevated permissions

## API & Edge Functions

### Available Edge Functions

1. **chunk_pdf** - Splits large PDFs into processable chunks
2. **chunk_xlsx** - Splits large Excel files into chunks
3. **extract_quote_multi_model** - Extracts data using multiple AI models
4. **extract_quote_textract** - AWS Textract-based extraction (optional)
5. **get_embedding** - Generates vector embeddings for similarity search
6. **parse_quote_llm_fallback** - LLM-based parsing for complex quotes
7. **parse_quote_production** - Production-grade parser with hybrid approach
8. **parse_quote_with_extractor** - Authenticated extraction endpoint
9. **process_parsing_job** - Background job processor
10. **ai_health** - Health check for AI services

### Calling Edge Functions

```typescript
const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/function_name`;

const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ /* your data */ })
});
```

## Development Guidelines

### Code Organization
- Keep files focused and under 300 lines when possible
- Use TypeScript for all new code
- Follow the single responsibility principle
- Group related functionality in dedicated directories

### Error Handling
- Always wrap async operations in try-catch blocks
- Log errors to console with context
- Provide user-friendly error messages
- Never expose sensitive information in error messages

### Security
- Never commit API keys or secrets
- Always use environment variables for configuration
- Enable RLS on all database tables
- Validate and sanitize all user inputs
- Use prepared statements for database queries

### Testing
- Write unit tests for business logic
- Test error handling paths
- Validate data types and constraints
- Test with production-like data

## Troubleshooting

### App Won't Load
1. Check browser console for errors
2. Verify environment variables are set correctly
3. Hard refresh the browser (Ctrl+Shift+R)
4. Check Supabase project is active and accessible
5. Verify database migrations have been applied

### Database Errors
1. Check RLS policies are configured correctly
2. Verify user has proper organization membership
3. Check database connection in Supabase dashboard
4. Review migration logs for errors

### AI Extraction Issues
1. Verify API keys are set in Supabase Edge Function secrets
2. Check Edge Function logs in Supabase dashboard
3. Ensure sufficient API credits/quota
4. Review extraction confidence scores

### Performance Issues
1. Check network tab for slow requests
2. Review database query performance
3. Consider implementing pagination for large datasets
4. Optimize image and file uploads

## License

Proprietary - All rights reserved

## Support

For issues or questions, please contact the development team.
