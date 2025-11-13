import { Card } from '@/components/ui/card';

interface HUOverlayProps {
  visible: boolean;
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
  huValue: number;
  sliceNumber: number;
  totalSlices: number;
  showCrosshair?: boolean;
}

export const HUOverlay = ({
  visible,
  x,
  y,
  pixelX,
  pixelY,
  huValue,
  sliceNumber,
  totalSlices,
  showCrosshair = false,
}: HUOverlayProps) => {
  if (!visible) return null;

  // Position the overlay near the cursor but not directly under it
  const offsetX = 15;
  const offsetY = 15;

  // Determine tissue type based on HU value
  const getTissueType = (hu: number): string => {
    if (hu < -900) return 'Air';
    if (hu < -500) return 'Lung';
    if (hu < -100) return 'Fat';
    if (hu < 0) return 'Water/CSF';
    if (hu < 40) return 'Soft Tissue';
    if (hu < 80) return 'Blood/Muscle';
    if (hu < 300) return 'Bone (Cancellous)';
    if (hu < 1000) return 'Bone (Compact)';
    return 'Metal';
  };

  const tissueType = getTissueType(huValue);

  return (
    <>
      {/* Crosshair lines */}
      {showCrosshair && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Horizontal line */}
          <div
            className="absolute bg-primary/50"
            style={{
              left: 0,
              top: y,
              width: '100%',
              height: '1px',
            }}
          />
          {/* Vertical line */}
          <div
            className="absolute bg-primary/50"
            style={{
              left: x,
              top: 0,
              width: '1px',
              height: '100%',
            }}
          />
        </div>
      )}

      {/* Info overlay */}
      <Card
        className="absolute pointer-events-none bg-background/95 border-primary/50 shadow-lg z-50"
        style={{
          left: x + offsetX,
          top: y + offsetY,
        }}
      >
        <div className="p-2 space-y-1 text-xs font-mono">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">HU:</span>
            <span className="font-bold text-primary">{huValue.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Type:</span>
            <span className="text-foreground">{tissueType}</span>
          </div>
          <div className="border-t border-border pt-1 mt-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Pixel:</span>
              <span className="text-foreground">
                {pixelX}, {pixelY}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Slice:</span>
              <span className="text-foreground">
                {sliceNumber + 1} / {totalSlices}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};
