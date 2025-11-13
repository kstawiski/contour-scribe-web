# DicomEdit - DICOM RT Structure Editor

> A specialized web-based medical imaging tool for visualization and modification of DICOM-RT (Radiation Therapy) files.

![Version](https://img.shields.io/badge/version-0.6.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-18.3.1-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178c6)

---

## 🎯 Overview

DicomEdit enables medical professionals (radiologists, oncologists, researchers) to work with DICOM radiation therapy structure sets in a browser-based environment. No installation required—just load your data and start editing.

### Key Capabilities

✅ **Load & View**
- DICOM CT image series from ZIP files
- RT Structure Sets with multiple contours
- NIfTI volumes with probability maps
- URL-based remote loading

✅ **Visualize & Navigate**
- Multi-slice CT viewing with smooth navigation
- Interactive window/level adjustment
- Zoom, pan, and scroll controls
- Overlay RT structure contours on CT images
- **Comprehensive keyboard shortcuts** for fast workflow (press `?` for help)

✅ **Edit & Create**
- Draw new contours with brush or polygon tools
- Erase existing contours
- Create multiple structures with custom colors
- Interpolate contours between slices
- Adjust brush/eraser size

✅ **Export & Save**
- Export as JSON (DICOM-RT representation)
- Export as CSV (for analysis)
- Export as research-friendly JSON
- Proper coordinate transformations

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Modern browser (Chrome, Firefox, or Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/kstawiski/contour-scribe-web.git
cd contour-scribe-web

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to use the application.

### Building for Production

```bash
npm run build
```

Output will be in the `dist/` directory, ready for deployment.

---

## 📚 Usage

### 1. Load Your Data

**Option A: Upload ZIP File**
- Drag and drop a ZIP file containing DICOM files
- Or click to browse and select a file
- ZIP should contain CT images (.dcm) and optionally an RT Structure file

**Option B: Load from URL**
- Enter a public URL to a DICOM ZIP file
- Click "Load from URL"

### 2. View and Navigate

- **Scroll through slices**: Mouse wheel or slider
- **Adjust contrast**: Use Window/Level sliders or activate W/L tool and drag
- **Zoom**: Mouse wheel with Zoom tool active, or use +/- buttons
- **Pan**: Activate Pan tool and drag, or hold spacebar (planned)

### 3. Create and Edit Contours

1. Click "New Structure" to create a new contour set
2. Select a drawing tool:
   - **Brush**: Freehand drawing
   - **Polygon**: Click points to create a polygon
   - **Eraser**: Remove parts of contours
3. Draw on the CT images
4. Use "Interpolate" to fill slices between drawn contours

### 4. Export Your Work

- Click "Download" button
- Choose export format (JSON, CSV, or Research)
- File will download to your computer

---

## 🛠️ Technology Stack

- **Frontend**: React 18.3 with TypeScript 5.5
- **Build Tool**: Vite 5.4 (with SWC for fast compilation)
- **UI Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 3.4
- **Medical Imaging**: dicom-parser, nifti-reader-js
- **File Handling**: JSZip, file-saver

---

## 📖 Documentation

- **[CLAUDE.md](./CLAUDE.md)**: Comprehensive development guide, architecture, and roadmap
- **[API Documentation](./CLAUDE.md#-api-documentation)**: Coordinate systems, export formats, hooks
- **[Feature Roadmap](./CLAUDE.md#-feature-roadmap)**: Planned improvements and timeline

---

## 🗺️ Roadmap

### ✅ Completed (v0.6.0)
- **Undo/Redo system** - Full history management with Ctrl+Z/Ctrl+Y (NEW in v0.6.0)
- **Code splitting & bundle optimization** - Reduced largest chunk from 586KB to 157KB (v0.5.0)
- **HU value display on hover** - Real-time tissue identification (v0.4.0)
- **Keyboard shortcuts** for all tools and actions (v0.3.0)
- RT Structure export functionality
- Proper contour interpolation
- Interactive pan and window/level tools
- Coordinate transformation utilities
- Error boundary system
- Memory optimization

### 🚧 In Progress
- Window/Level presets

### 📋 Planned
- Structure editing UI (rename, recolor)
- Measurement tools (distance, area, volume)
- Session persistence
- Actual DICOM RT file export
- Multi-planar reconstruction
- Advanced drawing tools (magic wand, region growing)

See [CLAUDE.md](./CLAUDE.md#-feature-roadmap) for complete roadmap.

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the code style in existing files
- Add tests for new features (when testing infrastructure is ready)
- Update CLAUDE.md for significant changes
- Use conventional commit messages

See [CLAUDE.md](./CLAUDE.md#-development-guidelines) for detailed guidelines.

---

## 🐛 Known Issues

- Dual structure state management (refactor planned)
- No unit tests (infrastructure in roadmap)

See [CLAUDE.md](./CLAUDE.md#-known-issues--technical-debt) for full list.

---

## 📜 License

MIT License - see LICENSE file for details.

---

## 🔒 Privacy & Security

⚠️ **Important**: This application is currently **NOT HIPAA compliant**.

All data processing happens **client-side** in your browser. No data is sent to external servers. However, for production use in healthcare settings, additional security measures are required (see CLAUDE.md for details).

---

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/) and [React](https://react.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- DICOM parsing via [dicom-parser](https://github.com/cornerstonejs/dicomParser)
- Inspired by [OHIF Viewer](https://ohif.org/) and [Cornerstone.js](https://www.cornerstonejs.org/)

---

## 📞 Support

- **Documentation**: See [CLAUDE.md](./CLAUDE.md)
- **Issues**: Report bugs via GitHub Issues
- **Questions**: Open a GitHub Discussion

---

**Built for medical professionals by developers who care about healthcare technology.** 🏥
