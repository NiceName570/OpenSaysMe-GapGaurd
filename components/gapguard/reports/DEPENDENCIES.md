# Dependency audit notes

The original installed dependency audit is preserved locally in `dependency-audit.json` (generated output, ignored by Git). To generate a current report, run `npm audit --json > reports/dependency-audit.json`; a nonzero exit code indicates audit findings. The available upstream versions include reported issues in `braces`, `js-yaml`, and `sprintf-js`, with transitive findings propagated to AdGuard packages. No forced major-version downgrade was applied: npm's suggested downgrades would replace the selected MV3 engine with an incompatible earlier integration.

`@adguard/dnr-rulesets` is used as a build-time asset source; its glob-related dependencies are not imported by GapGuard's background or UI. The scriptlet dependency pins an old YAML parser; a newer compatible 3.x override is applied in package.json. Findings remain after that update, including upstream `sprintf-js`/glob and YAML dependency findings. They are recorded rather than described as clean. No custom YAML or glob input is exposed in GapGuard's UI.

This record is a dependency review note, not a claim that reported vulnerabilities are exploitable or harmless in this integration, and not a completed security audit. User live testing addresses blocking and site compatibility, not dependency security.
