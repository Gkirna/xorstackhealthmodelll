-- ============================================
-- ADVANCED REAL-TIME NOTIFICATION SYSTEM
-- ============================================

-- 1. Add DELETE RLS Policy (Currently Missing!)
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" 
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- 2. Enable REPLICA IDENTITY FULL for better realtime updates
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 3. Add table to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 4. Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created 
ON public.notifications(user_id, is_read, created_at DESC);

-- 5. Create function to create session completion notifications
CREATE OR REPLACE FUNCTION public.create_session_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT;
BEGIN
  -- Only trigger when status CHANGES to review or completed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    
    -- Session completed with note
    IF NEW.status = 'completed' AND NEW.generated_note IS NOT NULL THEN
      notification_title := 'Session completed';
      notification_message := 'Clinical documentation for ' || COALESCE(NEW.patient_name, 'patient') || ' is ready';
      notification_type := 'success';
      
    -- Session ready for review
    ELSIF NEW.status = 'review' AND NEW.generated_note IS NOT NULL THEN
      notification_title := 'Note ready for review';
      notification_message := 'Clinical note for ' || COALESCE(NEW.patient_name, 'patient') || ' is ready for review';
      notification_type := 'info';
      
    -- Session interrupted
    ELSIF NEW.status = 'interrupted' THEN
      notification_title := 'Session interrupted';
      notification_message := 'Your session with ' || COALESCE(NEW.patient_name, 'patient') || ' was interrupted. You can resume later.';
      notification_type := 'warning';
      
    -- Session failed
    ELSIF NEW.status = 'failed' THEN
      notification_title := 'Session error';
      notification_message := 'An error occurred with the session for ' || COALESCE(NEW.patient_name, 'patient');
      notification_type := 'error';
      
    ELSE
      -- No notification for other status changes (draft, recording, etc.)
      RETURN NEW;
    END IF;
    
    -- Insert the notification
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      category,
      action_url,
      metadata
    ) VALUES (
      NEW.user_id,
      notification_title,
      notification_message,
      notification_type,
      'session',
      '/session/' || NEW.id || '/review',
      jsonb_build_object(
        'session_id', NEW.id,
        'patient_name', NEW.patient_name,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create trigger for session status changes
DROP TRIGGER IF EXISTS trigger_session_notification ON public.sessions;
CREATE TRIGGER trigger_session_notification
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_session_notification();