import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    Download,
    Keyboard,
    Undo,
    Redo,
    RotateCcw,
    Maximize2,
    Grid3x3,
    Play,
    Pause,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DicomImage, DicomRTStruct } from "@/types";
import { useDrawing } from "@/hooks/useDrawing";

interface ViewerToolbarProps {
    ctImages: DicomImage[];
    rtStruct?: DicomRTStruct;
    onBack?: () => void;
    mprMode: boolean;
    setMprMode: (mode: boolean) => void;
    setShowShortcutsHelp: (show: boolean) => void;
    drawing: ReturnType<typeof useDrawing>;
    resetView: () => void;
    cineMode: boolean;
    toggleCineMode: () => void;
    isFullscreen: boolean;
    toggleFullscreen: () => void;
    handleDownload: () => void;
}

export const ViewerToolbar = ({
    ctImages,
    rtStruct,
    onBack,
    mprMode,
    setMprMode,
    setShowShortcutsHelp,
    drawing,
    resetView,
    cineMode,
    toggleCineMode,
    isFullscreen,
    toggleFullscreen,
    handleDownload,
}: ViewerToolbarProps) => {
    const { toast } = useToast();

    return (
        <div className="bg-card border-b border-border px-4 py-2 flex-shrink-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <Button variant="ghost" size="sm" onClick={onBack} title="Back to file selection">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back
                        </Button>
                    )}
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">DicomEdit</h2>
                        <p className="text-muted-foreground text-xs">
                            {ctImages.length} slices {rtStruct ? "• RT Structure loaded" : ""}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={mprMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                            setMprMode(!mprMode);
                            toast({
                                title: !mprMode ? "MPR View" : "Single View",
                                description: !mprMode
                                    ? "Switched to multi-planar reconstruction view"
                                    : "Switched to standard single-plane view",
                            });
                        }}
                        title="Toggle MPR 3D view (M)"
                    >
                        <Grid3x3 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowShortcutsHelp(true)}
                        title="Keyboard shortcuts (?)"
                    >
                        <Keyboard className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            drawing.undo();
                            toast({
                                title: 'Undo',
                                description: 'Last action has been undone',
                            });
                        }}
                        disabled={!drawing.canUndo}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            drawing.redo();
                            toast({
                                title: 'Redo',
                                description: 'Last action has been redone',
                            });
                        }}
                        disabled={!drawing.canRedo}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetView} title="Reset view (R)">
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <Button
                        variant={cineMode ? "default" : "outline"}
                        size="sm"
                        onClick={toggleCineMode}
                        title="Cine/Auto-play mode (C)"
                    >
                        {cineMode ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                        variant={isFullscreen ? "default" : "outline"}
                        size="sm"
                        onClick={toggleFullscreen}
                        title="Fullscreen mode (F)"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <Button variant="medical" size="sm" onClick={handleDownload} title="Export structures (Ctrl+S)">
                        <Download className="w-4 h-4 mr-1" />
                        Export
                    </Button>
                </div>
            </div>
        </div>
    );
};
