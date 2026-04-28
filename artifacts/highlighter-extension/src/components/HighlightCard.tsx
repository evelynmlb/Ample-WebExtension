import { useState, useMemo, useRef, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  MoreVertical,
  Edit2,
  FolderInput,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag as TagIcon,
  ExternalLink,
  GripVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Highlight, HighlightColor, Folder } from "@/lib/types";

const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: "hsl(var(--highlight-yellow))",
  green: "hsl(var(--highlight-green))",
  blue: "hsl(var(--highlight-blue))",
  pink: "hsl(var(--highlight-pink))",
  orange: "hsl(var(--highlight-orange))",
};

interface HighlightCardProps {
  highlight: Highlight;
  folders: Folder[];
  onUpdate: (id: string, patch: Partial<Highlight>) => void;
  onDelete: (id: string) => void;
  isDragOverlay?: boolean;
}

export function HighlightCard({ highlight, folders, onUpdate, onDelete, isDragOverlay }: HighlightCardProps) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(highlight.note);
  const [showContext, setShowContext] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: highlight.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  const handleSaveNote = () => {
    onUpdate(highlight.id, { note: noteDraft });
    setIsEditingNote(false);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagDraft.trim()) {
      const newTags = [...new Set([...highlight.tags, tagDraft.trim()])];
      onUpdate(highlight.id, { tags: newTags });
      setTagDraft("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdate(highlight.id, { tags: highlight.tags.filter(t => t !== tagToRemove) });
  };

  const hasContext = highlight.contextBefore.trim() !== "" || highlight.contextAfter.trim() !== "";

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group relative flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm ${
        isDragOverlay ? "shadow-xl border-primary" : ""
      }`}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute left-2 top-4 hidden cursor-grab text-muted-foreground hover:text-foreground group-hover:block"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex items-start justify-between gap-4 pl-4">
        {/* Highlight Content */}
        <div className="flex-1 space-y-1">
          <div 
            className="border-l-4 pl-3 py-1"
            style={{ borderColor: COLOR_MAP[highlight.color] }}
          >
            <p className="font-serif text-lg leading-relaxed text-foreground">
              {highlight.text}
            </p>
          </div>
        </div>

        {/* Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setIsEditingNote(true)}>
              <Edit2 className="mr-2 h-4 w-4" /> Edit note
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <div
                  className="mr-2 h-4 w-4 rounded-full border ring-1 ring-black/10"
                  style={{ backgroundColor: COLOR_MAP[highlight.color] }}
                />
                Change color
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="p-2">
                <div className="flex gap-2">
                  {Object.entries(COLOR_MAP).map(([color, value]) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`${color} highlight`}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${highlight.color === color ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground/40'}`}
                      style={{ backgroundColor: value }}
                      onClick={() => onUpdate(highlight.id, { color: color as HighlightColor })}
                    />
                  ))}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="mr-2 h-4 w-4" />
                <span className="flex-1">Move to folder</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 max-h-72 overflow-y-auto">
                <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Move to
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onUpdate(highlight.id, { folderId: null })}
                  className={highlight.folderId === null ? "bg-accent" : ""}
                >
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full border border-dashed border-muted-foreground/50" />
                  Unfiled
                  {highlight.folderId === null && (
                    <span className="ml-auto text-xs text-muted-foreground">✓</span>
                  )}
                </DropdownMenuItem>
                {folders.length > 0 && <DropdownMenuSeparator />}
                {folders.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    No folders yet. Create one in the sidebar.
                  </div>
                ) : (
                  folders.map((f) => (
                    <DropdownMenuItem
                      key={f.id}
                      onClick={() => onUpdate(highlight.id, { folderId: f.id })}
                      className={highlight.folderId === f.id ? "bg-accent" : ""}
                    >
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: COLOR_MAP[f.color] }}
                      />
                      <span className="truncate">{f.name}</span>
                      {highlight.folderId === f.id && (
                        <span className="ml-auto text-xs text-muted-foreground">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(highlight.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Note */}
      <div className="pl-4">
        {isEditingNote ? (
          <div className="flex flex-col gap-2">
            <Input 
              value={noteDraft} 
              onChange={e => setNoteDraft(e.target.value)} 
              placeholder="Add a note..."
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveNote()}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setIsEditingNote(false); setNoteDraft(highlight.note); }}>Cancel</Button>
              <Button size="sm" onClick={handleSaveNote}>Save</Button>
            </div>
          </div>
        ) : (
          highlight.note ? (
            <p className="text-sm italic text-muted-foreground" onDoubleClick={() => setIsEditingNote(true)}>
              {highlight.note}
            </p>
          ) : (
            <button 
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground"
              onClick={() => setIsEditingNote(true)}
            >
              + Add note
            </button>
          )
        )}
      </div>

      {/* Context (Collapsible) */}
      {hasContext && (
        <div className="pl-4">
          <button 
            className="flex items-center text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowContext(!showContext)}
          >
            {showContext ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
            {showContext ? "Hide Context" : "Show Context"}
          </button>
          
          <AnimatePresence>
            {showContext && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                  {highlight.contextBefore}
                  <span className="font-medium text-foreground mx-1" style={{ backgroundColor: COLOR_MAP[highlight.color] + '40' }}>{highlight.text}</span>
                  {highlight.contextAfter}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Tags */}
      <div className="pl-4 flex flex-wrap items-center gap-1">
        {highlight.tags.map(tag => (
          <span key={tag} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
            #{tag}
            <button 
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => handleRemoveTag(tag)}
            >
              ×
            </button>
          </span>
        ))}
        {isEditingTags ? (
          <Input 
            className="h-6 w-24 px-2 py-0 text-xs" 
            value={tagDraft}
            onChange={e => setTagDraft(e.target.value)}
            onKeyDown={handleAddTag}
            onBlur={() => setIsEditingTags(false)}
            placeholder="new tag"
            autoFocus
          />
        ) : (
          <button 
            className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => setIsEditingTags(true)}
          >
            <TagIcon className="mr-1 h-3 w-3" /> Add
          </button>
        )}
      </div>

      {/* Footer: Source and Timestamp */}
      <div className="pl-4 mt-2 flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
        <a 
          href={highlight.sourceUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center hover:text-primary max-w-[200px] truncate"
          title={highlight.sourceTitle}
        >
          {highlight.sourceFavicon && (
            <img src={highlight.sourceFavicon} alt="" className="mr-2 h-3 w-3 rounded-sm" />
          )}
          <span className="truncate">{highlight.sourceTitle}</span>
          <ExternalLink className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </a>
        <span title={new Date(highlight.createdAt).toLocaleString()}>
          {formatDistanceToNow(highlight.createdAt, { addSuffix: true })}
        </span>
      </div>
    </motion.div>
  );
}
