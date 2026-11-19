# Closed-circuit logic examples

Open `/simulator/logic.html`. The examples are Buffer, NOT, AND, OR, NAND, NOR,
XOR, XNOR, then a half-adder composed of XOR and AND. The original three-item
assembly gallery remains available separately.

Choose A/B while stopped, select Semantic, Physical CPU, or Physical GPU, then
Run. The same marble circulates until paused. Reset rebuilds the selected input
configuration and clears measured results. Step advances a component passage in
Semantic mode and one simulation frame in physical modes. The cube icon toggles
spatial cells while running.

## What constitutes an input and an output

These examples use **fixed, manually configured input tracks**, not mutable
T-gate memory. A = 0 installs the zero branch of a level track switch; A = 1
installs the one branch. A binary gate has an A selector followed by a B selector
on each A branch. Both B selectors are configured from the same external B
setting before the run. They do not change or require resetting during laps.

This is a routing truth-table implementation. Each terminal track has a fixed
0/1 output label, like a hardwired constant. The marble's route selects that
terminal. The output readout is populated only after observing departure from
that actual output track. The display does not evaluate a Boolean expression
from A/B to manufacture the measured result. Its separate truth table shows
expected values for comparison.

Unary gates use only the A selector. Binary gates distinguish all four input
routes, even when multiple terminal tracks carry the same logical value.
Output tracks rejoin through passive level collectors, then an explicit powered
return brings the marble back to the input. There is no production lap limit.

## Physical construction

- Input switches and branch/collector tracks stay level.
- Ferris wheels supply upward transfer; ramps convert the height into travel.
- A level return chicane bends the approach before the Ferris pickup.
- No software velocity changes, teleports, or automatic switch resets occur.
- Component hierarchies use primitive Level 0, input/output groups at Level 1,
  logic modules at Level 2, and closed circuits at Level 3.

The switches are custom, preset routing geometry. They are not measured stock
VTech parts or newly validated mechanical actuators. Selecting an input rebuilds
the stopped track configuration; it does not simulate a hand moving a switch.
The low-loss material assumptions documented in README still apply.

## Half-adder

The same two input settings configure an XOR module and an AND module:

| A | B | Sum (XOR) | Carry (AND) |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 0 |
| 0 | 1 | 1 | 0 |
| 1 | 0 | 1 | 0 |
| 1 | 1 | 0 | 1 |

One control marble traverses XOR, then AND, then returns. The UI publishes the
Sum/Carry pair together on completion of a lap, so it never combines outputs from
different evaluations. A Ferris/ramp pair between the modules supplies energy
for the second module.

This is a sequentially sampled combinational half-adder demonstration. Its
outputs are observed rails, not a mechanically latched register or automatic
inputs to another arithmetic instruction. It does not add conditional opcodes
to the existing seven-instruction INC/JUMP machine.

## Verification

`tests/logic.test.js` compares every input combination and five semantic laps
with an independent Boolean reference. It also checks hierarchy, exact port
connections, elevation rules, stable inputs, and the half-adder identity
`Sum + 2*Carry = A + B`.

```sh
node --test tests/logic.test.js
npm run test:logic:physics
npm run test:logic:browser
UMC_TEST_GPU=1 npm run test:logic:browser
```

The physics runner checks actual output-track crossings, sampled inputs, repeated
laps, finite marble positions, launch speed, and stalls. It records complete lap
traces. Use `--mode=cpu` or `--mode=gpu`, `--gate=and`, `--scales=0.5,1,2`,
`--laps=3`, and `--report=artifacts/example.json` to select a qualification run.
Current reports are under `artifacts/logic-*.json`; only reports marked passed
qualify the configurations they explicitly list. The return-regression report
preserves focused repeated-lap coverage of the previously unstable pickup.
