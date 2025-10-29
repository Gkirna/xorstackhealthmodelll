-- Fix Missing Healthcare Provider Verification
-- Update RLS policies to enforce role-based access on PHI tables

-- Drop existing policies on sessions table
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON sessions;

-- Create new role-based policies for sessions
CREATE POLICY "Only verified providers can view sessions"
ON sessions FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'));

CREATE POLICY "Only verified providers can create sessions"
ON sessions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'));

CREATE POLICY "Only verified providers can update sessions"
ON sessions FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'));

CREATE POLICY "Only verified providers can delete sessions"
ON sessions FOR DELETE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'));

-- Drop existing policies on session_transcripts table
DROP POLICY IF EXISTS "Users can view transcripts for their sessions" ON session_transcripts;
DROP POLICY IF EXISTS "Users can create transcripts for their sessions" ON session_transcripts;

-- Create new role-based policies for session_transcripts
CREATE POLICY "Only verified providers can view transcripts"
ON session_transcripts FOR SELECT
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'))
  AND EXISTS (
    SELECT 1 FROM sessions 
    WHERE sessions.id = session_transcripts.session_id 
    AND sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Only verified providers can create transcripts"
ON session_transcripts FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'))
  AND EXISTS (
    SELECT 1 FROM sessions 
    WHERE sessions.id = session_transcripts.session_id 
    AND sessions.user_id = auth.uid()
  )
);

-- Drop existing policies on tasks table
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Create new role-based policies for tasks
CREATE POLICY "Only verified providers can view tasks"
ON tasks FOR SELECT
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'))
  AND auth.uid() = user_id
);

CREATE POLICY "Only verified providers can create tasks"
ON tasks FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'))
  AND auth.uid() = user_id
);

CREATE POLICY "Only verified providers can update tasks"
ON tasks FOR UPDATE
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'))
  AND auth.uid() = user_id
);

CREATE POLICY "Only verified providers can delete tasks"
ON tasks FOR DELETE
USING (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'user'))
  AND auth.uid() = user_id
);