# Research: Full Implementation Roadmap

**Branch**: `001-full-roadmap` | **Date**: 2026-03-04

## R1: Mesh Boolean Engine Selection

**Decision**: Use [manifold](https://github.com/elalish/manifold) (WASM build) for mesh boolean operations.

**Rationale**: Manifold is purpose-built for CAD booleans with guaranteed manifold output, high performance via WASM, and permissive licensing (Apache-2.0). It handles edge cases (coplanar faces, thin walls) that break general-purpose libraries like three-bvh-csg or three-csg-ts.

**Alternatives considered**:
- **three-bvh-csg**: Good Three.js integration but produces non-manifold output on complex cases. Not suitable for 3D printing export.
- **OpenCascade.js (OCCT)**: Full CAD kernel, extremely capable but 15MB+ WASM bundle, overkill for our boolean-only needs.
- **CGAL via Emscripten**: Robust but complex build pipeline and GPL licensing concerns.

## R2: Geometry Worker Architecture

**Decision**: Use a dedicated Web Worker for all geometry operations (extrusion, booleans, bake). Communicate via structured clone of typed arrays.

**Rationale**: Boolean operations on complex meshes can take 100ms–2s. Running them on the UI thread causes frame drops. Electron's renderer process supports standard Web Workers. The worker loads manifold WASM and exposes a message-based API.

**Alternatives considered**:
- **SharedArrayBuffer + Atomics**: More complex, requires COOP/COEP headers which complicate Electron setup. Unnecessary for our throughput needs.
- **Node.js child_process via main**: Adds IPC overhead and complicates the data flow. Worker is simpler and stays in renderer context.
- **OffscreenCanvas in worker**: Not needed — we only compute geometry in the worker, rendering stays on the main thread.

## R3: Undo/Redo Architecture

**Decision**: Command pattern with immutable snapshots of affected state slices. Each undoable action is a command with `execute()` and `undo()` methods that capture before/after state.

**Rationale**: The command pattern is well-suited for a design tool where actions are discrete and reversible. Storing full project snapshots would be wasteful for simple transforms. Instead, each command captures only the minimal diff (entity ID + old/new state).

**Alternatives considered**:
- **Full project snapshots (structural sharing via Immer)**: Simpler implementation but memory-intensive with 100+ entities. Would require periodic compaction.
- **Event sourcing**: Elegant but over-engineered for a desktop app. Replay performance degrades with long histories.
- **Zustand temporal middleware**: Tight coupling to Zustand. We want the undo system to work across any state management approach.

## R4: SVG Import Pipeline

**Decision**: Use browser-native DOMParser + SVGPathElement.getPathData() polyfill to parse SVG, then convert path segments to 2D polygon outlines via adaptive subdivision.

**Rationale**: Browser APIs handle SVG parsing for free. We only need path outlines (no rendering), so extracting `<path>` d-attributes and converting to point arrays is sufficient. The polyfill handles all SVG path commands (M, L, C, Q, A, Z).

**Alternatives considered**:
- **opentype.js for text**: Out of scope — we import SVG shapes, not fonts.
- **Paper.js**: Full 2D vector library, heavy dependency for just path parsing.
- **svg-path-parser (npm)**: Lightweight but doesn't handle transforms or compound paths.

## R5: STL Import/Export

**Decision**: Use Three.js built-in `STLLoader` for import and `STLExporter` for export. Both are maintained as part of three/examples/jsm.

**Rationale**: Already in our dependency tree. STLLoader handles both ASCII and binary formats. STLExporter produces binary STL (smaller files, faster parsing by slicers). No additional dependencies needed.

**Alternatives considered**:
- **Custom binary STL parser**: Unnecessary, Three.js loader is battle-tested.
- **stl-serializer (npm)**: Redundant with Three.js exporter.

## R6: 3MF Export

**Decision**: Use a lightweight 3MF writer that produces the OPC (ZIP) package with the required XML model file. Build a minimal writer rather than importing a full library.

**Rationale**: 3MF is a ZIP containing XML files following a well-defined schema. For our needs (single mesh + basic metadata), the XML generation is straightforward. A full 3MF library would be a heavy dependency for simple output.

**Alternatives considered**:
- **lib3mf (WASM)**: Official C++ library with WASM build. Very capable but 5MB+ and overkill for write-only use case.
- **3mf-js**: Community library with limited maintenance.

## R7: 2D Layout Camera & Interaction

**Decision**: Use `@react-three/drei` OrthographicCamera with custom pan/zoom controls. Disable orbit controls in layout mode. Use raycasting against a ground plane for mouse-to-world coordinate mapping.

**Rationale**: drei's orthographic camera integrates cleanly with r3f. Custom controls give us precise behavior (scroll zoom with cursor-centered scaling, middle-click pan). Raycasting against z=0 plane gives accurate 2D coordinates for entity placement.

**Alternatives considered**:
- **Separate 2D canvas (Canvas2D/Pixi.js)**: Would require syncing state between 2D and 3D views. Single Three.js canvas with mode switching is simpler.
- **drei MapControls**: Close to what we need but lacks cursor-centered zoom.

## R8: Grid Snapping

**Decision**: Snap-to-grid logic runs in the transform system, not in the input handler. Snap targets include Gridfinity grid intersections, entity edges/centers, and custom guide lines. Snapping is toggled globally and overridden per-drag with modifier keys.

**Rationale**: Centralizing snap logic in the transform system ensures consistency across all interaction modes (drag, keyboard nudge, programmatic placement). Separating snap candidates from snap resolution allows easy extension.

**Alternatives considered**:
- **Input-level snapping (round mouse coordinates)**: Loses sub-grid precision and doesn't support entity-to-entity snapping.
- **Post-move snap correction**: Causes visual jitter during drag.

## R9: Gridfinity Bin Geometry Generation

**Decision**: Parametric generation using Three.js BufferGeometry built from profile sweeps. Generate bin walls, floor, lip, magnet/screw recesses as separate geometry groups, then merge. Use the Gridfinity spec dimensions from the project's GridfinityConfig.

**Rationale**: Parametric generation from config values ensures bins are always dimensionally correct. Generating as BufferGeometry (not CSG) avoids boolean overhead for the base bin shape, which has a known analytical form.

**Alternatives considered**:
- **CSG-based bin generation**: More flexible but slower and unnecessary since bin profiles are well-defined geometric primitives.
- **Pre-baked bin meshes with scaling**: Doesn't support variable wall thickness, magnet options, or tolerance profiles.

## R10: Extrusion Pipeline (2D → 3D)

**Decision**: Use earcut triangulation for 2D polygon → face, then extrude by duplicating vertices along Z and stitching side faces. Support configurable depth and direction (up for solids, down for cutters). Handle holes via earcut's hole support.

**Rationale**: Earcut is fast, handles holes, and is already a Three.js dependency (used internally by ShapeGeometry). Our extrusion needs are simple (linear, single axis) and don't require NURBS or sweep surfaces.

**Alternatives considered**:
- **Three.js ExtrudeGeometry**: Built-in but uses its own path representation. Converting our polygon data to THREE.Shape adds unnecessary complexity.
- **Custom marching approach**: Over-engineered for linear extrusion.
