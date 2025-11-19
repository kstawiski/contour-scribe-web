import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Layers, Plus, Eye, EyeOff, Copy } from "lucide-react";
import { Structure3D, Contour } from "@/types";

interface StructureListProps {
    structures: Structure3D[];
    activeStructureId: string | null;
    currentSlice: number;
    onToggleVisibility: (id: string) => void;
    onStartEditing: (id: string) => void;
    onAddStructure: () => void;
    onInterpolate: () => void;
    getContoursForSlice: (slice: number) => Contour[];
}

export const StructureList = ({
    structures,
    activeStructureId,
    currentSlice,
    onToggleVisibility,
    onStartEditing,
    onAddStructure,
    onInterpolate,
    getContoursForSlice,
}: StructureListProps) => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        Structures ({structures.length})
                    </h3>
                    <Button variant="medical" size="sm" onClick={onAddStructure} title="Create new structure">
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                {structures.map((structure) => {
                    const isActive = activeStructureId === structure.id;
                    return (
                        <Card
                            key={structure.id}
                            className={`p-2 cursor-pointer transition-all ${isActive ? "border-primary shadow-glow bg-primary/5" : "hover:bg-muted/50"
                                }`}
                            onClick={() => onStartEditing(structure.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div
                                        className="w-3 h-3 rounded border flex-shrink-0"
                                        style={{ backgroundColor: structure.color }}
                                    />
                                    <span className="text-xs font-medium text-foreground truncate">
                                        {structure.name}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleVisibility(structure.id);
                                    }}
                                    className="flex-shrink-0 h-6 w-6 p-0"
                                >
                                    {structure.visible ? (
                                        <Eye className="w-3 h-3" />
                                    ) : (
                                        <EyeOff className="w-3 h-3 text-muted-foreground" />
                                    )}
                                </Button>
                            </div>
                        </Card>
                    );
                })}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onInterpolate}
                    className="w-full mt-4"
                    title="Interpolate contours between slices (I)"
                >
                    <Copy className="w-3 h-3 mr-2" />
                    Interpolate
                </Button>
            </div>

            <div className="p-3 border-t border-border bg-muted/30">
                <div className="text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                        <span>Visible:</span>
                        <span className="font-mono">{structures.filter(s => s.visible).length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Contours here:</span>
                        <span className="font-mono">{getContoursForSlice(currentSlice).length}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
