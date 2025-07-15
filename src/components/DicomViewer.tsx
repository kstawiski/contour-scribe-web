import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Move, 
  MousePointer, 
  Paintbrush, 
  Eraser, 
  Download,
  Settings,
  Layers,
  Eye,
  EyeOff,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DicomViewerProps {
  ctImages: ArrayBuffer[];
  rtStruct?: ArrayBuffer;
}

interface Structure {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  isEditing: boolean;
}

type Tool = "select" | "pan" | "zoom" | "windowing" | "brush" | "eraser";

export const DicomViewer = ({ ctImages, rtStruct }: DicomViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Viewer state
  const [currentSlice, setCurrentSlice] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [windowLevel, setWindowLevel] = useState([400]);
  const [windowWidth, setWindowWidth] = useState([800]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Structure state
  const [structures, setStructures] = useState<Structure[]>([
    {
      id: "1",
      name: "Tumor",
      color: "#ff4444",
      visible: true,
      isEditing: false
    },
    {
      id: "2", 
      name: "Lung_Left",
      color: "#44ff44",
      visible: true,
      isEditing: false
    },
    {
      id: "3",
      name: "Lung_Right", 
      color: "#4444ff",
      visible: true,
      isEditing: false
    }
  ]);

  // Canvas setup and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = 512;
    canvas.height = 512;

    // Clear canvas
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Mock CT image rendering
    ctx.fillStyle = "#333333";
    ctx.fillRect(50, 50, 412, 412);
    
    // Mock anatomical structures
    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.arc(256 + Math.sin(i) * 100, 256 + Math.cos(i) * 100, 20, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Render visible structures
    structures.forEach((structure) => {
      if (!structure.visible) return;
      
      ctx.strokeStyle = structure.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(structure.isEditing ? [5, 5] : []);
      
      // Mock structure contour
      ctx.beginPath();
      ctx.arc(200 + parseInt(structure.id) * 50, 200, 30, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Add slice indicator
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px monospace";
    ctx.fillText(`Slice: ${currentSlice + 1}/${ctImages.length}`, 10, 25);
    
  }, [currentSlice, structures, ctImages.length, zoom, pan, windowLevel, windowWidth]);

  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool);
    // Reset editing state when changing tools
    if (tool !== "brush" && tool !== "eraser") {
      setStructures(prev => prev.map(s => ({ ...s, isEditing: false })));
    }
  };

  const toggleStructureVisibility = (id: string) => {
    setStructures(prev => 
      prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s)
    );
  };

  const startEditingStructure = (id: string) => {
    setStructures(prev => 
      prev.map(s => ({ ...s, isEditing: s.id === id ? !s.isEditing : false }))
    );
    if (activeTool === "select") {
      setActiveTool("brush");
    }
  };

  const addNewStructure = () => {
    const newId = (structures.length + 1).toString();
    const colors = ["#ff8844", "#8844ff", "#44ff88", "#ff4488", "#88ff44"];
    const color = colors[structures.length % colors.length];
    
    const newStructure: Structure = {
      id: newId,
      name: `Structure_${newId}`,
      color,
      visible: true,
      isEditing: true
    };
    
    setStructures(prev => [...prev, newStructure]);
    setActiveTool("brush");
    
    toast({
      title: "New structure created",
      description: `${newStructure.name} ready for drawing`,
    });
  };

  const handleDownload = () => {
    toast({
      title: "Export initiated",
      description: "Generating DICOM RT Structure file...",
    });
    
    // Mock download - in real implementation, this would generate a proper DICOM file
    setTimeout(() => {
      toast({
        title: "Export complete",
        description: "RT Structure file downloaded successfully",
      });
    }, 2000);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setWindowLevel([400]);
    setWindowWidth([800]);
    toast({
      title: "View reset",
      description: "Returned to default view settings",
    });
  };

  return (
    <div className="min-h-screen bg-background flex animate-fade-in">
      {/* Main Viewer */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">DICOM Viewer</h2>
              <p className="text-muted-foreground text-sm">
                CT Series • {ctImages.length} slices • {rtStruct ? "RT Structure loaded" : "No RT Structure"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetView}>
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              <Button variant="medical" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 border border-border rounded-md p-1">
              <Button
                variant={activeTool === "select" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("select")}
              >
                <MousePointer className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTool === "pan" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("pan")}
              >
                <Move className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTool === "zoom" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("zoom")}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTool === "windowing" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("windowing")}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            <div className="flex items-center gap-1 border border-border rounded-md p-1">
              <Button
                variant={activeTool === "brush" ? "medical" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("brush")}
              >
                <Paintbrush className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTool === "eraser" ? "warning" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("eraser")}
              >
                <Eraser className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Tool:</span>
              <Badge variant="secondary" className="capitalize">
                {activeTool}
              </Badge>
            </div>
          </div>
        </div>

        {/* Viewer Canvas */}
        <div className="flex-1 flex">
          {/* Canvas Container */}
          <div className="flex-1 bg-black flex items-center justify-center p-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="border border-border shadow-elevation cursor-crosshair"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  imageRendering: "pixelated"
                }}
              />
              
              {/* Overlay Info */}
              <div className="absolute top-2 right-2 bg-black/80 text-white p-2 rounded text-xs font-mono">
                <div>WL: {windowLevel[0]}</div>
                <div>WW: {windowWidth[0]}</div>
                <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="w-80 bg-card border-l border-border p-4 space-y-6">
            {/* Slice Navigation */}
            <div>
              <h3 className="font-medium text-foreground mb-3">Slice Navigation</h3>
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">
                    {currentSlice + 1} / {ctImages.length}
                  </span>
                </div>
                <Slider
                  value={[currentSlice]}
                  onValueChange={([value]) => setCurrentSlice(value)}
                  max={ctImages.length - 1}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Image Controls */}
            <div>
              <h3 className="font-medium text-foreground mb-3">Image Controls</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Window Level</label>
                  <Slider
                    value={windowLevel}
                    onValueChange={setWindowLevel}
                    min={-1000}
                    max={3000}
                    step={10}
                    className="mt-2"
                  />
                  <span className="text-xs text-muted-foreground">{windowLevel[0]}</span>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Window Width</label>
                  <Slider
                    value={windowWidth}
                    onValueChange={setWindowWidth}
                    min={1}
                    max={4000}
                    step={10}
                    className="mt-2"
                  />
                  <span className="text-xs text-muted-foreground">{windowWidth[0]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Panel */}
      <div className="w-80 bg-card border-l border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Structures
            </h3>
            <Button variant="medical" size="sm" onClick={addNewStructure}>
              <Plus className="w-4 h-4" />
              New
            </Button>
          </div>
        </div>

        {/* Structures List */}
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {structures.map((structure) => (
            <Card 
              key={structure.id} 
              className={`p-3 cursor-pointer transition-all ${
                structure.isEditing ? "border-primary shadow-glow" : "hover:bg-muted/50"
              }`}
              onClick={() => startEditingStructure(structure.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded border-2"
                    style={{ backgroundColor: structure.color }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {structure.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStructureVisibility(structure.id);
                    }}
                  >
                    {structure.visible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              {structure.isEditing && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="text-xs">
                      Editing
                    </Badge>
                    <Badge 
                      variant={activeTool === "brush" ? "default" : "outline"} 
                      className="text-xs"
                    >
                      Draw
                    </Badge>
                    <Badge 
                      variant={activeTool === "eraser" ? "destructive" : "outline"} 
                      className="text-xs"
                    >
                      Erase
                    </Badge>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Total structures: {structures.length}</div>
            <div>Visible: {structures.filter(s => s.visible).length}</div>
            <div>Editing: {structures.filter(s => s.isEditing).length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};