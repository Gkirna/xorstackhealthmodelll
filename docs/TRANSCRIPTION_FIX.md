# Fix for Live Transcription Save Errors

## Problem
The live transcription feature is showing repeated error messages: "Failed to save your transcripts after multiple attempts" because the `session_transcripts` database table doesn't exist.

## Solution
A new migration file has been created to add the missing table.

## Steps to Apply the Fix

### 1. Apply the Database Migration

The migration file is located at:
```
supabase/migrations/20251015000000_add_session_transcripts.sql
```

#### Option A: Using Supabase CLI (Local)
```bash
# If you're using local Supabase
supabase db push
```

#### Option B: Using Supabase Dashboard (Remote)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of the migration file
4. Run the SQL script

#### Option C: Using Supabase CLI for Remote Projects
```bash
# Link your remote project first
supabase link --project-ref your-project-ref

# Push the migration
supabase db push
```

### 2. Verify the Migration

After applying the migration, verify the table exists:

```sql
SELECT * FROM session_transcripts LIMIT 1;
```

You should see the table structure with no errors.

## What Was Fixed

1. **Created `session_transcripts` table** with proper schema:
   - `id` - UUID primary key
   - `session_id` - Foreign key to sessions table
   - `text` - Transcript text
   - `speaker` - Speaker identifier (provider/patient)
   - `timestamp_offset` - Timestamp for ordering
   - `created_at` - Creation timestamp

2. **Added Row Level Security (RLS) policies**:
   - Users can only view/modify transcripts for their own sessions
   - Proper access control for security

3. **Improved error handling** in `useTranscription.tsx`:
   - Detects when table doesn't exist
   - Shows error only once (no spam)
   - Stores failed transcripts in localStorage for recovery
   - Clears cache on successful save

4. **Added indexes** for better performance

## How It Works

- Live transcription chunks are saved to the database in real-time
- If database connection fails, transcripts are cached locally in localStorage
- Once connection is restored, cached transcripts can be manually retried
- Transcripts are displayed in the UI even if database save failed

## Testing

After applying the migration:
1. Start a new recording session
2. Speak into the microphone
3. Verify transcripts appear in the UI
4. Check the browser console for "✅ Transcript saved successfully" messages
5. No error toasts should appear

## Troubleshooting

If you still see errors after applying the migration:

1. **Check database connection**:
   - Verify your Supabase credentials in `.env` file
   - Test connection in Supabase dashboard

2. **Check RLS policies**:
   - Ensure your user account has proper permissions
   - Verify the session belongs to the authenticated user

3. **Check browser console**:
   - Look for specific error messages
   - Share error details if issues persist

4. **Clear browser cache**:
   - The app caches failed transcripts in localStorage
   - Clear cache to start fresh

## Recovery of Cached Transcripts

If transcripts were cached locally before the fix was applied, they can be recovered:

```javascript
// In browser console:
const failedChunks = localStorage.getItem('failed_transcripts_YOUR_SESSION_ID');
console.log(JSON.parse(failedChunks));
```

You can then manually save these transcripts if needed.

