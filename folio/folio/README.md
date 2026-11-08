# Folio · PDF tool (demo)

A mock PDF tool in Java (Swing, no external libraries) with three profiles that use the same tool in completely different ways. The difference is not just in the documents but in **which features they click**, which makes it a great data source for grouping users by behavior.

| Profile | Documents | Uses | Never uses |
| --- | --- | --- | --- |
| Developer · Marko Petrović | Specs, RFCs, invoices, release notes | Search, export text, comments | Fill form, OCR, redaction |
| Doctor · Dr Ana Jovanović | Lab reports, referrals, scans of old reports, discharge summaries | Sign, fill form, OCR, redaction | Compare, export, AI summary |
| Banker · Jelena Marković | Loan agreements, KYC, balance sheets, ID card scans | Redaction, sign, version compare | Uses every tool |

The right panel **"How they use the PDF tool"** shows how many times each tool was used in the last 30 days and which tools the profile has **never used**. That is where interview questions come from, for example: *"You sign and fill in forms every day, but you have never opened the AI summary of a report. Why?"*

## Running

Requires Java 17 or newer.

```
java -jar folio.jar
java -jar folio.jar --profile doctor
java -jar folio.jar --profile banker
```

The old profile names (`--profile lekar`, `--profile bankar`) still work. You can also switch profiles with the buttons in the top right.

## What each tool does

| Tool | Effect in the demo |
| --- | --- |
| Sign | Adds a signature to a document that has a signature field |
| Fill form | Fills in an empty form (referral, KYC) |
| OCR | Turns a scan into a document with text |
| Redact | Redacts personal data (name, personal ID number, document number) |
| Compare | Shows the changes against the previous version of a contract or spec |
| AI summary | Shows a summary of the document |
| Comment | Adds a comment to the page |
| Search, Merge, Compress, Export text | Short notification |

A yellow dot on a tool means the current document is waiting for it (unsigned, empty form, scan without text, personal data not redacted). Every click increases the counter in the right panel.

## Data (JSON)

On first run the app creates a `folio-data/` folder with `developer.json`, `doctor.json` and `banker.json`. They contain:

- `usage`: how many times each feature was used (the numbers in the right panel),
- `documents`: documents with their state (`signed`, `filled`, `redacted`, `ocr`...), AI summary, changes for comparison and the content of the first page (`blocks`: title, table, form, signature...).

All changes are saved immediately. Delete `folio-data/` to reset to the initial state before a demo.

## PostHog (optional)

Events: `app_opened`, `profile_switched`, `document_opened`, `feature_used` (with the properties `feature` and `doc_kind`). Each profile is a separate person (`folio_developer`, `folio_doctor`, `folio_banker`) with a `role` property.

Without configuration, events are only printed to the console. To send them to PostHog:

```
export POSTHOG_KEY=phc_your_project_token
export POSTHOG_HOST=https://eu.i.posthog.com   # or https://us.i.posthog.com
java -jar folio.jar
```

On Windows: `set POSTHOG_KEY=...` before running.

For a new live person (demo): `java -jar folio.jar --profile doctor --user "Ana Zirij"`. Events then go to the person `folio_ana_zirij` (name without diacritics, lowercase, `_` instead of spaces), with the role of the selected profile.

## Building from source

`./build.sh` (macOS, Linux) or `build.bat` (Windows) builds a new `folio.jar`.
