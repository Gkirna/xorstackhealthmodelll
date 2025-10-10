import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, PlusCircle, Calendar, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Sessions = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const upcomingSessions = [
    { 
      id: "1", 
      patientName: "Sarah Williams", 
      patientId: "MRN-234567",
      date: "2025-10-11", 
      time: "10:00 AM",
      appointmentType: "Follow-up",
      chiefComplaint: "Diabetes management"
    },
    { 
      id: "2", 
      patientName: "Michael Chen", 
      patientId: "MRN-345678",
      date: "2025-10-11", 
      time: "2:30 PM",
      appointmentType: "Annual Checkup",
      chiefComplaint: "Routine physical"
    },
  ];

  const pastSessions = [
    { 
      id: "3", 
      patientName: "John Doe", 
      patientId: "MRN-123456",
      date: "2025-10-09", 
      status: "completed",
      appointmentType: "Initial",
      chiefComplaint: "Chest pain"
    },
    { 
      id: "4", 
      patientName: "Jane Smith", 
      patientId: "MRN-987654",
      date: "2025-10-09", 
      status: "draft",
      appointmentType: "Follow-up",
      chiefComplaint: "Annual checkup"
    },
    { 
      id: "5", 
      patientName: "Robert Johnson", 
      patientId: "MRN-456789",
      date: "2025-10-08", 
      status: "completed",
      appointmentType: "Follow-up",
      chiefComplaint: "Hypertension"
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "draft": return "secondary";
      default: return "outline";
    }
  };

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
        <Tabs defaultValue="past" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upcoming" className="space-y-4 mt-6">
            {upcomingSessions.map((session) => (
              <Card key={session.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{session.patientName}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>{session.patientId}</span>
                        <span>•</span>
                        <span>{session.chiefComplaint}</span>
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{session.appointmentType}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{session.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{session.time}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => navigate(`/session/${session.id}/record`)}
                    >
                      Start Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {upcomingSessions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No upcoming sessions scheduled</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="past" className="space-y-4 mt-6">
            {pastSessions.map((session) => (
              <Card 
                key={session.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/session/${session.id}/review`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{session.patientName}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>{session.patientId}</span>
                        <span>•</span>
                        <span>{session.chiefComplaint}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{session.appointmentType}</Badge>
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
                      <span>{session.date}</span>
                    </div>
                    <Button variant="ghost" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Sessions;
