-- Fix infinite recursion in team_members RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Team owners and admins can manage members" ON public.team_members;
DROP POLICY IF EXISTS "Users can view teams they are part of" ON public.team_members;

-- Create a security definer function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Create new policies using the security definer function
CREATE POLICY "Users can view their team memberships"
ON public.team_members
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Team admins can manage members"
ON public.team_members
FOR ALL
USING (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Users can insert pending invitations"
ON public.team_members
FOR INSERT
WITH CHECK (auth.uid() = invited_by);

-- Add default templates
INSERT INTO public.templates (user_id, name, description, content, category, is_community, is_shared)
VALUES 
  (
    (SELECT id FROM auth.users LIMIT 1),
    'SOAP Note',
    'Standard Subjective, Objective, Assessment, Plan format',
    'SUBJECTIVE:\n\nOBJECTIVE:\n\nASSESSMENT:\n\nPLAN:\n',
    'General',
    true,
    true
  ),
  (
    (SELECT id FROM auth.users LIMIT 1),
    'Progress Note',
    'Track patient progress over time',
    'Patient Name: {{patient_name}}\nDate: {{date}}\n\nProgress:\n\nIntervention:\n\nResponse:\n\nNext Steps:\n',
    'General',
    true,
    true
  ),
  (
    (SELECT id FROM auth.users LIMIT 1),
    'Mental Health Assessment',
    'Comprehensive mental health evaluation',
    'MENTAL STATUS EXAMINATION:\nAppearance:\nBehavior:\nSpeech:\nMood:\nAffect:\nThought Process:\nThought Content:\nCognition:\nInsight:\nJudgment:\n\nASSESSMENT:\n\nPLAN:\n',
    'Mental Health',
    true,
    true
  ),
  (
    (SELECT id FROM auth.users LIMIT 1),
    'Diabetes Visit Note',
    'Structured note for diabetes management',
    'DIABETES MANAGEMENT:\nHbA1c: \nBlood Glucose Readings:\nMedications:\nComplications Screen:\nSelf-Management:\n\nASSESSMENT:\n\nPLAN:\n',
    'Specialty',
    true,
    true
  )
ON CONFLICT DO NOTHING;