# OpenSaysMe + GapGuard

One personal Chromium extension with **Protection**, **News**, and **Research** tabs.

- **Protection:** GapGuard ad and tracker filtering, Core/Combined profiles, custom rules, element picker, and automatic saving of switches.
- **News:** OpenSaysMe publisher tools, custom sites, exclusions, and cookie cleanup.
- **Research:** OpenSaysMe DOI/open-access lookup, configured library access, citations, and retraction indicators.

## Load the combined extension

1. At `edge://extensions` (or your Chromium browser's extensions manager), enable **Developer mode**.
2. Choose **Load unpacked** and select this project's **extension** folder, which contains `manifest.json`.
3. Disable the standalone GapGuard and OpenSaysMe while testing this combined build. Also disable the original Bypass Paywalls Clean and Open Access Helper if installed.
4. Reload the websites you want to test. Open the combined popup and choose Protection, News, or Research.

The original project folders are preserved. This is a new extension identity with fresh preferences; existing installations are not automatically changed or imported. Protection settings can be exported from standalone GapGuard and imported into the combined Protection settings. Research/library preferences need to be configured for this installation.

## How the modules coexist

The background uses a rule coordinator, rather than letting either component replace the extension's entire rule collection. Each module sees its own virtual rule IDs, gets only its own rule collection, and can delete only its own rules. The coordinator restores its persisted records after worker suspension and translates diagnostic matches back to the module's IDs.

Publisher network rules use a reserved session namespace and rebuild on startup. Protection keeps its dynamic and session rules. Publisher allow exceptions are converted to conditions and tab guards affecting News only, so excluding a publisher cannot create an extension-wide ad-blocking exception. Request headers and publisher redirects have explicitly higher priority on their publisher scopes. A publisher redirect can therefore win over a protection action targeting that same document URL. Page navigation can need a reload for the News tab guard to settle.

Preferences remain separate: `bpc:` for News, `oa:` for Research, GapGuard's existing protection/engine storage, and `combined:` for the coordinator and shared interface. The Protection toggle pauses ad/tracker filtering; it does not disable News or Research. Disable the entire extension in the browser when you want all three modules off.

This integration prevents rule deletion and ID collisions; it does not prove the absence of every interaction between page scripts, site exceptions, redirects, or filters. Existing standalone site results are not automatically results for this new combined build.

## Build and check

Node.js 24 and npm:

```sh
npm ci
npm run build
npm run check
npm test
```

`npm run build` reuses the local protection build if present. A fresh checkout builds it automatically. To explicitly regenerate the protection rules from saved snapshots, run `npm run build:protection`. Supplemental inputs are fetched if no local cache exists, so a clean build may use newer supplemental rules than this first package. Generated extension output, filter caches, dependencies, diagnostic reports, and ZIP files are ignored by Git.

The coordinator tests use simulated browser APIs and controlled rule cases. Package checks verify manifest files, script syntax, original reader compatibility, checksums, and static rule limits. General website behavior remains your manual test, using [TESTING.md](TESTING.md).

## Sources

OpenSaysMe's runtime source was copied from the existing loadable extension. GapGuard's integration source and filter build scripts are preserved under `components/gapguard`. Build-time source hashes and local provenance are recorded in `reports/`. No original project was edited to produce this package.

Credits and original notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
