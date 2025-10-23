import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Calendar as CalendarIcon, Clipboard, Check, Link2, MessageSquare, FileText, Sparkles, CalendarDays, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useDeleteAllTasks, Task } from "@/hooks/useTasks";
import { format, formatDistanceToNow } from "date-fns";
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
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteAllTasks = useDeleteAllTasks();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<Date | undefined>();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
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

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTask.mutateAsync({
      id: task.id,
      updates: {
        status: newStatus,
      },
    });
  };

  const handleUpdateCategory = async (taskId: string, category: CategoryType) => {
    await updateTask.mutateAsync({
      id: taskId,
      updates: { category },
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteTask.mutateAsync(taskId);
    setSelectedTask(null);
  };

  const handleDeleteAllTasks = async () => {
    if (window.confirm('Are you sure you want to delete all tasks? This action cannot be undone.')) {
      await deleteAllTasks.mutateAsync();
    }
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
          <div className="flex gap-2">
            {tasks.length > 0 && (
              <Button 
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50"
                onClick={handleDeleteAllTasks}
                disabled={deleteAllTasks.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Tasks
              </Button>
            )}
            <Button 
              className="bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/90 text-white"
              onClick={() => setIsCreateTaskOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New task
            </Button>
          </div>
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

        {/* Tasks Table */}
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
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Task title</TableHead>
                  <TableHead className="w-[20%]">Patient</TableHead>
                  <TableHead className="w-[20%]">Category</TableHead>
                  <TableHead className="w-[15%]">Created</TableHead>
                  <TableHead className="w-[5%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id} className="cursor-pointer" onClick={() => setSelectedTask(task)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={task.status === "completed"}
                            onCheckedChange={() => handleToggleComplete(task)}
                            className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                          />
                        </div>
                        <span className="font-medium">{task.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">-</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {task.category ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700"
                            >
                              {CATEGORY_CONFIG[task.category as CategoryType] && (
                                <>
                                  {(() => {
                                    const Icon = CATEGORY_CONFIG[task.category as CategoryType].icon;
                                    return <Icon className={cn("mr-1.5 h-3.5 w-3.5", CATEGORY_CONFIG[task.category as CategoryType].color)} />;
                                  })()}
                                </>
                              )}
                              {task.category}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="bg-popover">
                            {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
                              const Icon = config.icon;
                              return (
                                <DropdownMenuItem
                                  key={category}
                                  onClick={() => handleUpdateCategory(task.id, category as CategoryType)}
                                >
                                  <Icon className={cn("mr-2 h-4 w-4", config.color)} />
                                  <span>{category}</span>
                                  {task.category === category && <Check className="ml-auto h-4 w-4" />}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit task
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      {/* Task Detail Sheet */}
      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent className="bg-background sm:max-w-md">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Tasks</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Incomplete tasks will be archived after 30 days
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setSelectedTask(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {selectedTask && (
            <div className="space-y-6">
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Created {format(new Date(selectedTask.created_at), "dd/MM/yy h:mma")}
                </p>
                <h3 className="text-xl font-semibold mb-4">{selectedTask.title}</h3>
              </div>

              <div className="space-y-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700"
                    >
                      {selectedTask.category && CATEGORY_CONFIG[selectedTask.category as CategoryType] && (
                        <>
                          {(() => {
                            const Icon = CATEGORY_CONFIG[selectedTask.category as CategoryType].icon;
                            return <Icon className={cn("mr-1.5 h-3.5 w-3.5", CATEGORY_CONFIG[selectedTask.category as CategoryType].color)} />;
                          })()}
                        </>
                      )}
                      {selectedTask.category || "Select category"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-popover">
                    {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
                      const Icon = config.icon;
                      return (
                        <DropdownMenuItem
                          key={category}
                          onClick={() => handleUpdateCategory(selectedTask.id, category as CategoryType)}
                        >
                          <Icon className={cn("mr-2 h-4 w-4", config.color)} />
                          <span>{category}</span>
                          {selectedTask.category === category && <Check className="ml-auto h-4 w-4" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  className="w-full bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/90 text-white"
                  onClick={() => handleToggleComplete(selectedTask)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {selectedTask.status === 'completed' ? 'Mark as incomplete' : 'Mark as complete'}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDeleteTask(selectedTask.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete task
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default Tasks;
