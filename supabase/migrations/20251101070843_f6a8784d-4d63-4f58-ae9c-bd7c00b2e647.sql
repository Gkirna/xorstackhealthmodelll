-- Drop the restrictive insert policy for team members
DROP POLICY IF EXISTS "Users can insert pending invitations" ON public.team_members;

-- Create a new policy that allows:
-- 1. Team creators to add themselves as owners
-- 2. Team admins to invite others
CREATE POLICY "Users can add team members"
ON public.team_members
FOR INSERT
WITH CHECK (
  -- Allow if user is adding themselves to a team they created
  (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_members.team_id 
    AND teams.created_by = auth.uid()
  ))
  OR
  -- Allow if user is a team admin inviting someone
  (auth.uid() = invited_by AND is_team_admin(auth.uid(), team_id))
);