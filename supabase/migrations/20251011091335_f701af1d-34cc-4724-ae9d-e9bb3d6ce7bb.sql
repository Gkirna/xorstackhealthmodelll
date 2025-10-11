-- Create user_preferences table for persistent settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Display preferences
  dark_mode BOOLEAN DEFAULT false,
  compact_sidebar BOOLEAN DEFAULT false,
  
  -- Default session preferences
  default_input_language TEXT DEFAULT 'en',
  default_output_language TEXT DEFAULT 'en',
  default_template_id UUID REFERENCES public.templates(id),
  auto_create_tasks BOOLEAN DEFAULT true,
  
  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  task_reminders BOOLEAN DEFAULT true,
  session_summaries BOOLEAN DEFAULT false,
  
  -- Beta features
  beta_features_enabled BOOLEAN DEFAULT false,
  advanced_ai_reasoning BOOLEAN DEFAULT false,
  multi_language_transcription BOOLEAN DEFAULT false,
  voice_commands BOOLEAN DEFAULT false,
  
  -- Coding preferences
  preferred_coding_system TEXT DEFAULT 'icd10',
  auto_suggest_codes BOOLEAN DEFAULT true,
  
  -- Data retention
  auto_delete_days INTEGER DEFAULT 90,
  
  -- Dashboard preferences
  dashboard_layout JSONB DEFAULT '{}',
  dashboard_filters JSONB DEFAULT '{}',
  
  -- Search history
  search_history JSONB DEFAULT '[]',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Enable RLS on user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies for user_preferences
CREATE POLICY "Users can view their own preferences" 
ON public.user_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
ON public.user_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
ON public.user_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic updated_at timestamp
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create team_members table for team collaboration
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create policies for team_members
CREATE POLICY "Users can view teams they are part of" 
ON public.team_members 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT user_id FROM public.team_members tm 
  WHERE tm.team_id = team_members.team_id
));

CREATE POLICY "Team owners and admins can manage members" 
ON public.team_members 
FOR ALL 
USING (auth.uid() IN (
  SELECT user_id FROM public.team_members tm 
  WHERE tm.team_id = team_members.team_id 
  AND tm.role IN ('owner', 'admin')
));

-- Create trigger for team_members
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create policies for teams
CREATE POLICY "Users can view teams they are members of" 
ON public.teams 
FOR SELECT 
USING (id IN (
  SELECT team_id FROM public.team_members 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Authenticated users can create teams" 
ON public.teams 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team owners can update teams" 
ON public.teams 
FOR UPDATE 
USING (id IN (
  SELECT team_id FROM public.team_members 
  WHERE user_id = auth.uid() AND role = 'owner'
));

-- Create trigger for teams
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key to team_members after teams table exists
ALTER TABLE public.team_members 
ADD CONSTRAINT team_members_team_id_fkey 
FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  category TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster notification queries
CREATE INDEX idx_notifications_user_id_created_at 
ON public.notifications(user_id, created_at DESC);

CREATE INDEX idx_notifications_user_id_is_read 
ON public.notifications(user_id, is_read);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to auto-create user preferences on signup
CREATE OR REPLACE FUNCTION public.create_user_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create preferences for new users
CREATE TRIGGER on_auth_user_created_preferences
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_user_preferences();