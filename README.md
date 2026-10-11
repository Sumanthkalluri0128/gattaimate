# GattaiMate — private PDF toolkit

Merge, scan, sign, redact, organize and optimize documents. Everything runs on the user's device — no backend, no uploads.

```
apps/web           React + Vite web app / installable offline PWA (hash-routed, code-split)
apps/mobile        Expo / React Native Android app (expo-router screens)
packages/pdf-core  Shared pdf-lib engine + helpers (tested with Vitest)
```

## Tools

| Tool | Web | Android | Notes |
| --- | :-: | :-: | --- |
| Merge PDF / Images to PDF | ✅ | ✅ | Drag/arrow reorder, per-file rotate, single image OK, EXIF-aware photos |
| **Scan to PDF** | – | ✅ | Camera → system crop → reorder/rotate → PDF (needs camera permission) |
| Split · Extract · Rotate | ✅ | ✅ | Split by groups (`1-2;3-5`) or every N pages → ZIP |
| **Organize Pages** | ✅ thumbnails + drag | ✅ list | Reorder, delete, duplicate, rotate pages |
| **Numbers & Watermark** | ✅ | ✅ | Position, style, start number, diagonal text stamp |
| **Sign PDF** | ✅ draw / type / upload, click to place | ✅ type / image, position presets | Visual signature (not a certificate signature) |
| **Fill Form** | ✅ | ✅ | Text, checkbox, dropdown, radio; optional flatten |
| **Redact** | ✅ | – | Draw boxes; those pages are flattened so text is truly removed |
| Optimize PDF | ✅ lossless + “Smaller file” | ✅ lossless | Before/after size bars; never saves a bigger file |
| Optimize Image | ✅ | ✅ | JPEG quality + max size |
| **PDF to Images** | ✅ | – | JPG/PNG, 72–300 dpi, page range → ZIP |
| **Protect / Unlock** | ✅ both | ✅ protect only | Protect = RC4-128 (light deterrent). Unlock needs the password (qpdf-wasm, web only) |
| **Presets & Batch** | ✅ | ✅ | Built-in + custom recipes on many PDFs → ZIP. “Shrink” step is web only |
| Preview | ✅ in every tool | ✅ images in-app, PDFs via viewer | |

Web extras: light/dark theme, keyboard shortcuts (`?` lists them), installable + works offline.
Android extras: *Share → GattaiMate* from any app opens a “what do you want to do” screen.

Why some features are web-only: redact, PDF→images and “Smaller file” need to render PDF pages to a canvas, and unlock uses WebAssembly; React Native's engine has neither without extra native libraries.

## Commands (repo root)

```bash
npm install
npm run dev:web        # http://localhost:5173
npm run dev:mobile     # Expo dev server
npm run check          # core tests + typecheck (web, mobile, core) + web build
```

## Deploy the web app (Vercel)
Root Directory: repository root · Install: `npm install` · Build: `npm run build:web` · Output: `apps/web/dist`. No environment variables. After the first visit the app can be installed and used offline.

## Android app (EAS build required)
The app now uses native modules (`expo-share-intent`, `expo-image-picker`), so build an APK instead of relying on Expo Go:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview
```
In Expo Go everything still runs except *Share → GattaiMate* (it is skipped safely). If Expo reports a version mismatch: `npx expo install --fix`.

## Notes and limits
- Password-protected PDFs are rejected with a clear message in every tool except Unlock. Merging drops digital signatures; check forms/bookmarks on your own files.
- RC4-128 protection opens in every reader but is a light deterrent — use dedicated software for highly sensitive files.
- Watermarks, page numbers and typed signatures use built-in PDF fonts: Latin text only.
- pdf.js is loaded from its **legacy** build on purpose (the default build needs very new JavaScript and fails on many browsers).
- Large PDFs use real RAM, especially on phones.
- New PDF operations belong in `packages/pdf-core` with a test; both apps call them.
