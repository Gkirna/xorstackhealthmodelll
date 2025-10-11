import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, PlusCircle, Calendar, FileText, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSessions, useDeleteSession } from "@/hooks/useSessions";
import { format } from "date-fns";

const Sessions = () => {
  const navigate = useNavigate();
  const { data: sessions = [], isLoading } = useSessions();
  const deleteSession = useDeleteSession();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("past");

  // Persist filter state
  useEffect(() => {
    const savedFilters = localStorage.getItem('sessionFilters');
    if (savedFilters) {
      const { status, tab } = JSON.parse(savedFilters);
      setFilterStatus(status || "all");
      setActiveTab(tab || "past");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sessionFilters', JSON.stringify({
      status: filterStatus,
      tab: activeTab
    }));
  }, [filterStatus, activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "draft": return "secondary";
      default: return "outline";
    }
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession.mutateAsync(id);
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.patient_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.chief_complaint?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || session.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const upcomingSessions = filteredSessions.filter(s => 
    s.scheduled_at && new Date(s.scheduled_at) > new Date()
  );

  const pastSessions = filteredSessions.filter(s => 
    !s.scheduled_at || new Date(s.scheduled_at) <= new Date()
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sessions</h1>
            <p className="text-muted-foreground">Manage your clinical encounter sessions</p>
          </div>
          <Button onClick={() => navigate("/session/new")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search patients, MRN, or complaints..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="finalized">Finalized</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sessions List */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="space-y-4 mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading sessions...</div>
            ) : upcomingSessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No upcoming sessions scheduled</p>
              </div>
            ) : (
              upcomingSessions.map((session) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl">{session.patient_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <span>{session.patient_id}</span>
                          {session.chief_complaint && (
                            <>
                              <span>•</span>
                              <span>{session.chief_complaint}</span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{session.appointment_type || 'General'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{session.scheduled_at ? format(new Date(session.scheduled_at), 'MMM d, yyyy h:mm a') : 'Not scheduled'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/session/${session.id}/record`);
                        }}
                      >
                        Start Session
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this session. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteSession(session.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          
          <TabsContent value="past" className="space-y-4 mt-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading sessions...</div>
            ) : pastSessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No past sessions found</p>
              </div>
            ) : (
              pastSessions.map((session) => (
                <Card 
                  key={session.id} 
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1" onClick={() => navigate(`/session/${session.id}/review`)}>
                        <CardTitle className="text-xl cursor-pointer">{session.patient_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <span>{session.patient_id}</span>
                          {session.chief_complaint && (
                            <>
                              <span>•</span>
                              <span>{session.chief_complaint}</span>
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{session.appointment_type || 'General'}</Badge>
                        <Badge variant={getStatusColor(session.status) as any}>
                          {session.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(session.created_at), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/session/${session.id}/review`)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this session and all associated data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteSession(session.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Sessions;
