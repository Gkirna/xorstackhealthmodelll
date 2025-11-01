import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, PlusCircle, Calendar, FileText, Trash2, ChevronLeft, ChevronRight, UserRoundSearch, ListFilter, ArrowDownUp, RefreshCw, WandSparkles, Unlink } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

const Sessions = () => {
  const navigate = useNavigate();
  const { data: sessions = [], isLoading, refetch } = useSessions();
  const deleteSession = useDeleteSession();

  // Subscribe to real-time session updates for patient names
  useEffect(() => {
    const channel = supabase
      .channel('sessions-list-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
        },
        (payload) => {
          console.log('Session updated in list:', payload);
          refetch(); // Refetch sessions when any session updates
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);
  
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

  const upcomingSessions = filteredSessions.filter(s => {
    if (!s.scheduled_at) return false;
    const scheduledDate = new Date(s.scheduled_at);
    const now = new Date();
    return scheduledDate > now;
  });

  const pastSessions = filteredSessions.filter(s => {
    if (!s.scheduled_at) return true; // Sessions without scheduled_at go to Past
    const scheduledDate = new Date(s.scheduled_at);
    const now = new Date();
    return scheduledDate <= now;
  });

  // Group sessions by date
  const groupSessionsByDate = (sessions: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    sessions.forEach(session => {
      const date = new Date(session.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(session);
    });
    return grouped;
  };

  const groupedPastSessions = groupSessionsByDate(pastSessions);
  const groupedUpcomingSessions = groupSessionsByDate(upcomingSessions);

  const [showSessions, setShowSessions] = useState(false);

  return (
    <AppLayout>
      <div className="flex h-full flex-row overflow-hidden border-r duration-500 ease-out min-w-[220px]">

        {/* Sessions Sidebar Panel */}
        <div 
          className="flex h-full flex-col overflow-hidden overflow-y-auto border-r py-4 transition-all duration-300 ease-in-out sm:flex w-full min-w-[220px] px-2"
          data-testid="sidebar-session-list-panel"
        >
          <div className="flex h-full min-w-[200px] shrink-0 flex-col">
            <div className="flex size-full w-full min-w-[182px] flex-col">
              {/* Tabs */}
              <div className="w-full h-full flex flex-col">
                <div className="inline-flex items-center justify-center text-text-secondary h-fit w-full bg-transparent">
                  <button 
                    type="button" 
                    role="tab"
                    className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-2 text-sm font-medium transition-all duration-300 ease-in-out w-full rounded-none border-b-2 ${
                      activeTab === 'upcoming' 
                        ? 'bg-surface text-text-primary border-border-selected' 
                        : 'border-outline hover:bg-background-tertiary-hover hover:text-text-primary'
                    }`}
                    onClick={() => setActiveTab('upcoming')}
                  >
                    <p className="text-xs font-medium leading-snug tracking-normal">Schedule</p>
                  </button>
                  <button 
                    type="button" 
                    role="tab"
                    className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-2 text-sm font-medium transition-all duration-300 ease-in-out w-full rounded-none border-b-2 ${
                      activeTab === 'past' 
                        ? 'bg-surface text-text-primary border-border-selected' 
                        : 'border-outline hover:bg-background-tertiary-hover hover:text-text-primary'
                    }`}
                    onClick={() => setActiveTab('past')}
                  >
                    <p className="text-xs font-medium leading-snug tracking-normal">Past</p>
                  </button>
                </div>

                {/* Sessions Content */}
                <div className="flex-1 mt-2 overflow-hidden">
                  {activeTab === 'upcoming' ? (
                    <div className="h-full">
                      {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
                      ) : Object.keys(groupedUpcomingSessions).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p>No upcoming sessions scheduled</p>
                        </div>
                      ) : (
                        <div className="h-full overflow-y-auto">
                          {Object.entries(groupedUpcomingSessions).map(([date, sessions]) => (
                            <div key={date}>
                              <div className="p-1.5">
                                <p className="text-xs font-medium leading-snug tracking-normal text-text-secondary">{date}</p>
                              </div>
                              {sessions.map((session) => (
                                <div key={session.id} className="w-[calc(100%-4px)] mb-1">
                                  <a 
                                    href={`/session/${session.id}/record`}
                                    className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium tracking-normal leading-5 h-fit group relative w-full justify-between overflow-hidden transition-all duration-200 ease-in-out hover:pr-10 hover:bg-background-tertiary-hover hover:text-text-primary"
                                    title={session.patient_name}
                                  >
                                    <div className="absolute right-[0.9rem] flex h-full flex-row items-center opacity-0 transition-all delay-100 duration-200 ease-in-out group-hover:opacity-100">
                                      <input type="checkbox" className="size-4 shrink-0 rounded-sm border border-border-selected" />
                                    </div>
                                    <div className="flex w-full items-center gap-2">
                                      <span className="relative flex shrink-0 overflow-hidden rounded-full size-6 border-[0.75px] border-text-tertiary text-text-tertiary hover:border-border-selected hover:text-text-primary">
                                        <span className="size-full rounded-full text-sm w-full flex items-center justify-center bg-transparent">
                                          <Unlink className="h-3 w-3" />
                                        </span>
                                      </span>
                                      <div className="flex flex-1 flex-col overflow-hidden">
                                        <span className="flex w-fit max-w-full items-center gap-1">
                                          <p className="text-xs font-normal leading-snug tracking-normal max-w-full truncate">{session.patient_name}</p>
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <p className="text-[10px] font-normal leading-snug tracking-normal truncate text-text-secondary duration-200">
                                            {session.scheduled_at ? format(new Date(session.scheduled_at), 'h:mm a') : 'Not scheduled'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </a>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full">
                      {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
                      ) : Object.keys(groupedPastSessions).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p>No past sessions found</p>
                        </div>
                      ) : (
                        <div className="h-full overflow-y-auto">
                          {Object.entries(groupedPastSessions).map(([date, sessions]) => (
                            <div key={date}>
                              <div className="p-1.5">
                                <p className="text-xs font-medium leading-snug tracking-normal text-text-secondary">{date}</p>
                              </div>
                              {sessions.map((session) => (
                                <div key={session.id} className="w-[calc(100%-4px)] mb-1">
                                  <a 
                                    href={`/session/${session.id}/review`}
                                    className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium tracking-normal leading-5 h-fit group relative w-full justify-between overflow-hidden transition-all duration-200 ease-in-out hover:pr-10 hover:bg-background-tertiary-hover hover:text-text-primary"
                                    title={session.patient_name}
                                  >
                                    <div className="absolute right-[0.9rem] flex h-full flex-row items-center opacity-0 transition-all delay-100 duration-200 ease-in-out group-hover:opacity-100">
                                      <input type="checkbox" className="size-4 shrink-0 rounded-sm border border-border-selected" />
                                    </div>
                                    <div className="flex w-full items-center gap-2">
                                      <span className="relative flex shrink-0 overflow-hidden rounded-full size-6 border-[0.75px] border-text-tertiary text-text-tertiary hover:border-border-selected hover:text-text-primary">
                                        <span className="size-full rounded-full text-sm w-full flex items-center justify-center bg-transparent">
                                          {session.patient_name ? (
                                            <span className="text-xs font-normal tracking-normal leading-none">
                                              {session.patient_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </span>
                                          ) : (
                                            <Unlink className="h-3 w-3" />
                                          )}
                                        </span>
                                      </span>
                                      <div className="flex flex-1 flex-col overflow-hidden">
                                        <span className="flex w-fit max-w-full items-center gap-1">
                                          <p className="text-xs font-normal leading-snug tracking-normal max-w-full truncate">{session.patient_name || 'Untitled session'}</p>
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <p className="text-[10px] font-normal leading-snug tracking-normal truncate text-text-secondary duration-200">
                                            {format(new Date(session.created_at), 'h:mm a')}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </a>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action */}
                <div className="mt-auto">
                  <Button 
                    variant="outline" 
                    className="h-7 min-w-7 rounded-md px-2.5 py-2 text-xs font-medium tracking-normal leading-7 flex gap-3 text-text-secondary"
                  >
                    <WandSparkles className="h-3 w-3" />
                    <p className="text-xs font-medium leading-snug tracking-normal">Tidy up</p>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Shows current tab content (Tasks, New Session, Team, Settings, etc.) */}
        <div className="flex-1 flex flex-col">
          {/* This area shows the current tab content - Tasks, New Session, Team, Settings, etc. */}
          {/* The main area displays whatever tab is currently active */}
        </div>
      </div>
    </AppLayout>
  );
};

export default Sessions;
