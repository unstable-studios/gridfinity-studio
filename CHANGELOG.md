# Changelog

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
