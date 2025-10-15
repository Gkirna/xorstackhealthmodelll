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
  Shield
} from "lucide-react";
import { NavLink } from "react-router-dom";
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

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-sidebar-border"
      style={{ width: isCollapsed ? '64px' : '240px' }}
    >
      <SidebarHeader className="border-b border-sidebar-border p-4 h-14">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          {!isCollapsed && (
            <span className="font-semibold text-base">Heidi Scribe</span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "relative bg-transparent text-primary font-medium border-l-4 border-primary pl-4"
                          : "hover:bg-sidebar-accent/50 pl-5"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
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
                          ? "relative bg-transparent text-primary font-medium border-l-4 border-primary pl-4"
                          : "hover:bg-sidebar-accent/50 pl-5"
                      }
                    >
                      <Shield className="h-4 w-4" />
                      {!isCollapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Secondary Actions */}
        {!isCollapsed && (
          <SidebarGroup className="mt-auto pb-4">
            <SidebarGroupLabel className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Resources
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton className="bg-warning/30 text-warning-foreground hover:bg-warning/40">
                    <span className="text-sm">Feature Request</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
