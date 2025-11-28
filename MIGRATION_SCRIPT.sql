-- ============================================
-- COMPLETE SUPABASE MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor FIRST
-- Then use the Chrome extension to migrate
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ============================================
-- STEP 1: CREATE ENUMS
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- ============================================
-- STEP 2: CREATE ALL TABLES
-- ============================================

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  specialty TEXT,
  license_number TEXT,
  organization TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Templates table
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  category TEXT,
  structure JSONB,
  is_shared BOOLEAN DEFAULT false NOT NULL,
  is_community BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_name TEXT NOT NULL,
  patient_id TEXT,
  patient_dob DATE,
  visit_mode TEXT,
  status TEXT DEFAULT 'draft' NOT NULL,
  summary TEXT,
  generated_note TEXT,
  chief_complaint TEXT,
  appointment_type TEXT,
  input_language TEXT DEFAULT 'en' NOT NULL,
  output_language TEXT DEFAULT 'en' NOT NULL,
  note_json JSONB,
  clinical_codes JSONB,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  transcript_quality_avg NUMERIC,
  total_words INTEGER DEFAULT 0,
  transcription_duration_seconds INTEGER,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- AI logs table (CRITICAL - must exist before other migrations)
CREATE TABLE public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  tokens_used INTEGER,
  duration_ms BIGINT,
  status TEXT DEFAULT 'success',
  error TEXT,
  function_name TEXT,
  input_hash TEXT,
  output_preview TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Session transcripts table
CREATE TABLE public.session_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp_offset INTEGER,
  confidence_score NUMERIC DEFAULT 0.95,
  processing_time_ms INTEGER,
  is_corrected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- User preferences table
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  dark_mode BOOLEAN DEFAULT false,
  compact_sidebar BOOLEAN DEFAULT false,
  default_template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  preferred_coding_system TEXT DEFAULT 'icd10',
  default_input_language TEXT DEFAULT 'en',
  default_output_language TEXT DEFAULT 'en',
  auto_create_tasks BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  task_reminders BOOLEAN DEFAULT true,
  session_summaries BOOLEAN DEFAULT false,
  beta_features_enabled BOOLEAN DEFAULT false,
  advanced_ai_reasoning BOOLEAN DEFAULT false,
  multi_language_transcription BOOLEAN DEFAULT false,
  voice_commands BOOLEAN DEFAULT false,
  auto_suggest_codes BOOLEAN DEFAULT true,
  auto_delete_days INTEGER DEFAULT 90,
  dashboard_layout JSONB DEFAULT '{}'::jsonb,
  dashboard_filters JSONB DEFAULT '{}'::jsonb,
  search_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Team members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' NOT NULL,
  category TEXT,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- System metrics table
CREATE TABLE public.system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User feedback table
CREATE TABLE public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check team admin
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role);
  
  RETURN NEW;
END;
$function$;

-- Function to create user preferences
CREATE OR REPLACE FUNCTION public.create_user_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Function to log sensitive operations
CREATE OR REPLACE FUNCTION public.log_sensitive_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.ai_logs (user_id, operation_type, model, status, metadata)
    VALUES (
      OLD.user_id,
      'session_deleted',
      NULL,
      'success',
      jsonb_build_object('session_id', OLD.id, 'patient_name', OLD.patient_name)
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- STEP 5: CREATE RLS POLICIES
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Templates policies
CREATE POLICY "Users can view their own templates"
ON public.templates FOR SELECT
USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "Users can create their own templates"
ON public.templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.templates FOR DELETE
USING (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY "Only verified providers can view sessions"
ON public.sessions FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role) OR 
  public.has_role(auth.uid(), 'user'::app_role)
);

CREATE POLICY "Only verified providers can create sessions"
ON public.sessions FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role) OR 
  public.has_role(auth.uid(), 'user'::app_role)
);

CREATE POLICY "Only verified providers can update sessions"
ON public.sessions FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role) OR 
  public.has_role(auth.uid(), 'user'::app_role)
);

CREATE POLICY "Only verified providers can delete sessions"
ON public.sessions FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'moderator'::app_role) OR 
  public.has_role(auth.uid(), 'user'::app_role)
);

-- AI logs policies
CREATE POLICY "Users can view their own ai logs"
ON public.ai_logs FOR SELECT
USING (auth.uid() = user_id);

-- Session transcripts policies
CREATE POLICY "Only verified providers can view transcripts"
ON public.session_transcripts FOR SELECT
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'moderator'::app_role) OR 
   public.has_role(auth.uid(), 'user'::app_role)) AND
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = session_transcripts.session_id 
      AND sessions.user_id = auth.uid()
  )
);

CREATE POLICY "Only verified providers can create transcripts"
ON public.session_transcripts FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'moderator'::app_role) OR 
   public.has_role(auth.uid(), 'user'::app_role)) AND
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = session_transcripts.session_id 
      AND sessions.user_id = auth.uid()
  )
);

-- Tasks policies
CREATE POLICY "Only verified providers can view tasks"
ON public.tasks FOR SELECT
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'moderator'::app_role) OR 
   public.has_role(auth.uid(), 'user'::app_role)) AND
  auth.uid() = user_id
);

CREATE POLICY "Only verified providers can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'moderator'::app_role) OR 
   public.has_role(auth.uid(), 'user'::app_role)) AND
  auth.uid() = user_id
);

CREATE POLICY "Only verified providers can update tasks"
ON public.tasks FOR UPDATE
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'moderator'::app_role) OR 
   public.has_role(auth.uid(), 'user'::app_role)) AND
  auth.uid() = user_id
);

CREATE POLICY "Only verified providers can delete tasks"
ON public.tasks FOR DELETE
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'moderator'::app_role) OR 
   public.has_role(auth.uid(), 'user'::app_role)) AND
  auth.uid() = user_id
);

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- User preferences policies
CREATE POLICY "Users can view their own preferences"
ON public.user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.user_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Teams policies
CREATE POLICY "Users can view teams they are members of"
ON public.teams FOR SELECT
USING (
  id IN (
    SELECT team_id FROM public.team_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create teams"
ON public.teams FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team owners can update teams"
ON public.teams FOR UPDATE
USING (
  id IN (
    SELECT team_id FROM public.team_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- Team members policies
CREATE POLICY "Users can view their team memberships"
ON public.team_members FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Team admins can manage members"
ON public.team_members FOR ALL
USING (public.is_team_admin(auth.uid(), team_id));

CREATE POLICY "Users can add team members"
ON public.team_members FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = team_members.team_id 
      AND teams.created_by = auth.uid()
  )) OR
  (auth.uid() = invited_by AND public.is_team_admin(auth.uid(), team_id))
);

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- System metrics policies
CREATE POLICY "Admins can view all metrics"
ON public.system_metrics FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert metrics"
ON public.system_metrics FOR INSERT
WITH CHECK (true);

-- User feedback policies
CREATE POLICY "Users can create feedback"
ON public.user_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their feedback"
ON public.user_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
ON public.user_feedback FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update feedback"
ON public.user_feedback FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- STEP 6: CREATE TRIGGERS
-- ============================================

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at
BEFORE UPDATE ON public.user_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auth triggers
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_preferences
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_user_preferences();

-- ============================================
-- STEP 7: CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_ai_logs_user_session ON public.ai_logs(user_id, session_id);
CREATE INDEX idx_ai_logs_created_at ON public.ai_logs(created_at DESC);
CREATE INDEX idx_sessions_user_status ON public.sessions(user_id, status, created_at DESC);
CREATE INDEX idx_session_transcripts_session_id ON public.session_transcripts(session_id);
CREATE INDEX idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX idx_system_metrics_type_created ON public.system_metrics(metric_type, created_at DESC);
CREATE INDEX idx_user_feedback_user_id ON public.user_feedback(user_id);
CREATE INDEX idx_user_feedback_status ON public.user_feedback(status);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_team_members_team_user ON public.team_members(team_id, user_id);

-- ============================================
-- STEP 8: CREATE STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('audio-recordings', 'audio-recordings', false),
  ('exported-documents', 'exported-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio-recordings
CREATE POLICY "Users can upload their own recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-recordings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-recordings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own recordings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-recordings' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for exported-documents
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exported-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exported-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exported-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- DONE! You can now run the migration extension
-- ============================================
