import { useState } from "react";
import { DicomLoader } from "@/components/DicomLoader";
import { NiftiLoader } from "@/components/NiftiLoader";
import { DicomViewer } from "@/components/DicomViewer";
import { DicomImage, DicomRTStruct } from "@/lib/dicom-utils";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface ImageData {
  ctImages: DicomImage[];
  rtStruct?: DicomRTStruct;
  probabilityMap?: Float32Array[];
}

const Index = () => {
  const [imageData, setImageData] = useState<ImageData | null>(null);

  const handleDataLoaded = (data: ImageData) => {
    setImageData(data);
  };

  const handleBackToLoader = () => {
    setImageData(null);
  };

  if (imageData) {
    return (
      <DicomViewer
        ctImages={imageData.ctImages}
        rtStruct={imageData.rtStruct}
        probabilityMap={imageData.probabilityMap}
        onBack={handleBackToLoader}
      />
    );
  }

  return (
    <Tabs defaultValue="dicom" className="p-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="dicom">DICOM</TabsTrigger>
        <TabsTrigger value="nifti">NIfTI</TabsTrigger>
      </TabsList>
      <TabsContent value="dicom">
        <DicomLoader onDataLoaded={handleDataLoaded} />
      </TabsContent>
      <TabsContent value="nifti">
        <NiftiLoader onDataLoaded={handleDataLoaded} />
      </TabsContent>
    </Tabs>
  );
};

export default Index;
