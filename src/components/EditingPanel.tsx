import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  MousePointer,
  Copy,
  Trash2,
  Scissors,
  Scaling,
  Plus,
  Minus,
  Sparkles,
  Wand2,
  Target,
} from 'lucide-react';
import { BooleanOp } from '@/lib/editing-utils';
import { Structure3D } from '@/lib/contour-utils';

interface EditingPanelProps {
  selectedContour: { contourId: string; structureId: string; selectedPointIndex: number | null } | null;
  structures: Structure3D[];
  elasticRadius: number;
  onElasticRadiusChange: (radius: number) => void;
  onDeleteContour: () => void;
  onCopyContour: () => void;
  onPasteContour: () => void;
  onSmooth2D: (iterations: number, strength: number) => void;
  onSmooth3D: (iterations: number, strength: number) => void;
  onApplyMargin: (margin: number) => void;
  onBooleanOp: (operation: BooleanOp, targetId: string) => void;
  onCropWithMargin: (cropId: string, margin: number) => void;
  onThreshold: (minHU: number, maxHU: number) => void;
  onRegionGrow: (tolerance: number) => void;
  onMagicWand: (tolerance: number) => void;
  pixelSpacing?: number;
}

export function EditingPanel({
  selectedContour,
  structures,
  elasticRadius,
  onElasticRadiusChange,
  onDeleteContour,
  onCopyContour,
  onPasteContour,
  onSmooth2D,
  onSmooth3D,
  onApplyMargin,
  onBooleanOp,
  onCropWithMargin,
  onThreshold,
  onRegionGrow,
  onMagicWand,
  pixelSpacing = 1.0,
}: EditingPanelProps) {
  // Point editing
  const [smoothIterations, setSmoothIterations] = useState(3);
  const [smoothStrength, setSmoothStrength] = useState(0.5);

  // Margin operations
  const [marginValue, setMarginValue] = useState(5);

  // Boolean operations
  const [booleanTargetId, setBooleanTargetId] = useState<string>('');

  // Crop operations
  const [cropTargetId, setCropTargetId] = useState<string>('');
  const [cropMargin, setCropMargin] = useState(0);

  // Segmentation
  const [thresholdMin, setThresholdMin] = useState(-400);
  const [thresholdMax, setThresholdMax] = useState(400);
  const [segmentTolerance, setSegmentTolerance] = useState(50);

  return (
    <Card className="w-80">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MousePointer className="w-4 h-4" />
          Advanced Editing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <Tabs defaultValue="points" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="points" className="text-xs">Points</TabsTrigger>
            <TabsTrigger value="3d" className="text-xs">3D</TabsTrigger>
            <TabsTrigger value="boolean" className="text-xs">Boolean</TabsTrigger>
            <TabsTrigger value="segment" className="text-xs">Segment</TabsTrigger>
          </TabsList>

          {/* Point Editing Tab */}
          <TabsContent value="points" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs mb-1">Elastic Radius</Label>
              <Slider
                value={[elasticRadius]}
                onValueChange={([v]) => onElasticRadiusChange(v)}
                min={10}
                max={100}
                step={5}
                className="mb-1"
              />
              <span className="text-xs text-muted-foreground">{elasticRadius}px</span>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Selection Actions</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCopyContour}
                  disabled={!selectedContour}
                  className="h-8 text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onPasteContour}
                  className="h-8 text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Paste
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onDeleteContour}
                  disabled={!selectedContour}
                  className="h-8 text-xs col-span-2"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete Contour
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Smooth Selected</Label>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Iterations: {smoothIterations}</Label>
                  <Slider
                    value={[smoothIterations]}
                    onValueChange={([v]) => setSmoothIterations(v)}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Strength: {smoothStrength.toFixed(2)}</Label>
                  <Slider
                    value={[smoothStrength * 100]}
                    onValueChange={([v]) => setSmoothStrength(v / 100)}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSmooth2D(smoothIterations, smoothStrength)}
                  disabled={!selectedContour}
                  className="w-full h-8 text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Apply Smoothing
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* 3D Operations Tab */}
          <TabsContent value="3d" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label className="text-xs">3D Smoothing (Entire Structure)</Label>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Iterations: {smoothIterations}</Label>
                  <Slider
                    value={[smoothIterations]}
                    onValueChange={([v]) => setSmoothIterations(v)}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Strength: {smoothStrength.toFixed(2)}</Label>
                  <Slider
                    value={[smoothStrength * 100]}
                    onValueChange={([v]) => setSmoothStrength(v / 100)}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onSmooth3D(smoothIterations, smoothStrength)}
                  disabled={!selectedContour}
                  className="w-full h-8 text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Smooth 3D
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Margin Operations</Label>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Margin: {marginValue > 0 ? '+' : ''}{marginValue}mm
                  </Label>
                  <Slider
                    value={[marginValue]}
                    onValueChange={([v]) => setMarginValue(v)}
                    min={-20}
                    max={20}
                    step={1}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApplyMargin(marginValue)}
                    disabled={!selectedContour || marginValue === 0}
                    className="h-8 text-xs"
                  >
                    <Scaling className="w-3 h-3 mr-1" />
                    {marginValue > 0 ? 'Expand' : 'Shrink'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMarginValue(0)}
                    className="h-8 text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Crop with Margin</Label>
              <Select value={cropTargetId} onValueChange={setCropTargetId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select crop contour" />
                </SelectTrigger>
                <SelectContent>
                  {structures.flatMap(s =>
                    s.contours.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {s.name} - Slice {c.sliceIndex}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div>
                <Label className="text-xs text-muted-foreground">Margin: {cropMargin}mm</Label>
                <Slider
                  value={[cropMargin]}
                  onValueChange={([v]) => setCropMargin(v)}
                  min={-10}
                  max={10}
                  step={1}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onCropWithMargin(cropTargetId, cropMargin)}
                disabled={!selectedContour || !cropTargetId}
                className="w-full h-8 text-xs"
              >
                <Scissors className="w-3 h-3 mr-1" />
                Apply Crop
              </Button>
            </div>
          </TabsContent>

          {/* Boolean Operations Tab */}
          <TabsContent value="boolean" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label className="text-xs">Boolean Operations</Label>
              <Select value={booleanTargetId} onValueChange={setBooleanTargetId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select second contour" />
                </SelectTrigger>
                <SelectContent>
                  {structures.flatMap(s =>
                    s.contours
                      .filter(c => c.id !== selectedContour?.contourId)
                      .map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {s.name} - Slice {c.sliceIndex}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBooleanOp(BooleanOp.UNION, booleanTargetId)}
                  disabled={!selectedContour || !booleanTargetId}
                  className="h-8 text-xs"
                  title="Union (A ∪ B)"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Union
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBooleanOp(BooleanOp.INTERSECTION, booleanTargetId)}
                  disabled={!selectedContour || !booleanTargetId}
                  className="h-8 text-xs"
                  title="Intersection (A ∩ B)"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Intersect
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBooleanOp(BooleanOp.DIFFERENCE, booleanTargetId)}
                  disabled={!selectedContour || !booleanTargetId}
                  className="h-8 text-xs"
                  title="Difference (A - B)"
                >
                  <Minus className="w-3 h-3 mr-1" />
                  Subtract
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBooleanOp(BooleanOp.XOR, booleanTargetId)}
                  disabled={!selectedContour || !booleanTargetId}
                  className="h-8 text-xs"
                  title="XOR (A ⊕ B)"
                >
                  <Scissors className="w-3 h-3 mr-1" />
                  XOR
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
              <p className="font-semibold mb-1">Info:</p>
              <ul className="space-y-1 text-[10px]">
                <li>• Union: Combine two contours</li>
                <li>• Intersect: Only overlapping area</li>
                <li>• Subtract: Remove second from first</li>
                <li>• XOR: Non-overlapping areas only</li>
              </ul>
            </div>
          </TabsContent>

          {/* Segmentation Tab */}
          <TabsContent value="segment" className="space-y-3 mt-3">
            <div className="space-y-2">
              <Label className="text-xs">Threshold Segmentation</Label>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Min HU: {thresholdMin}</Label>
                  <Input
                    type="number"
                    value={thresholdMin}
                    onChange={(e) => setThresholdMin(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max HU: {thresholdMax}</Label>
                  <Input
                    type="number"
                    value={thresholdMax}
                    onChange={(e) => setThresholdMax(Number(e.target.value))}
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onThreshold(thresholdMin, thresholdMax)}
                  className="w-full h-8 text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Segment by Threshold
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs">Region Growing / Magic Wand</Label>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Tolerance: {segmentTolerance} HU</Label>
                  <Slider
                    value={[segmentTolerance]}
                    onValueChange={([v]) => setSegmentTolerance(v)}
                    min={10}
                    max={200}
                    step={10}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onRegionGrow(segmentTolerance)}
                  className="w-full h-8 text-xs"
                >
                  <Target className="w-3 h-3 mr-1" />
                  Region Growing
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onMagicWand(segmentTolerance)}
                  className="w-full h-8 text-xs"
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  Magic Wand
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
              <p className="font-semibold mb-1">Usage:</p>
              <ul className="space-y-1 text-[10px]">
                <li>• Threshold: Segments by HU range</li>
                <li>• Region Growing: Click seed point</li>
                <li>• Magic Wand: Click-to-select region</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        {selectedContour && (
          <div className="text-xs p-2 bg-primary/10 rounded-md">
            <p className="font-semibold">Selected:</p>
            <p className="text-muted-foreground">
              {structures.find(s => s.id === selectedContour.structureId)?.name || 'Unknown'}
            </p>
            {selectedContour.selectedPointIndex !== null && (
              <p className="text-muted-foreground">Point: {selectedContour.selectedPointIndex}</p>
            )}
          </div>
        )}

        {!selectedContour && (
          <div className="text-xs text-center text-muted-foreground p-2">
            Select a contour to enable editing features
          </div>
        )}
      </CardContent>
    </Card>
  );
}
