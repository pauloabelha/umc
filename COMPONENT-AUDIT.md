# Component audit — 2026-11-19

The active simulator contains exactly three top-level assemblies. The former
abstract lift/drop-column machine is archived and is not used by the active
seven-instruction model.

| Assembly | Composition level | Elevation audit | Semantic | CPU | GPU |
| --- | --- | --- | --- | --- | --- |
| Ferris wheel + ramp closed circuit | 2 | Pass | Pass | Five laps at scales ¼, ½, 1, 2 | Five laps at scales ¼, ½, 1, 2 |
| Ferris wheel + T-gate closed circuit | 2 | Pass | Both branches alternate | Five laps at scales ¼, ½, 1, 2 | Five laps at scales ¼, ½, 1, 2 |
| Seven-instruction machine | 3 | Pass | Matches reference through overflow | Four-bit run: 51 completed instructions, then expected a overflow | Four-bit run: 51 completed instructions, then expected a overflow |

Loop evidence: `artifacts/ramp-loop-cpu-scales-final.json`,
`artifacts/gate-loop-cpu-scales-final.json`,
`artifacts/ramp-loop-gpu-scales-final.json`, and
`artifacts/gate-loop-gpu-scales-final.json`; reference-scale GPU results and the
machine trace are in `artifacts/physical-gpu-final.json`.

## Additional logic examples

The main three-item gallery is unchanged. A separate [logic examples page](simulator/logic.html) contains closed-circuit Buffer, NOT, AND, OR, NAND, NOR, XOR, XNOR, and a composed half-adder. Its fixed input switches, observed output rails, and backend-specific verification are described in [LOGIC-CIRCUITS.md](LOGIC-CIRCUITS.md). These are additional custom routing examples, not replacements for T-gate memory or new INC/JUMP opcodes. All 32 input cases now pass three CPU and GPU laps at reference scale. Passive centering guides align the marble before each Ferris pickup; the failed XOR case additionally passes an eight-lap GPU regression. See `artifacts/logic-validation.json` for exact coverage and source fingerprints.

## Rules enforced

- Primitive composition Level is 0; composite Level is one above its deepest child.
- The composition tree contains every executable instance exactly once.
- Straights, curves, and receiving junctions have level inlets/outlets and paths.
- Ferris wheels raise the marble; only T-gates and ramps lower it.
- Ports meet spatially, face opposite directions, and share an up vector.
- Physical movement comes from gravity, contact and prescribed Ferris rotation.
  Observers read crossings; they do not select exits, move marbles, or change bits.
- Explicit inlet fixtures provide momentum for standalone level-track tests.
  Re-entry restores that fixture while retaining time, identity and gate state.

## Changes supported by checks

The CPU solver now uses contact tolerances appropriate to the normalized
centimetre-scale mechanisms. Tracks and curves no longer hide a descent.
The Ferris/T-gate loop uses an actual rotating wheel and level return branches.
The seven-instruction machine uses a planar primitive layout with a Ferris inlet
at each bit and a level completion collector. An explicit wheel/ramp pair restores
energy on the long b-to-1 return; there is no software speed boost.

The four-bit CPU machine was compared with the exact-integer instruction model
at every instruction boundary. All 51 completed instructions matched both PC and
register values. It stopped at `a-bit-3.right` at 773.6572916666667 simulated
seconds. The failed INC was not counted as a completed instruction.
Evidence: `artifacts/machine-cpu-reference.json`.

The default four-bit GPU machine also matched all 51 completed instructions and
exited at the expected a-register overflow at 678.6208333333333 simulated seconds.
Evidence: `artifacts/physical-gpu-final.json`. Machine physical qualification is
for the default four-bit assembly at reference scale; the loop scale checks do
not imply a full machine trace at every capacity and scale.

The GPU contact correction is reduced and solved over more iterations to avoid
large impulses when a light marble touches several rotating pocket surfaces.
Explicit rolling/torsional drag is zero for ordinary shapes, matching the
CPU model's material assumptions. This is a numerical/model change, not a
measurement of real plastic. CUDA graphs retain collision/solver execution on
GPU; there is no fallback to CPU or semantic movement.

## Verification

- All 94 Node tests pass, covering primitives, composition, port connections, state, re-entry,
  exhaustive finite INC cases, and reference-equivalent instruction execution.
- `npm run test:physical` checks physical lap targets and complete instruction
  traces through overflow, writing `artifacts/physical-assemblies.json`.
- `npm run test:components` checks the active assemblies and their primitive
  fixtures, including backend failures. Cleanup failures are recorded.
- Repeated physical T-gate checks pass all 128 passages: CPU/GPU × four scales ×
  two initial states × eight passages without resetting memory. Evidence:
  `artifacts/t-gate-physics.json`.
- Browser checks cover the three-item selector, hierarchy, semantic branch memory,
  physical CPU looping, settings, run/pause/reset, machine stepping, and visible
  GPU failure without fallback. A separate live-CUDA browser check requires a
  completed T-gate-loop lap and pause (`npm run test:browser:gpu`); it passes.
  Evidence: `artifacts/browser-results.json` and `artifacts/gpu-browser-results.json`.
- All four GPU schema tests pass, and the production bundle builds successfully.
  Vite reports its existing large-chunk advisory.

## Physical evidence limits

The 60 mm height unit, dimensions, friction, Ferris retention/discharge geometry,
and seesaw mass distribution remain estimates. Tracks use friction 0.002 and the
marble uses zero friction as an explicitly idealized low-loss model. Receiving junctions are explicitly
custom geometry. The production seesaw implements the user's observed alternating
rule; it is not an identified, measured stock VTech part. Historical failed gate
candidates remain in `experiments/` and older reports. Simulation success does not
establish stock-part compatibility or universality.
