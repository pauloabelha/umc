# Jumps and control flow

Checked 2026-11-18 against Lenny Pitt, *Turing Tumble is Turing-Complete*, especially §§2.1–2.2 and §4, pp. 7–10 and 16–18. [Archived paper](references/turing-tumble/pitt-turing-tumble.pdf), [online paper](https://arxiv.org/pdf/2110.09343).

## How Turing Tumble transfers control

There is no separate JUMP piece in the paper's component inventory. A fixed transfer uses ramps and, where paths cross, crossovers. A bit chooses an outgoing route but flips when traversed. Gear-linked bit constructions supply nondestructive reads and writes to chosen values (pp. 7–10).

A trigger causes a hopper to release another ball higher on the board; the descending ball does not teleport upward (pp. 8–9).

In the finite-control construction, gear-linked state rows encode the active state. A transition writes the next state's row to 1 and the other rows to 0. The current ball's path still carries the information needed to finish the current action. A router made of ramps and crossovers maps that path to the selected action line (pp. 16–18).

## Mapping this to UMC

These are proposed mappings, not a claim that the stock VTech parts implement Pitt's mechanisms.

| Required transfer | UMC components | Status |
| --- | --- | --- |
| Fixed `A → C`, skipping B | Connect A's output to C's input with tracks, curves and descending ramps. Use a bridge or separated layer if paths cross. | A connection/assembly, not a new logic primitive. Lattice ports and height budget must meet. |
| Return to an earlier or higher component | Return tracks plus a powered elevator whose outlet leads to that component. | Semantic circulation demonstrated in the new loop; lattice physical handoffs remain open. |
| Choose between two fixed destinations from the toggle's state | T-gate and two distinct paths. | Implemented semantically; every visit changes the bit. It is not a nondestructive conditional read. |
| Select a destination after a common return/elevator | Writable retained destination state plus a selector, or physically separate return routes. | Missing mechanism if multiple destinations must share one return. An ordinary toggle's next position cannot be set arbitrarily by another component under our present contract. |
| Repeat a read without changing a data bit, or select its new value | A coupled/read-write memory mechanism serving the roles of TT's gear bits and gears, or an independently established alternative. | No stock-VTech equivalent established. Do not assume an arbitrary collection of independent toggles is equivalent. |

A jump to a label does **not** inherently require a program counter. In a directly wired control graph, the marble's location identifies the active component, and the connections determine its successor. A stored destination is needed for the shared-dispatch design described above, not for every fixed edge.

A connection in the semantic graph must correspond to an actual transport assembly: a nonlocal edge is not free movement. Its intervening components consume lattice cells, vertical levels, and virtual time. Existing port-frame validation rejects disconnected endpoints.

## Why our merge is valid—and what it cannot do

In the current loop, both branches intentionally have the same successor: the elevator, then the T-gate. Forgetting which branch was used at the merge is therefore harmless.

If one branch meant “next execute B” and another meant “next execute C,” merging them into the same stateless elevator and outlet before reaching those targets would erase that distinction. Keep the paths separate until their intended destinations, or store the destination mechanically before merging and read it afterward. Do not let the simulator remember a caller or destination that has no physical encoding.

## Small next experiment

Add a second T-gate on just one branch of the first gate. Route the first gate's left output directly to the return; route its right output through the second gate, then return. This demonstrates a concrete conditional bypass: the second operation runs on alternate visits, and its state persists on skipped visits. With the right output serving as carry, it is also the start of our two-bit counter.

It needs two T-gates, transport paths, a suitable merge, and height restoration. The added gate costs one more level, so recompute the height budget and elevator span rather than reuse the present two-level layout unchanged. First test the semantic trace for visits and skips; later qualify the physical gate and handoffs. This remains a small control-flow experiment, not a universality result.

## Implemented: five-instruction jump machine

Open `/simulator/?component=jump-machine&mode=semantic`, or select its gallery card.
This fixed wired program reuses the two-branch lattice layout. Instruction addresses
name locations; they do not imply spatial ordering or an editable stored program.

| Address | Instruction | Mechanism |
| --- | --- | --- |
| 1 | Toggle; jump to 3 for old bit 0, or 5 for old bit 1 | T-gate |
| 2 | Jump to 4 | Merge into elevator |
| 3 | Jump to 2 | Left return track |
| 4 | Lift; jump to 1 | Two-level elevator |
| 5 | Jump to 2 | Right return track |

Execution starts at 1 with bit 0. The instruction sequences alternate:
`1 → 3 → 2 → 4 → 1` and `1 → 5 → 2 → 4 → 1`.
The marble's indexed component location serves as the instruction pointer;
there is no separate hidden program counter. Each Step completes one instruction
and follows a joined output/input connection. Instructions 1, 2, 3, and 5 each take
one base time unit; the elevator takes five. A loop takes eight units, divided
by semantic speed. Reset restores instruction 1 and bit 0.

The program table highlights the current instruction, or the recorded instruction
when inspecting history. The existing computation log retains component IDs and
branch transitions. All five addresses are exercised across two loops.

This is a finite control-flow demonstration with a fixed routing graph, not a
universal machine or an arbitrary programmable jump router. The geometry is a
semantic-only lattice preview; physical gate switching and lift handoffs remain
unfinished. Every connection still passes lattice and port-frame validation.
