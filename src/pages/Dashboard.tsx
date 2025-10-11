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
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your clinical activity overview.</p>
          </div>
          <Button onClick={() => navigate("/session/new")} size="lg" className="shadow-md hover:shadow-lg transition-shadow">
            <PlusCircle className="mr-2 h-5 w-5" />
            New Session
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="transition-all hover:shadow-lg hover:-translate-y-1 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSessions}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-lg hover:-translate-y-1 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingTasks}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-lg hover:-translate-y-1 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTemplates}</div>
              <p className="text-xs text-muted-foreground">Ready to use</p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-lg hover:-translate-y-1 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisWeekSessions}</div>
              <p className="text-xs text-muted-foreground">Sessions completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Sessions</CardTitle>
                  <CardDescription>Your latest clinical encounters</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/sessions")}
                >
                  View all
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessionsLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : (
                  recentSessions.map((session) => (
                    <div 
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/session/${session.id}/review`)}
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{session.patient_name}</p>
                        <p className="text-sm text-muted-foreground">{session.chief_complaint || 'No complaint specified'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(session.status) as any}>
                          {session.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(session.created_at), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                {recentSessions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No sessions yet</p>
                    <Button 
                      variant="link" 
                      className="mt-2"
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Upcoming Tasks</CardTitle>
                  <CardDescription>Pending follow-ups and actions</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/tasks")}
                >
                  View all
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tasksLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : (
                  upcomingTasks.map((task) => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{task.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No due date'}
                        </div>
                      </div>
                      <Badge variant={getPriorityColor(task.priority) as any}>
                        {task.priority}
                      </Badge>
                    </div>
                  ))
                )}
                {upcomingTasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>All caught up!</p>
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
