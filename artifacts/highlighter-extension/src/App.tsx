import { useState, useMemo } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import {
  isExtensionEnvironment,
  matchesQuery,
  sortHighlights,
} from "@/lib/storage";
import { useHighlights } from "@/hooks/use-highlights";
import { HighlightCard } from "@/components/HighlightCard";
import { Highlight, SortMode } from "@/lib/types";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Search,
  Settings,
  HelpCircle,
  Folder as FolderIcon,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

const queryClient = new QueryClient();

function MainDashboard() {
  const {
    highlights,
    folders,
    sortMode,
    setSortMode,
    isLoading,
    actions,
  } = useHighlights();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | "all" | "unfiled">("all");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredAndSortedHighlights = useMemo(() => {
    let result = highlights;
    if (selectedFolderId === "unfiled") {
      result = result.filter(h => !h.folderId);
    } else if (selectedFolderId !== "all") {
      result = result.filter(h => h.folderId === selectedFolderId);
    }
    
    if (searchQuery.trim()) {
      result = result.filter(h => matchesQuery(h, searchQuery));
    }

    return sortHighlights(result, sortMode);
  }, [highlights, selectedFolderId, searchQuery, sortMode]);

  const activeHighlight = useMemo(() => 
    highlights.find((h) => h.id === activeDragId),
  [activeDragId, highlights]);

  const handleDelete = (id: string) => {
    const highlightToRestore = highlights.find(h => h.id === id);
    if (!highlightToRestore) return;
    
    actions.removeHighlight(id);
    toast("Highlight deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          const { id: _, order: __, createdAt: ___, ...rest } = highlightToRestore;
          actions.addHighlight(rest);
        }
      }
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      if (sortMode !== "custom") return; // Only allow reorder in custom mode
      
      const oldIndex = filteredAndSortedHighlights.findIndex((h) => h.id === active.id);
      const newIndex = filteredAndSortedHighlights.findIndex((h) => h.id === over.id);
      
      const newlyOrdered = arrayMove(filteredAndSortedHighlights, oldIndex, newIndex);
      actions.reorderHighlights(newlyOrdered.map(h => h.id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-t-2 border-primary animate-spin"></div>
          <p className="text-sm text-muted-foreground">Loading library...</p>
        </div>
      </div>
    );
  }

  const isExtension = isExtensionEnvironment();

  return (
    <div className="flex flex-col h-screen max-h-[600px] w-full min-w-[380px] bg-background text-foreground font-sans overflow-hidden">
      {!isExtension && (
        <div className="bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            <span>Preview Mode</span>
          </div>
          <span className="opacity-80">Run <code className="bg-black/20 px-1 rounded">pnpm run build:ext</code> to install</span>
        </div>
      )}

      {/* Header */}
      <header className="px-4 pt-4 pb-2 shrink-0 border-b bg-card z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="h-4 w-4 rounded-full bg-highlight-yellow border border-border" />
              Highlighter
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Session library — {highlights.length} {highlights.length === 1 ? 'reference' : 'references'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 text-sm" align="end">
                <p className="font-semibold mb-2">Keyboard Shortcuts</p>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center text-muted-foreground">
                  <span>Save selection</span>
                  <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">Alt+H</kbd>
                  <span>Open library</span>
                  <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">Alt+Shift+H</kbd>
                </div>
                <div className="mt-4 pt-3 border-t text-xs text-muted-foreground/80">
                  Data is saved only for the current browser session.
                </div>
              </PopoverContent>
            </Popover>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all highlights?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all your saved highlights for this session. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => actions.clearHighlights()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search"
            placeholder="Search quotes, notes, tags..." 
            className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Folder Strip */}
        <div className="w-32 shrink-0 border-r bg-sidebar flex flex-col pt-2 pb-4">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-0.5">
            <button
              onClick={() => setSelectedFolderId("all")}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                selectedFolderId === "all" ? "bg-primary text-primary-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedFolderId("unfiled")}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                selectedFolderId === "unfiled" ? "bg-primary text-primary-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              Unfiled
            </button>
            <div className="py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 px-2 mb-1">Folders</div>
              {folders.map(folder => (
                <div key={folder.id} className="group relative">
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors pr-6 ${
                      selectedFolderId === folder.id ? "bg-primary text-primary-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <FolderIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-0 top-0 h-8 w-6 opacity-0 group-hover:opacity-100 text-sidebar-foreground/50 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.removeFolder(folder.id);
                      if (selectedFolderId === folder.id) setSelectedFolderId("all");
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="px-2 mt-auto pt-2 border-t border-sidebar-border">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={() => {
              const name = prompt("New folder name:");
              if (name) actions.addFolder({ name, color: "blue" });
            }}>
              <Plus className="h-3 w-3 mr-2" /> New Folder
            </Button>
          </div>
        </div>

        {/* List Area */}
        <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur z-10 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">
              {filteredAndSortedHighlights.length} results
            </span>
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="w-[120px] h-7 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="custom">Custom order</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 px-4 py-4">
            {filteredAndSortedHighlights.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center h-full py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <div className="w-6 h-6 rounded border-2 border-dashed border-muted-foreground/50" />
                </div>
                <h3 className="font-serif font-medium text-lg mb-1">It's quiet in here</h3>
                <p className="text-sm text-muted-foreground max-w-[240px]">
                  {searchQuery 
                    ? "No highlights match your search."
                    : "Select text on any page, then pick a color from the floating bar that appears."}
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredAndSortedHighlights.map(h => h.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-4 pb-8">
                    <AnimatePresence mode="popLayout">
                      {filteredAndSortedHighlights.map((highlight) => (
                        <HighlightCard 
                          key={highlight.id}
                          highlight={highlight}
                          folders={folders}
                          onUpdate={actions.updateHighlight}
                          onDelete={handleDelete}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </SortableContext>
                
                <DragOverlay>
                  {activeHighlight ? (
                    <HighlightCard 
                      highlight={activeHighlight}
                      folders={folders}
                      onUpdate={() => {}}
                      onDelete={() => {}}
                      isDragOverlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={MainDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
