# Verification reports

The current logic qualification is indexed by [logic-validation.json](logic-validation.json).
It identifies source hashes, tested inputs, lap counts, and scale limits.

Current logic reports:

- `logic-cpu.json` and `logic-gpu.json`: all 32 input cases, three laps each.
- `logic-cpu-scales.json` and `logic-gpu-scales.json`: explicitly listed scale checks.
- `logic-feed.json`: passive centering fixtures on both backends.
- `logic-feed-regression.json`: eight GPU laps of XOR 00.
- `logic-browser.json`: UI truth tables and real CPU/GPU browser laps.

`logic-gpu-before-return-fix.json`, `logic-gpu-before-feed-guides.json`,
`logic-return-regression.json`, and `logic-return-cpu.json` describe earlier
layouts and are retained as history. Their results are not qualification of the
final model. Other research/candidate reports can also contain intentional
historical failures.

The earlier three-assembly audit is described in [COMPONENT-AUDIT.md](../COMPONENT-AUDIT.md).
Its `final-validation.json` snapshot predates the additional logic examples.
Generated screenshots and build output remain ignored; JSON evidence is tracked.

## Current runnable CPU catalog

- `catalog-cpu.json`: all 10 physical parts/assemblies at reference scale.
- `catalog-gates-cpu.json`: all 32 gate/half-adder inputs, three CPU laps each.
- `catalog-machine-cpu.json`: default four-bit machine, 51 instruction boundaries
  and register states matched to the oracle, followed by expected overflow.

These reports are produced by `npm run test:catalog:cpu`. Archived semantic concepts
are not included in the runnable catalog or represented as physical successes.
