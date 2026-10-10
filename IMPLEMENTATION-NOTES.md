# GattaiMate — selected reference design implementation

This update follows the user's selected dashboard reference (purple/blue neon accents, left navigation, tool cards, recent files, privacy banner, and matching mobile home screen).

## Included in the source update
- Web dashboard shell with responsive sidebar navigation, search/filter for tool cards, hero panel, gradient tool cards, recent session history, and merge workspace.
- Android home screen with the app icon, matching premium brand header, colorful document-tool grid, privacy messaging, and recent session history.
- Existing PDF + JPG/JPEG/PNG merge/conversion flow and editable output filename retained.
- Recent history is session-only metadata. The app does not keep document bytes in history.
- Android icon/adaptive icon/splash assets remain configured in `apps/mobile/app.json`.

## Important feature status
Merge PDF and convert images to PDF are implemented. File ordering is implemented at the file level. Split PDF, rotate PDF, extract pages, compression, per-page thumbnails, and advanced PDF page editing remain future features; their cards should not be mistaken for working tools yet.

## Verify locally
From the repository root:

```bash
npm install
npm run test:core
npm run build:web
```

For Android, from `apps/mobile`:

```bash
npx expo-doctor
npx eas-cli build --platform android --profile preview
```

The dependency install/build was not verified in this environment because `npm install` timed out. Run the checks locally before pushing to Vercel or creating a new APK.

## Document tools implementation update

- Merge PDF and images-to-PDF remain powered by the shared `@gattaimate/pdf-core` package.
- Split PDF: accepts page groups such as `1-2,3-5` and downloads one PDF per group.
- Extract Pages: accepts page selections such as `1-3,5`.
- Rotate PDF: rotates all pages or a selected range by 90, 180, or 270 degrees.
- Optimize PDF: re-saves with object streams and removes metadata. This is structural optimization only; it does not promise smaller files and does not perform lossy image recompression.
- Preview PDF: opens the selected PDF in a browser tab on web; on Android it uses the native share sheet so a PDF viewer can open it.
- Organize Files/Pages: uses the existing up/down ordering controls before merge.

Run `npm run test:core` and `npm run build:web` from the repository root after installing dependencies. The current environment could not complete `npm install`, so the new changes have not been compiled here; verify on the development machine before deploying or building the APK.


## In-app preview and rotation update
- The web app now opens selected PDFs and images in an in-app preview dialog instead of launching a new browser tab.
- Rotate controls update the preview. “Save rotated copy” explicitly creates a separate rotated file; the original remains unchanged.
- Previewing alone does not trigger a download.
- The preview UI uses the existing dark purple theme and adapts to smaller screens.
- Validation note: dependency installation timed out in the execution environment, so run the checks below locally after `npm install`.
