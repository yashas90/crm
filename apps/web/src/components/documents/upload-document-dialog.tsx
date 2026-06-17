"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUploadDocument } from "@/hooks/use-documents";
import { useProjects } from "@/hooks/use-projects";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

type UploadDocumentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
};

export function UploadDocumentDialog({ open, onOpenChange, projectId }: UploadDocumentDialogProps) {
  const upload = useUploadDocument();
  const { data: projects } = useProjects();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? "");
  const [isGlobal, setIsGlobal] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function reset() {
    setFile(null);
    setName("");
    setDescription("");
    setSelectedProjectId(projectId ?? "");
    setIsGlobal(false);
  }

  async function handleSubmit() {
    if (!file || !name.trim()) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name.trim());
    if (description.trim()) formData.append("description", description.trim());
    if (selectedProjectId) formData.append("projectId", selectedProjectId);
    formData.append("isGlobal", String(isGlobal));

    await upload.mutateAsync(formData);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>PDF, JPG, PNG, or MP4 up to 25MB</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped) {
              setFile(dropped);
              if (!name) setName(dropped.name.replace(/\.[^.]+$/, ""));
            }
          }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            {file ? file.name : "Drag & drop or click to browse"}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.mp4,application/pdf,image/jpeg,image/png,video/mp4"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) {
                setFile(picked);
                if (!name) setName(picked.name.replace(/\.[^.]+$/, ""));
              }
            }}
          />
        </button>

        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {!projectId ? (
            <div>
              <Label>Project (optional)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">No project</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Available to all agents</span>
            <input
              type="checkbox"
              checked={isGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!file || !name.trim() || upload.isPending}
          >
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
