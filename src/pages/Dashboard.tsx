import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, CheckSquare, FileText, PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSessions } from "@/hooks/useSessions";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { format } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: sessions = [] } = useSessions();
  const { data: tasks = [] } = useTasks();
  const { data: templates = [] } = useTemplates();

  const recentSessions = sessions.slice(0, 5);
  const pendingTasks = tasks.filter(t => t.status === 'pending').slice(0, 5);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Button onClick={() => navigate("/session/new")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sessions.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending').length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Templates</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sessions.filter(s => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(s.created_at) > weekAgo;
                }).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Sessions</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/sessions")}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No sessions yet</p>
                ) : (
                  recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent"
                      onClick={() => navigate(`/session/${session.id}/review`)}
                    >
                      <div>
                        <p className="font-medium">{session.patient_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(session.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge>{session.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pending Tasks</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No pending tasks</p>
                ) : (
                  pendingTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No due date'}
                        </p>
                      </div>
                      <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
                        {task.priority}
                      </Badge>
                    </div>
                  ))
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
