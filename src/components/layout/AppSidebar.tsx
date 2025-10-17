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
  User
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
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
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "New Session", url: "/session/new", icon: PlusCircle },
  { title: "Sessions", url: "/sessions", icon: FolderOpen },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Templates", url: "/templates", icon: FileText },
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

  return (
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
            {!isCollapsed && <NotificationCenter />}
            <SidebarTrigger />
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
