import { Bell, HelpCircle, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const isNewSession = location.pathname.includes('/session/new') || location.pathname.includes('/session/') && location.pathname.includes('/record');
  const isSessions = location.pathname === '/sessions';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center bg-background border-b border-border shadow-sm">
      {/* Left: User Info */}
      <div className="flex items-center gap-4 px-6">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="text-sm font-medium text-foreground">
            {user?.email?.split('@')[0] || 'User'}
          </p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <div className="flex-1 flex justify-center">
        <Tabs value={isNewSession ? "new" : isSessions ? "sessions" : "new"} className="w-auto">
          <TabsList className="h-10 bg-transparent border-0">
            <TabsTrigger 
              value="new" 
              onClick={() => navigate('/session/new')}
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6"
            >
              New Session
            </TabsTrigger>
            <TabsTrigger 
              value="sessions" 
              onClick={() => navigate('/sessions')}
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6"
            >
              View Sessions
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Right: Action Icons */}
      <div className="flex items-center gap-2 px-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 rounded-full hover:bg-muted"
          onClick={() => navigate('/help')}
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 rounded-full hover:bg-muted"
          onClick={() => navigate('/help')}
        >
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
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
      </div>
    </header>
  );
}
