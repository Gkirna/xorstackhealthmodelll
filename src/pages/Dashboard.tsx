import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FolderOpen, 
  CheckSquare, 
  FileText, 
  PlusCircle, 
  ArrowRight,
  Clock,
  Calendar
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSessions } from "@/hooks/useSessions";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { format } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const { data: preferences } = useUserPreferences();

  const [dashboardLayout, setDashboardLayout] = useState<any>({});

  // Persist dashboard layout
  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
      setDashboardLayout(JSON.parse(savedLayout));
    }
  }, []);

  useEffect(() => {
    if (Object.keys(dashboardLayout).length > 0) {
      localStorage.setItem('dashboardLayout', JSON.stringify(dashboardLayout));
    }
  }, [dashboardLayout]);

  const recentSessions = sessions.slice(0, 3);
  const upcomingTasks = tasks
    .filter(t => t.status === 'pending')
    .slice(0, 3);

  const stats = {
    totalSessions: sessions.length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    activeTemplates: templates.length,
    thisWeekSessions: sessions.filter(s => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(s.created_at) > weekAgo;
    }).length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "draft": return "secondary";
      default: return "secondary";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Clinical activity overview</p>
          </div>
          <Button onClick={() => navigate("/session/new")} size="sm">
            <PlusCircle className="mr-1.5 h-4 w-4" />
            New Session
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Sessions</CardTitle>
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-1">
              <div className="text-xl font-semibold">{stats.totalSessions}</div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Pending Tasks</CardTitle>
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-1">
              <div className="text-xl font-semibold">{stats.pendingTasks}</div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Active Templates</CardTitle>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-1">
              <div className="text-xl font-semibold">{stats.activeTemplates}</div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">This Week</CardTitle>
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-1">
              <div className="text-xl font-semibold">{stats.thisWeekSessions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Sessions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Sessions</CardTitle>
                  <CardDescription className="text-xs">Latest clinical encounters</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/sessions")}
                  className="h-8 text-xs"
                >
                  View all
                  <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sessionsLoading ? (
                  <div className="text-center py-3 text-sm text-muted-foreground">Loading...</div>
                ) : (
                  recentSessions.map((session) => (
                    <div 
                      key={session.id}
                      className="flex items-center justify-between p-2.5 rounded-md border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/session/${session.id}/review`)}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{session.patient_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{session.chief_complaint || 'No complaint specified'}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <Badge variant={getStatusColor(session.status) as any} className="text-xs px-2 py-0">
                          {session.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(session.created_at), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                {recentSessions.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No sessions yet</p>
                    <Button 
                      variant="link" 
                      className="mt-1 text-xs h-auto p-0"
                      onClick={() => navigate("/session/new")}
                    >
                      Create your first session
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Upcoming Tasks</CardTitle>
                  <CardDescription className="text-xs">Pending follow-ups and actions</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/tasks")}
                  className="h-8 text-xs"
                >
                  View all
                  <ArrowRight className="ml-1.5 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasksLoading ? (
                  <div className="text-center py-3 text-sm text-muted-foreground">Loading...</div>
                ) : (
                  upcomingTasks.map((task) => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between p-2.5 rounded-md border hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">
                            {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No due date'}
                          </span>
                        </div>
                      </div>
                      <Badge variant={getPriorityColor(task.priority) as any} className="text-xs px-2 py-0 ml-2 flex-shrink-0">
                        {task.priority}
                      </Badge>
                    </div>
                  ))
                )}
                {upcomingTasks.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">All caught up!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
