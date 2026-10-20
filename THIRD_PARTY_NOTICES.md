# OpenSaysMe + GapGuard credits

This is a personal combined integration. It is not an official release of AdGuard, Bypass Paywalls Clean, Open Access Helper, or their maintainers.

- GapGuard 0.1.2 integration and the AdGuard filtering engine: GPL-3.0-only. Original integration notices are retained in `licenses/gapguard-THIRD_PARTY_NOTICES.md` in the extension and `components/gapguard/THIRD_PARTY_NOTICES.md` in the source project.
- OpenSaysMe 1.0.1 integration incorporates Bypass Paywalls Clean 2.7.1.1 and Open Access Helper Web 2026.8. Their source, copyright statements, and embedded notices are preserved in `components/opensaysme/`. The supplied MIT notice is retained as `licenses/opensaysme-LICENSE` in the extension.
- DOMPurify retains its embedded upstream notice in `lib/purify.min.js`.
- Mozilla WebExtension polyfill retains its MPL-2.0 notice in bundled code.
- AdGuard libraries, EasyList/EasyPrivacy/Fanboy and uAssets inputs retain the notices recorded by GapGuard and in the original filter headers. Downloaded filter snapshots are a local build cache, not integration source edits.

The new coordinator and combined interface are provided under GPL-3.0-only; see LICENSE. Original upstream components retain their respective notices. This project includes the integration source and pinned dependency lockfile. The personal build is not a security audit or a promise of universal site access.
