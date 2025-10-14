-- Fix team_members RLS infinite recursion by using security definer function
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Team admins can manage members" ON public.team_members;
DROP POLICY IF EXISTS "Users can view their team memberships" ON public.team_members;
DROP POLICY IF EXISTS "Users can insert pending invitations" ON public.team_members;

-- Policies using security definer function (already exists: is_team_admin)
CREATE POLICY "Users can view their team memberships"
ON public.team_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Team admins can manage members"
ON public.team_members
FOR ALL
TO authenticated
USING (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Users can insert pending invitations"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = invited_by);

-- Insert ready-to-use templates for immediate use
INSERT INTO public.templates (name, description, category, content, structure, is_community, is_active, user_id)
SELECT 
  'SOAP Note Template',
  'Standard Subjective, Objective, Assessment, Plan note format',
  'General',
  'SOAP Note Template for clinical documentation',
  '{"sections": ["Subjective", "Objective", "Assessment", "Plan"]}'::jsonb,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE name = 'SOAP Note Template');

INSERT INTO public.templates (name, description, category, content, structure, is_community, is_active, user_id)
SELECT 
  'Progress Note',
  'Track patient progress over multiple visits',
  'General',
  'Progress Note for ongoing patient care',
  '{"sections": ["Chief Complaint", "HPI", "Assessment", "Plan", "Follow-up"]}'::jsonb,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE name = 'Progress Note');

INSERT INTO public.templates (name, description, category, content, structure, is_community, is_active, user_id)
SELECT 
  'H&P Template',
  'Comprehensive History & Physical examination',
  'General',
  'Complete H&P documentation template',
  '{"sections": ["Chief Complaint", "History of Present Illness", "Past Medical History", "Medications", "Allergies", "Social History", "Family History", "Review of Systems", "Physical Examination", "Assessment", "Plan"]}'::jsonb,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE name = 'H&P Template');

INSERT INTO public.templates (name, description, category, content, structure, is_community, is_active, user_id)
SELECT 
  'Mental Health Assessment',
  'Psychiatric evaluation and mental status exam',
  'Psychiatry',
  'Mental Health Assessment Template',
  '{"sections": ["Presenting Problem", "Mental Status Exam", "Risk Assessment", "Diagnosis", "Treatment Plan"]}'::jsonb,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE name = 'Mental Health Assessment');

INSERT INTO public.templates (name, description, category, content, structure, is_community, is_active, user_id)
SELECT 
  'Procedure Note',
  'Document medical procedures performed',
  'Procedural',
  'Procedure documentation template',
  '{"sections": ["Indication", "Procedure", "Findings", "Complications", "Plan"]}'::jsonb,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE name = 'Procedure Note');

INSERT INTO public.templates (name, description, category, content, structure, is_community, is_active, user_id)
SELECT 
  'Pediatric Well-Child Visit',
  'Template for routine pediatric wellness visits',
  'Pediatrics',
  'Pediatric wellness visit documentation',
  '{"sections": ["Growth Parameters", "Development", "Nutrition", "Safety", "Immunizations", "Physical Exam", "Anticipatory Guidance"]}'::jsonb,
  true,
  true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.templates WHERE name = 'Pediatric Well-Child Visit');