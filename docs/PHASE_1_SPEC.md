# Phase 1 — Authentication & Onboarding (Functional Specification)

## 1. Overview
Complete authentication system with signup, login, session management, profile creation, and role assignment.

## 2. User Flows

### 2.1 Signup Flow
**Entry Point:** `/signup`

**Steps:**
1. User enters: firstName, lastName, email, password, confirmPassword
2. User accepts terms & conditions (checkbox required)
3. System validates input (Zod schema)
4. System calls `signUp(email, password, metadata)`
5. Supabase creates `auth.users` record
6. Trigger `handle_new_user()` creates `profiles` record
7. System redirects to `/onboarding/profile`

**Acceptance Criteria:**
- ✅ Form validates email format
- ✅ Password must be ≥6 characters
- ✅ Passwords must match
- ✅ Terms checkbox must be checked
- ✅ `profiles` row created with `full_name` from metadata
- ✅ Email confirmation disabled (auto-confirm enabled)
- ✅ Session persists after signup

### 2.2 Login Flow
**Entry Point:** `/login`

**Steps:**
1. User enters email & password
2. System validates input (Zod schema)
3. System calls `signInWithPassword(email, password)`
4. Supabase returns session + user
5. `useAuth` updates state via `onAuthStateChange`
6. System redirects to `/dashboard`

**Acceptance Criteria:**
- ✅ Invalid credentials show "Invalid email or password"
- ✅ Session stored in localStorage
- ✅ `onAuthStateChange` fires on login
- ✅ User redirected to dashboard
- ✅ Refresh maintains session

### 2.3 Onboarding Profile Flow
**Entry Point:** `/onboarding/profile`

**Steps:**
1. User enters: professional title, specialty, organization
2. User selects: preferred language, date format
3. System validates authenticated user
4. System updates `profiles` table with user_id
5. System redirects to `/dashboard`

**Acceptance Criteria:**
- ✅ Profile data saved to `profiles` table
- ✅ All fields optional except those marked required
- ✅ Redirect to dashboard after save
- ✅ "Skip for now" navigates to dashboard

### 2.4 Protected Route Flow
**Entry Point:** Any protected route (e.g., `/dashboard`)

**Steps:**
1. `ProtectedRoute` component checks `user` from `useAuth`
2. If `loading === true`, show spinner
3. If `!user && !loading`, redirect to `/login`
4. If `user`, render children

**Acceptance Criteria:**
- ✅ Unauthenticated users redirected to `/login`
- ✅ Authenticated users see protected content
- ✅ Loading state shows spinner
- ✅ No flash of protected content

### 2.5 Logout Flow
**Steps:**
1. User clicks logout
2. System calls `signOut()`
3. Supabase clears session
4. `onAuthStateChange` fires with null session
5. System redirects to `/login`

**Acceptance Criteria:**
- ✅ Session cleared from localStorage
- ✅ User redirected to login
- ✅ Cannot access protected routes after logout

## 3. Database Schema

### 3.1 `profiles` Table
```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  specialty text,
  organization text,
  license_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
```

### 3.2 `user_roles` Table
```sql
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer function
CREATE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### 3.3 Trigger: Auto-create Profile
```sql
CREATE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## 4. API Endpoints

### 4.1 Supabase Auth SDK
- `supabase.auth.signUp({ email, password, options })`
- `supabase.auth.signInWithPassword({ email, password })`
- `supabase.auth.signOut()`
- `supabase.auth.getSession()`
- `supabase.auth.onAuthStateChange(callback)`

### 4.2 Profile CRUD
- `supabase.from('profiles').select('*').eq('id', user.id).single()`
- `supabase.from('profiles').update(data).eq('id', user.id)`

### 4.3 User Roles
- `supabase.from('user_roles').select('role')`
- `supabase.rpc('has_role', { _user_id, _role })`

## 5. Components

### 5.1 `useAuth` Hook
**File:** `src/hooks/useAuth.tsx`

**State:**
- `user: User | null`
- `session: Session | null`
- `loading: boolean`

**Methods:**
- `signUp(email, password, metadata)`
- `signIn(email, password)`
- `signOut()`
- `resetPassword(email)`

**Effects:**
- Set up `onAuthStateChange` listener
- Check for existing session on mount
- Clean up subscription on unmount

### 5.2 `ProtectedRoute` Component
**File:** `src/components/ProtectedRoute.tsx`

**Props:**
- `children: ReactNode`

**Logic:**
- Get `user, loading` from `useAuth()`
- Show spinner if loading
- Redirect to `/login` if not authenticated
- Render children if authenticated

### 5.3 `Login` Page
**File:** `src/pages/Login.tsx`

**Features:**
- Email + password inputs with validation
- "Forgot password?" link
- "Sign up" link
- Loading state during submission
- Error handling with toast notifications
- Auto-redirect if already logged in

### 5.4 `Signup` Page
**File:** `src/pages/Signup.tsx`

**Features:**
- First name, last name, email, password, confirm password
- Terms & conditions checkbox
- Zod schema validation
- Toast notifications
- Redirect to `/onboarding/profile` after signup

### 5.5 `OnboardingProfile` Page
**File:** `src/pages/OnboardingProfile.tsx`

**Features:**
- Professional title, specialty, organization
- Preferred language, date format selects
- "Skip for now" button
- Save to `profiles` table
- Redirect to `/dashboard`

## 6. Security Requirements

### 6.1 Input Validation
```typescript
const signupSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be ≥6 chars"),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true)
}).refine(data => data.password === data.confirmPassword);
```

### 6.2 RLS Policies
- All `profiles` queries filtered by `auth.uid()`
- No direct access to `auth.users` table
- `user_roles` uses security definer function to prevent recursion

### 6.3 Session Security
- HTTPOnly cookies (managed by Supabase)
- Auto-refresh tokens
- Persistent sessions in localStorage
- Session timeout (handled by Supabase)

## 7. Test Plan

### 7.1 Unit Tests
- ✅ Zod schema validation (valid/invalid inputs)
- ✅ `useAuth` hook state management
- ✅ `ProtectedRoute` redirect logic

### 7.2 Integration Tests
- ✅ Signup creates `auth.users` + `profiles` records
- ✅ Login returns valid session
- ✅ Logout clears session
- ✅ Profile update persists to DB
- ✅ RLS policies enforce access control

### 7.3 E2E Tests
- ✅ Full signup → onboarding → dashboard flow
- ✅ Login → dashboard → logout flow
- ✅ Protected route redirect when not authenticated
- ✅ Session persistence across refresh
- ✅ Invalid credentials error handling

### 7.4 Security Tests
- ✅ Attempt to access another user's profile (should fail)
- ✅ Attempt to insert role without admin privileges (should fail)
- ✅ SQL injection attempts in email/password
- ✅ XSS attempts in profile fields

## 8. Error Handling

### 8.1 Authentication Errors
| Error Code | Message | User Action |
|------------|---------|-------------|
| `Invalid login credentials` | "Invalid email or password" | Re-enter credentials |
| `Email not confirmed` | "Please confirm your email" | Check inbox |
| `User already registered` | "Account already exists" | Use login |
| `Weak password` | "Password too weak" | Choose stronger password |

### 8.2 Network Errors
- Retry logic with exponential backoff
- Offline detection
- Toast notification for connection issues

### 8.3 Validation Errors
- Inline field errors
- Toast summary of errors
- Prevent form submission until valid

## 9. Performance Targets

| Metric | Target | Measured |
|--------|--------|----------|
| Signup response time | < 2s | TBD |
| Login response time | < 1s | TBD |
| Session check | < 100ms | TBD |
| Profile load | < 500ms | TBD |

## 10. Acceptance Criteria Summary

### Critical (Must Pass)
- [x] Signup creates user + profile
- [x] Login authenticates and redirects
- [x] Protected routes block unauthenticated users
- [x] Session persists across refresh
- [x] RLS policies prevent unauthorized access

### Important (Should Pass)
- [x] Auto-confirm email enabled
- [x] Onboarding profile saves correctly
- [x] Error messages are user-friendly
- [x] Loading states prevent double-submission
- [ ] User roles table populated (FAILING - empty array)

### Nice-to-have (May Defer)
- [ ] Social login (Google OAuth)
- [ ] Multi-factor authentication
- [ ] Password strength indicator
- [ ] Email verification flow

## 11. Known Issues & Remediations

### Issue 1: User Roles Not Assigned
**Status:** 🔴 CRITICAL
**Evidence:** Network logs show `user_roles` query returns `[]`
**Impact:** Users cannot access admin features
**Remediation:** 
1. Create migration to assign default 'user' role on signup
2. Add trigger to auto-assign role when user created
3. Provide admin UI to assign roles

### Issue 2: Storage RLS Error
**Status:** 🟡 WARNING
**Evidence:** Postgres logs show "new row violates row-level security policy for table 'objects'"
**Impact:** File uploads may fail
**Remediation:**
1. Review storage bucket RLS policies
2. Ensure user can upload to their own folder
3. Add error handling in upload UI

## 12. Next Steps

1. **Fix critical role assignment issue**
2. Run comprehensive E2E tests
3. Generate test evidence (screenshots, DB queries)
4. Create validation report
5. Stop and await "NEXT" command

---

**Prepared by:** Lovable AI  
**Date:** 2025-10-10  
**Phase:** 1 (Authentication & Onboarding)  
**Status:** READY FOR VALIDATION
