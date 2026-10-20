![GapGuard — Broader filtering. One extension.](assets/branding/github-banner.png)

<p align="center">
  <strong><a href="https://github.com/NiceName570/GapGaurd-AdBlocker/releases/download/v0.1.2/GapGuard-0.1.2-extension.zip">⬇ Download extension ZIP</a></strong> &nbsp;·&nbsp;
  <a href="https://github.com/NiceName570/GapGaurd-AdBlocker/releases/download/v0.1.2/GapGuard-Setup-0.1.2.exe">Windows setup EXE</a> &nbsp;·&nbsp;
  <a href="https://github.com/NiceName570/GapGaurd-AdBlocker/releases/tag/v0.1.2">Release notes &amp; checksums</a>
</p>

<p align="center">
  <img alt="Chromium browsers" src="https://img.shields.io/badge/Chromium_browsers-0c1218?style=flat-square&amp;logo=googlechrome&amp;logoColor=75e1bc">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-75e1bc?style=flat-square&amp;labelColor=141e28">
  <img alt="Version 0.1.2" src="https://img.shields.io/badge/version-0.1.2-75e1bc?style=flat-square&amp;labelColor=141e28">
  <img alt="GPL 3.0" src="https://img.shields.io/badge/license-GPL--3.0-75e1bc?style=flat-square&amp;labelColor=141e28">
</p>

<p align="center">
  <a href="#quick-start">Get started</a> &nbsp;·&nbsp;
  <a href="#browser-compatibility">Browsers</a> &nbsp;·&nbsp;
  <a href="#your-browser-your-controls">Features</a> &nbsp;·&nbsp;
  <a href="#two-profiles-one-engine">Coverage</a> &nbsp;·&nbsp;
  <a href="TESTING.md">Testing</a> &nbsp;·&nbsp;
  <a href="#built-on-open-source">Credits</a>
</p>

GapGuard is a personal ad and tracker blocker for **desktop Chromium browsers**, including **Google Chrome, Microsoft Edge, Brave, Opera, Opera GX, and Vivaldi**. It brings established filter lists into one package, removes exact duplicate rules, and gives you direct control over what runs on each site.

The aim is practical: find the gaps between filter sources and close them without stacking independent blocking engines.

## Your browser. Your controls.

| | What you get |
| --- | --- |
| **Combined coverage** | AdGuard core filtering with supplemental EasyPrivacy, Fanboy, and selected uBlock lists. |
| **One engine** | Network blocking, cosmetic filtering, supported scriptlets, and redirects through one integrated engine. |
| **Site-by-site control** | Pause protection for a website, add exceptions, or turn protection off globally. Protection switches save immediately in both the popup and Settings. |
| **Pick it. Block it.** | Select an unwanted page element and save a cosmetic rule, or write a custom rule yourself. |
| **Settings you can keep** | Export and import your settings, custom rules, and exceptions. |
| **Useful diagnostics** | Inspect recent network-rule matches and export a summary when something needs fixing. |

**Optional:** a YouTube helper clicks visible **Skip ad** buttons during ads. It is off by default and does not prevent unskippable ads or change ordinary video playback speed.

## Quick start

### Extension ZIP — Chromium browsers

1. **[Download the extension ZIP](https://github.com/NiceName570/GapGaurd-AdBlocker/releases/download/v0.1.2/GapGuard-0.1.2-extension.zip)** and extract it to a permanent folder.
2. Open your browser's extensions manager: `chrome://extensions` in Chrome, `edge://extensions` in Edge, `brave://extensions` in Brave, `opera://extensions` in Opera / Opera GX, or `vivaldi://extensions` in Vivaldi.
3. Enable **Developer mode**, click **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Open GapGuard, check that it says **Ready**, and reload your websites.

Keep the extracted folder in place. In other Chromium browsers, open the extensions manager from the browser menu and use its unpacked-extension loading controls.

### Windows setup

Download **[GapGuard-Setup-0.1.2.exe](https://github.com/NiceName570/GapGaurd-AdBlocker/releases/download/v0.1.2/GapGuard-Setup-0.1.2.exe)**, run it, and click **Install / update GapGuard**.

The setup places the extension and its source in your user folder, then provides buttons to open Edge's extensions page, open the extension folder, and copy its path. No administrator access is requested.

Finish in Edge:

1. Open `edge://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the installed **`extension`** folder.
3. Open GapGuard and check that it says **Ready**.
4. Reload your open websites.

For a portable option, download the **[extension ZIP](https://github.com/NiceName570/GapGaurd-AdBlocker/releases/download/v0.1.2/GapGuard-0.1.2-extension.zip)**, extract it, and select the extracted folder with **Load unpacked**. Downloads and checksums are on the **[release page](https://github.com/NiceName570/GapGaurd-AdBlocker/releases/tag/v0.1.2)**.

Keep the installed folder in place. Setup guides the normal Edge loading process; it does not silently install the extension or change browser policies.

<details>
<summary><strong>Prefer to build from source?</strong></summary>

Use **Node.js 24** and npm. From the repository folder:

```sh
npm ci
npm run build
npm run check
npm test
```

The first build downloads supplemental filter lists and caches them in the ignored `sources/` folder. It also generates `extension/` and build reports locally. Later builds reuse that cache; a fresh clone may fetch newer supplemental filters than the published release.

Open your browser's extensions manager, enable Developer mode, choose **Load unpacked**, and select the generated **`extension`** folder.

To rebuild the Windows setup on Windows:

```powershell
./scripts/build-installer.ps1
```

This uses the Windows .NET Framework C# compiler and bundles the existing `extension` output. The setup is an unsigned local build.

</details>

## Browser compatibility

GapGuard targets **desktop Chromium 121+**, Manifest V3, and the required extension APIs and network-rule capacity. The same extension ZIP is intended for compatible Chromium browsers.

The Chromium browser family includes **Google Chrome, Chromium, Microsoft Edge, Brave, Opera, Opera GX, Vivaldi, Arc, ungoogled-chromium, Thorium, Yandex Browser, NAVER Whale, Avast Secure Browser, Slimjet, and Epic Privacy Browser**. Other Chromium forks may also work when they support the same APIs and unpacked extensions.

**Confirmed working by the user: Microsoft Edge.** The other browsers listed are compatibility candidates, not individually tested GapGuard builds. Browser policies, engine versions, API differences, and shared rule limits can affect loading. This desktop package is not a Firefox, Safari, or mobile extension. The Windows setup currently opens Edge; use the ZIP instructions for another browser.

Browser extension references: [Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world), [Brave](https://brave.com/learn/installing-chrome-extensions/), [Opera](https://help.opera.com/en/extensions/testing/), [Vivaldi](https://help.vivaldi.com/desktop/appearance-customization/extensions/), [Arc](https://resources.arc.net/hc/en-us/articles/25540117353623-What-Happens-to-Ad-Blocking-in-Arc-when-Google-upgrades-to-Manifest-V3), [Whale](https://help.whale.naver.com/en/desktop/store/), and [Epic](https://epicbrowser.com/).

## Two profiles. One engine.

| Core | Combined — default |
| --- | --- |
| AdGuard Base, Tracking Protection, Cookie Notices, Popups, and Other Annoyances. | Everything in Core, plus unique rules from EasyPrivacy, Fanboy Annoyance, and uBlock filtering, privacy, quick-fix, and compatibility lists. |

Switch profiles from the popup to compare behavior. **Only one compiled profile is active at a time.**

The build removes exact source-rule duplicates and equivalent compiled network rules while preserving different scopes and exceptions. Different patterns can still match the same request; exact deduplication does not mean every form of overlap has been eliminated.

## Made to be inspectable

- **Local settings:** custom rules and site exceptions stay in browser-local storage.
- **Bundled filters:** this version uses snapshots and has no automatic filter updater.
- **Bounded logs:** recent network matches are limited to 100 entries in worker memory, with query strings and URL fragments omitted.
- **Shareable diagnostics:** exported summaries omit browsing URLs.
- **Traceable builds:** each build generates `reports/build-report.json` and `extension/build-report.json` with source URLs, hashes, duplicate removal, rule counts, and exclusions. Generated reports stay out of Git.

The match counter reports **rule matches**, including exceptions and redirects. It is not an ads-blocked score.

<details>
<summary><strong>Updating filters</strong></summary>

Normal builds reuse saved supplemental snapshots. To fetch fresh supplemental lists:

```sh
npm run build -- --refresh
npm run check
npm test
```

AdGuard snapshots come from the pinned `@adguard/dnr-rulesets` dependency. Update that dependency and rebuild to refresh those inputs. Reload GapGuard at `edge://extensions` after updating the build.

</details>

## Help close the next gap

This is a working personal build under active development. Broader real-world coverage is evaluated through manual testing, rather than inferred from the number of rules.

Use the [test guide](TESTING.md) and compare **Combined**, **Core**, and **GapGuard off**. For a miss or broken page, report the URL, reproduction steps, and what changes between those three states.

<details>
<summary><strong>Current limits and compatibility notes</strong></summary>

- Manifest V3 cannot represent every upstream rule. Conversion exclusions are recorded in `reports/`.
- Third-party syntax and scriptlets are not universally compatible with this engine.
- Additional lists can create site conflicts; use Core for comparison when troubleshooting.
- Internal Edge pages and the extension store cannot be filtered.
- Page changes may persist until you reload after toggling protection.
- Upstream dependency findings are documented in the [dependency notes](reports/DEPENDENCIES.md). This project has not completed a security audit.
- Run one ad blocker at a time for clean comparisons. Review screenshots and diagnostic files before sharing them.

</details>

## Built on open source

GapGuard brings together work maintained by [AdGuard](https://github.com/AdguardTeam/tsurlfilter), [AdGuard Filters](https://github.com/AdguardTeam/AdGuardFilters), [EasyList](https://easylist.to/), [uBlock Origin uAssets](https://github.com/uBlockOrigin/uAssets), and [Mozilla](https://github.com/mozilla/webextension-polyfill).

It is an independent personal integration, not an official release from those projects. It uses public filter sources and does not include Ad Remover's proprietary implementation or subscription checks.

**License:** GPL-3.0-only for the GapGuard integration. Upstream components retain their own licenses and notices. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).
