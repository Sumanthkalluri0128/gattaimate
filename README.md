# GattaiMate — private PDF toolkit

Merge PDFs, turn photos into PDFs, split, extract, rotate and optimize documents. Everything runs on the user's device — no backend, no uploads.

```
apps/web         React + Vite web app (hash-routed pages, code-split)
apps/mobile      Expo / React Native Android app (expo-router screens)
packages/pdf-core  Shared pdf-lib engine + helpers (tested with Vitest)
```

## Tools (web and mobile)

| Tool | What it does |
| --- | --- |
| Merge PDF / Images to PDF | Combine PDFs and JPG/PNG in any order (drag or arrows), rotate any file, a single image is fine. Phone photos are auto-oriented from EXIF; landscape images get landscape A4 pages. |
| Split PDF | Custom groups (`1-2;3-5;6`, `1,3;2,4-5`) or every N pages. Output is one ZIP. |
| Extract Pages | Keep selected pages (`1-3,5`). |
| Rotate PDF | 90 / 180 / 270°, all pages or a range. |
| Optimize PDF | *Keep text & links* (lossless rewrite, both platforms). *Smaller file* (web only) flattens pages to JPEG; it refuses to save if the result would be larger. |
| Optimize Image | JPEG quality + max size; PNG transparency becomes white. |
| Preview (inside every tool) | After choosing a file, press **Preview**. Web: viewer modal with zoom, paging, rotate and "save rotated copy". Android: images in-app (rotate + save), PDFs open in the phone's PDF viewer. Also available per file in Merge. |

Recent files keep only names, sizes and times (localStorage on web, a small JSON file on Android) — never documents.

## Commands (repo root)

```bash
npm install
npm run dev:web        # http://localhost:5173
npm run dev:mobile     # Expo; scan the QR with Expo Go
npm run check          # core tests + typecheck (web, mobile, core) + web build
```

If Expo reports a version mismatch: `cd apps/mobile && npx expo install --fix`, then `npx expo start -c`.

## Deploy the web app (Vercel)
Root Directory: repository root · Install: `npm install` · Build: `npm run build:web` · Output: `apps/web/dist`. No environment variables.

## Build an Android APK (EAS)
```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview
```
Open the build URL on the phone to install. Web deploys do not update the APK; rebuild after mobile changes.

## Notes and limits
- Password-protected PDFs are rejected with a clear message (no bypass). Merging drops digital signatures; forms/bookmarks need testing.
- Large PDFs use real RAM, especially on phones.
- pdf.js is loaded from its **legacy** build on purpose: the default build needs very new JavaScript (`Map.prototype.getOrInsertComputed`) and fails on many current browsers.
- The shared engine lives in `packages/pdf-core`; add new PDF operations there with a test, then call them from both apps.
