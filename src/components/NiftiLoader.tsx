import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NiftiProcessor } from '@/lib/nifti-utils';
import { DicomImage } from '@/lib/dicom-utils';

interface NiftiLoaderProps {
  onDataLoaded: (data: { ctImages: DicomImage[]; probabilityMap?: Float32Array[] }) => void;
}

export const NiftiLoader = ({ onDataLoaded }: NiftiLoaderProps) => {
  const [ctFile, setCtFile] = useState<File | null>(null);
  const [probFile, setProbFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLoad = async () => {
    if (!ctFile) return;
    setIsLoading(true);
    try {
      const ctBuffer = await ctFile.arrayBuffer();
      const volume = NiftiProcessor.parseVolume(ctBuffer);
      if (!volume) throw new Error('Invalid NIfTI CT file');
      const ctImages = NiftiProcessor.volumeToDicomImages(volume);
      let probabilityMap: Float32Array[] | undefined;
      if (probFile) {
        const probBuffer = await probFile.arrayBuffer();
        probabilityMap = NiftiProcessor.parseProbabilityMap(probBuffer) || undefined;
      }
      onDataLoaded({ ctImages, probabilityMap });
      toast({ title: 'NIfTI data loaded', description: `Loaded ${ctImages.length} slices` });
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to load NIfTI', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>NIfTI Loader</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">CT Volume (.nii/.nii.gz)</label>
            <Input type="file" accept=".nii,.nii.gz" onChange={e => setCtFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Probability Map (optional)</label>
            <Input type="file" accept=".nii,.nii.gz" onChange={e => setProbFile(e.target.files?.[0] || null)} />
          </div>
          <Button onClick={handleLoad} disabled={!ctFile || isLoading} variant="medical">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NiftiLoader;
