# GapGuard third-party notices

GapGuard is a personal modified integration, not an official AdGuard, OSKA, or Ad Remover release.

- Filtering engine: AdGuard TSWebExtension and TSUrlFilter, Adguard Software Ltd., GPL-3.0-only. https://github.com/AdguardTeam/tsurlfilter
- DNR conversion and bundled filter snapshots: AdGuard DNR Converter and DNR Rulesets, GPL-3.0-only. Same repository.
- Scriptlets, redirect resources, Extended CSS, and Assistant: AdGuard respective libraries. https://github.com/AdguardTeam
- AdGuard filter rules: https://github.com/AdguardTeam/AdGuardFilters — upstream license https://github.com/AdguardTeam/AdGuardFilters/blob/master/LICENSE (GPL-3.0). Base also incorporates EasyList; preserve upstream notices in sources/adguard-2.txt.
- EasyPrivacy and Fanboy Annoyance: EasyList authors, GPL-3.0-or-later or CC-BY-SA-3.0 as stated in the downloaded list headers. https://easylist.to/ — selected here under GPL terms. The original headers and notices are retained in sources/.
- WebExtension polyfill: Mozilla, MPL-2.0. https://github.com/mozilla/webextension-polyfill
- uBlock filters, privacy, quick fixes, and unbreak: uAssets contributors, GPL-3.0. https://github.com/uBlockOrigin/uAssets — original list headers are retained in sources/.
- Runtime transitive dependencies retain their upstream copyright and license notices in bundled output and node_modules. Locked versions are in package-lock.json.

The build uses public filter-list equivalents of shared capabilities; it does not copy Ad Remover's proprietary implementation or license checks. The YouTube skip helper is original code and is deliberately optional. OSKA's AdGuard-derived filter inputs are already represented by the core lists.

GapGuard source is provided under GPL-3.0-only. See LICENSE.txt in the extension and LICENSE in the project. Rebuild instructions and all integration source are included in this project. The package is intended for personal local use, with no store publication or remote service.
