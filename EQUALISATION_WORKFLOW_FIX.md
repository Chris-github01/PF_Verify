# Equalisation Workflow Step Fix

## Problem

The Scope Matrix page was skipping the **Equalisation** step and going directly to Reports when clicking "Next: Equalisation". This broke the intended 6-step workflow.

### Original Flow (Broken)
1. Import Quotes
2. Review & Clean
3. Quote Intelligence
4. Scope Matrix → **SKIPPED TO REPORTS** ❌
5. ~~Equalisation~~ (missing)
6. Award Report

## Root Cause

The Equalisation page existed (`src/pages/Equalisation.tsx`) and was defined in the Navigation component, but it was **not wired up** in the main App routing logic.

### Issues Found

1. **Missing Route Handler**: No `case 'equalisation':` in `App.tsx`
2. **Wrong Navigation**: Scope Matrix navigated to `'reports'` instead of `'equalisation'`
3. **Missing Dependencies**: Equalisation page referenced non-existent modules
4. **Incorrect Step Numbers**: Workflow showed "Step 5 of 5" instead of proper numbering

## Changes Made

### 1. Added Equalisation Import to App.tsx

```typescript
// src/App.tsx
import Equalisation from './pages/Equalisation';
```

### 2. Added Equalisation Route Case

```typescript
// src/App.tsx line 464-487
case 'equalisation':
  if (!projectId) {
    return <NewProjectDashboard ... />;
  }
  return <Equalisation
    projectId={projectId}
    onNavigateBack={() => setActiveTab('scope')}
    onNavigateNext={() => setActiveTab('reports')}
  />;
```

### 3. Fixed Scope Matrix Navigation

**Before:**
```typescript
return <ScopeMatrix
  projectId={projectId}
  onNavigateBack={() => setActiveTab('quoteintel')}
  onNavigateNext={() => setActiveTab('reports')}  // ❌ Wrong!
/>;
```

**After:**
```typescript
return <ScopeMatrix
  projectId={projectId}
  onNavigateBack={() => setActiveTab('quoteintel')}
  onNavigateNext={() => setActiveTab('equalisation')}  // ✅ Correct!
/>;
```

### 4. Updated Step Numbers

**Scope Matrix** (`src/pages/ScopeMatrix.tsx:1208-1209`):
```typescript
<WorkflowNav
  currentStep={4}
  totalSteps={6}  // Changed from default 5
  onBack={onNavigateBack}
  onNext={onNavigateNext}
  backLabel="Back: Quote Intelligence"
  nextLabel="Next: Equalisation"
/>
```

**Equalisation** (`src/pages/Equalisation.tsx:520-527`):
```typescript
<WorkflowNav
  currentStep={5}
  totalSteps={6}
  onBack={onNavigateBack}
  onNext={onNavigateNext}
  backLabel="Back: Scope Matrix"
  nextLabel="Next: Award Report"
/>
```

### 5. Created Missing Equalisation Modules

#### Created Type Definitions
**File**: `src/types/equalisation.types.ts`

Defines:
- `EqualisationMode`: 'MODEL' | 'PEER_MEDIAN'
- `EqualisationLogEntry`: Log of equalisation adjustments
- `SupplierTotal`: Supplier totals before/after equalisation
- `EqualisationResult`: Complete equalisation result

#### Created Equalisation Logic
**File**: `src/lib/equalisation/buildEqualisation.ts`

Implements equalisation algorithm that:
1. Identifies missing scope items per supplier
2. Fills gaps using model rates or peer median rates
3. Calculates adjusted supplier totals
4. Generates detailed log of all adjustments

### 6. Fixed Missing Import
Changed `compareAgainstModel` to `compareAgainstModelHybrid` (the actual function that exists).

## Complete Workflow (Fixed)

```
1. Import Quotes        → Step 1 of 6
2. Review & Clean       → Step 2 of 6
3. Quote Intelligence   → Step 3 of 6
4. Scope Matrix         → Step 4 of 6
5. Equalisation         → Step 5 of 6 ✅ NOW WORKS!
6. Award Report         → Step 6 of 6
```

## What Equalisation Does

**Purpose**: Ensures fair comparison by filling scope gaps

When suppliers quote different items, comparison is unfair. Equalisation adds missing items to each supplier using either:

- **MODEL mode**: Uses configured model rates for missing items
- **PEER_MEDIAN mode**: Uses median rate from other suppliers for missing items

### Example

**Before Equalisation:**
- Supplier A quoted 50 items: $100,000
- Supplier B quoted 45 items: $95,000 (missing 5 systems)

**After Equalisation (MODEL mode):**
- Supplier A: $100,000 (no change)
- Supplier B: $95,000 + $8,000 (5 missing systems) = $103,000

Now you can fairly compare: Supplier A ($100k) vs Supplier B ($103k)

## UI Features

The Equalisation page provides:

1. **Mode Selection**: Toggle between MODEL and PEER_MEDIAN
2. **Data Status Panel**: Shows coverage of model rates
3. **Supplier Totals Table**: Before/after comparison with adjustments
4. **Equalisation Log**: Detailed list of all filled items
5. **Export to CSV**: Download complete log for audit trail
6. **Workflow Navigation**: Consistent back/next buttons

## Testing

To verify the fix:

1. Navigate to Scope Matrix
2. Generate a scope matrix
3. Click "Next: Equalisation"
4. ✅ Should land on Equalisation page (not Reports)
5. Select equalisation mode
6. Review supplier totals
7. Click "Next: Award Report"
8. ✅ Should land on Award Report

## Build Status

✅ Build successful with no errors
✅ All TypeScript types defined
✅ Equalisation logic implemented
✅ Workflow navigation complete

## Files Changed

1. `src/App.tsx` - Added equalisation route and import
2. `src/pages/ScopeMatrix.tsx` - Fixed navigation and step number
3. `src/pages/Equalisation.tsx` - Added WorkflowNav, fixed imports
4. `src/types/equalisation.types.ts` - Created (new file)
5. `src/lib/equalisation/buildEqualisation.ts` - Created (new file)

## Summary

The workflow now properly includes the Equalisation step between Scope Matrix and Award Report. This ensures users can equalise scope gaps before generating final award reports, making the comparison fair and accurate.

**Before**: Scope Matrix → Reports (broken workflow)
**After**: Scope Matrix → Equalisation → Reports (complete workflow) ✅
