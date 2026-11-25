# Gridfinity Studio

A desktop app for designing [Gridfinity](https://gridfinity.xyz) bins with custom pockets. Lay out bins on a grid, draw the pockets your tools need, check the result in 3D, and export it for printing.

Runs on macOS, Windows and Linux.

![Design view: three bins on the grid, with a rectangle, an ellipse and a polygon drawn in the first and a rectangle in the third](docs/images/design.png)

![Preview: the same bins in 3D, with their pockets cut](docs/images/preview.png)

## What it does

- **Bins on a grid.** Add bins from a size picker or draw them on the canvas. Bins snap to the grid and can't overlap.
- **Pockets.** Draw rectangles, ellipses and polygons inside a bin. Each one is cut into the bin to its own depth.
- **3D preview.** See the finished bins, with the stacking lip, feet, and magnet and screw holes.
- **Export.** Save 3MF or STL: every bin or only the ones you check, in one file or one file per bin.
- **Projects.** Work is saved as a `.gfstudio` file, with undo, redo, cut, copy and paste.
- **Examples.** Three example projects open from the welcome screen: a socket tray, a divided tray and a tool tray.

## Install

Download the latest version from [Releases](https://github.com/unstable-studios/gridfinity-studio/releases/latest).

| Platform | File                                    | Notes                                                  |
| -------- | --------------------------------------- | ------------------------------------------------------ |
| macOS    | `gridfinity-studio-<version>.dmg`       | Apple silicon. Signed and notarized.                   |
| Windows  | `gridfinity-studio-<version>-setup.exe` | Not code signed, so Windows may ask before running it. |
| Linux    | `.AppImage`, `.deb` or `.snap`          | x64.                                                   |

The app checks for updates when it starts and every hour, and offers to restart when one is ready. **Help > Check for updates** checks at once. The snap does not update itself: install a new one from Releases.

## Using it

[docs/HELP.md](docs/HELP.md) is the user guide. The app shows the same text under **Help > User guide**.

## Build from source

You need [pnpm](https://pnpm.io), which installs the right Node version for the project, and a GitHub token.

The UI library is published on GitHub Packages, which asks for a token even for public packages. Create a [personal access token (classic)](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages) with the `read:packages` scope and add this line to `~/.npmrc`:

```ini
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

Then:

```bash
pnpm install
```

```bash
pnpm dev
```

Before sending a change, run the full check. It runs the typecheck, lint and unit tests, then builds the app and drives it with Playwright.

```bash
pnpm verify
```

To package an installer for your platform, run `pnpm build:mac`, `pnpm build:win` or `pnpm build:linux`.

[CLAUDE.md](CLAUDE.md) describes the architecture, and [docs/PROJECT_SCHEMA.md](docs/PROJECT_SCHEMA.md) the project file format.

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org), checked in CI: `type(scope): subject`. [CONTRIBUTING.md](CONTRIBUTING.md) has the details. Open pull requests against `main`.

## License

[MIT](LICENSE)

**Help > About Gridfinity Studio** lists the open-source packages the app is built with and their licenses.

The app includes the [Inter](src/renderer/public/fonts/Inter-LICENSE.txt) and [JetBrains Mono](src/renderer/public/fonts/JetBrainsMono-LICENSE.txt) fonts, each under the SIL Open Font License 1.1.
