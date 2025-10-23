import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Calendar as CalendarIcon, Clipboard, Check, Link2, MessageSquare, FileText, Sparkles, CalendarDays } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { useTasks, useCreateTask, Task } from "@/hooks/useTasks";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type CategoryType = 'Order' | 'Coordinate' | 'Communicate' | 'Document' | 'Action';

const CATEGORY_CONFIG: Record<CategoryType, { icon: any; color: string }> = {
  'Action': { icon: Sparkles, color: 'text-blue-600' },
  'Communicate': { icon: MessageSquare, color: 'text-orange-600' },
  'Coordinate': { icon: CalendarDays, color: 'text-purple-600' },
  'Document': { icon: FileText, color: 'text-green-600' },
  'Order': { icon: Link2, color: 'text-pink-600' },
};

const Tasks = () => {
  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<Date | undefined>();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<CategoryType | "">("");

  const resetFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterCategory("all");
    setFilterDate(undefined);
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || 
                          (filterStatus === "pending" && task.status === "pending") ||
                          (filterStatus === "completed" && task.status === "completed") ||
                          (filterStatus === "cancelled" && task.status === "cancelled");
    const matchesCategory = filterCategory === "all" || task.category === filterCategory;
    const matchesDate = !filterDate || (task.due_date && new Date(task.due_date).toDateString() === filterDate.toDateString());
    return matchesSearch && matchesStatus && matchesCategory && matchesDate;
  });

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    await createTask.mutateAsync({
      title: newTaskTitle,
      category: newTaskCategory || undefined,
      priority: 'medium',
    });
    
    setNewTaskTitle("");
    setNewTaskCategory("");
    setIsCreateTaskOpen(false);
  };

  const getStatusLabel = (status: string) => {
    if (status === 'pending') return 'To Do';
    if (status === 'completed') return 'Done';
    if (status === 'cancelled') return 'Archived';
    return 'All';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Incomplete tasks will be archived after 30 days
            </p>
          </div>
          <Button 
            className="bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/90 text-white"
            onClick={() => setIsCreateTaskOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New task
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for a task or patient"
              className="pl-9 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                >
                  {getStatusLabel(filterStatus)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover">
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                  <span>All</span>
                  {filterStatus === "all" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("pending")}>
                  <span>To Do</span>
                  {filterStatus === "pending" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("completed")}>
                  <span>Done</span>
                  {filterStatus === "completed" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("cancelled")}>
                  <span>Archived</span>
                  {filterStatus === "cancelled" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Category</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                >
                  {filterCategory === "all" ? "All" : filterCategory}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover">
                <DropdownMenuItem onClick={() => setFilterCategory("all")}>
                  <span>All</span>
                  {filterCategory === "all" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
                  const Icon = config.icon;
                  return (
                    <DropdownMenuItem key={category} onClick={() => setFilterCategory(category)}>
                      <Icon className={cn("mr-2 h-4 w-4", config.color)} />
                      <span>{category}</span>
                      {filterCategory === category && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Date</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9"
                >
                  {filterDate ? format(filterDate, "MMM dd") : "All"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <Calendar
                  mode="single"
                  selected={filterDate}
                  onSelect={setFilterDate}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
                <div className="p-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setFilterDate(undefined)}
                  >
                    Reset
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={resetFilters}
          >
            Reset filters
          </Button>
        </div>

        {/* Tasks Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-6">
            <Clipboard className="h-24 w-24 text-muted-foreground/20" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">No tasks yet</h3>
              <p className="text-sm text-muted-foreground">
                Tasks saved from your sessions will appear here.
              </p>
            </div>
            <Button 
              className="bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/90 text-white"
              onClick={() => setIsCreateTaskOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create a new task
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>

      {/* Create Task Sheet */}
      <Sheet open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <SheetContent className="bg-background">
          <SheetHeader>
            <SheetTitle>Task title</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Enter task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {newTaskCategory || "Select category"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[300px] bg-popover">
                  {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
                    const Icon = config.icon;
                    return (
                      <DropdownMenuItem 
                        key={category} 
                        onClick={() => setNewTaskCategory(category as CategoryType)}
                      >
                        <Icon className={cn("mr-2 h-4 w-4", config.color)} />
                        <span>{category}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              className="w-full bg-muted hover:bg-muted/80 text-muted-foreground"
              disabled={!newTaskTitle.trim()}
              onClick={handleCreateTask}
            >
              Save task
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

// Task Row Component
function TaskRow({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <Checkbox checked={task.status === "completed"} />
      <div className="flex-1">
        <p className="font-medium text-sm">{task.title}</p>
      </div>
      {task.category && CATEGORY_CONFIG[task.category as CategoryType] && (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          {task.category}
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">
        {format(new Date(task.created_at), "MMM dd")}
      </span>
    </div>
  );
}

export default Tasks;
