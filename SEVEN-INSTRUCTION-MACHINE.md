# Seven-instruction INC / JUMP machine

**Completion requirement, confirmed by the user on 2026-11-18:** reliable
collision-based physical simulation is required. The semantic machine is a
reference and intermediate result, not completion of this milestone.

Goal: build a small marble machine with seven real instructions, using only INC
and JUMP. Work proceeds from instruction semantics to component assemblies to
physical verification. The instruction simulator is the first stage, not proof
that the marble machine has been built.

Open `/simulator/machine.html`, also linked from the component gallery.

```
1  INC(a)
2  JUMP(5)
3  INC(b)
4  JUMP(7)
5  INC(a)
6  JUMP(3)
7  JUMP(1)
```

INC increments its named shared register and advances to the next address.
JUMP sets the next instruction address and leaves both registers unchanged.
Execution order is 1, 2, 5, 6, 3, 4, 7, then repeats. From zero, after n cycles,
a = 2n and b = n. Instructions 1 and 5 access the SAME register a.
The program uses no conditional instruction, decrement, or hidden data-dependent
jump. This instruction subset alone is not a universality construction.

The simulator shows exact integer register values, the next instruction pointer,
active/ready instruction states, per-instruction execution counts, virtual time,
and an execution log with before/after registers. Step completes one instruction
atomically. Run repeats; Pause preserves state; Reset clears it. Changing speed
resets the run. Full logs export as JSON. One instruction costs one virtual second
at 1x; this is an abstract instruction timing contract, not a prediction of carry
propagation time through a physical register.

## Current implementation

The active component model is `src/machine/physical-machine.js`, exposed through the stable `lattice-machine.js` entry point. It is a planar assembly of level straights, quarter-turn curves, receiving junctions, Ferris wheels, T-gates, and one return ramp. All primitive elevation checks pass. No abstract lift or drop column is used by this model.

Each register bit has a contact-driven T-gate and a Ferris inlet. Left exits join a level completion collector; right exits carry to the next bit. Register a's return gate alternates continuation 2/6 for this fixed program. The long b-to-1 return includes an explicit Ferris/ramp pair to restore energy through motor work and gravity. It does not receive a software velocity boost.

The primitive tree has composition Level 3. Its register and route assemblies contain Level 0 primitives through intermediate Level 1/2 groups. Composition depth is independent of geometric y coordinates.

The default four-bit machine completes 51 instructions on both CPU and GPU with the correct PC and register values at every boundary, then reaches its expected overflow through physical contact. Semantic tests compare the actual primitive topology with the instruction oracle for one-, two-, and four-bit registers. Backend-specific traces and qualification limits are recorded in [COMPONENT-AUDIT.md](COMPONENT-AUDIT.md).

## Historical design and experiments

The sections below document earlier lowering stages and rejected candidates. Their implementation-status statements are historical. The lift-column model is preserved as `src/machine/legacy-lattice-machine.js` and is no longer the active machine.

## Historical evidence and remaining work

Implemented: validated INC/JUMP execution, seven-instruction program, shared
registers, exact BigInt arithmetic, simulator controls and state tracking.
Tests cover 100 cycles, each register effect, jumps preserving data, timing,
values above Number precision, snapshot/log isolation, invalid programs, and
browser stepping, run/pause, reset and export.

Not implemented: lowering this program into the Component/Circuit model,
physical register capacity/overflow, caller-specific continuation after shared
register access, lattice layout, and collision-driven physical execution.
The instruction model has explicit software registers and a program counter;
these must acquire physical encodings before claiming a marble implementation.

Next design step: implement one bounded INC register assembly with carry and a
completion exit. Then solve two callers of that same register, preserving which
continuation to take. Do not duplicate register a at instruction addresses 1 and
5, or hide its return-address state in the renderer. Variable carry-path duration
must be represented when lowering an instruction into component events.

## First lowering step: bounded INC assembly

`src/machine/increment-register.js` now builds a lattice Circuit of N T-gates
and N−1 carry tracks (1–64 bits supported by this prototype). The existing
SemanticExecution engine executes every passage; bit values are decoded from
the component states rather than incremented by an arithmetic shortcut.
Each old-0 left exit completes INC. Each old-1 right exit carries to the next
bit, except the most significant right exit, which explicitly signals overflow.
This finite assembly computes modulo 2^N with an overflow signal; it must not
silently stand in for the reference model's unbounded integer register.

The gallery's INC register shows 7 → 8 in four bits. Step advances one component
passage, exposing transient values 6, 4, 0 before reaching 8. These intermediate
values are not completed instructions. A carry across k gates costs 2k−1 base
time units because connecting tracks also execute. Every connection has aligned
ports, every gate drops one level, and allocated lattice cells do not overlap.
Tests exhaust every initial value at widths 1–8, plus scale/speed and occupancy
checks. Browser checks verify the carry sequence and reset.

The assembly remains semantic-only. Its completion exits are still separate;
collecting them and routing to the correct continuation for two callers is the
next step. No caller state has been secretly added to the marble or renderer.

## Shared-register continuation: fixed-program gate model

The machine page now offers **Instruction reference** and **T-gate wiring**.
The latter executes the seven instructions through one shared bank of T-gates
for a, one for b, and an explicit return T-gate for a. Both i1 and i5 enter
`a-bit-0`. All successful a completion exits reach `a-return`, whose left and
right outputs lead to i2 and i6. This works because callers of a strictly
alternate i1/i5 from reset. It is NOT a general return-address mechanism and
must not be reused for arbitrary call sequences without a new construction.
Register b has one caller, so its completion goes directly to i4.

A marble contains only its identity. The route is chosen from fixed wiring
and the local gate state; the displayed active instruction is bookkeeping,
not a routing input. Register values are decoded from gate states. Each gate
uses the existing TGate Component's semantic passage. INC is considered
complete only when its completion route reaches the following instruction.
JUMP traverses its fixed instruction route and never changes a register.

The UI supports gate/route stepping, whole-instruction stepping, and timed
execution. It displays gate bits, a-return's next destination, current marble
location, partial-carry register values, and both instruction and gate traces.
Choose 4, 8 or 16 bits before running (the model supports up to 64). On overflow
it stops, marks the INC incomplete, and leaves the actual wrapped bit pattern
visible; it does not pretend to have executed an unbounded increment. Reset
restores both registers, phase, instruction pointer and traces.

Differential tests compare each completed instruction with the reference for
widths 1, 2, 4 and 8 at two speeds, through overflow. Additional checks verify
shared bank identity, alternating return destinations and partial carry state.
Browser checks exercise gate stepping, both callers, overflow stop, width
changes, reset and run/pause.

Remaining boundary: this is a logical connection graph, not yet a spatial
Circuit. Its links do not assert physical handoffs. The existing standalone
INC register has lattice geometry, but full completion collectors, return
tracks, lift placement, and seven-instruction lattice layout remain to build.
Logical node timing omits those future transport costs. Collision-driven
T-gate switching also remains unfinished. The overall goal is still active.

## Spatial completion collector and return gate

`src/machine/shared-register.js` now places the INC bank, every successful
completion route, a descending collector and the return T-gate in one validated
lattice Circuit. The new gallery entry **INC · collector and return** shows it.
No nonlocal connections are used: every joined pair of port frames coincides,
and allocated component cells do not overlap. For N bits it uses 4N−1 instances.
The four-bit case has 15 instances and descends six cell levels overall.

Old-0 exits join the collector at their own bit level. Earlier completions
continue through the downstream merges; a completion at the highest visited
bit joins lower down. The last right output remains the separate overflow exit
and never flips the return gate. The return's left/right outputs are exposed
for future connections to instruction 2/6; those instruction paths are not yet
part of this standalone assembly. Initial return state is explicit.

The 7 → 8 example takes 12 base time units: seven passages through register
bits/carry tracks, a length-three completion track taking three units, one merge
and one return gate. Completion-track duration scales with its length. Transport
is now charged explicitly for this subassembly. Tests exhaust all initial
register values and both return phases at widths 1, 2, 4 and 6; additional checks
cover scale, speed, height budget, indexed history and browser execution.

Remaining full-machine work: connect the seven instruction entries, both register
assemblies and necessary elevators on the lattice, retain their states across
cycles, and verify the instruction-level trace. Physical switching and handoffs
remain unimplemented; these channels are still semantic layout previews.

## Full seven-instruction lattice circuit

Choose **Full lattice circuit · semantic** on the instruction page, or open
`/simulator/?component=seven-instruction-lattice&mode=semantic` for the 3D view.
The four-bit layout currently contains 152 component instances and two overhead
routing levels. It remains a layout prototype, not a measured stock-VTech build plan.

`lattice-machine.js` instantiates both shared register banks, the a input merge,
a's alternating return gate, a single completion outlet for b, and seven
instruction entry components. `lattice-routing.js` joins the remaining links
with explicit overhead tracks, lift columns, and descent columns. The ten links share two routing heights where their paths do not intersect;
each still has two explicit columns. These are proposed transport
assemblies, not working ferry-wheel replicas. Their vertical and horizontal
transport durations are charged explicitly. Every port frame is checked and
every allocated cell is non-overlapping. Overflow outlets remain unconnected.

`LatticeMachineExecution` observes the existing SemanticExecution engine.
Register values come from the actual circuit's T-gate states. The visible PC
stays on an INC while the marble traverses its register, collector, return gate
and outgoing routing; the next instruction is observed only when its entry is
reached. The PC never determines the marble's successor. JUMP traverses its own
connected route and leaves register bits untouched. There is one marble, and
its indexed location/history covers all transport components.

Differential tests execute the entire program with 1-, 2- and 4-bit banks until
overflow, comparing every completed instruction and both registers with the
reference. Additional tests cover scale, speed, transport costs, and indexed
history. Browser checks cover all seven instruction transitions, mid-transport
PC stability, reset, the 3D scene, and disabled physical execution.

Remaining work is physical feasibility and simplification: the circuit still
uses unqualified vertical routing lifts/drops and semantic-only T-gates. No
collision-based seven-instruction run has passed. The layout must be reduced
toward practical VTech dimensions and supported lift mechanisms. The finite
registers stop on overflow; extending capacity requires adding stages before
reset, not silently creating physical memory during execution. The full goal
remains active.

## Physical switching experiment — not qualified

`experiments/passive-gate.js` introduces a separate Rapier contact-only rocking
V gate. Two light wings pivot on a limited revolute joint. Gravity retains the
state against a stop; marble contact moves the rocker to the opposite stop.
There are no motors, semantic toggle updates, timed actuator commands, or
marble-dependent impulses. The experiment records contacts, exit side, and
before/after angle. It is not integrated into the production TGate component.

The controlled baseline alternates eight centered drops from either initial
orientation. The reproducible diagnostic `node scripts/probe-passive-gate.js`
tests 30 combinations of timestep (1/240, 1/480, 1/960), lateral entry offset
(−3, −1, 0, +1, +3 mm), and initial orientation, with eight drops per case.
Only **14/30** cases alternate correctly. Full success and failure records are
in `artifacts/passive-gate-contact-report.json`; `qualified` is explicitly false.
Geometry exploration also exposed sensitivity to drop height.

This baseline uses an unmeasured 1 g rocker, a 5 g / 11 mm-radius marble and a
130 mm drop measured from the pivot. It is neither a stock VTech replica nor
a qualified one-cell-height component. The experiment removes escaped balls
and releases the next only after settling. It does not establish continuous
flow, inlet/outlet handoffs, GPU equivalence or circuit operation. The physical
model must obtain a controlled inlet and fit the one-level port contract before
it can replace the semantic gate. No full-machine physical claim is supported.

## Physical candidate rejected under stricter contact checks

A follow-up experiment adds fixed funnel/neck walls and exposes Rapier's
`lengthUnit` to examine contact tolerance. The installed Rapier declaration
specifies that normalized allowed penetration and prediction distance are
multiplied by lengthUnit. This matters for a millimetre-scale mechanism.
The earlier centered baseline used lengthUnit=1; it must not be treated as
physical validation.

Run `node scripts/probe-passive-gate-inlet.js` to reproduce 36 cases, retaining
all outcomes in `artifacts/passive-gate-inlet-report.json`. Each group below has
six cases (both initial orientations and offsets −3, 0, +3 mm), eight drops each:

| lengthUnit | No guide | Fixed inlet guide |
| --- | --- | --- |
| 1 | 2/6 | 0/6 |
| 0.1 | 0/6 | 0/6 |
| 0.01 | 0/6 | 2/6 |

The candidate fails both entry tolerance and solver-tolerance robustness. The
inlet does not fix it. The baseline regression test only reproduces the old
coarse-contact result; passing that test does not qualify the mechanism.
The production TGate remains semantic-only, and no full machine physics mode
has been enabled. Before further physical integration, this rocking geometry
needs redesign or replacement based on the actual VTech mechanism and inlet
constraints. These results do not disprove the user's observed stock T-gate
behavior; they reject this unmeasured approximation of it.


## Layout simplification

The router now reserves column access, shares a routing plane where paths do not
intersect, and uses another plane when needed. Consecutive straight cells become
one multi-cell track with duration proportional to its length. This changes the
layout and execution granularity, not the instruction semantics or shared memory.
The default four-bit machine shrank from 375 to 152 component instances and from
ten overhead routing levels to two. Its maximum cell level is now 11 instead
of 27. It still has ten proposed lifts and ten drops; this is not a claim that
those mechanisms have become physically qualified.

The 1-, 2-, 4- and 8-bit layouts all validate with two routing planes and fewer
than 200 instances. Completed-instruction differential tests and browser checks
remain passing. Height reduction and track grouping do not remove virtual
transport costs, duplicate a register, or introduce nonlocal graph edges.
