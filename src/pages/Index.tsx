import { useState } from "react";
import { DicomLoader } from "@/components/DicomLoader";
import { DicomViewer } from "@/components/DicomViewer";
import { DicomImage, DicomRTStruct } from "@/lib/dicom-utils";

interface DicomData {
  ctImages: DicomImage[];
  rtStruct?: DicomRTStruct;
}

const Index = () => {
  const [dicomData, setDicomData] = useState<DicomData | null>(null);

  const handleDataLoaded = (data: DicomData) => {
    setDicomData(data);
  };

  const handleBackToLoader = () => {
    setDicomData(null);
  };

  if (dicomData) {
    return (
      <DicomViewer 
        ctImages={dicomData.ctImages} 
        rtStruct={dicomData.rtStruct}
        onBack={handleBackToLoader}
      />
    );
  }

  return <DicomLoader onDataLoaded={handleDataLoaded} />;
};

export default Index;
