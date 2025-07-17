import { useDrawing } from "@/hooks/useDrawing";

export function DebugInfo() {
  const drawing = useDrawing();
  
  return (
    <div className="fixed top-0 right-0 bg-card p-4 border border-border m-4 rounded-lg text-xs max-w-xs z-50">
      <h3 className="font-bold mb-2">Debug Info</h3>
      <div className="space-y-1 text-muted-foreground">
        <div>Tool: {drawing.currentTool}</div>
        <div>Drawing: {drawing.isDrawing ? 'Yes' : 'No'}</div>
        <div>Path points: {drawing.currentPath.length}</div>
        <div>Structures: {drawing.structures.length}</div>
        <div>Active: {drawing.activeStructureId || 'None'}</div>
      </div>
    </div>
  );
}