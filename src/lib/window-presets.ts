/**
 * Window/Level Presets for DICOM Viewing
 * Based on common clinical imaging protocols
 */

export interface WindowPreset {
  name: string;
  windowWidth: number;
  windowLevel: number;
  description: string;
}

export const WINDOW_PRESETS: WindowPreset[] = [
  {
    name: 'Lung',
    windowWidth: 1500,
    windowLevel: -600,
    description: 'Optimal for viewing lung parenchyma and air spaces'
  },
  {
    name: 'Bone',
    windowWidth: 2500,
    windowLevel: 480,
    description: 'Optimal for viewing bone structures and calcifications'
  },
  {
    name: 'Soft Tissue',
    windowWidth: 400,
    windowLevel: 40,
    description: 'General soft tissue visualization'
  },
  {
    name: 'Brain',
    windowWidth: 80,
    windowLevel: 40,
    description: 'Brain parenchyma visualization'
  },
  {
    name: 'Liver',
    windowWidth: 150,
    windowLevel: 30,
    description: 'Liver and abdominal organ visualization'
  },
  {
    name: 'Abdomen',
    windowWidth: 350,
    windowLevel: 40,
    description: 'General abdominal imaging'
  },
  {
    name: 'Mediastinum',
    windowWidth: 350,
    windowLevel: 50,
    description: 'Mediastinal structures and vasculature'
  },
];

export function getPresetByName(name: string): WindowPreset | undefined {
  return WINDOW_PRESETS.find(preset => preset.name === name);
}
