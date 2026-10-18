# First combined build

The user approved a separate combined package after manually checking the two standalone extensions together. This project preserves the original OpenSaysMe and GapGuard directories and creates a new extension identity.

## Integration decisions

- Keep GapGuard's 0.1.2 automatic-saving switches, filtering engine, static profiles, and element picker.
- Retain the existing OpenSaysMe publisher and research runtime source, its preference namespaces, and original upstream notices.
- Use a three-tab popup and shared settings hub without merging the components' reset or exception lists.
- Use a scoped API coordinator for both background modules. Protection retains virtual dynamic/session IDs. News is compiled into a reserved native session namespace. Only the coordinator sees actual shared IDs.
- Persist intended updates before applying native rules, then roll back the intent on failure. Reconcile the saved intent when the worker restarts. Translate diagnostic IDs back to the requesting module.
- Do not emit the publisher module's broad allow rules into the shared extension: convert domain exclusions to rule conditions, document exclusions to positive ASCII URL expressions, and restricted-tab allowances to News-only excluded tab IDs.
- Reserve session and regex capacity for the publisher module. Publisher redirects/header changes have explicit higher priority on their scoped URLs. This policy can differ from two independently installed extensions; compare actual article and video behavior manually.

## Verification and correction

The original publisher module deletes every dynamic rule before replacing its collection. AdGuard can likewise clear dynamic and session collections. The scoped coordinator addresses both directions, including duplicate original rule IDs.

An initial positive document-guard expression passed JavaScript syntax checks but exceeded the RE2 memory budget. The actual publisher-generator fixture caught it. Guard generation now uses ASCII URL character ranges and compact trie expressions; all generated publisher expressions pass the same RE2 validator used by GapGuard's build. The fixture makes no network requests.

Checked: combined manifest resources; scripts/styles for 14 HTML pages; worker syntax; preservation of the actual AdGuard reader, rule checksums, source maps, static budgets, and one active profile; seven rule-coordinator regression cases; actual publisher default generation (761 source rules, 992 scoped emitted rules, 495 regex rules, 486 unsafe rules, no emitted publisher allow rules).

Not checked: the new combined extension in an actual browser, live publisher access, library services, streaming, or real-world page-script interactions. Those checks are explicitly handed back to the user in TESTING.md. Standalone success is not claimed as proof for this new extension.

No GitHub repository was created or changed for this separate build.
