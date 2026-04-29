import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HIGHLIGHT_COLORS } from "@/lib/types";
import type { Folder, HighlightColor, NewFolder } from "@/lib/types";

interface UnfiledDropTargetProps {
  isSelected: boolean;
  count: number;
  onSelect: () => void;
}

export function UnfiledDropTarget({
  isSelected,
  count,
  onSelect,
}: UnfiledDropTargetProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "folder:unfiled",
    data: { type: "folder", folderId: null },
  });
  return (
    <button
      ref={setNodeRef}
      onClick={onSelect}
      className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors flex items-center justify-between ${
        isOver
          ? "ring-2 ring-primary ring-offset-1 ring-offset-sidebar bg-sidebar-accent text-sidebar-foreground"
          : isSelected
            ? "bg-primary text-primary-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent"
      }`}
    >
      <span>Unfiled</span>
      {count > 0 && (
        <span
          className={`text-[10px] tabular-nums ${
            isSelected && !isOver
              ? "text-primary-foreground/70"
              : "text-sidebar-foreground/50"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

const COLOR_VAR: Record<HighlightColor, string> = {
  yellow: "hsl(var(--highlight-yellow))",
  green: "hsl(var(--highlight-green))",
  blue: "hsl(var(--highlight-blue))",
  pink: "hsl(var(--highlight-pink))",
  orange: "hsl(var(--highlight-orange))",
};

interface ColorSwatchesProps {
  value: HighlightColor;
  onChange: (color: HighlightColor) => void;
}

function ColorSwatches({ value, onChange }: ColorSwatchesProps) {
  return (
    <div className="flex gap-1.5">
      {HIGHLIGHT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`${c} folder`}
          onClick={() => onChange(c)}
          className={`h-5 w-5 rounded-full border-2 transition-all ${
            value === c
              ? "border-foreground scale-110"
              : "border-transparent hover:border-muted-foreground/30"
          }`}
          style={{ backgroundColor: COLOR_VAR[c] }}
        />
      ))}
    </div>
  );
}

interface NewFolderPopoverProps {
  onCreate: (folder: NewFolder) => void;
}

export function NewFolderPopover({ onCreate }: NewFolderPopoverProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<HighlightColor>("blue");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setName("");
      setColor("blue");
    }
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ name: trimmed, color });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          <Plus className="h-3 w-3 mr-2" /> New folder
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        align="start"
        side="top"
        sideOffset={4}
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Folder name
            </label>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research"
              className="h-8 text-sm"
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Color
            </label>
            <ColorSwatches value={color} onChange={setColor} />
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={submit}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FolderRowProps {
  folder: Folder;
  isSelected: boolean;
  count: number;
  onSelect: () => void;
  onRename: (name: string) => void;
  onChangeColor: (color: HighlightColor) => void;
  onDelete: () => void;
}

export function FolderRow({
  folder,
  isSelected,
  count,
  onSelect,
  onRename,
  onChangeColor,
  onDelete,
}: FolderRowProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setDraftName(folder.name);
      setTimeout(() => {
        renameRef.current?.focus();
        renameRef.current?.select();
      }, 30);
    }
  }, [isRenaming, folder.name]);

  const commitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== folder.name) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: COLOR_VAR[folder.color] }}
        />
        <Input
          ref={renameRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          className="h-7 text-sm flex-1 px-1.5 min-w-0"
          maxLength={40}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          onBlur={commitRename}
        />
      </div>
    );
  }

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: "folder", folderId: folder.id },
  });

  return (
    <>
      <div
        ref={setDropRef}
        className={`group/row flex items-center gap-1 rounded-md pl-2 pr-1 py-1 transition-colors ${
          isOver
            ? "ring-2 ring-primary ring-offset-1 ring-offset-sidebar bg-sidebar-accent"
            : isSelected
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
        }`}
      >
        <button
          onClick={onSelect}
          className="flex items-center gap-2 flex-1 min-w-0 text-left text-sm"
          title={folder.name}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: COLOR_VAR[folder.color] }}
          />
          <span className={`truncate ${isSelected ? "font-medium" : ""}`}>
            {folder.name}
          </span>
        </button>

        {count > 0 && (
          <span
            className={`text-[10px] tabular-nums shrink-0 px-1 ${
              isSelected
                ? "text-primary-foreground/70"
                : "text-sidebar-foreground/50"
            }`}
          >
            {count}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 shrink-0 transition-opacity ${
                isSelected
                  ? "text-primary-foreground/80 opacity-100 hover:bg-white/10 hover:text-primary-foreground"
                  : "text-sidebar-foreground/50 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 hover:bg-sidebar-accent-foreground/10"
              }`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Folder options for ${folder.name}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="w-44 p-1">
            <DropdownMenuItem onClick={() => setIsRenaming(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
            </DropdownMenuItem>
            <div className="px-2 py-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Color
              </div>
              <ColorSwatches value={folder.color} onChange={onChangeColor} />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder "{folder.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {count > 0
                ? `${count} highlight${count === 1 ? "" : "s"} in this folder will become Unfiled. The highlights themselves are kept.`
                : "This folder is empty and will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
