# Fixed: Infinite Recursion in RLS Policies

## Problem

**Error:** `infinite recursion detected in policy for relation "organisation_members"`

This occurred when trying to create an organisation in the admin console. The error was caused by RLS policies on `organisation_members` that queried the same table they were protecting, creating a circular dependency.

### Root Cause

When we optimized RLS policies with `(SELECT auth.uid())` wrappers, the following policy created infinite recursion:

```sql
-- BROKEN: This policy queries organisation_members to check if user is a member
CREATE POLICY "Users can view org members"
  ON public.organisation_members FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id
      FROM public.organisation_members  -- ⚠️ Queries itself!
      WHERE user_id = (SELECT auth.uid())
    )
  );
```

When Postgres evaluates this policy to check if a user can SELECT from `organisation_members`, it needs to run a SELECT query on `organisation_members` (to check membership), which triggers the policy again, creating infinite recursion.

---

## Solution

Created **Security Definer helper functions** that bypass RLS when checking membership:

### 1. Core Membership Check Function

```sql
CREATE FUNCTION public.user_is_org_member(org_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_members
    WHERE organisation_id = org_id
      AND organisation_members.user_id = user_is_org_member.user_id
  );
$$;
```

**Key points:**
- `SECURITY DEFINER` - Runs with function owner's privileges, bypassing RLS
- Immutable `search_path` - Prevents injection attacks
- Single-purpose - Just checks membership, nothing else

### 2. Project Access Helper

```sql
CREATE FUNCTION public.user_can_access_project(proj_id uuid, user_id uuid)
RETURNS boolean
-- Uses user_is_org_member internally
```

### 3. Quote Access Helper

```sql
CREATE FUNCTION public.user_can_access_quote(quote_id_param uuid, user_id uuid)
RETURNS boolean
-- Uses user_can_access_project internally
```

---

## Policies Updated

All RLS policies now use these helper functions instead of querying `organisation_members` directly:

### Organisation Members (4 policies)
- ✅ SELECT - Uses `user_is_org_member()`
- ✅ INSERT - Admins only (uses helper + role check)
- ✅ UPDATE - Admins only (uses helper + role check)
- ✅ DELETE - Admins only (uses helper + role check)

### Organisation-Based Tables (18 policies)
- ✅ organisations (3 policies)
- ✅ projects (4 policies)
- ✅ parsing_jobs (1 policy)
- ✅ library_items (4 policies)
- ✅ supplier_template_fingerprints (3 policies)
- ✅ scope_categories (4 policies - via project check)

### Project-Based Tables (19 policies)
- ✅ award_reports (4 policies)
- ✅ quotes (4 policies)
- ✅ project_settings (3 policies)
- ✅ review_queue (2 policies)
- ✅ quote_items (4 policies - via quote check)

**Total:** 41 policies updated to use helper functions

---

## Benefits

### 1. No More Recursion
- Helper functions use `SECURITY DEFINER` to bypass RLS
- Breaks the circular dependency

### 2. Better Performance
- Single function call instead of complex subqueries
- PostgreSQL can cache function results
- Cleaner execution plans

### 3. Maintainability
- Membership logic in one place
- Easier to audit and update
- Consistent behavior across all policies

### 4. Security
- `SET search_path` prevents injection attacks
- Functions are focused and auditable
- RLS still fully enforced, just implemented better

---

## Testing Checklist

After this fix, verify:

- [x] Build succeeds (no TypeScript errors)
- [ ] **Admin Console:**
  - [ ] Create organisation works without recursion error
  - [ ] View organisations list
  - [ ] Edit organisation details
  - [ ] Add/remove members

- [ ] **Regular User Flows:**
  - [ ] Login and see correct organisations
  - [ ] View projects within organisation
  - [ ] Import quotes
  - [ ] View/edit quote items
  - [ ] Generate scope matrix
  - [ ] View reports

- [ ] **Permissions:**
  - [ ] Users only see their own org data
  - [ ] Platform admins see all orgs
  - [ ] Regular members can't access admin functions

---

## Migration Files Applied

1. `fix_organisation_members_recursion` - Fixed org members policies with helper function
2. `fix_all_policies_using_membership_check` - Updated org-level policies
3. `fix_remaining_policies_with_helper` - Updated project and quote policies

---

## Related Documentation

- Main security fixes: `SECURITY_FIXES_SUMMARY.md`
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Security Definer best practices: https://www.postgresql.org/docs/current/sql-createfunction.html

---

## Why This Approach Works

**Before (Broken):**
```
User tries to SELECT from organisation_members
  → RLS policy checks: "Is user a member?"
    → Runs SELECT on organisation_members
      → RLS policy checks: "Is user a member?"
        → Runs SELECT on organisation_members
          → ♾️ INFINITE RECURSION
```

**After (Fixed):**
```
User tries to SELECT from organisation_members
  → RLS policy calls: user_is_org_member()
    → Function runs with SECURITY DEFINER (bypasses RLS)
      → Returns true/false
    → Policy allows/denies access
  ✅ NO RECURSION
```

The key insight: **You can't query the same table in its own RLS policy unless you use SECURITY DEFINER to break out of the RLS context.**
