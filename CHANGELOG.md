# Changelog

## [1.18.2](https://github.com/unstable-studios/gridfinity-studio/compare/v1.18.1...v1.18.2) (2026-11-25)


### Documentation

* ship the license of the bundled fonts with them ([#549](https://github.com/unstable-studios/gridfinity-studio/issues/549)) ([b4b1302](https://github.com/unstable-studios/gridfinity-studio/commit/b4b130271003fb12170926a0c6e7d132d4c4aadb))

## [1.18.1](https://github.com/unstable-studios/gridfinity-studio/compare/v1.18.0...v1.18.1) (2026-11-25)


### Bug Fixes

* restore the package list the 1.18.0 release commit undid ([#547](https://github.com/unstable-studios/gridfinity-studio/issues/547)) ([b50896d](https://github.com/unstable-studios/gridfinity-studio/commit/b50896d5b22070bd50e7550034affa4d6b77fe0d))

## [1.18.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.17.3...v1.18.0) (2026-11-25)


### Features

* **ui:** add example projects to the welcome screen ([#542](https://github.com/unstable-studios/gridfinity-studio/issues/542)) ([bd387c0](https://github.com/unstable-studios/gridfinity-studio/commit/bd387c0c398812e20244c10a53a87d9475b60fd0))
* **ui:** warn when a pocket is too close to the wall ([#540](https://github.com/unstable-studios/gridfinity-studio/issues/540)) ([cbd1cd5](https://github.com/unstable-studios/gridfinity-studio/commit/cbd1cd52b7c557c0d5edbd83ad84662bff083af1))


### Documentation

* license the project under MIT ([#536](https://github.com/unstable-studios/gridfinity-studio/issues/536)) ([0352c3e](https://github.com/unstable-studios/gridfinity-studio/commit/0352c3ecca7f4ea67ef6941e4327f6567d104da4))


### Refactoring

* remove the old bin mesh generator ([#538](https://github.com/unstable-studios/gridfinity-studio/issues/538)) ([647dd2a](https://github.com/unstable-studios/gridfinity-studio/commit/647dd2a65e23afcf5e254b291b0ffe2adbc16f71))

## [1.17.3](https://github.com/unstable-studios/gridfinity-studio/compare/v1.17.2...v1.17.3) (2026-11-24)


### Build

* pack only the libraries the main process loads ([#533](https://github.com/unstable-studios/gridfinity-studio/issues/533)) ([a562957](https://github.com/unstable-studios/gridfinity-studio/commit/a562957134fd60023f7f563dae437f2fbb5362ca))

## [1.17.2](https://github.com/unstable-studios/gridfinity-studio/compare/v1.17.1...v1.17.2) (2026-11-24)


### Bug Fixes

* **core:** do not let a resize skew a turned shape ([#527](https://github.com/unstable-studios/gridfinity-studio/issues/527)) ([9a91a61](https://github.com/unstable-studios/gridfinity-studio/commit/9a91a615f1f604dd2d027ba2729d6f7a40d824d5))
* **ui:** make preview status and warnings readable in the light theme ([#529](https://github.com/unstable-studios/gridfinity-studio/issues/529)) ([af05bfb](https://github.com/unstable-studios/gridfinity-studio/commit/af05bfbbb5cfa15e38327a2c15f68bb7df5dc1f1))


### Documentation

* add screenshots to the readme ([#528](https://github.com/unstable-studios/gridfinity-studio/issues/528)) ([3e11ce0](https://github.com/unstable-studios/gridfinity-studio/commit/3e11ce0df73793b434ef9343e73d78e241d2ed33))

## [1.17.1](https://github.com/unstable-studios/gridfinity-studio/compare/v1.17.0...v1.17.1) (2026-11-24)


### Refactoring

* **core:** convert project files forward, and drop the old formats ([#525](https://github.com/unstable-studios/gridfinity-studio/issues/525)) ([a66a5b5](https://github.com/unstable-studios/gridfinity-studio/commit/a66a5b54166d1da39b8f2835691b9555c5ac795d))
* **core:** remove the geometry worker's unused messages ([#524](https://github.com/unstable-studios/gridfinity-studio/issues/524)) ([5cb0185](https://github.com/unstable-studios/gridfinity-studio/commit/5cb0185c6743613b3c1a78cdea535675c85d33c3))

## [1.17.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.16.3...v1.17.0) (2026-11-24)


### Features

* **ui:** check for updates again, and recover when one fails ([#521](https://github.com/unstable-studios/gridfinity-studio/issues/521)) ([c9a6c32](https://github.com/unstable-studios/gridfinity-studio/commit/c9a6c3218c47eacd5d6668eb1cf68f5711677512))
* **ui:** collapse the add bin section once it is not needed ([#520](https://github.com/unstable-studios/gridfinity-studio/issues/520)) ([3889b9a](https://github.com/unstable-studios/gridfinity-studio/commit/3889b9ab052b74c75703227eae33ebe088a9bfeb))


### Bug Fixes

* **ui:** tidy the window edge, top bar, switch and size grid ([#519](https://github.com/unstable-studios/gridfinity-studio/issues/519)) ([ba123a4](https://github.com/unstable-studios/gridfinity-studio/commit/ba123a4718194611cd837ba350f733f5bcea3579))

## [1.16.3](https://github.com/unstable-studios/gridfinity-studio/compare/v1.16.2...v1.16.3) (2026-11-24)


### Bug Fixes

* **core:** keep the bin when a pocket has nothing to cut ([#499](https://github.com/unstable-studios/gridfinity-studio/issues/499)) ([fd55e61](https://github.com/unstable-studios/gridfinity-studio/commit/fd55e61899cabe8beff0f187e0f6345fb1f2d4e5))

## [1.16.2](https://github.com/unstable-studios/gridfinity-studio/compare/v1.16.1...v1.16.2) (2026-11-24)


### Bug Fixes

* **core:** bake bins without flat triangles or thin steps ([#493](https://github.com/unstable-studios/gridfinity-studio/issues/493)) ([25658c8](https://github.com/unstable-studios/gridfinity-studio/commit/25658c8c6636e35e70ec31b661110aada3c26100))
* **core:** free a bake's memory when it ends ([#496](https://github.com/unstable-studios/gridfinity-studio/issues/496)) ([e63fab4](https://github.com/unstable-studios/gridfinity-studio/commit/e63fab4c59063f6fb0ca0089baf640a12cbb728a))
* **core:** validate a project's layout when it opens ([#492](https://github.com/unstable-studios/gridfinity-studio/issues/492)) ([d25b5e9](https://github.com/unstable-studios/gridfinity-studio/commit/d25b5e93a93263b92d0463536b9e8bd0ffb0db9d))

## [1.16.1](https://github.com/unstable-studios/gridfinity-studio/compare/v1.16.0...v1.16.1) (2026-11-24)


### Bug Fixes

* **core:** make a shape transform one step that updates bins ([#487](https://github.com/unstable-studios/gridfinity-studio/issues/487)) ([e215f54](https://github.com/unstable-studios/gridfinity-studio/commit/e215f54aa13d8916ae0baa375cdab320e3c37c22))


### Documentation

* describe the current project file format ([#489](https://github.com/unstable-studios/gridfinity-studio/issues/489)) ([0646e12](https://github.com/unstable-studios/gridfinity-studio/commit/0646e1275302b090074fcbdf08e1c102a5565a00))

## [1.16.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.15.0...v1.16.0) (2026-11-24)


### Features

* **ui:** place new bins in rows without overlap ([#480](https://github.com/unstable-studios/gridfinity-studio/issues/480)) ([6d5c3dd](https://github.com/unstable-studios/gridfinity-studio/commit/6d5c3dd79bf86df8a056b125587ca83476021f82))


### Bug Fixes

* **core:** cut a pocket the way its shape is turned ([#479](https://github.com/unstable-studios/gridfinity-studio/issues/479)) ([2a48071](https://github.com/unstable-studios/gridfinity-studio/commit/2a48071ae7b9a95962dcdca2f684c79ee2b9edc5))


### Documentation

* write the readme ([#481](https://github.com/unstable-studios/gridfinity-studio/issues/481)) ([9162c2d](https://github.com/unstable-studios/gridfinity-studio/commit/9162c2db11a7246bdfda3bece53eaaed43f3ce4b))

## [1.15.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.14.0...v1.15.0) (2026-11-24)


### Features

* **ui:** draw a bin on the canvas by dragging ([#477](https://github.com/unstable-studios/gridfinity-studio/issues/477)) ([603569a](https://github.com/unstable-studios/gridfinity-studio/commit/603569a00469c27af614e24faa0e43ea7023cc8d))
* **ui:** export one file per bin ([#476](https://github.com/unstable-studios/gridfinity-studio/issues/476)) ([cd1bbcb](https://github.com/unstable-studios/gridfinity-studio/commit/cd1bbcb05ebc494a613963e35b5d50845a66962b))
* **ui:** export only the selected bins ([#475](https://github.com/unstable-studios/gridfinity-studio/issues/475)) ([c52cbce](https://github.com/unstable-studios/gridfinity-studio/commit/c52cbceb96d2840b58d2999c78525a2aa29317fe))

## [1.14.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.13.0...v1.14.0) (2026-11-24)


### Features

* **ui:** add a right-click menu for bins and shapes ([#472](https://github.com/unstable-studios/gridfinity-studio/issues/472)) ([4d056ee](https://github.com/unstable-studios/gridfinity-studio/commit/4d056eef69c85a51736d1b35809ab3f25f7a7e3e))
* **ui:** cut, copy and paste bins and shapes ([#470](https://github.com/unstable-studios/gridfinity-studio/issues/470)) ([0db748d](https://github.com/unstable-studios/gridfinity-studio/commit/0db748d8de35b3603e627fc2f71b99ac8c71b6b5))
* **ui:** rename bins and shapes ([#468](https://github.com/unstable-studios/gridfinity-studio/issues/468)) ([4920a8b](https://github.com/unstable-studios/gridfinity-studio/commit/4920a8b57ca4a9c2fbb9fa6c804bc5a8a2771bf1))
* **ui:** select several rows in the sidebar with shift and cmd ([#467](https://github.com/unstable-studios/gridfinity-studio/issues/467)) ([9f1ee92](https://github.com/unstable-studios/gridfinity-studio/commit/9f1ee92145aa67dcbfe83a4b10ed78e015c120a2))


### Bug Fixes

* **core:** ask before closing with unsaved work ([#471](https://github.com/unstable-studios/gridfinity-studio/issues/471)) ([d237d4f](https://github.com/unstable-studios/gridfinity-studio/commit/d237d4f2ec9453383889bd59c33447ff3baea538))
* **ui:** give the sidebar a slim scrollbar with even margins ([#473](https://github.com/unstable-studios/gridfinity-studio/issues/473)) ([f11ce20](https://github.com/unstable-studios/gridfinity-studio/commit/f11ce20831788afbde83320df225fac28d63aa79))

## [1.13.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.12.1...v1.13.0) (2026-11-24)


### Features

* **ui:** draw rectangles and ellipses from a corner or the center ([#466](https://github.com/unstable-studios/gridfinity-studio/issues/466)) ([5493c5f](https://github.com/unstable-studios/gridfinity-studio/commit/5493c5f591c78a8fa2ef319cc53c43f2119f3b6d))


### Bug Fixes

* **core:** keep touching pockets closed in 3mf export ([#442](https://github.com/unstable-studios/gridfinity-studio/issues/442)) ([610b843](https://github.com/unstable-studios/gridfinity-studio/commit/610b843ffa9e6789df27599d013d09c612cf73f4))
* **core:** make bin walls straight between rounded corners ([#444](https://github.com/unstable-studios/gridfinity-studio/issues/444)) ([51c5291](https://github.com/unstable-studios/gridfinity-studio/commit/51c52911a0aa72db06d1af0f3032fcfcf3e38394))
* **ui:** make the bin under a dragged shape stand out ([#462](https://github.com/unstable-studios/gridfinity-studio/issues/462)) ([a0ff092](https://github.com/unstable-studios/gridfinity-studio/commit/a0ff0925e8472c651ae5c2b3f8bc3ce340ce66e0))
* **ui:** name exports after the project ([#460](https://github.com/unstable-studios/gridfinity-studio/issues/460)) ([702853a](https://github.com/unstable-studios/gridfinity-studio/commit/702853abc431e476a53cb47123abbe3bf5f411bc))
* **ui:** stop a sidebar resize from overlapping another bin ([#463](https://github.com/unstable-studios/gridfinity-studio/issues/463)) ([96ecb2e](https://github.com/unstable-studios/gridfinity-studio/commit/96ecb2e688fc0a8acaee1119cc60c3fc96a3e021))
* **ui:** tidy the add bin picker, shape labels and sidebar scrolling ([#461](https://github.com/unstable-studios/gridfinity-studio/issues/461)) ([d130f36](https://github.com/unstable-studios/gridfinity-studio/commit/d130f3647286890da10e14204f27e12e590210e4))


### Documentation

* **ui:** tighten ui copy and remove em dashes ([#464](https://github.com/unstable-studios/gridfinity-studio/issues/464)) ([1d8b819](https://github.com/unstable-studios/gridfinity-studio/commit/1d8b8195be2f7f284a530bca4789984e523ab231))

## [1.12.1](https://github.com/unstable-studios/gridfinity-studio/compare/v1.12.0...v1.12.1) (2026-11-24)


### Bug Fixes

* **core:** cut circles and holes finely enough to print smooth ([#438](https://github.com/unstable-studios/gridfinity-studio/issues/438)) ([0fa5f41](https://github.com/unstable-studios/gridfinity-studio/commit/0fa5f413c38890e359bf3fa530295256acf023cb))
* **core:** share vertices between triangles in 3mf export ([#437](https://github.com/unstable-studios/gridfinity-studio/issues/437)) ([a3f2c34](https://github.com/unstable-studios/gridfinity-studio/commit/a3f2c345d6ac5e2c51022d310153ae4876d2020b))

## [1.12.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.11.0...v1.12.0) (2026-11-24)


### Features

* **ui:** align selected pockets ([#427](https://github.com/unstable-studios/gridfinity-studio/issues/427)) ([de01d01](https://github.com/unstable-studios/gridfinity-studio/commit/de01d01689ecbdf7eb0405dbded1d0fedf70179b))
* **ui:** distribute selected shapes with equal gaps ([#428](https://github.com/unstable-studios/gridfinity-studio/issues/428)) ([0269932](https://github.com/unstable-studios/gridfinity-studio/commit/02699324cc73202ea5cc3772f92e62e380183ad4))
* **ui:** show shape position from the lower left, on the canvas or in its bin ([#434](https://github.com/unstable-studios/gridfinity-studio/issues/434)) ([3b1df20](https://github.com/unstable-studios/gridfinity-studio/commit/3b1df20217892a2211fa2aa775bef574bac59abc))


### Bug Fixes

* **core:** rebake a bin edited during a failed bake ([#422](https://github.com/unstable-studios/gridfinity-studio/issues/422)) ([ba3a95e](https://github.com/unstable-studios/gridfinity-studio/commit/ba3a95e4d97af3d3e96f37b8020b7347f9db5dce))
* **core:** record bin assignment for undo and session restore ([#421](https://github.com/unstable-studios/gridfinity-studio/issues/421)) ([edc1e18](https://github.com/unstable-studios/gridfinity-studio/commit/edc1e18245088779b22c7a46bbc706af67d2c30e))
* **core:** record pocket depth changes for undo and saving ([#433](https://github.com/unstable-studios/gridfinity-studio/issues/433)) ([cf2e2f9](https://github.com/unstable-studios/gridfinity-studio/commit/cf2e2f9fbc6afcebec6c40a2540909ffc9d1c463))
* **ui:** keep bin size inputs inside the sidebar ([#423](https://github.com/unstable-studios/gridfinity-studio/issues/423)) ([93cecb3](https://github.com/unstable-studios/gridfinity-studio/commit/93cecb310a98ff1fb68725d39fd5bdce5c003f9f))
* **ui:** make a typed shape position an undo step ([#431](https://github.com/unstable-studios/gridfinity-studio/issues/431)) ([d971579](https://github.com/unstable-studios/gridfinity-studio/commit/d971579825d32add843779fe62ff61b4c09be979))

## [1.11.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.10.1...v1.11.0) (2026-11-23)


### Features

* **core:** make konva the default layout engine ([#399](https://github.com/unstable-studios/gridfinity-studio/issues/399)) ([db8881c](https://github.com/unstable-studios/gridfinity-studio/commit/db8881c1a2726ae4ba3851779bbaa7d2ddcc84e9))


### Bug Fixes

* **core:** draw the shape preview in the overlay, not the engine ([#412](https://github.com/unstable-studios/gridfinity-studio/issues/412)) ([e5820e5](https://github.com/unstable-studios/gridfinity-studio/commit/e5820e5e3c1e34e3b9db602c16b40cdd273e98e3))
* **core:** opened-project sidebar, undo baseline, unfocused export ([#397](https://github.com/unstable-studios/gridfinity-studio/issues/397)) ([8616ee9](https://github.com/unstable-studios/gridfinity-studio/commit/8616ee97ec854db613027201495dc58f758119bf))
* repair dev mode, pin node 24, run tests in ci ([#396](https://github.com/unstable-studios/gridfinity-studio/issues/396)) ([be7ac04](https://github.com/unstable-studios/gridfinity-studio/commit/be7ac041080dca095f82a35f875ee0d8bd46e144))
* **ui:** frame the bins in the 3D preview ([#413](https://github.com/unstable-studios/gridfinity-studio/issues/413)) ([01fb6dd](https://github.com/unstable-studios/gridfinity-studio/commit/01fb6dd3b32872538bdb57a561c873b86722fd17))
* **ui:** generate styles for classes used inside the ui package ([#410](https://github.com/unstable-studios/gridfinity-studio/issues/410)) ([8910dff](https://github.com/unstable-studios/gridfinity-studio/commit/8910dffcfe497f6998a34343d8b96f881e2d2ae5))
* **ui:** lock the base unit while the project has bins ([#411](https://github.com/unstable-studios/gridfinity-studio/issues/411)) ([9884da3](https://github.com/unstable-studios/gridfinity-studio/commit/9884da3120f531ebd079103dee17036d2d8c33bd))
* **ui:** rewrite interface copy to the ui-copy rules ([#401](https://github.com/unstable-studios/gridfinity-studio/issues/401)) ([fb3e2c3](https://github.com/unstable-studios/gridfinity-studio/commit/fb3e2c3b7049ff8705f51892353d10d69f83d28f))
* **ui:** show the outcome of save, open and export ([#414](https://github.com/unstable-studios/gridfinity-studio/issues/414)) ([f89c201](https://github.com/unstable-studios/gridfinity-studio/commit/f89c2011e89501edfcd25762cfa5f762fe024b2a))


### Refactoring

* **core:** remove the fabric layout engine ([#400](https://github.com/unstable-studios/gridfinity-studio/issues/400)) ([95732d8](https://github.com/unstable-studios/gridfinity-studio/commit/95732d845782f36988ecad4046c50ee9f4b25bd3))

## [1.10.1](https://github.com/unstable-studios/gridfinity-studio/compare/v1.10.0...v1.10.1) (2026-05-06)


### Bug Fixes

* **core:** metadata changes ride a tick + Fabric tooltip finds grouped shapes ([#354](https://github.com/unstable-studios/gridfinity-studio/issues/354)) ([2baef1e](https://github.com/unstable-studios/gridfinity-studio/commit/2baef1e72414e3c553f9a725116f3457b9d8e94e))

## [1.10.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.9.0...v1.10.0) (2026-05-06)


### Features

* **ui:** no-delay hover tooltip on canvas shapes ([#348](https://github.com/unstable-studios/gridfinity-studio/issues/348)) ([c0e0d3d](https://github.com/unstable-studios/gridfinity-studio/commit/c0e0d3d4d9c5cc142c1328bbcb7d3a9164559284))
* **ui:** per-shape pocket depth control + numeric-input cleanup ([#346](https://github.com/unstable-studios/gridfinity-studio/issues/346)) ([02be577](https://github.com/unstable-studios/gridfinity-studio/commit/02be577f98b885fd295b47e8447587c6af6ea711))
* **ui:** scale shape canvas opacity by pocket depth ([#347](https://github.com/unstable-studios/gridfinity-studio/issues/347)) ([722a4d7](https://github.com/unstable-studios/gridfinity-studio/commit/722a4d793f35759881ca64e10562a64a6386c2b3))


### Bug Fixes

* **core:** evict shapes whose centroid leaves a resized bin ([#350](https://github.com/unstable-studios/gridfinity-studio/issues/350)) ([81ee2b4](https://github.com/unstable-studios/gridfinity-studio/commit/81ee2b4377d748e12993e439f0dd5fe32cc7735c))

## [1.9.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.8.0...v1.9.0) (2026-05-05)


### Features

* **ui:** surface auto-update status in the Help menu ([#344](https://github.com/unstable-studios/gridfinity-studio/issues/344)) ([4488224](https://github.com/unstable-studios/gridfinity-studio/commit/448822450f7b03f972e51d5df3990aa85d9b30ce))

## [1.8.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.7.6...v1.8.0) (2026-05-04)


### Features

* **core:** route autoUpdater logs through electron-log ([#339](https://github.com/unstable-studios/gridfinity-studio/issues/339)) ([53689a5](https://github.com/unstable-studios/gridfinity-studio/commit/53689a595cb2a78c47f75087fb18e0530abafa6f))

## [1.7.6](https://github.com/unstable-studios/gridfinity-studio/compare/v1.7.5...v1.7.6) (2026-05-03)


### Bug Fixes

* **core:** reparent between bins cleans up old group's childIds (+ T2 reparenting matrix) ([#334](https://github.com/unstable-studios/gridfinity-studio/issues/334)) ([6dae074](https://github.com/unstable-studios/gridfinity-studio/commit/6dae074bf5dfd303141079cdbdb0ed71a52ae909))

## [1.7.5](https://github.com/unstable-studios/gridfinity-studio/compare/v1.7.4...v1.7.5) (2026-05-01)


### Bug Fixes

* **deps:** update dependency @unstable-studios/ui to v1 ([#325](https://github.com/unstable-studios/gridfinity-studio/issues/325)) ([a913ace](https://github.com/unstable-studios/gridfinity-studio/commit/a913acef35578f6c56d49a7ae4c4cb685673ee8a))
* **deps:** update dependency lucide-react to v1 ([#326](https://github.com/unstable-studios/gridfinity-studio/issues/326)) ([0bc0b37](https://github.com/unstable-studios/gridfinity-studio/commit/0bc0b378704a6a0490d3d84cc4b95fb8fd3bf302))
* load manifold.wasm via Vite asset URL so it works in Electron prod ([#329](https://github.com/unstable-studios/gridfinity-studio/issues/329)) ([192b9c6](https://github.com/unstable-studios/gridfinity-studio/commit/192b9c6e690665bea9cbe22c67b3435bcd628dfa))

## [1.7.4](https://github.com/unstable-studios/gridfinity-studio/compare/v1.7.3...v1.7.4) (2026-05-01)


### Bug Fixes

* bump electron-builder to 26.9.0 + use node-linker=hoisted to fix asar dep packaging ([#322](https://github.com/unstable-studios/gridfinity-studio/issues/322)) ([b1a9059](https://github.com/unstable-studios/gridfinity-studio/commit/b1a9059d6b63c4db186f828180d7fdb1c2388bcc))

## [1.7.3](https://github.com/unstable-studios/gridfinity-studio/compare/v1.7.2...v1.7.3) (2026-05-01)


### Bug Fixes

* **deps:** update dependency three to ^0.184.0 ([#310](https://github.com/unstable-studios/gridfinity-studio/issues/310)) ([be45b76](https://github.com/unstable-studios/gridfinity-studio/commit/be45b76eba411e109e9c7e2f8c2affeba5fcbd46))
* prep for React monorepo + TypeScript 6 bumps ([#316](https://github.com/unstable-studios/gridfinity-studio/issues/316)) ([f5079c5](https://github.com/unstable-studios/gridfinity-studio/commit/f5079c5fb544de94a423230293ec242abd2c4b00))

## [1.7.2](https://github.com/unstable-studios/gridfinity-studio/compare/v1.7.1...v1.7.2) (2026-05-01)


### Miscellaneous

* release 1.7.2 ([#308](https://github.com/unstable-studios/gridfinity-studio/issues/308)) ([8332cc6](https://github.com/unstable-studios/gridfinity-studio/commit/8332cc650df079dee8963798d0f0eaced370f799))

## [1.7.1](https://github.com/unstable-studios/gridfinity-studio/compare/v1.7.0...v1.7.1) (2026-04-30)


### Miscellaneous

* release 1.7.1 ([#302](https://github.com/unstable-studios/gridfinity-studio/issues/302)) ([c0846a1](https://github.com/unstable-studios/gridfinity-studio/commit/c0846a1dd36b51565b88b7ccc5c3c2bf13fc1fee))

## [1.7.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.6.0...v1.7.0) (2026-04-30)


### Features

* **core:** shape-to-bin assignment via drag ([#240](https://github.com/unstable-studios/gridfinity-studio/issues/240)) ([#270](https://github.com/unstable-studios/gridfinity-studio/issues/270)) ([78de8b7](https://github.com/unstable-studios/gridfinity-studio/commit/78de8b7509a2282db64047be5b5329be2a2774cc))
* **core:** wire bake loop and STL/3MF export — MVP path is now live ([#287](https://github.com/unstable-studios/gridfinity-studio/issues/287)) ([78fc0a9](https://github.com/unstable-studios/gridfinity-studio/commit/78fc0a938b2b68c223f94c28ed8f69456cc2da08))
* decouple input handling from rendering engines ([#226](https://github.com/unstable-studios/gridfinity-studio/issues/226)) ([#257](https://github.com/unstable-studios/gridfinity-studio/issues/257)) ([a376087](https://github.com/unstable-studios/gridfinity-studio/commit/a376087a3e13b7a49d596cd6973cb18bf1ca7451))
* layout engine abstraction with Fabric + Konva adapters ([#228](https://github.com/unstable-studios/gridfinity-studio/issues/228)) ([b237c76](https://github.com/unstable-studios/gridfinity-studio/commit/b237c76c2070ac7f66300c72403ca62751885378))
* layout engine integration (clean slate) ([#233](https://github.com/unstable-studios/gridfinity-studio/issues/233)) ([c00de77](https://github.com/unstable-studios/gridfinity-studio/commit/c00de77fb0276d8bcfd9ab1ae5fad0a6732a5a5c))
* **ui:** bin artwork, GroupRenderer encapsulation, viewport improvements ([#245](https://github.com/unstable-studios/gridfinity-studio/issues/245)) ([24cb475](https://github.com/unstable-studios/gridfinity-studio/commit/24cb47577f50b6a6fa75ecefb5f9d2a1cab8b612))
* **ui:** bin footprint, grid picker, new project dialog ([#218](https://github.com/unstable-studios/gridfinity-studio/issues/218)) ([d111c7a](https://github.com/unstable-studios/gridfinity-studio/commit/d111c7a8c870e1fcbe718b4b589163b4a596224b))
* **ui:** canvas interactions polish & unsaved indicator ([#216](https://github.com/unstable-studios/gridfinity-studio/issues/216)) ([02f1cfc](https://github.com/unstable-studios/gridfinity-studio/commit/02f1cfcc2f96d6103f8afe82d671e131e03fe63b))
* **ui:** drag-to-resize bins with collision detection (T018/T019) ([#248](https://github.com/unstable-studios/gridfinity-studio/issues/248)) ([29e2857](https://github.com/unstable-studios/gridfinity-studio/commit/29e285790fa10ef7edfb79303fdbee42febeeac2))
* **ui:** drawing tools — rectangle, circle, polygon (T021–T025) ([#254](https://github.com/unstable-studios/gridfinity-studio/issues/254)) ([00588f0](https://github.com/unstable-studios/gridfinity-studio/commit/00588f076306cea26fd9d70182847d7a31ff45f0))
* **ui:** sidebar overhaul — project header, context menus, pocket warning ([#215](https://github.com/unstable-studios/gridfinity-studio/issues/215)) ([b7a50b4](https://github.com/unstable-studios/gridfinity-studio/commit/b7a50b4d1199aa55954a54c94604cc5c943e3177))


### Bug Fixes

* **core:** bypass enterGroup in Fabric addShape for grouped snapshots ([#284](https://github.com/unstable-studios/gridfinity-studio/issues/284)) ([dd2386c](https://github.com/unstable-studios/gridfinity-studio/commit/dd2386c30239a3734e8f019e5134d70f1fdb86ea))
* **core:** Konva multi-drag snap — shapes follow bin snap ([#264](https://github.com/unstable-studios/gridfinity-studio/issues/264)) ([5f4a2f0](https://github.com/unstable-studios/gridfinity-studio/commit/5f4a2f02d37e4c9a695c7014c06a2f0b42a15b48))
* **core:** normalize polygon pocket winding so CCW-on-screen draws still cut ([#294](https://github.com/unstable-studios/gridfinity-studio/issues/294)) ([6963bf8](https://github.com/unstable-studios/gridfinity-studio/commit/6963bf845739ac5d9bdc3c23c61d1af289306c0c))
* **core:** normalize polygon position across Fabric/Konva engines ([#256](https://github.com/unstable-studios/gridfinity-studio/issues/256)) ([7964740](https://github.com/unstable-studios/gridfinity-studio/commit/79647402665d9127979d09162d43abffebe0e205))
* **core:** preserve child shape positions when bin is resized ([#280](https://github.com/unstable-studios/gridfinity-studio/issues/280)) ([00925dd](https://github.com/unstable-studios/gridfinity-studio/commit/00925ddcb246e0a3cfbfa7c293e39e6313841edb))
* **core:** preserve child world position across createGroup and updateGroup resize ([#286](https://github.com/unstable-studios/gridfinity-studio/issues/286)) ([9124116](https://github.com/unstable-studios/gridfinity-studio/commit/9124116daec726b5999041e076be2fa84d3d07eb))
* **core:** redo only restoring one step forward ([#263](https://github.com/unstable-studios/gridfinity-studio/issues/263)) ([b86902b](https://github.com/unstable-studios/gridfinity-studio/commit/b86902b6a5844304e59d4e09ff7834ff4af14a13))
* **deps:** add lockfile-include-tarball-url for GPR compatibility ([#244](https://github.com/unstable-studios/gridfinity-studio/issues/244)) ([21b6ef9](https://github.com/unstable-studios/gridfinity-studio/commit/21b6ef9b569fd47c0f6a55788875ae216d115b88))


### Documentation

* add adapter-based modularity as constitutional principle VII ([#243](https://github.com/unstable-studios/gridfinity-studio/issues/243)) ([324dbd6](https://github.com/unstable-studios/gridfinity-studio/commit/324dbd660971d808484cab1e40f0bfb80e9b2d38))


### Refactoring

* canvas interaction layer normalization and consolidation ([#219](https://github.com/unstable-studios/gridfinity-studio/issues/219)) ([dbc856b](https://github.com/unstable-studios/gridfinity-studio/commit/dbc856b4ddcb0940097d1ec1a73619a8904c549a))
* quick wins batch ([#230](https://github.com/unstable-studios/gridfinity-studio/issues/230), [#232](https://github.com/unstable-studios/gridfinity-studio/issues/232), [#246](https://github.com/unstable-studios/gridfinity-studio/issues/246), [#247](https://github.com/unstable-studios/gridfinity-studio/issues/247), [#231](https://github.com/unstable-studios/gridfinity-studio/issues/231)) ([#250](https://github.com/unstable-studios/gridfinity-studio/issues/250)) ([aa8d87f](https://github.com/unstable-studios/gridfinity-studio/commit/aa8d87fa6319a4619aa5db6ab13f50aaa8c3e413))

## [1.6.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.5.0...v1.6.0) (2026-03-06)


### Features

* **core:** full implementation roadmap and foundation (phases 1-2) ([#176](https://github.com/unstable-studios/gridfinity-studio/issues/176)) ([b9c5f9a](https://github.com/unstable-studios/gridfinity-studio/commit/b9c5f9a5114ea11e5149d6b89847614e5f76f53b))
* **core:** undo/redo system via Zustand ([#214](https://github.com/unstable-studios/gridfinity-studio/issues/214)) ([ff041f2](https://github.com/unstable-studios/gridfinity-studio/commit/ff041f2d2702aafa2b548e79ec1f9f49fb21f541))
* **core:** User Story 1 MVP — design-to-export pipeline (phase 3) ([#180](https://github.com/unstable-studios/gridfinity-studio/issues/180)) ([901111d](https://github.com/unstable-studios/gridfinity-studio/commit/901111da7a378882aced70430ecd0e1f75ce3ad5))
* create documentation for Gridfinity Studio Engineer agent ([#141](https://github.com/unstable-studios/gridfinity-studio/issues/141)) ([8f171cc](https://github.com/unstable-studios/gridfinity-studio/commit/8f171cc71659560dace15f7ee997456984e33742))
* CSG-first bin generator and full roadmap progress ([#193](https://github.com/unstable-studios/gridfinity-studio/issues/193)) ([a87db3e](https://github.com/unstable-studios/gridfinity-studio/commit/a87db3e4c3bf4d6b4ce34e9c42e2bdc2dfe9b49b))
* multi-bin export foundations and bug fixes ([#198](https://github.com/unstable-studios/gridfinity-studio/issues/198)) ([82b75ac](https://github.com/unstable-studios/gridfinity-studio/commit/82b75ac9c6a547bf87f7a54b315a7261fd458ec0))
* Phase 3.5 — true Gridfinity spec bin geometry ([#189](https://github.com/unstable-studios/gridfinity-studio/issues/189)) ([4b4dda9](https://github.com/unstable-studios/gridfinity-studio/commit/4b4dda901deb18ccdaaf1d9abedcd2f225e07f5f))
* **ui:** contextual hints and unit-aware dimensions ([#197](https://github.com/unstable-studios/gridfinity-studio/issues/197)) ([42b379d](https://github.com/unstable-studios/gridfinity-studio/commit/42b379ddff886e9d178ac06462126cb0f60e9375))
* **ui:** multi-bin layout & grid alignment ([#188](https://github.com/unstable-studios/gridfinity-studio/issues/188)) ([f3c5f29](https://github.com/unstable-studios/gridfinity-studio/commit/f3c5f29cb408cfb6b53400763a02cdc24128902d))
* **ui:** Phase 3.5 UX foundations ([#187](https://github.com/unstable-studios/gridfinity-studio/issues/187)) ([ddc7616](https://github.com/unstable-studios/gridfinity-studio/commit/ddc761685e531c8bd342bf6d99efa85d56c6bb57))
* **ui:** theme system, color picker, Design/Preview rename, and CSG fixes ([#194](https://github.com/unstable-studios/gridfinity-studio/issues/194)) ([3f75bb4](https://github.com/unstable-studios/gridfinity-studio/commit/3f75bb4f3f24b281bd5dc8600896c113bda45634))


### Bug Fixes

* **repo:** restore speckit commands lost by .claude/ gitignore ([#181](https://github.com/unstable-studios/gridfinity-studio/issues/181)) ([e8b17e1](https://github.com/unstable-studios/gridfinity-studio/commit/e8b17e1d15ec070a366012083722f0f3f107933c))
* **ui:** disable entity/bin interaction when drawing tool active ([#195](https://github.com/unstable-studios/gridfinity-studio/issues/195)) ([cba52f8](https://github.com/unstable-studios/gridfinity-studio/commit/cba52f89b6340f91cbb0d027c16f2e3c2981c235))


### Documentation

* **core:** revise plan with integration architecture and state audit ([#185](https://github.com/unstable-studios/gridfinity-studio/issues/185)) ([35c8315](https://github.com/unstable-studios/gridfinity-studio/commit/35c8315b5fa2e323cef89b3ec75f62339b43c408))
* mark phase 4 (multi-bin export) complete ([#211](https://github.com/unstable-studios/gridfinity-studio/issues/211)) ([8c92276](https://github.com/unstable-studios/gridfinity-studio/commit/8c92276e8d3dabf052e44adcc6028877d1af5f34))
* mark T218 and T219 complete ([#196](https://github.com/unstable-studios/gridfinity-studio/issues/196)) ([c0ba23f](https://github.com/unstable-studios/gridfinity-studio/commit/c0ba23fb400d24a95d1d029306c1e24af8094d11))
* **repo:** add spec-kit tooling and project constitution v1.0.0 ([#171](https://github.com/unstable-studios/gridfinity-studio/issues/171)) ([6dd4e34](https://github.com/unstable-studios/gridfinity-studio/commit/6dd4e34b386cea6c78238006689226ff56c71f66))

## [1.5.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.4.0...v1.5.0) (2025-12-28)


### Features

* fix minor CI issues ([#136](https://github.com/unstable-studios/gridfinity-studio/issues/136)) ([a7d1a4f](https://github.com/unstable-studios/gridfinity-studio/commit/a7d1a4fb43afea8c5615cbd4dd8fa584a3de6ca6))
* initialize R3F UI and viewport ([#130](https://github.com/unstable-studios/gridfinity-studio/issues/130)) ([f7d1206](https://github.com/unstable-studios/gridfinity-studio/commit/f7d12062886175c7d31fdf239da1000db5f3556a))
* **repo:** init repo with basic commit hooks and tooling ([4ad0ea6](https://github.com/unstable-studios/gridfinity-studio/commit/4ad0ea61ef00cde9d4a21d5a17e32b69fedbceb5))
* **repo:** update commitlint config for proper scope settings ([8ad68ab](https://github.com/unstable-studios/gridfinity-studio/commit/8ad68abcb2388100f7696b32ec1b008fc72d2d85))
* **ui:** create base UI and layout ([#128](https://github.com/unstable-studios/gridfinity-studio/issues/128)) ([c709dd2](https://github.com/unstable-studios/gridfinity-studio/commit/c709dd267174f8309876762213647b7ab6bd4562))
* **ui:** implement base tailwind styling and fonts ([#126](https://github.com/unstable-studios/gridfinity-studio/issues/126)) ([18894c7](https://github.com/unstable-studios/gridfinity-studio/commit/18894c7bc5cc2116ed5a7698413eb9452f812dc2))
* **ui:** import shadcn library ([#129](https://github.com/unstable-studios/gridfinity-studio/issues/129)) ([0e99a68](https://github.com/unstable-studios/gridfinity-studio/commit/0e99a6835309948c4554b7063c16086933bddb02))
* update CI and pass version tag to app ([#131](https://github.com/unstable-studios/gridfinity-studio/issues/131)) ([a407f6a](https://github.com/unstable-studios/gridfinity-studio/commit/a407f6abfbdbd4f9311a997c726dbca485174298))
* use softprops/action-gh-release for pushing release artifacts ([#138](https://github.com/unstable-studios/gridfinity-studio/issues/138)) ([001f71d](https://github.com/unstable-studios/gridfinity-studio/commit/001f71d216ad9e8918074d0d0e9013a24c511958))


### Bug Fixes

* adjust commitlint settings ([8de0460](https://github.com/unstable-studios/gridfinity-studio/commit/8de0460f0e16431fbdd26d2cefcf0d7302eefd2d))
* revert commitlint change ([34a00d6](https://github.com/unstable-studios/gridfinity-studio/commit/34a00d6ec00397953d3bccdaade249d8c1d20da5))


### Refactoring

* **repo:** set up basic electron-vite template ([98c43e6](https://github.com/unstable-studios/gridfinity-studio/commit/98c43e60196aa055ea9f9c0434b5b0f2b739c13f))
* **repo:** switch to pnpm and verify commitlint works as intended ([d31e90b](https://github.com/unstable-studios/gridfinity-studio/commit/d31e90be660c042cfd2e4aa10b67c2f87ba857f5))

## [1.4.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.3.0...v1.4.0) (2025-12-28)


### Features

* fix minor CI issues ([#136](https://github.com/unstable-studios/gridfinity-studio/issues/136)) ([a7d1a4f](https://github.com/unstable-studios/gridfinity-studio/commit/a7d1a4fb43afea8c5615cbd4dd8fa584a3de6ca6))

## [1.3.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.2.0...v1.3.0) (2025-12-28)


### Features

* initialize R3F UI and viewport ([#130](https://github.com/unstable-studios/gridfinity-studio/issues/130)) ([f7d1206](https://github.com/unstable-studios/gridfinity-studio/commit/f7d12062886175c7d31fdf239da1000db5f3556a))
* **repo:** init repo with basic commit hooks and tooling ([4ad0ea6](https://github.com/unstable-studios/gridfinity-studio/commit/4ad0ea61ef00cde9d4a21d5a17e32b69fedbceb5))
* **repo:** update commitlint config for proper scope settings ([8ad68ab](https://github.com/unstable-studios/gridfinity-studio/commit/8ad68abcb2388100f7696b32ec1b008fc72d2d85))
* **ui:** create base UI and layout ([#128](https://github.com/unstable-studios/gridfinity-studio/issues/128)) ([c709dd2](https://github.com/unstable-studios/gridfinity-studio/commit/c709dd267174f8309876762213647b7ab6bd4562))
* **ui:** implement base tailwind styling and fonts ([#126](https://github.com/unstable-studios/gridfinity-studio/issues/126)) ([18894c7](https://github.com/unstable-studios/gridfinity-studio/commit/18894c7bc5cc2116ed5a7698413eb9452f812dc2))
* **ui:** import shadcn library ([#129](https://github.com/unstable-studios/gridfinity-studio/issues/129)) ([0e99a68](https://github.com/unstable-studios/gridfinity-studio/commit/0e99a6835309948c4554b7063c16086933bddb02))
* update CI and pass version tag to app ([#131](https://github.com/unstable-studios/gridfinity-studio/issues/131)) ([a407f6a](https://github.com/unstable-studios/gridfinity-studio/commit/a407f6abfbdbd4f9311a997c726dbca485174298))


### Bug Fixes

* adjust commitlint settings ([8de0460](https://github.com/unstable-studios/gridfinity-studio/commit/8de0460f0e16431fbdd26d2cefcf0d7302eefd2d))
* revert commitlint change ([34a00d6](https://github.com/unstable-studios/gridfinity-studio/commit/34a00d6ec00397953d3bccdaade249d8c1d20da5))


### Refactoring

* **repo:** set up basic electron-vite template ([98c43e6](https://github.com/unstable-studios/gridfinity-studio/commit/98c43e60196aa055ea9f9c0434b5b0f2b739c13f))
* **repo:** switch to pnpm and verify commitlint works as intended ([d31e90b](https://github.com/unstable-studios/gridfinity-studio/commit/d31e90be660c042cfd2e4aa10b67c2f87ba857f5))

## [1.2.0](https://github.com/unstable-studios/gridfinity-studio/compare/gridfinity-studio-v1.1.0...gridfinity-studio-v1.2.0) (2025-12-28)


### Features

* initialize R3F UI and viewport ([#130](https://github.com/unstable-studios/gridfinity-studio/issues/130)) ([f7d1206](https://github.com/unstable-studios/gridfinity-studio/commit/f7d12062886175c7d31fdf239da1000db5f3556a))
* **repo:** init repo with basic commit hooks and tooling ([4ad0ea6](https://github.com/unstable-studios/gridfinity-studio/commit/4ad0ea61ef00cde9d4a21d5a17e32b69fedbceb5))
* **repo:** update commitlint config for proper scope settings ([8ad68ab](https://github.com/unstable-studios/gridfinity-studio/commit/8ad68abcb2388100f7696b32ec1b008fc72d2d85))
* **ui:** create base UI and layout ([#128](https://github.com/unstable-studios/gridfinity-studio/issues/128)) ([c709dd2](https://github.com/unstable-studios/gridfinity-studio/commit/c709dd267174f8309876762213647b7ab6bd4562))
* **ui:** implement base tailwind styling and fonts ([#126](https://github.com/unstable-studios/gridfinity-studio/issues/126)) ([18894c7](https://github.com/unstable-studios/gridfinity-studio/commit/18894c7bc5cc2116ed5a7698413eb9452f812dc2))
* **ui:** import shadcn library ([#129](https://github.com/unstable-studios/gridfinity-studio/issues/129)) ([0e99a68](https://github.com/unstable-studios/gridfinity-studio/commit/0e99a6835309948c4554b7063c16086933bddb02))
* update CI and pass version tag to app ([#131](https://github.com/unstable-studios/gridfinity-studio/issues/131)) ([a407f6a](https://github.com/unstable-studios/gridfinity-studio/commit/a407f6abfbdbd4f9311a997c726dbca485174298))


### Bug Fixes

* adjust commitlint settings ([8de0460](https://github.com/unstable-studios/gridfinity-studio/commit/8de0460f0e16431fbdd26d2cefcf0d7302eefd2d))
* revert commitlint change ([34a00d6](https://github.com/unstable-studios/gridfinity-studio/commit/34a00d6ec00397953d3bccdaade249d8c1d20da5))


### Refactoring

* **repo:** set up basic electron-vite template ([98c43e6](https://github.com/unstable-studios/gridfinity-studio/commit/98c43e60196aa055ea9f9c0434b5b0f2b739c13f))
* **repo:** switch to pnpm and verify commitlint works as intended ([d31e90b](https://github.com/unstable-studios/gridfinity-studio/commit/d31e90be660c042cfd2e4aa10b67c2f87ba857f5))

## [1.1.0](https://github.com/unstable-studios/gridfinity-studio/compare/v1.0.0...v1.1.0) (2025-12-28)


### Features

* initialize R3F UI and viewport ([#130](https://github.com/unstable-studios/gridfinity-studio/issues/130)) ([f7d1206](https://github.com/unstable-studios/gridfinity-studio/commit/f7d12062886175c7d31fdf239da1000db5f3556a))
* **repo:** init repo with basic commit hooks and tooling ([4ad0ea6](https://github.com/unstable-studios/gridfinity-studio/commit/4ad0ea61ef00cde9d4a21d5a17e32b69fedbceb5))
* **repo:** update commitlint config for proper scope settings ([8ad68ab](https://github.com/unstable-studios/gridfinity-studio/commit/8ad68abcb2388100f7696b32ec1b008fc72d2d85))
* **ui:** create base UI and layout ([#128](https://github.com/unstable-studios/gridfinity-studio/issues/128)) ([c709dd2](https://github.com/unstable-studios/gridfinity-studio/commit/c709dd267174f8309876762213647b7ab6bd4562))
* **ui:** implement base tailwind styling and fonts ([#126](https://github.com/unstable-studios/gridfinity-studio/issues/126)) ([18894c7](https://github.com/unstable-studios/gridfinity-studio/commit/18894c7bc5cc2116ed5a7698413eb9452f812dc2))
* **ui:** import shadcn library ([#129](https://github.com/unstable-studios/gridfinity-studio/issues/129)) ([0e99a68](https://github.com/unstable-studios/gridfinity-studio/commit/0e99a6835309948c4554b7063c16086933bddb02))


### Bug Fixes

* adjust commitlint settings ([8de0460](https://github.com/unstable-studios/gridfinity-studio/commit/8de0460f0e16431fbdd26d2cefcf0d7302eefd2d))
* revert commitlint change ([34a00d6](https://github.com/unstable-studios/gridfinity-studio/commit/34a00d6ec00397953d3bccdaade249d8c1d20da5))


### Refactoring

* **repo:** set up basic electron-vite template ([98c43e6](https://github.com/unstable-studios/gridfinity-studio/commit/98c43e60196aa055ea9f9c0434b5b0f2b739c13f))
* **repo:** switch to pnpm and verify commitlint works as intended ([d31e90b](https://github.com/unstable-studios/gridfinity-studio/commit/d31e90be660c042cfd2e4aa10b67c2f87ba857f5))
