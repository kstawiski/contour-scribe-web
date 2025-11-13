# DicomEdit Development Guide

**Last Updated**: 2025-11-13
**Current Version**: 0.2.0
**Status**: Active Development

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Current Status](#current-status)
4. [Feature Roadmap](#feature-roadmap)
5. [Development Guidelines](#development-guidelines)
6. [API Documentation](#api-documentation)
7. [Known Issues & Technical Debt](#known-issues--technical-debt)
8. [Testing Strategy](#testing-strategy)
9. [Deployment](#deployment)
10. [Contributing](#contributing)

---

## 🎯 Project Overview

### Purpose
DicomEdit is a specialized, web-based medical imaging tool for visualization and modification of DICOM-RT (Radiation Therapy) files. It enables medical professionals to:
- Load and view CT scan image series
- Visualize RT Structure Sets (contours/segmentations)
- Create and modify contours using intuitive drawing tools
- Export modifications as DICOM-RT compliant files

### Target Users
- Radiologists
- Oncologists
- Medical Researchers
- Radiation Therapy Planning Teams

### Technology Stack
- **Frontend**: React 18.3.1 + TypeScript 5.5.3
- **Build Tool**: Vite 5.4.1 with SWC
- **UI Framework**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 3.4.11
- **Medical Imaging**: dicom-parser 1.8.21, nifti-reader-js 0.8.0
- **File Handling**: JSZip 3.10.1, file-saver 2.0.5
- **State Management**: React hooks (local state)
- **Router**: React Router DOM 6.26.2

---

## 🏗️ Architecture

### Directory Structure
```
src/
├── components/
│   ├── DicomLoader.tsx           # ZIP file loading & DICOM parsing
│   ├── DicomViewer.tsx           # Main viewer with rendering & editing
│   ├── DrawingCanvas.tsx         # Transparent overlay for contour drawing
│   ├── NiftiLoader.tsx           # NIfTI file support
│   ├── ErrorBoundary.tsx         # Application-wide error handling
│   └── ui/                       # 49 shadcn/ui components
├── hooks/
│   ├── useDrawing.ts             # Drawing state & tool management
│   ├── use-toast.ts              # Toast notifications
│   └── use-mobile.tsx            # Mobile detection
├── lib/
│   ├── dicom-utils.ts            # DICOM parsing & processing
│   ├── nifti-utils.ts            # NIfTI volume handling
│   ├── contour-utils.ts          # Contour operations (interpolation, smoothing)
│   ├── coordinate-utils.ts       # World ↔ Canvas coordinate transforms
│   ├── rtstruct-export.ts        # RT Structure Set export utilities
│   └── utils.ts                  # General utilities
├── pages/
│   ├── Index.tsx                 # Main application page
│   ├── Admin.tsx                 # Admin panel (basic)
│   └── NotFound.tsx              # 404 page
├── App.tsx                       # Router & providers setup
├── main.tsx                      # Application entry point
└── index.css                     # Global styles & theme
```

### Component Hierarchy
```
App (ErrorBoundary, Router, QueryClient)
└── Index
    └── DicomLoader
        └── DicomViewer
            ├── Canvas (main rendering)
            └── DrawingCanvas (overlay)
```

### Data Flow
1. **Loading**: User uploads ZIP → DicomLoader parses → extracts CT images & RT structures
2. **Rendering**: DicomViewer receives data → renders to canvas → applies window/level
3. **Interaction**: User draws → useDrawing hook manages state → DrawingCanvas renders
4. **Export**: User clicks download → rtstruct-export transforms data → saves file

### State Management
- **Local State**: Component-level useState for UI (zoom, pan, slice)
- **Drawing State**: Custom hook `useDrawing` for contour/structure management
- **RT Structures**: Dual state system (rtStructures for original, drawing.structures for edits)

---

## ✅ Current Status

### Completed Features (v0.2.0)

#### Core Functionality
- ✅ DICOM CT image loading from ZIP files
- ✅ URL-based DICOM data loading
- ✅ RT Structure Set parsing and visualization
- ✅ Multi-slice navigation (slider + mouse wheel)
- ✅ Window/Level adjustment (interactive + sliders)
- ✅ Zoom and Pan controls
- ✅ NIfTI file support with probability maps

#### Drawing & Editing Tools
- ✅ Brush tool (freehand drawing)
- ✅ Polygon tool (point-by-point)
- ✅ Eraser tool (proximity-based)
- ✅ Adjustable brush size (1-20px)
- ✅ Adjustable eraser size (5-50px)
- ✅ Auto-contour closing
- ✅ Light contour smoothing

#### Structure Management
- ✅ Create new structures with auto-coloring
- ✅ Toggle structure visibility
- ✅ Structure selection and editing mode
- ✅ Contour interpolation between slices (proper linear interpolation)
- ✅ Multiple structures per dataset

#### Export & Save
- ✅ RT Structure export as JSON (DICOM-RT representation)
- ✅ RT Structure export as CSV (analysis format)
- ✅ RT Structure export as research JSON
- ✅ Proper coordinate transformation (world → DICOM patient coordinates)
- ✅ Full metadata preservation

#### Viewer Tools
- ✅ Pan tool with mouse drag
- ✅ Window/Level tool with mouse interaction
- ✅ Zoom tool with mouse wheel
- ✅ Scroll tool for slice navigation
- ✅ Reset view to defaults

#### Technical Improvements
- ✅ Error boundary for graceful error handling
- ✅ Coordinate transformation utilities (reusable)
- ✅ Memory leak prevention (canvas reuse)
- ✅ Proper RT contour → slice matching
- ✅ Build optimization (successful production build)

### Recently Completed (Nov 13, 2025)
- Fixed interpolation algorithm (now uses proper linear interpolation)
- Implemented RT Structure export functionality (3 formats)
- Fixed Pan and Window/Level interactive tools
- Created coordinate utilities module
- Added application-wide ErrorBoundary
- Optimized canvas operations (memory leak fixes)
- Enhanced RT structure slice matching

---

## 🗺️ Feature Roadmap

### Phase 1: Critical UX Improvements (1-2 weeks)
**Priority**: HIGH

- [ ] **Keyboard Shortcuts**
  - `B` - Brush tool
  - `E` - Eraser
  - `P` - Pan tool
  - `W` - Window/Level tool
  - `Space + Drag` - Quick pan
  - `[` / `]` - Previous/Next slice
  - `Ctrl+Z` / `Ctrl+Y` - Undo/Redo
  - `Ctrl+S` - Quick export
  - `Delete` - Remove selected contour
  - `1-9` - Quick structure selection
  - Files: `src/hooks/useKeyboardShortcuts.ts`, update `DicomViewer.tsx`

- [ ] **Undo/Redo System**
  - History stack for contour operations
  - Support for Ctrl+Z / Ctrl+Y
  - Snapshot-based state management
  - Limit history size (e.g., 50 operations)
  - Files: `src/hooks/useHistory.ts`, integrate into `useDrawing.ts`

- [ ] **HU Value Display on Hover**
  - Show Hounsfield Unit at cursor position
  - Display pixel coordinates
  - Optional crosshair cursor
  - Info panel overlay
  - Files: update `DicomViewer.tsx`, `DrawingCanvas.tsx`

- [ ] **Code Splitting**
  - Lazy load Admin page
  - Lazy load DicomViewer component
  - Split large dependencies
  - Reduce initial bundle from 570KB to <300KB
  - Files: update `App.tsx`, `pages/Index.tsx`

### Phase 2: Clinical Features (2-3 weeks)
**Priority**: MEDIUM-HIGH

- [ ] **Preset Window/Level Settings**
  - Dropdown with presets: Lung, Bone, Soft Tissue, Brain, Liver
  - Custom preset saving (localStorage)
  - Quick keyboard shortcuts for presets
  - Files: `src/lib/window-presets.ts`, update `DicomViewer.tsx`

- [ ] **Structure Management UI**
  - Rename structures (inline editing)
  - Change structure colors (color picker)
  - Duplicate structures
  - Merge structures (boolean union)
  - Delete structures with confirmation
  - Files: new `StructureManager.tsx` component

- [ ] **Contour Point Editing**
  - Click contour to select and show control points
  - Drag individual points to adjust
  - Insert points between existing ones
  - Delete points
  - Smooth selected contour
  - Simplify contour (reduce points)
  - Files: new `ContourEditor.tsx`, update contour-utils

- [ ] **Measurement Tools**
  - Distance measurement (ruler tool)
  - Area calculation per slice
  - Volume calculation across slices
  - Angle measurement
  - Export measurements to CSV
  - Display measurements overlay
  - Files: new `src/lib/measurement-utils.ts`, new tool components

- [ ] **Session Persistence**
  - Auto-save to localStorage every 30 seconds
  - "Resume previous session" dialog on load
  - Export/import session as JSON
  - Session history management
  - Files: `src/hooks/useSessionPersistence.ts`

### Phase 3: Advanced Features (1-2 months)
**Priority**: MEDIUM

- [ ] **Actual DICOM RT File Export**
  - Generate proper DICOM RT Structure Set files (not just JSON)
  - Use dcmjs library or similar
  - Full DICOM tag compliance
  - Validation before export
  - Files: update `rtstruct-export.ts`, add dependencies

- [ ] **DICOM Metadata Viewer**
  - Patient info panel (name, ID, DOB)
  - Study/Series metadata
  - Image dimensions, spacing, orientation
  - Modality and equipment info
  - Files: new `DicomMetadataPanel.tsx`

- [ ] **Contour Propagation**
  - Copy contour to next N slices
  - Rigid registration + copy
  - Smart interpolation with live preview
  - Propagation settings dialog
  - Files: new `src/lib/propagation-utils.ts`

- [ ] **Advanced Drawing Tools**
  - Magic wand (threshold-based selection)
  - Region growing algorithm
  - Polygon boolean operations (union, intersect, subtract)
  - Brush opacity/hardness controls
  - Files: update `drawing-engine.ts`, new algorithms

- [ ] **Multi-Planar Reconstruction (MPR)**
  - 3-panel layout (axial, sagittal, coronal)
  - Linked cursor across views
  - Scroll synchronization
  - Independent zoom/pan per panel
  - Files: new `MPRViewer.tsx`, significant refactor

### Phase 4: Production Readiness (Ongoing)
**Priority**: VARIABLE

- [ ] **Testing Infrastructure**
  - Vitest unit tests for utilities
  - React Testing Library for components
  - Playwright E2E tests
  - Test coverage >80%
  - CI/CD integration
  - Files: `tests/` directory, vitest config

- [ ] **Documentation**
  - JSDoc comments on all public functions
  - User guide with screenshots
  - API documentation for exports
  - Video tutorials
  - Files: `docs/` directory, update README

- [ ] **Accessibility**
  - ARIA labels for all interactive elements
  - Keyboard-only navigation support
  - Screen reader compatibility
  - High contrast mode
  - Focus indicators
  - Files: update all components

- [ ] **Internationalization**
  - i18n framework setup (react-i18next)
  - English (default)
  - Spanish, French, German, Chinese
  - RTL support
  - Files: `src/i18n/`, update all text

---

## 👨‍💻 Development Guidelines

### Code Style
- **TypeScript**: Strict mode enabled, avoid `any` unless necessary
- **React**: Functional components with hooks (no class components)
- **Naming**:
  - Components: PascalCase (`DicomViewer.tsx`)
  - Utilities: camelCase (`dicom-utils.ts`)
  - Hooks: `use` prefix (`useDrawing.ts`)
  - Constants: UPPER_SNAKE_CASE
- **Comments**: JSDoc for public APIs, inline for complex logic
- **File Size**: Keep components <500 lines; extract if larger

### Git Workflow
- **Branches**: Feature branches from main (`feature/keyboard-shortcuts`)
- **Commits**: Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- **PR Process**: All changes via pull request with description
- **Review**: At least one approval for production code

### Testing Requirements
- Unit tests for all utilities (target 90% coverage)
- Integration tests for critical workflows
- Visual regression tests for UI components
- Manual testing checklist for new features

### Performance Guidelines
- Canvas rendering: Target 60fps for smooth panning/zooming
- Initial load: <3 seconds on standard connection
- Bundle size: Keep main bundle <300KB gzipped
- Memory: Monitor for leaks with Chrome DevTools
- Use React.memo() for expensive re-renders

### Security Considerations
- No patient data sent to external servers
- All processing client-side only
- Sanitize file uploads (validate DICOM headers)
- CSP headers for production deployment
- Regular dependency audits (`npm audit`)

---

## 📚 API Documentation

### Coordinate System

#### World Coordinates (DICOM Patient Coordinates)
- Origin: DICOM Image Position (Patient)
- Units: millimeters
- Used for: RT structure contour points

#### Canvas Coordinates
- Origin: Top-left corner of canvas
- Units: pixels
- Used for: Mouse interactions, rendering

#### Transformations
```typescript
import { worldToCanvas, canvasToWorld } from '@/lib/coordinate-utils';

const config = {
  canvasSize: 800,
  zoom: 1.5,
  pan: { x: 0, y: 0 }
};

// World → Canvas
const canvasPoint = worldToCanvas(100, 200, dicomImage, config);

// Canvas → World
const worldPoint = canvasToWorld(400, 300, dicomImage, config);
```

### Export Formats

#### JSON (DICOM-RT Representation)
```json
{
  "metadata": {
    "version": "1.0",
    "exportDate": "2025-11-13T10:30:00Z",
    "modality": "RTSTRUCT"
  },
  "structures": [{
    "id": "edit_1234",
    "name": "GTV",
    "color": "#ff8844",
    "contours": [{
      "sliceIndex": 10,
      "sopInstanceUID": "1.2.3...",
      "contourData": [x1, y1, z1, x2, y2, z2, ...]
    }]
  }]
}
```

#### CSV (Analysis Format)
```csv
Structure ID,Structure Name,Contour ID,Slice Index,Point Index,X,Y,Z,Slice Location
edit_1234,GTV,contour_1,10,0,100.5,200.3,150.0,150.0
```

### Drawing Hook API

```typescript
import { useDrawing } from '@/hooks/useDrawing';

const drawing = useDrawing();

// Tool management
drawing.setTool('brush' | 'eraser' | 'polygon' | 'select');
drawing.setBrushSize(10); // pixels
drawing.setEraserSize(20); // pixels

// Structure management
drawing.addStructure({ id, name, color, visible });
drawing.setActiveStructure(id);
drawing.toggleStructureVisibility(id);

// Drawing operations
drawing.startDrawing(worldPoint);
drawing.addPoint(worldPoint);
drawing.finishDrawing(sliceIndex);
drawing.eraseAt(worldPoint, sliceIndex);

// Query
const contours = drawing.getContoursForSlice(sliceIndex);
const structure = drawing.structures.find(s => s.id === id);
```

---

## ⚠️ Known Issues & Technical Debt

### Critical Issues
- **No Undo/Redo**: Users can't recover from mistakes (Priority: HIGH)
- **Mock Data Fallback**: DicomLoader creates fake data on parse failure - should show error instead (Priority: MEDIUM)
- **Bundle Size**: 570KB exceeds 500KB warning (Priority: MEDIUM)

### Technical Debt
1. **Dual Structure State**: RT structures stored in both `rtStructures` state and `drawing.structures` - prone to sync issues
   - File: `DicomViewer.tsx:66-83, 358-363`
   - Impact: Medium
   - Effort: Medium (refactor to single source of truth)

2. **No Unit Tests**: Zero test coverage
   - Impact: High (confidence in changes)
   - Effort: High (write test suite)

3. **Limited Error Handling**: DICOM parsing errors not always user-friendly
   - Files: `DicomLoader.tsx`, `dicom-utils.ts`
   - Impact: Medium
   - Effort: Low (improve error messages)

4. **No Loading Indicators**: Large files freeze UI during processing
   - Files: `DicomLoader.tsx`, `DicomViewer.tsx`
   - Impact: Medium
   - Effort: Low (add loading states)

5. **Canvas Context Checks**: Not always validating context retrieval
   - Files: Multiple canvas rendering locations
   - Impact: Low (silent failures)
   - Effort: Low (add null checks)

### Browser Compatibility
- **Tested**: Chrome 120+, Firefox 121+, Edge 120+
- **Not Tested**: Safari, mobile browsers
- **Known Issues**: None reported

### Performance Concerns
- Large datasets (>500 slices) may cause lag
- Probability map rendering is CPU-intensive
- No WebGL acceleration (CPU-only rendering)

---

## 🧪 Testing Strategy

### Unit Testing (Not Implemented)
**Target Coverage**: 90%

Priority test files:
```
tests/
├── lib/
│   ├── contour-utils.test.ts      # Interpolation, smoothing
│   ├── coordinate-utils.test.ts   # Transformations
│   ├── dicom-utils.test.ts        # Parsing logic
│   └── rtstruct-export.test.ts    # Export formats
├── hooks/
│   └── useDrawing.test.ts         # Drawing state
└── components/
    └── DicomViewer.test.tsx       # Rendering logic
```

### Integration Testing (Not Implemented)
**E2E Scenarios**:
1. Load DICOM ZIP → View images → Draw contour → Export → Validate file
2. Load RT structure → Toggle visibility → Edit contour → Export
3. Use interpolation → Verify intermediate slices
4. Pan/Zoom → Verify coordinate accuracy

### Manual Testing Checklist
**Before Each Release**:
- [ ] Load test DICOM dataset (provided)
- [ ] Navigate through all slices
- [ ] Draw contours on 3+ slices
- [ ] Test interpolation between slices
- [ ] Toggle structure visibility
- [ ] Adjust window/level
- [ ] Pan and zoom
- [ ] Export structures (all formats)
- [ ] Reload exported file
- [ ] Test error handling (invalid files)

### Test Data
**Location**: Not included (HIPAA compliance)
**Required**:
- Sample CT dataset (non-identifiable, 50-100 slices)
- Sample RT Structure Set
- Invalid DICOM files for error testing
- Edge cases (single slice, missing metadata)

---

## 🚀 Deployment

### Development
```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

### Production Build
```bash
npm run build
# Output: dist/
```

### Build Configuration
- **Target**: ES2020
- **Minification**: Enabled (esbuild)
- **Source Maps**: Enabled in dev, disabled in prod
- **Public Path**: `/`

### Environment Variables
Currently none required (all client-side).

Future considerations:
- `VITE_API_URL` - If backend integration added
- `VITE_SENTRY_DSN` - Error tracking
- `VITE_ANALYTICS_ID` - Usage analytics

### Hosting Recommendations
- **Vercel**: Zero-config, automatic deployments
- **Netlify**: Good for SPA, redirect rules
- **AWS S3 + CloudFront**: For HIPAA compliance
- **Self-hosted**: Nginx with proper CORS headers

### HIPAA Compliance Notes
⚠️ **Current Status**: NOT HIPAA compliant

Requirements for compliance:
- [ ] BAA with hosting provider
- [ ] Encrypted data at rest and in transit
- [ ] Audit logging
- [ ] User authentication & authorization
- [ ] Session timeout
- [ ] Data anonymization tools
- [ ] Access controls
- [ ] Regular security audits

---

## 🤝 Contributing

### For Claude Developers
This file is designed to help you quickly understand the project state and pick up where previous sessions left off.

**Before Starting Work**:
1. Read "Current Status" to understand what's done
2. Check "Feature Roadmap" for planned work
3. Review "Known Issues" to avoid duplicate fixes
4. Follow "Development Guidelines" for code consistency

**After Completing Work**:
1. Update "Current Status" with completed features
2. Move roadmap items to "Current Status" when done
3. Add any new issues to "Known Issues"
4. Update "Last Updated" date at top
5. Increment version if significant changes

**Version Numbering**:
- Major (X.0.0): Breaking changes, major features
- Minor (0.X.0): New features, significant improvements
- Patch (0.0.X): Bug fixes, small tweaks

### For Human Developers
**Pull Request Checklist**:
- [ ] Code follows style guidelines
- [ ] Updated CLAUDE.md if significant changes
- [ ] Added tests for new features
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing completed
- [ ] Documentation updated if API changes

---

## 📝 Change Log

### v0.2.0 (2025-11-13)
**Major Improvements**:
- Implemented RT Structure export (JSON, CSV, Research formats)
- Fixed contour interpolation algorithm (proper linear interpolation)
- Added Pan and Window/Level interactive tools
- Created coordinate transformation utilities module
- Added application-wide ErrorBoundary
- Optimized canvas operations (memory leak fixes)
- Enhanced RT structure slice matching

**Files Changed**: 7 files modified, 763 additions, 112 deletions

### v0.1.0 (Initial)
**Features**:
- DICOM CT image loading and viewing
- RT Structure Set visualization
- Basic drawing tools (brush, eraser, polygon)
- Structure management
- NIfTI support
- Admin panel skeleton

---

## 📞 Support & Resources

### Documentation Links
- **DICOM Standard**: https://www.dicomstandard.org/
- **RT Structure Set**: https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_A.19.html
- **React Docs**: https://react.dev/
- **Vite Guide**: https://vitejs.dev/guide/
- **shadcn/ui**: https://ui.shadcn.com/

### Medical Imaging Resources
- **Cornerstone.js** (reference): https://www.cornerstonejs.org/
- **OHIF Viewer** (reference): https://ohif.org/
- **dicom-parser**: https://github.com/cornerstonejs/dicomParser

### Libraries Used
- dicom-parser: DICOM file parsing
- JSZip: ZIP file handling
- file-saver: Client-side file downloads
- nifti-reader-js: NIfTI volume loading

---

## 🎯 Quick Start for New Claude Sessions

**Most Common Tasks**:

1. **Add Keyboard Shortcut**:
   - Create/update `src/hooks/useKeyboardShortcuts.ts`
   - Import in `DicomViewer.tsx`
   - Add useEffect listener

2. **Add New Tool**:
   - Add to `DrawingTool` type in `useDrawing.ts`
   - Implement tool logic in `DicomViewer.tsx`
   - Add button to toolbar UI

3. **Add Export Format**:
   - Create export function in `rtstruct-export.ts`
   - Update `exportRTStruct()` switch case
   - Add format option to UI

4. **Fix Bug**:
   - Check "Known Issues" section first
   - Add test case if possible
   - Update "Known Issues" when fixed

5. **Add Feature**:
   - Check "Feature Roadmap" for context
   - Follow "Development Guidelines"
   - Update CLAUDE.md when complete

---

**End of CLAUDE.md**
*This is a living document. Keep it updated!*
