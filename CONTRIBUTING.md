# Contributing to DicomEdit

Thank you for your interest in contributing to DicomEdit! This document provides guidelines and instructions for contributing to the project.

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Pull Request Process](#pull-request-process)
5. [Testing Guidelines](#testing-guidelines)
6. [Documentation](#documentation)
7. [For AI Assistants (Claude)](#for-ai-assistants-claude)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Modern code editor (VS Code recommended)
- Basic understanding of React, TypeScript, and medical imaging (DICOM)

### Setting Up Your Environment

```bash
# Clone the repository
git clone https://github.com/kstawiski/contour-scribe-web.git
cd contour-scribe-web

# Install dependencies
npm install

# Start development server
npm run dev

# In another terminal, watch for type errors
npx tsc --watch --noEmit
```

### Recommended VS Code Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelliSense
- Error Lens

---

## 🔄 Development Workflow

### 1. Choose a Task

Before starting work:

1. Check [TODO.md](./TODO.md) for available tasks
2. Look at [GitHub Issues](../../issues) for reported bugs
3. Review [CLAUDE.md](./CLAUDE.md) roadmap for planned features
4. Comment on the issue to claim it (avoid duplicate work)

### 2. Create a Branch

Use descriptive branch names:

```bash
# Feature branch
git checkout -b feature/keyboard-shortcuts

# Bug fix branch
git checkout -b fix/canvas-memory-leak

# Documentation branch
git checkout -b docs/api-documentation

# Refactor branch
git checkout -b refactor/unify-structure-state
```

### 3. Make Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update documentation if needed
- Test your changes manually

### 4. Commit Your Changes

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature
git commit -m "feat: add keyboard shortcuts for tool selection"

# Bug fix
git commit -m "fix: prevent memory leak in canvas rendering"

# Documentation
git commit -m "docs: update API documentation for export functions"

# Refactor
git commit -m "refactor: extract coordinate transformation utilities"

# Performance improvement
git commit -m "perf: optimize contour rendering for large datasets"

# Chore (dependencies, config)
git commit -m "chore: update vite to version 5.4.10"
```

**Commit Message Format**:
```
<type>: <short description>

<optional longer description>

<optional footer with issue references>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring (no functional changes)
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependencies

### 5. Push and Create PR

```bash
git push origin your-branch-name
```

Then create a Pull Request on GitHub.

---

## 📏 Code Standards

### TypeScript

**Do**:
```typescript
// Use explicit types
function calculateDistance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Use interfaces for objects
interface DicomImage {
  width: number;
  height: number;
  pixelData: Uint16Array | Uint8Array;
}

// Use type unions
type DrawingTool = 'brush' | 'eraser' | 'polygon' | 'select';
```

**Don't**:
```typescript
// Avoid 'any' unless absolutely necessary
function process(data: any) { /* BAD */ }

// Don't use implicit any
function calculate(x, y) { /* BAD - missing types */ }

// Don't use var
var count = 0; // BAD - use const or let
```

### React Components

**Do**:
```typescript
// Functional components with TypeScript
interface Props {
  image: DicomImage;
  onLoad: (success: boolean) => void;
}

export const ImageLoader: React.FC<Props> = ({ image, onLoad }) => {
  // Component logic
};

// Use hooks properly
const [count, setCount] = useState<number>(0);

// Memoize expensive computations
const processedData = useMemo(() => processImage(image), [image]);
```

**Don't**:
```typescript
// Don't use class components (use functional)
class ImageLoader extends React.Component { /* BAD */ }

// Don't create functions in render
<button onClick={() => handleClick(data)}> /* BAD - creates new function each render */

// Better approach
const handleClick = useCallback(() => handleClick(data), [data]);
```

### File Organization

```
src/
├── components/           # React components
│   ├── DicomViewer.tsx  # Main components (PascalCase)
│   └── ui/              # Reusable UI components
├── hooks/               # Custom React hooks
│   └── useDrawing.ts    # use* prefix
├── lib/                 # Utility functions
│   └── dicom-utils.ts   # kebab-case
└── pages/              # Route pages
    └── Index.tsx        # PascalCase
```

### Naming Conventions

- **Components**: PascalCase (`DicomViewer.tsx`)
- **Hooks**: camelCase with `use` prefix (`useDrawing.ts`)
- **Utils**: kebab-case (`dicom-utils.ts`)
- **Variables**: camelCase (`currentSlice`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_ZOOM_LEVEL`)
- **Types/Interfaces**: PascalCase (`DicomImage`, `Point2D`)

### Code Style

```typescript
// Use 2-space indentation
function example() {
  if (condition) {
    doSomething();
  }
}

// Use semicolons
const value = getValue();

// Use single quotes for strings (unless template literals needed)
const name = 'DicomEdit';
const message = `Welcome to ${name}`;

// Use trailing commas in objects/arrays
const config = {
  zoom: 1,
  pan: { x: 0, y: 0 },
};

// Destructure props
const { image, zoom, pan } = props;

// Use early returns for guards
if (!image) return null;
```

### Comments

```typescript
/**
 * JSDoc for public functions
 *
 * @param points - Array of contour points
 * @param targetCount - Desired number of points after resampling
 * @returns Resampled contour points
 */
export function resampleContour(
  points: Point2D[],
  targetCount: number
): Point2D[] {
  // Implementation
}

// Inline comments for complex logic
// Calculate interpolation factor between slices
const t = (targetSlice - slice1) / (slice2 - slice1);
```

---

## 🔀 Pull Request Process

### Before Submitting

- [ ] Code builds successfully (`npm run build`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Manually tested the changes
- [ ] Updated documentation if needed
- [ ] Updated CLAUDE.md if significant changes
- [ ] Followed code style guidelines

### PR Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- List specific changes
- One per line

## Testing
- Describe how you tested this
- Manual testing steps
- Edge cases considered

## Screenshots (if applicable)
Add screenshots or videos demonstrating the changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Build succeeds
```

### Review Process

1. **Automated Checks**: Ensure CI passes (when set up)
2. **Code Review**: Wait for review from maintainers
3. **Address Feedback**: Make requested changes
4. **Approval**: PR will be merged after approval

### After Merge

- Delete your feature branch
- Update your local main branch
- Update TODO.md if the task is complete

---

## 🧪 Testing Guidelines

### Manual Testing

**Always test**:
1. Loading DICOM files (valid and invalid)
2. Drawing and erasing contours
3. Exporting structures
4. Error handling (try to break it!)
5. Different browser (Chrome, Firefox, Edge)

### Unit Tests (When Infrastructure Ready)

```typescript
// Example test structure
import { describe, it, expect } from 'vitest';
import { interpolateContours } from '@/lib/contour-utils';

describe('interpolateContours', () => {
  it('should interpolate between two contours', () => {
    const contour1 = createMockContour(0, [[0, 0]]);
    const contour2 = createMockContour(2, [[10, 10]]);

    const result = interpolateContours(contour1, contour2, 1);

    expect(result).toBeDefined();
    expect(result?.sliceIndex).toBe(1);
    expect(result?.points[0].x).toBeCloseTo(5);
  });

  it('should return null for invalid input', () => {
    const result = interpolateContours(null, null, 0);
    expect(result).toBeNull();
  });
});
```

**Test Coverage Goals**:
- Utilities: 90%+
- Hooks: 80%+
- Components: 70%+

---

## 📚 Documentation

### When to Update Documentation

**Always update when**:
- Adding new features
- Changing public APIs
- Modifying export formats
- Adding keyboard shortcuts
- Fixing significant bugs

**Files to Update**:
- `CLAUDE.md` - For architectural changes or completed roadmap items
- `README.md` - For user-facing features
- `TODO.md` - Mark tasks complete, add new ones
- JSDoc comments - For any public functions

### Documentation Standards

```typescript
/**
 * Brief one-line description.
 *
 * More detailed explanation if needed. Can span multiple lines
 * and include examples.
 *
 * @example
 * ```typescript
 * const result = worldToCanvas(100, 200, image, config);
 * console.log(result); // { x: 450, y: 320 }
 * ```
 *
 * @param worldX - X coordinate in DICOM patient coordinates (mm)
 * @param worldY - Y coordinate in DICOM patient coordinates (mm)
 * @param image - DICOM image with position and spacing information
 * @param config - Canvas configuration (size, zoom, pan)
 * @returns Canvas pixel coordinates
 */
export function worldToCanvas(
  worldX: number,
  worldY: number,
  image: DicomImage,
  config: CanvasConfig
): Point2D {
  // Implementation
}
```

---

## 🤖 For AI Assistants (Claude)

### Quick Reference for Claude Sessions

**Starting a new session**:
1. Read [CLAUDE.md](./CLAUDE.md) "Current Status" section
2. Check [TODO.md](./TODO.md) for specific tasks
3. Review recent commits (`git log --oneline -10`)

**Making changes**:
1. Follow all code standards above
2. Update documentation in the same commit
3. Mark TODO items complete when done
4. Update "Last Updated" date in CLAUDE.md if significant

**Ending a session**:
1. Ensure all changes are committed
2. Update CLAUDE.md "Current Status" if needed
3. Push changes to the development branch
4. Leave clear notes in commit messages for next session

### Common Tasks Quick Links

- **Add Keyboard Shortcut**: See TODO.md "Keyboard Shortcuts System"
- **Add Export Format**: See `src/lib/rtstruct-export.ts`
- **Add Drawing Tool**: See `src/hooks/useDrawing.ts`
- **Fix Bug**: Check "Known Issues" in CLAUDE.md first

### Version Updates

When incrementing version:
- **Patch** (0.0.X): Bug fixes only
- **Minor** (0.X.0): New features, no breaking changes
- **Major** (X.0.0): Breaking changes

Update version in:
- `package.json`
- `CLAUDE.md` (top of file)
- `README.md` (badge)

---

## 💡 Tips for Contributors

### Performance

- Use `React.memo()` for expensive components
- Use `useMemo()` for expensive computations
- Use `useCallback()` for functions passed as props
- Avoid creating objects/arrays in render
- Profile with Chrome DevTools before optimizing

### Debugging

```typescript
// Use proper logging
console.log('DICOM image loaded:', { width, height, sliceLocation });

// Use debugger in development
if (process.env.NODE_ENV === 'development') {
  debugger;
}

// Use React DevTools
// Install React DevTools extension for your browser
```

### Common Pitfalls

❌ **Don't**:
- Mutate state directly (`state.value = 10`)
- Use index as key in lists
- Forget to clean up useEffect
- Create functions in JSX
- Ignore TypeScript errors

✅ **Do**:
- Use immutable updates (`setState({ ...state, value: 10 })`)
- Use unique IDs as keys
- Return cleanup functions from useEffect
- Define functions outside JSX or use useCallback
- Fix all TypeScript errors before committing

---

## 🤝 Community

### Getting Help

- **Documentation**: Check CLAUDE.md first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Code**: Read the source—it's well-commented!

### Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what's best for the project
- Accept constructive criticism gracefully
- Assume good intent

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## 🎉 Thank You!

Every contribution helps make DicomEdit better for medical professionals worldwide. Whether it's fixing a typo or implementing a major feature, your work is appreciated!

**Happy coding!** 🏥💻
