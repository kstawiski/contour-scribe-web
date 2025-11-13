# DicomEdit Development Guide

**Last Updated**: 2025-11-13
**Current Version**: 0.7.0
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
- **Undo/Redo System**: Complete history management for contour operations (v0.6.0)
  - Implemented useHistory hook with snapshot-based state management
  - Integrated history into useDrawing hook for seamless undo/redo
  - Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+Shift+Z (redo alternate)
  - UI buttons with disabled state when no history available
  - 50-action history limit (configurable)
  - Toast notifications for undo/redo actions
  - Tracks: drawing, erasing, adding/removing structures, clearing slices
  - Visibility toggles don't create history entries (UI-only state)
- **Code Splitting & Bundle Optimization**: Reduced initial bundle size (v0.5.0)
  - Implemented lazy loading for all routes (Admin, Index, NotFound)
  - Configured Vite manual chunk splitting for vendor libraries
  - Split into focused chunks: react-vendor (157KB), utils-vendor (146KB), ui-vendor (112KB), medical-vendor (62KB)
  - Eliminated 500KB chunk size warning (largest chunk now 157KB)
  - Improved browser caching with separate vendor chunks
  - Added loading fallback component with spinner
  - Better initial page load performance (parallel chunk downloads)
- **HU Value Display on Hover**: Real-time Hounsfield Unit display (v0.4.0)
  - Live HU value calculation as cursor moves
  - Automatic tissue type classification (Air, Lung, Fat, Soft Tissue, Bone, Metal)
  - Pixel coordinate display
  - Optional crosshair cursor for precision
  - Keyboard shortcuts (Ctrl+H to toggle, X for crosshair)
  - Smart positioning near cursor
- **Keyboard Shortcuts System**: Complete keyboard navigation and shortcuts (v0.3.0)
  - Tool selection (B, E, P, W, S)
  - Navigation ([, ], +, -, R)
  - Actions (Ctrl+S, I, Escape)
  - Quick structure selection (1-9)
  - Help modal (? or H)
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

- [x] **Keyboard Shortcuts** ✅ Completed (v0.3.0)
  - ✅ `B` - Brush tool
  - ✅ `E` - Eraser
  - ✅ `P` - Pan tool
  - ✅ `W` - Window/Level tool
  - ✅ `[` / `]` - Previous/Next slice
  - ✅ `Ctrl+S` - Quick export
  - ✅ `1-9` - Quick structure selection
  - ✅ `?` / `H` - Show keyboard shortcuts help
  - ✅ `R` - Reset view
  - ✅ `+` / `-` - Zoom in/out
  - ✅ `I` - Interpolate contours
  - ✅ `Escape` - Cancel polygon drawing
  - ✅ `Ctrl+Z` / `Ctrl+Y` - Undo/Redo (v0.6.0)
  - Note: Space+Drag for future (needs additional features)
  - Files: `src/hooks/useKeyboardShortcuts.ts`, `src/components/KeyboardShortcutsHelp.tsx`, `DicomViewer.tsx`

- [x] **Undo/Redo System** ✅ Completed (v0.6.0)
  - ✅ History stack for contour operations
  - ✅ Support for Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
  - ✅ Snapshot-based state management
  - ✅ 50-action history limit (configurable)
  - ✅ UI buttons with disabled states
  - ✅ Toast notifications
  - Files: `src/hooks/useHistory.ts`, `useDrawing.ts`, `DicomViewer.tsx`

- [x] **HU Value Display on Hover** ✅ Completed (v0.4.0)
  - ✅ Show Hounsfield Unit at cursor position
  - ✅ Display pixel coordinates
  - ✅ Optional crosshair cursor
  - ✅ Info panel overlay with tissue type classification
  - ✅ Keyboard shortcuts (Ctrl+H, X)
  - Files: `HUOverlay.tsx`, `dicom-utils.ts`, `DicomViewer.tsx`

- [x] **Code Splitting** ✅ Completed (v0.5.0)
  - ✅ Lazy load Admin page
  - ✅ Lazy load Index and NotFound pages
  - ✅ Split vendor dependencies into focused chunks
  - ✅ Reduced largest chunk from 586KB to 157KB (no more warnings)
  - ✅ Better caching with manual chunk configuration
  - Files: `App.tsx`, `vite.config.ts`

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
- **Mock Data Fallback**: DicomLoader creates fake data on parse failure - should show error instead (Priority: MEDIUM)

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

### v0.7.0 (2025-11-13)
**Major Feature**:
- **Complete UI/UX Redesign**: Dramatically improved interface intuitiveness and usability
  - **Fixed Critical Bug**: Mouse wheel scrolling through slices now works properly
    - Added missing onWheel event handler to DrawingCanvas overlay
    - Wheel events now properly forward from drawing overlay to main canvas
  - **New Layout Architecture**:
    - Compact top header with essential actions (Back, Undo/Redo, Reset, Export, Shortcuts)
    - Left vertical tool sidebar with icon + label buttons (easier to find tools)
    - Prominent bottom slice navigation bar with << < slider > >> controls
    - Consolidated right sidebar with Image Controls, Drawing Settings, and Structures
  - **Tool Organization**:
    - Viewer tools (Select, Pan, W/L) grouped together on left sidebar
    - Drawing tools (Brush, Polygon, Eraser) grouped below viewer tools
    - Each tool button shows icon, label, and tooltip with keyboard shortcut
  - **Slice Navigation Improvements**:
    - Moved from hidden right panel to prominent bottom bar
    - Added first/last slice buttons (<< and >>)
    - Large visible slider with current slice indicator
    - Clear "Slice X / Total" counter display
  - **Better Visual Feedback**:
    - Context-sensitive help text on canvas (top-left corner with emoji icons)
    - Clear tooltips on all buttons with keyboard shortcut hints
    - Color-coded tool buttons (medical green for drawing, red for eraser)
    - Active tool highlighting with background color
  - **Improved Information Display**:
    - Compact header showing slice count and RT structure status
    - Structures panel shows count in header
    - Reduced font sizes and spacing for more screen space
    - Better use of vertical space

**Benefits**:
- **Mouse wheel navigation now works** - users can scroll through slices with any tool active
- **Much more intuitive** - tools are clearly labeled and organized logically
- **Slice navigation is prominent** - no longer hidden, easy to see and use
- **Larger canvas area** - more space for actual medical image viewing
- **Faster workflow** - everything is accessible with fewer clicks
- **Better for new users** - self-explanatory interface with helpful tooltips

**Technical Changes**:
- Added `onWheel` prop to DrawingCanvas component (line 207 in DrawingCanvas.tsx)
- Complete reorganization of DicomViewer.tsx layout structure:
  - Changed from horizontal 3-panel layout to structured top/left/center/right/bottom layout
  - Reduced header height (compact design)
  - Changed right sidebar from 2 panels (80px + 80px) to 1 consolidated panel (72px)
  - Added left tool sidebar (16px width, vertical layout)
  - Added prominent bottom navigation bar with border-primary highlight
- Added `getImageBounds` helper function for HU overlay positioning
- Enhanced button titles/tooltips throughout the interface
- Used emoji icons in context help for better visual communication

**Files Changed**: 2 files (DrawingCanvas.tsx, DicomViewer.tsx), ~500 lines modified
**Build**: Successful (Index chunk: 62.58 KB, +1.65 KB from v0.6.0)
**Bundle sizes maintained**: No significant increase, still under 157KB largest chunk

### v0.6.0 (2025-11-13)
**Major Feature**:
- **Undo/Redo System**: Complete history management for contour editing
  - Created useHistory hook for generic state history management
  - Integrated history into useDrawing hook with snapshot-based approach
  - Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+Shift+Z (redo alternate)
  - UI buttons with proper disabled states and tooltips
  - 50-action history limit (configurable via maxHistorySize option)
  - Toast notifications for user feedback on undo/redo actions
  - Tracks all editing operations: drawing, erasing, adding/removing structures, clearing slices
  - Visibility toggles excluded from history (UI-only state, not data mutation)

**Technical Implementation**:
- useHistory hook with past/present/future stack pattern
- Automatic history recording with optional recordHistory flag
- Undo/redo flag to prevent circular history recording
- canUndo and canRedo computed properties
- clearHistory function for data reload scenarios

**Benefits**:
- Users can confidently edit without fear of mistakes
- Essential clinical feature for precision medical work
- Improved workflow efficiency (no need to redraw from scratch)
- Standard UX pattern familiar to all users

**Files Changed**: 3 files (1 new, 2 modified), 239 additions, 40 deletions
**New Files**: `src/hooks/useHistory.ts`
**Modified Files**: `src/hooks/useDrawing.ts`, `src/components/DicomViewer.tsx`
**Build**: Successful (Index chunk: 60.93 KB, +2.63 KB from v0.5.0)

### v0.5.0 (2025-11-13)
**Major Feature**:
- **Code Splitting & Bundle Optimization**: Dramatically improved loading performance
  - Implemented React.lazy for all route components (Index, Admin, NotFound)
  - Added Suspense with loading fallback spinner
  - Configured Vite manual chunk splitting for vendor libraries
  - Split into focused chunks: react-vendor (157KB), utils-vendor (146KB), ui-vendor (112KB), medical-vendor (62KB)
  - Eliminated 500KB chunk size warning (largest chunk reduced from 586KB to 157KB)
  - Improved browser caching with separate vendor chunks
  - Better initial page load with parallel chunk downloads

**Benefits**:
- Admin page only loads when user visits /admin (saves 5KB on initial load)
- Vendor chunks cached separately for faster repeat visits
- No more build warnings about large chunks
- Better perceived performance with loading states

**Files Changed**: 2 files modified (App.tsx, vite.config.ts), 50 additions, 5 deletions
**Build**: Successful (11 chunks total, largest 157KB)

### v0.4.0 (2025-11-13)
**Major Feature**:
- **HU Value Display on Hover**: Real-time Hounsfield Unit display for tissue identification
  - Created HUOverlay component with info card and optional crosshair
  - Extended DicomImage interface with additional metadata fields
  - Implemented getHUValueAtPixel() and getPixelInfo() utilities
  - Automatic tissue type classification (Air, Lung, Fat, Water, Soft Tissue, Blood, Bone, Metal)
  - Real-time calculation on mouse move with pixel coordinate display
  - Keyboard shortcuts: Ctrl+H (toggle overlay), X (toggle crosshair)
  - Smart positioning near cursor to avoid obstruction

**Benefits**:
- Essential clinical feature for radiologists to identify tissue types
- Instant feedback on HU values without external tools
- Improved diagnostic accuracy with tissue classification
- Non-intrusive overlay that doesn't interfere with workflow

**Files Changed**: 3 files (1 new, 2 modified), 316 additions, 4 deletions
**Build**: Successful (bundle size: 586KB)

### v0.3.0 (2025-11-13)
**Major Feature**:
- **Keyboard Shortcuts System**: Comprehensive keyboard navigation
  - useKeyboardShortcuts hook for generic keyboard handling
  - KeyboardShortcutsHelp modal with categorized shortcuts
  - Tool selection shortcuts (B, E, P, W, S)
  - Navigation shortcuts ([, ], +, -, R)
  - Action shortcuts (Ctrl+S, I, Escape)
  - Quick structure selection (1-9)
  - Help toggle (? or H)
  - Platform-aware display (⌘ on Mac, Ctrl on others)
  - Context-aware (doesn't interfere with text inputs)

**Benefits**:
- Significantly faster workflow for medical professionals
- Reduced mouse movements and clicks
- Improved accessibility with keyboard-only navigation
- Easy discoverability through help modal

**Files Changed**: 3 files, 407 additions, 9 deletions
**Build**: Successful (bundle size: 582KB)

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
