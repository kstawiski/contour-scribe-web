# DicomEdit TODO List

**Last Updated**: 2025-11-13

> This file tracks specific implementation tasks. For strategic planning, see [CLAUDE.md](./CLAUDE.md).

---

## 🔥 Critical (Do First)

### Keyboard Shortcuts System
- [ ] Create `src/hooks/useKeyboardShortcuts.ts`
  - [ ] Hook to manage keyboard event listeners
  - [ ] Support key combinations (Ctrl+Z, etc.)
  - [ ] Prevent conflicts with browser shortcuts
  - [ ] Context-aware shortcuts (only when focused)
- [ ] Implement shortcuts in `DicomViewer.tsx`
  - [ ] `B` - Brush tool
  - [ ] `E` - Eraser tool
  - [ ] `P` - Pan tool
  - [ ] `W` - Window/Level tool
  - [ ] `S` - Select/pointer tool
  - [ ] `[` / `]` - Previous/Next slice
  - [ ] `+` / `-` - Zoom in/out
  - [ ] `R` - Reset view
  - [ ] `Space + Drag` - Quick pan (override current tool)
  - [ ] `Escape` - Cancel current drawing
- [ ] Add keyboard shortcuts help modal
  - [ ] `?` or `H` to show help
  - [ ] List all shortcuts with icons
  - [ ] Close with `Escape` or click outside
- [ ] Show visual hints
  - [ ] Display current tool in corner
  - [ ] Show shortcut in button tooltips

**Files to Create/Modify**:
- `src/hooks/useKeyboardShortcuts.ts` (new)
- `src/components/KeyboardShortcutsHelp.tsx` (new)
- `src/components/DicomViewer.tsx` (modify)

**Estimated Time**: 4-6 hours

---

### Undo/Redo System
- [ ] Create `src/hooks/useHistory.ts`
  - [ ] Generic history stack implementation
  - [ ] `undo()`, `redo()`, `push()` methods
  - [ ] Configurable max history size (default 50)
  - [ ] Clear history on major state changes
- [ ] Integrate with `useDrawing.ts`
  - [ ] Snapshot structure state before mutations
  - [ ] Push to history on: add contour, delete contour, add structure
  - [ ] Implement `drawing.undo()` and `drawing.redo()`
  - [ ] Restore state from history snapshots
- [ ] Add UI controls
  - [ ] Undo button in toolbar (disabled when no history)
  - [ ] Redo button in toolbar (disabled when at latest)
  - [ ] Show "Undo [action]" tooltip
- [ ] Wire up keyboard shortcuts
  - [ ] `Ctrl+Z` / `Cmd+Z` - Undo
  - [ ] `Ctrl+Y` / `Cmd+Shift+Z` - Redo

**Files to Create/Modify**:
- `src/hooks/useHistory.ts` (new)
- `src/hooks/useDrawing.ts` (modify - add history integration)
- `src/components/DicomViewer.tsx` (modify - add UI buttons)

**Estimated Time**: 6-8 hours

**Complexity**: Medium (state snapshots can be tricky)

---

### HU Value Display on Hover
- [ ] Add mouse tracking to main canvas
  - [ ] Track mouse position in canvas coordinates
  - [ ] Convert to pixel coordinates in image
  - [ ] Sample pixel value from current CT image
  - [ ] Apply rescale slope/intercept to get HU value
- [ ] Create HU info overlay component
  - [ ] Show HU value at cursor
  - [ ] Show pixel coordinates (X, Y)
  - [ ] Show slice number and position
  - [ ] Optional: Show RGB values
  - [ ] Position near cursor (avoid obscuring image)
- [ ] Add crosshair cursor option
  - [ ] Toggle in settings/toolbar
  - [ ] Draw crosshair lines on canvas
  - [ ] Sync with mouse position
- [ ] Performance optimization
  - [ ] Debounce pixel sampling (every 50ms)
  - [ ] Only show when mouse is over image area

**Files to Create/Modify**:
- `src/components/HUOverlay.tsx` (new)
- `src/components/DicomViewer.tsx` (modify)
- `src/lib/dicom-utils.ts` (add `getHUValueAtPixel` function)

**Estimated Time**: 3-4 hours

---

### Code Splitting / Bundle Optimization
- [ ] Lazy load heavy components
  - [ ] Wrap `Admin` page with React.lazy()
  - [ ] Wrap `DicomViewer` with React.lazy()
  - [ ] Add loading fallback (spinner)
- [ ] Split vendor chunks
  - [ ] Configure Vite to split dicom-parser
  - [ ] Configure Vite to split JSZip
  - [ ] Configure Vite to split UI components
- [ ] Analyze bundle
  - [ ] Install `rollup-plugin-visualizer`
  - [ ] Generate bundle analysis
  - [ ] Identify largest chunks
- [ ] Tree-shake unused exports
  - [ ] Review and remove unused imports
  - [ ] Mark side-effect-free packages in package.json

**Files to Create/Modify**:
- `src/App.tsx` (add lazy loading)
- `vite.config.ts` (configure chunk splitting)
- `package.json` (add sideEffects field)

**Target**: Reduce main bundle from 570KB to <300KB

**Estimated Time**: 2-3 hours

---

## ⭐ High Priority

### Preset Window/Level Settings
- [ ] Create preset definitions
  - [ ] Define standard presets (Lung, Bone, Soft Tissue, Brain, Liver, Abdomen)
  - [ ] Allow custom presets (save to localStorage)
  - [ ] Export/import preset file
- [ ] Add preset dropdown
  - [ ] Dropdown button in toolbar
  - [ ] List of presets with icons
  - [ ] "Save current as preset" option
  - [ ] "Reset to defaults" option
- [ ] Keyboard shortcuts for top 5 presets
  - [ ] `1` - Lung
  - [ ] `2` - Bone
  - [ ] `3` - Soft Tissue
  - [ ] `4` - Brain
  - [ ] `5` - Liver
- [ ] Visual feedback
  - [ ] Show active preset name
  - [ ] Indicate when custom values (not a preset)

**Files to Create/Modify**:
- `src/lib/window-presets.ts` (new)
- `src/components/WindowPresetSelector.tsx` (new)
- `src/components/DicomViewer.tsx` (modify)

**Estimated Time**: 3-4 hours

---

### Structure Editing UI
- [ ] Make structure names editable
  - [ ] Double-click name to edit
  - [ ] Inline text input with validation
  - [ ] Save on Enter, cancel on Escape
  - [ ] Show edit icon on hover
- [ ] Add color picker
  - [ ] Color button next to structure name
  - [ ] Popover with color picker
  - [ ] Support hex input
  - [ ] Show recently used colors
- [ ] Add structure actions menu
  - [ ] Three-dot menu button per structure
  - [ ] Duplicate structure
  - [ ] Merge with another structure
  - [ ] Delete structure (with confirmation)
  - [ ] Export single structure
- [ ] Drag to reorder structures
  - [ ] Use dnd-kit or similar
  - [ ] Visual drag feedback
  - [ ] Save order preference

**Files to Create/Modify**:
- `src/components/StructureListItem.tsx` (new - extract from DicomViewer)
- `src/components/ColorPicker.tsx` (new or use existing library)
- `src/components/DicomViewer.tsx` (modify - use new components)
- `src/hooks/useDrawing.ts` (add rename, merge, duplicate methods)

**Estimated Time**: 6-8 hours

---

### Session Persistence
- [ ] Design session format
  - [ ] Include all structures and contours
  - [ ] Include viewer state (zoom, pan, slice, W/L)
  - [ ] Include metadata (timestamp, version)
  - [ ] Exclude actual DICOM pixel data (too large)
- [ ] Implement auto-save
  - [ ] Save to localStorage every 30 seconds
  - [ ] Debounce save on changes
  - [ ] Use unique session ID (timestamp)
  - [ ] Limit to last 5 sessions (delete old)
- [ ] Add session restore UI
  - [ ] Show "Resume previous session?" dialog on load
  - [ ] List recent sessions with preview
  - [ ] Option to discard and start fresh
- [ ] Manual export/import
  - [ ] "Export Session" button (JSON file)
  - [ ] "Import Session" button (load JSON)
  - [ ] Validate session file before loading
  - [ ] Merge or replace current session

**Files to Create/Modify**:
- `src/hooks/useSessionPersistence.ts` (new)
- `src/components/SessionRestoreDialog.tsx` (new)
- `src/pages/Index.tsx` (modify - show dialog)
- `src/lib/session-utils.ts` (new - validation, serialization)

**Estimated Time**: 6-8 hours

**Complexity**: Medium (localStorage size limits, error handling)

---

## 📊 Medium Priority

### Measurement Tools

#### Distance Measurement
- [ ] Add ruler tool to toolbar
- [ ] Click two points to measure
- [ ] Show line between points
- [ ] Display distance in mm
- [ ] Support multiple measurements on screen
- [ ] Delete measurement (click + Delete key)
- [ ] Export measurements to CSV

#### Area Calculation
- [ ] Add to structure context menu
- [ ] Calculate area per slice (pixel count × spacing)
- [ ] Display in mm² or cm²
- [ ] Show in structure list
- [ ] Export area table

#### Volume Calculation
- [ ] Calculate across all slices
- [ ] Sum of (area × slice thickness)
- [ ] Display in cm³ or mL
- [ ] Show in structure list
- [ ] Update in real-time as editing

**Files to Create/Modify**:
- `src/lib/measurement-utils.ts` (new)
- `src/components/RulerTool.tsx` (new)
- `src/components/DicomViewer.tsx` (modify)
- `src/hooks/useDrawing.ts` (add measurement state)

**Estimated Time**: 8-10 hours

---

### Contour Point Editing
- [ ] Implement contour selection
  - [ ] Click contour to select (highlight)
  - [ ] Show control points as circles
  - [ ] Different colors for selected/unselected
- [ ] Point manipulation
  - [ ] Drag individual points
  - [ ] Insert point (click on line segment)
  - [ ] Delete point (select + Delete key)
  - [ ] Snap to nearby contours (optional)
- [ ] Contour operations
  - [ ] Smooth selected contour
  - [ ] Simplify (reduce points)
  - [ ] Close/open contour
  - [ ] Reverse point order
- [ ] UI controls
  - [ ] "Edit Points" mode button
  - [ ] Point count display
  - [ ] "Accept" / "Cancel" buttons

**Files to Create/Modify**:
- `src/components/ContourEditor.tsx` (new)
- `src/lib/contour-utils.ts` (add simplification algorithm)
- `src/components/DicomViewer.tsx` (modify)
- `src/hooks/useDrawing.ts` (add point editing state)

**Estimated Time**: 10-12 hours

**Complexity**: High (complex interaction logic)

---

### DICOM Metadata Viewer
- [ ] Create metadata panel component
  - [ ] Collapsible sidebar or modal
  - [ ] Tabbed layout (Patient, Study, Series, Image)
- [ ] Display patient information
  - [ ] Patient Name (anonymize option)
  - [ ] Patient ID
  - [ ] Patient Birth Date
  - [ ] Patient Sex
  - [ ] Patient Age
- [ ] Display study information
  - [ ] Study Date & Time
  - [ ] Study Description
  - [ ] Study Instance UID
  - [ ] Accession Number
- [ ] Display series information
  - [ ] Series Description
  - [ ] Modality
  - [ ] Series Number
  - [ ] Number of Images
- [ ] Display image information
  - [ ] Image Position (Patient)
  - [ ] Image Orientation
  - [ ] Pixel Spacing
  - [ ] Slice Thickness
  - [ ] Window Center/Width defaults
- [ ] Copy values to clipboard
- [ ] Export metadata as JSON

**Files to Create/Modify**:
- `src/components/DicomMetadataPanel.tsx` (new)
- `src/lib/dicom-utils.ts` (add metadata extraction helper)
- `src/components/DicomViewer.tsx` (add panel)

**Estimated Time**: 4-6 hours

---

## 🚀 Nice to Have

### Advanced Drawing Tools
- [ ] Magic Wand Tool
  - [ ] Threshold-based selection
  - [ ] Tolerance slider
  - [ ] Contiguous vs. global mode
  - [ ] Convert selection to contour
- [ ] Region Growing
  - [ ] Click seed point
  - [ ] Grow based on HU similarity
  - [ ] Preview before accepting
  - [ ] Adjustable threshold
- [ ] Boolean Operations on Contours
  - [ ] Union (combine structures)
  - [ ] Intersection (overlapping area)
  - [ ] Subtraction (remove overlap)
  - [ ] Use proper polygon clipping library

**Estimated Time**: 20+ hours

**Complexity**: Very High

---

### Multi-Planar Reconstruction (MPR)
- [ ] Design 3-panel layout
- [ ] Implement sagittal view reconstruction
- [ ] Implement coronal view reconstruction
- [ ] Linked cursor across views
- [ ] Scroll synchronization
- [ ] Independent zoom/pan per panel
- [ ] Contour visualization in all planes

**Estimated Time**: 40+ hours

**Complexity**: Very High (requires significant refactoring)

---

## 🧪 Testing & Quality

### Unit Tests
- [ ] Set up Vitest
- [ ] Write tests for `contour-utils.ts`
  - [ ] interpolateContours
  - [ ] smoothContour
  - [ ] closeContour
- [ ] Write tests for `coordinate-utils.ts`
  - [ ] worldToCanvas
  - [ ] canvasToWorld
- [ ] Write tests for `dicom-utils.ts`
  - [ ] parseDicomFile
  - [ ] matchContoursToSlices
- [ ] Write tests for `rtstruct-export.ts`
  - [ ] exportRTStructAsJSON
  - [ ] exportRTStructAsCSV

**Target**: 80% coverage

**Estimated Time**: 12-16 hours

---

### E2E Tests
- [ ] Set up Playwright
- [ ] Test: Load DICOM → View → Export
- [ ] Test: Draw contour → Interpolate → Export
- [ ] Test: Edit existing RT structure
- [ ] Test: Error handling (invalid file)

**Estimated Time**: 8-10 hours

---

## 📝 Documentation

### User Guide
- [ ] Write step-by-step tutorials
- [ ] Add screenshots for each feature
- [ ] Create video walkthrough
- [ ] Troubleshooting section

**Estimated Time**: 6-8 hours

---

### API Documentation
- [ ] JSDoc comments for all public functions
- [ ] Generate API docs with TypeDoc
- [ ] Document export formats with examples
- [ ] Document coordinate systems clearly

**Estimated Time**: 4-6 hours

---

## 🔧 Technical Debt

### Refactoring Tasks
- [ ] Unify dual structure state
  - Currently using both `rtStructures` and `drawing.structures`
  - Refactor to single source of truth
  - Update all references
- [ ] Extract large components
  - `DicomViewer.tsx` is 900+ lines
  - Split into smaller focused components
- [ ] Improve error messages
  - Make user-friendly
  - Add suggested fixes
  - Better error boundaries

### Performance
- [ ] Profile and optimize rendering
- [ ] Add WebGL renderer option
- [ ] Optimize contour rendering for large datasets
- [ ] Lazy load contours (only render visible slices)

---

## 📋 Notes

### Blocked Items
- **Actual DICOM RT Export**: Requires dcmjs or similar library (heavy dependency)
- **Multi-user Editing**: Requires backend infrastructure

### Deferred Items
- 3D Visualization: Out of scope for v1.0
- Backend Integration: Client-side only for now
- HIPAA Compliance: Requires significant infrastructure

---

**Last reviewed**: 2025-11-13
**Next review**: After completing Phase 1 (Critical items)
