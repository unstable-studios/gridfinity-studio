# 006 — Viewport Layouts (PIP / Split View)

## Summary

Allow users to view Design (2D) and Preview (3D) canvases simultaneously via split-view or picture-in-picture layouts, rather than exclusively switching between tabs.

## Motivation

Currently the Design and Preview views are mutually exclusive tabs. Seeing live 3D feedback while editing 2D cutouts requires constant tab switching. A PIP or split layout would tighten the design–preview feedback loop significantly.

## Layout Modes

| Mode | Description |
|------|-------------|
| **Tabs** | Current behavior — one view at a time (default) |
| **Split** | Side-by-side or top/bottom, resizable divider |
| **PIP** | Small draggable/resizable overlay of Preview in a corner of Design |

## Key Design Decisions

### Dual Canvas Mounting
Both `<Canvas>` instances (Design + Preview) must stay mounted simultaneously for instant switching. The inactive canvas should either:
- Pause its frameloop (`frameloop="never"`)
- Render at reduced DPR

In PIP/Split mode both render actively.

### State Shape
Add a viewport layout mode to app state:
```typescript
type ViewportLayout = 'tabs' | 'split' | 'pip'
```

### PIP Behavior
- Draggable to any corner
- Resizable with aspect ratio lock
- Click to swap (PIP becomes main, main becomes PIP)
- Toggle via toolbar button or keyboard shortcut

### Split Behavior
- Resizable divider (drag handle)
- Orientation toggle (horizontal / vertical)
- Remember last split ratio

## Out of Scope
- Multiple 3D viewports (e.g., different camera angles)
- Detached/floating windows
