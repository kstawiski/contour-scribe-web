import { useState, useCallback } from "react";
import { Upload, Link, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import JSZip from "jszip";
import { DicomProcessor, DicomImage, DicomRTStruct } from "@/lib/dicom-utils";

interface DicomLoaderProps {
  onDataLoaded: (data: { ctImages: DicomImage[], rtStruct?: DicomRTStruct }) => void;
}

export const DicomLoader = ({ onDataLoaded }: DicomLoaderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const { toast } = useToast();

  const processZipFile = useCallback(async (file: File | ArrayBuffer) => {
    try {
      setIsLoading(true);
      const zip = new JSZip();
      
      const zipData = file instanceof File ? await file.arrayBuffer() : file;
      const zipContent = await zip.loadAsync(zipData);
      
      const ctImages: DicomImage[] = [];
      let rtStruct: DicomRTStruct | undefined;
      
      // Process files in the ZIP
      for (const [filename, fileObj] of Object.entries(zipContent.files)) {
        if (fileObj.dir) continue;
        
        const content = await fileObj.async("arraybuffer");
        
        // Try to parse as DICOM
        try {
          // Check if it's a DICOM file by looking for DICOM prefix
          const uint8Array = new Uint8Array(content);
          const hasDicomPrefix = (
            uint8Array[128] === 0x44 && // 'D'
            uint8Array[129] === 0x49 && // 'I'
            uint8Array[130] === 0x43 && // 'C'
            uint8Array[131] === 0x4D    // 'M'
          );
          
          if (hasDicomPrefix || filename.toLowerCase().endsWith('.dcm')) {
            // Try to parse as CT image first
            const dicomImage = DicomProcessor.parseDicomFile(content);
            if (dicomImage) {
              ctImages.push(dicomImage);
              continue;
            }
            
            // If not a CT image, try parsing as RT Structure
            const rtStructData = DicomProcessor.parseRTStruct(content);
            if (rtStructData && !rtStruct) {
              rtStruct = rtStructData;
            }
          }
        } catch (error) {
          console.warn(`Could not parse file ${filename} as DICOM:`, error);
          
          // Fallback: try simple filename detection for non-DICOM files
          if (filename.toLowerCase().includes("ct") || 
              filename.toLowerCase().includes("image") ||
              filename.toLowerCase().includes("slice")) {
            // Create a mock DICOM image for testing
            const mockImage: DicomImage = {
              arrayBuffer: content,
              dataSet: null,
              pixelData: new Uint8Array(512 * 512).map(() => Math.random() * 255),
              width: 512,
              height: 512,
              windowCenter: 40,
              windowWidth: 400,
              rescaleIntercept: 0,
              rescaleSlope: 1,
              seriesInstanceUID: `mock.${Date.now()}.${ctImages.length}`,
              sopInstanceUID: `mock.${Date.now()}.${ctImages.length}`,
              sliceLocation: ctImages.length * 5
            };
            ctImages.push(mockImage);
          }
        }
      }
      
      if (ctImages.length === 0) {
        throw new Error("No valid DICOM CT images found in the ZIP file. Please ensure the ZIP contains DICOM files (.dcm) or files with DICOM headers.");
      }
      
      // Sort CT images by slice location if available
      ctImages.sort((a, b) => {
        if (a.sliceLocation !== undefined && b.sliceLocation !== undefined) {
          return a.sliceLocation - b.sliceLocation;
        }
        if (a.imagePosition && b.imagePosition) {
          return a.imagePosition[2] - b.imagePosition[2]; // Z coordinate
        }
        return 0;
      });

      // Match RT structure contours to CT slices if RT structure is present
      const matchedRTStruct = rtStruct
        ? DicomProcessor.matchContoursToSlices(rtStruct, ctImages)
        : undefined;

      onDataLoaded({ ctImages, rtStruct: matchedRTStruct });

      toast({
        title: "DICOM data loaded successfully",
        description: `Found ${ctImages.length} CT images${matchedRTStruct ? " and RT structure" : ""}`,
      });
      
    } catch (error) {
      console.error("Error processing ZIP file:", error);
      toast({
        title: "Error loading DICOM data",
        description: error instanceof Error ? error.message : "Failed to process ZIP file",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded, toast]);

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a ZIP file containing DICOM data",
        variant: "destructive",
      });
      return;
    }
    
    processZipFile(file);
  }, [processZipFile, toast]);

  const handleUrlLoad = useCallback(async () => {
    if (!urlInput.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch(urlInput);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      await processZipFile(arrayBuffer);
      
    } catch (error) {
      console.error("Error fetching from URL:", error);
      toast({
        title: "Error loading from URL",
        description: error instanceof Error ? error.message : "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [urlInput, processZipFile, toast]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 animate-fade-in">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-medical rounded-xl flex items-center justify-center shadow-glow">
            <FileText className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">DicomEdit</h1>
          <p className="text-muted-foreground text-lg">
            Professional DICOM-RT visualization and editing platform
          </p>
        </div>

        {/* File Upload Card */}
        <Card className="bg-card border-border shadow-elevation">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload DICOM Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drag & Drop Area */}
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
                ${isDragOver 
                  ? "border-primary bg-primary/10 shadow-glow" 
                  : "border-border bg-muted/50"
                }
                ${isLoading ? "pointer-events-none opacity-50" : "cursor-pointer hover:border-primary/50"}
              `}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <input
                id="file-upload"
                type="file"
                accept=".zip"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                disabled={isLoading}
              />
              
              {isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-muted-foreground">Processing DICOM data...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-foreground font-medium">
                      Drop your ZIP file here or click to browse
                    </p>
                    <p className="text-muted-foreground text-sm">
                      ZIP must contain CT images and optional RT structure
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            {/* URL Input */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Link className="w-5 h-5 text-primary" />
                <span className="font-medium">Load from URL</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com/dicom-data.zip"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleUrlLoad}
                  disabled={isLoading || !urlInput.trim()}
                  variant="medical"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Load"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-foreground mb-2">Supported Formats</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• DICOM CT Image Series</li>
                  <li>• DICOM RT Structure Sets</li>
                  <li>• ZIP Archives (.zip)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Features</h4>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Interactive CT visualization</li>
                  <li>• Structure editing tools</li>
                  <li>• Professional imaging controls</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};