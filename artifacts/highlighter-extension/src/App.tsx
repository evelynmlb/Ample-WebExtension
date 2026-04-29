import { useState, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  isExtensionEnvironment,
  matchesQuery,
  sortHighlights,
} from "@/lib/storage";
import { useHighlights } from "@/hooks/use-highlights";
import { HighlightCard } from "@/components/HighlightCard";
import { Highlight, SortMode } from "@/lib/types";
import { FolderRow, NewFolderPopover, UnfiledDropTarget } from "@/components/FolderControls";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Search,
  HelpCircle,
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

  // Custom collision detection: if the pointer is over any sidebar folder
  // droppable, prefer that target. Otherwise fall back to closestCenter so
  // sortable reorder of highlight cards still works as before.
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    const folderHit = pointerHits.find((c) =>
      String(c.id).startsWith("folder:"),
    );
    if (folderHit) return [folderHit];
    const rectHits = rectIntersection(args);
    const folderRectHit = rectHits.find((c) =>
      String(c.id).startsWith("folder:"),
    );
    if (folderRectHit) return [folderRectHit];
    return closestCenter(args);
  };

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

  const sortedFolders = useMemo(
    () =>
      [...folders].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt,
      ),
    [folders],
  );

  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of highlights) {
      if (h.folderId) {
        counts.set(h.folderId, (counts.get(h.folderId) ?? 0) + 1);
      }
    }
    return counts;
  }, [highlights]);

  const unfiledCount = useMemo(
    () => highlights.filter((h) => !h.folderId).length,
    [highlights],
  );

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
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Drop on a folder (sidebar) → reassign folderId.
    if (overId.startsWith("folder:")) {
      const target = overId.slice("folder:".length);
      const folderId = target === "unfiled" ? null : target;
      const dragged = highlights.find((h) => h.id === activeId);
      if (!dragged) return;
      if (dragged.folderId === folderId) return;
      actions.moveHighlightToFolder(activeId, folderId);
      const folderName =
        folderId === null
          ? "Unfiled"
          : (folders.find((f) => f.id === folderId)?.name ?? "folder");
      toast(`Moved to ${folderName}`);
      return;
    }

    // Otherwise: reorder within the highlight list.
    if (activeId === overId) return;

    const oldIndex = filteredAndSortedHighlights.findIndex((h) => h.id === activeId);
    const newIndex = filteredAndSortedHighlights.findIndex((h) => h.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newFilteredOrder = arrayMove(filteredAndSortedHighlights, oldIndex, newIndex);

    // Build the full new order: walk the current visible-sorted full list,
    // replacing items that belong to the filtered subset with their new positions.
    const fullSorted = sortHighlights(highlights, sortMode);
    const filteredIds = new Set(filteredAndSortedHighlights.map((h) => h.id));
    let cursor = 0;
    const fullNewOrder = fullSorted.map((h) =>
      filteredIds.has(h.id) ? newFilteredOrder[cursor++] : h,
    );

    actions.reorderHighlights(fullNewOrder.map((h) => h.id));

    if (sortMode !== "custom") {
      setSortMode("custom");
      toast("Switched to custom order", {
        description: "Drag highlights anywhere to reorder. Use the sort menu to revert.",
      });
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
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Folder Strip */}
        <div className="w-48 shrink-0 border-r bg-sidebar flex flex-col pt-2 pb-4">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-0.5">
            <button
              onClick={() => setSelectedFolderId("all")}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between ${
                selectedFolderId === "all" ? "bg-primary text-primary-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <span>All</span>
              {highlights.length > 0 && (
                <span className={`text-[10px] tabular-nums ${selectedFolderId === "all" ? "text-primary-foreground/70" : "text-sidebar-foreground/50"}`}>
                  {highlights.length}
                </span>
              )}
            </button>
            <UnfiledDropTarget
              isSelected={selectedFolderId === "unfiled"}
              count={unfiledCount}
              onSelect={() => setSelectedFolderId("unfiled")}
            />
            <div className="py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 px-2 mb-1">Folders</div>
              {sortedFolders.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-sidebar-foreground/50 leading-relaxed">
                  No folders yet. Create one below to organize highlights.
                </p>
              ) : (
                sortedFolders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    isSelected={selectedFolderId === folder.id}
                    count={folderCounts.get(folder.id) ?? 0}
                    onSelect={() => setSelectedFolderId(folder.id)}
                    onRename={async (name) => {
                      await actions.updateFolder(folder.id, { name });
                    }}
                    onChangeColor={async (color) => {
                      await actions.updateFolder(folder.id, { color });
                    }}
                    onDelete={async () => {
                      const movedCount = folderCounts.get(folder.id) ?? 0;
                      await actions.removeFolder(folder.id);
                      if (selectedFolderId === folder.id) {
                        setSelectedFolderId("all");
                      }
                      toast(
                        movedCount > 0
                          ? `Folder deleted — ${movedCount} highlight${movedCount === 1 ? "" : "s"} moved to Unfiled`
                          : "Folder deleted",
                      );
                    }}
                  />
                ))
              )}
            </div>
          </div>
          <div className="px-2 mt-auto pt-2 border-t border-sidebar-border">
            <NewFolderPopover
              onCreate={async (folder) => {
                const created = await actions.addFolder(folder);
                if (created?.id) {
                  setSelectedFolderId(created.id);
                }
                toast(`Folder "${folder.name}" created`);
              }}
            />
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
            )}
          </ScrollArea>
        </div>
      </div>

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
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MainDashboard />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
