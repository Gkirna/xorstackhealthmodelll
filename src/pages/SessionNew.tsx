import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCreateSession } from "@/hooks/useSessions";
import { Loader2 } from "lucide-react";

const SessionNew = () => {
  const navigate = useNavigate();
  const createSession = useCreateSession();

  useEffect(() => {
    // Immediately create a new session and redirect to record page
    const createNewSession = async () => {
      try {
        const session = await createSession.mutateAsync({
          patient_name: "New Patient",
          scheduled_at: new Date().toISOString(),
        });

        navigate(`/session/${session.id}/record`, { replace: true });
      } catch (error) {
        console.error('Failed to create session:', error);
        navigate("/dashboard", { replace: true });
      }
    };

    createNewSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground text-lg">Creating new session...</p>
        </div>
      </div>
    </AppLayout>
  );
};

export default SessionNew;
