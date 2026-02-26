# DamageDraft

Android-first Expo app for creating Outlook-ready damage report email drafts. The app builds and pre-fills the draft, and the user still presses **Send** in Outlook/email client.

## Stack

- Expo SDK 54 + React Native 0.81
- Navigation: `@react-navigation/native`, `@react-navigation/native-stack`
- Database: `expo-sqlite`
- Camera: `expo-camera`
- Gallery picker: `expo-image-picker`
- OCR: `expo-text-extractor`
- Image compression: `expo-image-manipulator`
- Local file storage: `expo-file-system/legacy`
- Email drafting: `expo-mail-composer`
- Export sharing: `expo-sharing`

## Run

1. Install dependencies

```bash
npm install
```

2. Start

```bash
npx expo start
```

3. Run Android

```bash
npx expo run:android
```

## Important Build Notes

- `expo-text-extractor` is a native module and is not available in standard Expo Go.
- Use a development build (`npx expo run:android`) or EAS build for full functionality (OCR, native compose, etc.).
- App config already includes required plugins/permissions in `app.json`:
  - `expo-camera` plugin + camera permission message
  - `expo-image-picker` plugin + photo library permission message
  - `expo-mail-composer`
  - `expo-sqlite`
  - Android `CAMERA` permission

## Features Implemented

- New report, save incomplete, resume incomplete
- Make + model fields in report editor (optional)
- Optional color swatch picker (10-color preset, no default)
- VIN-based make/model auto-fill (best-effort, with online VIN decode fallback when available)
- Completed reports list + edit + draft again
- Completed reports quick duplicate (copies VIN/location/recipients into a new incomplete report; photos/codes cleared)
- VIN required for draft
- VIN photo required for draft (and attached)
- VIN OCR extraction with full VIN preference (`[A-HJ-NPR-Z0-9]{17}`), fallback to longest alphanumeric run >= 8
- Damage code entry:
  - Dropdown mode (Area/Type/Severity)
  - Manual mode (`xx`, `xx`, `x`) producing exact `xx-xx-x`
  - Per-code remove
  - Top 5 Area/Type from completed reports in last 30 days shown at top of dropdowns
- Fast capture loop for non-VIN photos (`Add Photos` -> shutter -> keeps camera open)
- VIN capture flow (`Capture VIN Photo (OCR)`)
- Gallery photo selection for VIN and damage photos
- Local photo storage in app directory
- Missing-file-safe rendering (`missing file` placeholder instead of crash)
- Email draft creation with:
  - recipients from settings/report
  - subject format `VIN <VIN> - <Location> - Damage Report` (location omitted when blank)
  - body format:
    - codes (one per line)
    - blank line
    - `Location: ...`
    - blank line
    - notes
  - attachments include VIN photo + all other photos (compressed copies)
- Compression strategy:
  - longest edge <= 1600
  - JPEG quality 0.75
  - warning confirm when >12 photos
- Optional field confirmations on draft:
  - no codes
  - no unit location
- Logs export:
  - CSV
  - plain text blocks
  - share sheet export
  - optional email-export to default export address
  - export warning flow when incomplete reports exist (review / delete all incomplete / continue)
  - CSV `vin_text`, `unit_location`, `make_model` columns are adjacent for easier spreadsheet copy/paste
  - damage codes exported in `codes_text` as text-safe value for Excel
- Photo maintenance:
  - delete photos older than 7 days
  - delete all stored photos
- Incomplete reports:
  - per-report delete
  - delete all incomplete reports
- Theme options:
  - dark/light mode with `system`, `light`, and `dark` selection in Options
- Branding:
  - launcher icon configured from `assets/branding/launcher-outline-minimal.png`
  - home wordmark image loaded from `assets/branding/damagedraft-wordmark.png`

## Data Model

SQLite tables:

- `reports`
- `report_codes`
- `report_photos`
- `settings`

Indexes:

- `idx_report_codes_code`
- `idx_report_photos_created_at`

## File Structure

```text
src/
  db/
    db.ts
    queries.ts
  data/
    damageAreas.json
    damageTypes.json
    severity.json
  screens/
    HomeScreen.tsx
    ReportEditorScreen.tsx
    IncompleteReportsScreen.tsx
    CompletedReportsScreen.tsx
    OptionsScreen.tsx
  components/
    Button.tsx
    CodeEntry.tsx
    PhotoStrip.tsx
    ConfirmDialog.tsx
  lib/
    ocr.ts
    email.ts
    images.ts
    export.ts
    theme.ts
  types/
    models.ts
    navigation.ts
App.tsx
```

## Design Choices

- Report row is created immediately when entering New Report to simplify attaching photos/codes quickly.
- Text fields (`VIN`, `location`, `recipients`, `notes`) are persisted on explicit save/draft actions.
- `Delete all stored photos` removes file entries from DB (simple and reliable cleanup path).
- Full area/type lists are included from the provided card data, including the corrected code `89`:
  - `89 - Trailer Hitch, Wiring Harness / Tow Hook`
