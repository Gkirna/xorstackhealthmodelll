import { 
  Home, 
  PlusCircle, 
  FolderOpen, 
  CheckSquare, 
  FileText, 
  Users, 
  Settings, 
  HelpCircle,
  Activity,
  Shield,
  Bell,
  User,
  ChevronLeft,
  ChevronRight,
  Search,
  ListFilter,
  ArrowDownUp,
  RefreshCw,
  Calendar,
  WandSparkles,
  Unlink,
  Check,
  Trash2,
  Plus
} from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useSessions, useDeleteSession } from "@/hooks/useSessions";
import { useNotifications } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "View sessions", url: "/sessions", icon: FolderOpen, hasChevron: true },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
];

const templateItems = [
  { title: "Template library", url: "/templates", icon: FileText },
  { title: "Community", url: "/community", icon: Users },
];

const bottomItems = [
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Help", url: "/help", icon: HelpCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [showSessions, setShowSessions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("past");
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  
  // Sessions data
  const { data: sessions = [], isLoading } = useSessions();
  const deleteSession = useDeleteSession();
  const { data: notifications = [] } = useNotifications();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (user) {
        const name = (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || "User";
        setUserName(name);
        setUserEmail(user.email || "");
      } else {
        setUserName("");
        setUserEmail("");
      }
    };
    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadUser());
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const initials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const second = parts[1]?.[0] || "";
    return (first + second).toUpperCase();
  };

  // Sessions filtering and grouping
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.patient_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.chief_complaint?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const upcomingSessions = filteredSessions.filter(s => 
    s.scheduled_at && new Date(s.scheduled_at) > new Date()
  );

  const pastSessions = filteredSessions.filter(s => 
    !s.scheduled_at || new Date(s.scheduled_at) <= new Date()
  );

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

  const currentSessions = activeTab === 'past' ? pastSessions : upcomingSessions;
  const allSelected = currentSessions.length > 0 && selectedSessions.length === currentSessions.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions(currentSessions.map(s => s.id));
    }
  };

  const handleSelectSession = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSessions(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedSessions.length === 0) return;
    
    try {
      await Promise.all(selectedSessions.map(id => deleteSession.mutateAsync(id)));
      setSelectedSessions([]);
      toast.success(`Deleted ${selectedSessions.length} session(s)`);
    } catch (error) {
      toast.error('Failed to delete sessions');
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Main Sidebar - Fixed and Minimal */}
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
          </div>

          {/* User block (hidden when collapsed) */}
          {!isCollapsed && (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {initials(userName) || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-popover">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex flex-col leading-tight min-w-0 text-left">
                <span className="font-medium truncate max-w-[200px]">{userName || 'User'}</span>
                {userEmail && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{userEmail}</span>
                )}
              </div>
            </div>
          )}

          {/* Controls on the right (always visible) */}
          <div className="flex items-center gap-2">
            <SidebarTrigger />
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {/* New Session Button + Notification - Prominent */}
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Button 
              asChild 
              className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground"
              size="lg"
            >
              <Link to="/session/new">
                <Plus className="h-4 w-4 mr-2" />
                New session
              </Link>
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="relative h-11 w-11">
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-96 p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-lg font-semibold">Notifications</h2>
                  </div>
                  <ScrollArea className="flex-1">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
                        <div className="mb-4 text-muted-foreground">
                          <svg className="w-20 h-20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Nothing to see here</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          No more notifications, you're free to focus on patient care.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-all cursor-pointer"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-medium text-sm mb-1">{notification.title}</p>
                                <p className="text-xs text-muted-foreground mb-2">{notification.message}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(notification.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.title === "View sessions" ? (
                    <SidebarMenuButton 
                      onClick={() => setShowSessions(!showSessions)}
                      className="w-full justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </div>
                      {item.hasChevron && (
                        showSessions ? (
                          <ChevronLeft className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )
                      )}
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "hover:bg-sidebar-accent/50"
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Templates Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Templates</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {templateItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>

    {/* Sessions Sidebar - Slides out when toggled */}
    {showSessions && (
      <div className="w-64 border-r bg-background flex flex-col h-full min-h-0 overflow-hidden transition-all duration-300 ease-in-out">
        {/* Header - Fixed */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Sessions</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowSessions(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Toolbar - Fixed */}
        <div className="flex h-6 items-center justify-between p-4 border-b flex-shrink-0">
          <div className="ml-auto hidden items-center gap-0.5 sm:flex">
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <ListFilter className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <ArrowDownUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <Search className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Search Input (Hidden by default) - Fixed */}
        <div className="overflow-hidden p-4 flex-shrink-0" style={{ opacity: 0, height: '0px' }}>
          <div className="flex h-fit items-center gap-2 rounded-md border border-solid border-border px-3 bg-transparent transition-all">
            <Search className="h-3.5 w-3.5 cursor-pointer text-xs text-text-secondary hover:text-text-primary" />
            <input 
              className="flex h-[38px] w-full truncate border-0 bg-transparent transition-colors placeholder:text-text-secondary focus-visible:outline-none text-base font-normal sm:h-7 sm:text-xs" 
              placeholder="Search" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs - Fixed */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="inline-flex items-center justify-center rounded-md p-1 text-text-secondary h-fit w-full bg-transparent py-0">
            <button 
              type="button" 
              role="tab"
              className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-all w-full rounded-none border-b-2 border-outline ${
                activeTab === 'upcoming' 
                  ? 'bg-surface text-text-primary border-border-selected' 
                  : 'hover:bg-background-tertiary-hover hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('upcoming')}
            >
              <p className="text-xs font-medium leading-snug tracking-normal">Schedule</p>
            </button>
            <button 
              type="button" 
              role="tab"
              className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-all w-full rounded-none border-b-2 border-outline ${
                activeTab === 'past' 
                  ? 'bg-surface text-text-primary border-border-selected' 
                  : 'hover:bg-background-tertiary-hover hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('past')}
            >
              <p className="text-xs font-medium leading-snug tracking-normal">Past</p>
            </button>
          </div>
        </div>

        {/* Sessions Content - Scrollable */}
        <div className="flex-1 p-4 min-h-0">
          <div className="sidebar-sessions-list max-h-full overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground text-xs">Loading sessions...</div>
            ) : (
              <div className="space-y-3">
                {activeTab === 'past' ? (
                  Object.keys(groupedPastSessions).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      <FileText className="h-6 w-6 mx-auto mb-2 opacity-20" />
                      <p>No past sessions found</p>
                    </div>
                  ) : (
                    Object.entries(groupedPastSessions).map(([date, sessions]) => (
                      <div key={date}>
                        <div className="p-1.5">
                          <p className="text-xs font-medium text-muted-foreground">{date}</p>
                        </div>
                        <div className="space-y-1">
                          {sessions.map((session) => (
                            <div
                              key={session.id}
                              className="p-2 rounded-md hover:bg-muted cursor-pointer group relative"
                            >
                              <div className="flex items-center gap-2" onClick={() => navigate(`/session/${session.id}/review`)}>
                                <Checkbox
                                  checked={selectedSessions.includes(session.id)}
                                  onClick={(e) => handleSelectSession(session.id, e as any)}
                                  className="shrink-0"
                                />
                                <span className="relative flex shrink-0 overflow-hidden rounded-full size-6 border-[0.75px] border-text-tertiary text-text-tertiary">
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
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">{session.patient_name || 'Untitled session'}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {format(new Date(session.created_at), 'h:mm a')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  Object.keys(groupedUpcomingSessions).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      <Calendar className="h-6 w-6 mx-auto mb-2 opacity-20" />
                      <p>No upcoming sessions scheduled</p>
                    </div>
                  ) : (
                    Object.entries(groupedUpcomingSessions).map(([date, sessions]) => (
                      <div key={date}>
                        <div className="p-1.5">
                          <p className="text-xs font-medium text-muted-foreground">{date}</p>
                        </div>
                        <div className="space-y-1">
                          {sessions.map((session) => (
                            <div
                              key={session.id}
                              className="p-2 rounded-md hover:bg-muted cursor-pointer group relative"
                            >
                              <div className="flex items-center gap-2" onClick={() => navigate(`/session/${session.id}/record`)}>
                                <Checkbox
                                  checked={selectedSessions.includes(session.id)}
                                  onClick={(e) => handleSelectSession(session.id, e as any)}
                                  className="shrink-0"
                                />
                                <span className="relative flex shrink-0 overflow-hidden rounded-full size-6 border-[0.75px] border-text-tertiary text-text-tertiary">
                                  <span className="size-full rounded-full text-sm w-full flex items-center justify-center bg-transparent">
                                    <Unlink className="h-3 w-3" />
                                  </span>
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">{session.patient_name}</div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {session.scheduled_at ? format(new Date(session.scheduled_at), 'h:mm a') : 'Not scheduled'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions - Fixed */}
        <div className="p-4 border-t flex-shrink-0 space-y-2">
          {selectedSessions.length > 0 ? (
            <>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 text-xs h-7"
                onClick={handleSelectAll}
              >
                <Check className="h-3 w-3" />
                {allSelected ? 'Deselect all' : 'Select all'}
              </Button>
              <Button 
                variant="destructive" 
                className="w-full justify-start gap-2 text-xs h-7"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-3 w-3" />
                Delete selected ({selectedSessions.length})
              </Button>
            </>
          ) : (
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 text-xs h-7"
            >
              <WandSparkles className="h-3 w-3" />
              Tidy up
            </Button>
          )}
        </div>
      </div>
    )}
    </div>
  );
}
