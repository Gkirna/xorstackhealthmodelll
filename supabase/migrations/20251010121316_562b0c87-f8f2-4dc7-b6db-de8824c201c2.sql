-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  specialty TEXT,
  license_number TEXT,
  organization TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create sessions table for clinical encounters
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_id TEXT,
  patient_dob DATE,
  visit_mode TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  generated_note TEXT,
  note_json JSONB,
  clinical_codes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Create session_transcripts table
CREATE TABLE IF NOT EXISTS public.session_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.session_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transcripts for their sessions"
  ON public.session_transcripts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = session_transcripts.session_id 
    AND sessions.user_id = auth.uid()
  ));

CREATE POLICY "Users can create transcripts for their sessions"
  ON public.session_transcripts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = session_transcripts.session_id 
    AND sessions.user_id = auth.uid()
  ));

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Create templates table
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

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

-- Create ai_logs table
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  model TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ai logs"
  ON public.ai_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
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

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exported-documents', 'exported-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio-recordings
CREATE POLICY "Users can upload their own audio recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-recordings' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own audio recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-recordings' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for exported-documents
CREATE POLICY "Users can upload their own exported documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exported-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own exported documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exported-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );