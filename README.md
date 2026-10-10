# GattaiMate — PDF Merger

A privacy-first PDF merger for the web and Android. PDF files are processed locally on the user's device. There is no backend or database in this starter.

## Included
- React + TypeScript + Vite web app
- Expo + React Native Android app
- Shared `pdf-lib` merge package
- Web drag-and-drop/file selection, reorder, remove, merge and download
- Android document picker, reorder, merge and share
- Basic unit test for the shared PDF engine

## Requirements
- Node.js LTS (Node 20.19+ or a newer supported LTS is recommended)
- npm
- For Android: Expo Go for quick development, and EAS CLI/account for cloud APK builds

## Install
From the repository root:

```bash
npm install
```

## Run the web app
```bash
npm run dev:web
```
Open the local URL printed by Vite, usually http://localhost:5173.

## Run the Android app
```bash
npm run dev:mobile
```
Install Expo Go on your Android device and scan the QR code. For native package compatibility, if Expo reports a dependency mismatch, run `npx expo install --fix` from `apps/mobile` and restart with `npx expo start -c`.

## Test and build web
```bash
npm run test:core
npm run build:web
```

## Deploy web to Vercel
1. Push this repository to GitHub.
2. In Vercel, import the repository.
3. Set the Root Directory to `apps/web`.
4. Set Framework Preset to Vite.
5. Set Build Command to `cd ../.. && npm install && npm run build:web` if the dashboard allows a custom command. If Vercel's root install/build setup does not install the workspace root, use the repository root as the Root Directory and configure:
   - Build Command: `npm run build:web`
   - Output Directory: `apps/web/dist`
   - Install Command: `npm install`
6. Deploy. No environment variables are needed.

**Recommended Vercel monorepo configuration:** set the Root Directory to the repository root, Install Command to `npm install`, Build Command to `npm run build:web`, and Output Directory to `apps/web/dist`. If Vercel asks to detect a framework, choose Vite.

Check the current hosting plan's terms before commercial use; free tiers have limits and terms can change.

## Build an Android APK with EAS
1. Create an Expo account.
2. Install EAS CLI: `npm install --global eas-cli` (or use `npx eas-cli` if global install permissions are blocked).
3. From `apps/mobile`, run `npx eas login`.
4. Run `npx eas build:configure`.
5. Use the included `eas.json`, then run:
   ```bash
   npx eas build --platform android --profile preview
   ```
6. When the build finishes, open the build URL on your Android device and install the APK.

Direct APK installation is suitable for testers. Google Play distribution has separate account, policy and testing requirements.

## Privacy and PDF limitations
- This app does not upload documents to a server.
- Password-protected/encrypted PDFs may fail; this starter reports an error rather than bypassing encryption.
- Digital signatures generally do not remain valid after modifying/merging a PDF.
- Interactive forms, bookmarks, attachments and other advanced PDF features require additional compatibility testing.
- Large PDFs can use substantial RAM, especially on phones. Test with realistic files and consider a file-size/page-count warning before public launch.

## Suggested next improvements
- Drag-and-drop ordering on web and accessible keyboard controls
- Page thumbnails and preview
- Split, rotate and remove pages
- Progress/cancellation for large jobs (true cancellation requires a worker/streaming design)
- Localization, analytics that exclude document contents, privacy policy and accessibility audit


## Output filename behavior
When the first PDF(s) are selected, the suggested output name becomes `<first-pdf-name>-merged.pdf`. The name remains editable. Once the user edits it, adding more files will not overwrite their chosen name.

## Baby steps: create an Android APK
1. Open Terminal in VS Code at the repository root.
2. Run `npm install` if you have not already done so.
3. Move to the mobile app: `cd apps/mobile`.
4. Sign up or sign in at https://expo.dev/.
5. Run `npx eas-cli login` and follow the browser/login instructions.
6. Run `npx eas-cli build:configure` if EAS has not been configured yet.
7. Start a preview APK build: `npx eas-cli build --platform android --profile preview`.
8. If asked to create an Android keystore, allow EAS to generate and manage it for this test build.
9. Wait for the build to finish, then open the build URL on your Android phone and download/install the APK. You may need to allow installation from your browser for this APK.
10. For future code changes, create a new APK build; Vercel only updates the website.


## Combine images with PDFs
GattaiMate supports PDF, JPG, JPEG, and PNG inputs on web and Android. Each image is converted into one A4 PDF page, centered and scaled to fit while preserving its aspect ratio. Items are combined in the order shown in the workspace. Processing stays on the device/browser; no backend is needed.


## Convert images to PDF and merge
GattaiMate supports PDF, JPG, JPEG, and PNG inputs in both the web and Android apps. Each selected image becomes one A4 PDF page, preserving its aspect ratio. You can combine images and PDFs in any order, or select a single image to create a one-page PDF. The suggested output filename is based on the first selected file and remains editable. Processing is local; no backend is required.


## Document editing and optimization updates

- Split PDF lets you choose the exact source PDF. Separate output groups with semicolons (for example `1-2;3-5;6`); commas inside a group select multiple pages (for example `1,3;2,4-5`). Legacy comma-only groups remain supported.
- Optimize PDF renders pages and recompresses them as JPEG at a selectable quality. This can reduce file size but rasterizes pages, so selectable text, links, forms, and vector quality are not preserved in the optimized copy. Keep the original when those matter.
- Optimize Image exports JPG/JPEG/PNG selections as compressed JPG, optionally downscaling images larger than 2400 px. PNG transparency is flattened to white.
- Every uploaded file has Open and Rotate controls. Rotation produces a new file and leaves the original untouched.
- PDF/image work is performed locally in the browser.
