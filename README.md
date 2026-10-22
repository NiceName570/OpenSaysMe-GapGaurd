# OpenSaysMe + GapGuard

One personal Chromium extension in OpenSaysMe's blue-and-white style. **One toolbar switch controls Protection, News, and Research together and saves automatically.**

- **Protection:** GapGuard ad and tracker filtering, saved filter profiles, custom rules, and element picker.
- **News:** OpenSaysMe publisher tools, custom sites, exclusions, and cookie cleanup.
- **Research:** OpenSaysMe DOI/open-access lookup, configured library access, citations, and retraction indicators.

## Load the combined extension

1. At `edge://extensions` (or your Chromium browser's extensions manager), enable **Developer mode**.
2. Choose **Load unpacked** and select this project's **extension** folder, which contains `manifest.json`.
3. Disable the standalone GapGuard and OpenSaysMe while testing this combined build. Also disable the original Bypass Paywalls Clean and Open Access Helper if installed.
4. Reload the websites you want to test. Use the single OpenSaysMe switch in the toolbar popup. Article tools are under **News & research tools**; advanced preferences are under **Settings**.

**Off** removes native protection and publisher rules, pauses the protection engine, suppresses publisher injections/cookie cleanup/navigation callbacks, and aborts research requests. **On** restores filtering and the saved preferences. The switch survives browser/worker restarts. Reload webpages after switching: already-modified article DOM cannot be reconstructed automatically.

The original project folders are preserved. This is a new extension identity with fresh preferences; existing installations are not automatically changed or imported. Protection settings can be exported from standalone GapGuard and imported into the combined Protection settings. Research/library preferences need to be configured for this installation.

## Share it as a ZIP

`npm run package` builds, checks, and writes `dist/OpenSaysMe.zip`. The files sit at the top of the ZIP, so extracting it on Windows or macOS creates one `OpenSaysMe` folder with `manifest.json` directly inside. That folder is the one to choose at **Load unpacked**. The ZIP also contains `READ ME FIRST.txt`, plain step-by-step instructions for Chrome and Edge (source: `docs/READ-ME-FIRST.txt`).

The ZIP keeps the same name for every version on purpose. Chrome ties an unpacked extension to its folder, so for an update the recipient copies the new files into the same folder and clicks reload, which keeps their settings.

## How the modules coexist

The background uses a rule coordinator, rather than letting either component replace the extension's entire rule collection. Each module sees its own virtual rule IDs, gets only its own rule collection, and can delete only its own rules. The coordinator restores its persisted records after worker suspension and translates diagnostic matches back to the module's IDs.

Publisher network rules use a reserved session namespace and rebuild on startup. Protection keeps its dynamic and session rules. Publisher allow exceptions are converted to conditions and tab guards affecting News only, so excluding a publisher cannot create an extension-wide ad-blocking exception. Request headers and publisher redirects have explicitly higher priority on their publisher scopes. A publisher redirect can therefore win over a protection action targeting that same document URL. Page navigation can need a reload for the News tab guard to settle.

Preferences remain separate: `bpc:` for News, `oa:` for Research, GapGuard's existing protection/engine storage, and `combined:` for the coordinator and shared interface. The sole program power setting is `combined:enabled`; the visible module power switches are removed. Importing protection preferences does not override the master switch.

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
