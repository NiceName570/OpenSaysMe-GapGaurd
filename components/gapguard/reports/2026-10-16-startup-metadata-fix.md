# Startup metadata format correction

User-reported error in 0.1.0, observed directly in Edge:

> Rule set ruleset_0 has invalid or unsupported metadata ... "metadata.chunk" of metadata rule #0 is not a string

Cause: the build pinned DNR Converter 1.1.2 while TSWebExtension 6.0.1 resolved DNR Converter 2.0.0 for its runtime reader. The earlier checks used the compiler's format and did not validate through the engine's actual reader. Converter 2.0 requires metadata serialized as bounded string chunks rather than one metadata object.

Correction in 0.1.1: pin compiler 2.0.0 to match the runtime reader; preserve the chunk envelope through deduplication; allocate metadata IDs separately; include chunk overhead in static quotas. Package checks now resolve the converter from the runtime engine and deserialize every emitted ruleset with it, with a negative check rejecting the exact old format. The source snapshot package still contains its own old converter, but it is only read for original filter text, not used to emit runtime assets.

The original 0.1.0 ZIP is preserved. User remains responsible for general live-site effectiveness tests. Startup should be rechecked in Edge after reloading the corrected local package.
