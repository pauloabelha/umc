# UMC — Universal Marble Computer

Design proposal · updated 2026-11-18

## Objective and starting point

Build a universal, programmable marble computer, starting with **stock VTech Marble Rush T-gates, tracks, marbles, and a motorized elevator**. Explore what these parts can do before introducing other mechanisms. Any eventual custom component must be explicitly identified as an extension.

Work one small mechanism at a time:

**one toggle → two-bit counter → three increments and a bypass → controlled memory and branching → extensible computation.**

Use [Pitt's Turing Tumble paper](references/turing-tumble/pitt-turing-tumble.pdf) for useful mechanisms and proof methods. Its full tape architecture is a reference, not our first build or a predetermined destination.

The [useful-items inventory](USEFUL-ITEMS.md) distinguishes user observations, manufacturer documentation, and candidate uses. None of the complete machines below has yet been physically demonstrated in this project.

## Our primitive: the alternating T-gate

The user reports that a ball moves the gate right and exits left; the next moves it left and exits right. Assuming the gate has the opposite position before each passage:

| Before | Marble exits | After |
| --- | --- | --- |
| Left | Left | Right |
| Right | Right | Left |

With left = `0` and right = `1`, our provisional abstract rule is:

```text
TOGGLE(q): output q; store 1 − q.
```

An output labeled `0` or `1` therefore describes the **old** state, not the new state. Confirm this orientation convention against the actual part before drawing a physical layout.

If both positions persist between visits, this is one bit of memory plus conditional routing. Each access changes the bit. It is not a nondestructive read or a selectable write.

First establish retained positions, usable entrances, and the response to one marble. The exact set and molded part ID remain unidentified.

## Current component simulator

The active gallery contains only the Ferris/ramp closed circuit, the Ferris/T-gate closed circuit, and the seven-instruction machine. Each is composed recursively from primitives. A primitive has composition Level 0; every composite has `1 + max(child levels)`. This depth is distinct from physical elevation.

Straight and curved tracks and receiving junctions stay level. Ferris wheels raise the marble. Only ramps and T-gates lower it. The current seven-instruction machine uses a planar arrangement of real primitive models, not the older abstract lift/drop columns. The 60 mm height unit remains provisional, not a measured VTech dimension.

The T-gate occupies a 3 × 3-cell horizontal footprint spanning **two height levels**. Its inlet `(1.5, 1, 0)` faces −z; its left `(0, 0, 1.5)` and right `(3, 0, 1.5)` outlets face −x/+x. Both outlets are one height unit below the inlet. A passive hinged seesaw retains its position and is moved by contact in physical execution. The semantic contract selects the old state and then toggles.

The Ferris/T-gate circuit raises one height unit, descends it at the gate, and returns through level tracks and a receiving junction. The Ferris/ramp circuit descends at its ramp. Neither loop has a production lap limit.

[README.md](README.md) describes current execution, composition, and commands. [COMPONENT-AUDIT.md](COMPONENT-AUDIT.md) records qualification and outstanding failures. The research machines below explain the design progression; they are not additional active gallery entries or evidence that their older layouts meet the current rules.

## Execution discipline: one circulating marble

The Ferris wheel restores height so the marble can revisit earlier parts. Use one control marble initially: an operation finishes before that marble returns to begin the next cycle. Switching on the motor supplies energy; it must not select computational outcomes.

A common return path is useful when the preceding path information is no longer needed or has already been stored mechanically. Merging two paths otherwise loses the distinction between them. Neither the elevator nor the simulator may silently remember the marble's caller.

The real wheel's pocket count, speed, torque, and handoff geometry still need identification. Do not treat the eight-paddle approximation in `~/umr` as a measurement of the VTech part. Continuous external power is a modeling assumption, not unlimited torque or guaranteed reliable transport.

For fixed transfers, backward returns, and the missing mechanisms for shared dispatch, see [Jumps and control flow](JUMPS.md).

## Machine 1: a two-bit counter

Two T-gates store `A0`, the least significant bit, and `A1`, the most significant bit. Values are written in the order `A1 A0`.

At the abstract routing level, increment is:

```text
entry → A0
  A0 output 0 → done             (0 becomes 1: no carry)
  A0 output 1 → A1               (1 becomes 0: carry)
    A1 output 0 → done           (carry absorbed)
    A1 output 1 → overflow       (11 becomes 00)
```

At the completed-increment checkpoint:

| A before | A after | Overflow? |
| --- | --- | --- |
| 00 | 01 | No |
| 01 | 10 | No |
| 10 | 11 | No |
| 11 | 00 | Yes |

For a wrapping counter, both `done` and `overflow` return through the elevator to the same entrance. Keeping overflow separate until that merge also gives a visible overflow event.

This realizes the logical effect of:

```text
repeat:
    A ← (A + 1) mod 4
```

The marble's route performs carry propagation. No separate arithmetic controller is needed. Under the declared toggle rule, the table follows directly; a stock-parts layout and reliable circulation remain to be demonstrated.

## Machine 2: three increments, then one bypass

Add two gates `P0` and `P1` as a four-phase counter. These hold **control state**; the original pair still holds **data A**. Every cycle enters `P0` first.

```text
entry → P0
  P0 output 0 → INC(A)
  P0 output 1 → P1
    P1 output 0 → INC(A)
    P1 output 1 → bypass A

INC(A) completion or bypass → elevator → entry
```

This is the same carry structure as Machine 1, except its non-overflow exits feed the shared incrementer and its overflow exit bypasses it. All INC paths visit the **same physical A0 and A1**.

Starting from `P=00` and `A=00`:

| Cycle | P before | Selected operation | P after | A after |
| --- | --- | --- | --- | --- |
| 1 | 00 | INC(A) | 01 | 01 |
| 2 | 01 | INC(A) | 10 | 10 |
| 3 | 10 | INC(A) | 11 | 11 |
| 4 | 11 | Bypass | 00 | 11 |
| 5 | 00 | INC(A) | 01 | 00 |

Four gates suffice **in this abstract network**. This does not count tracks, lifts, supports, or any additional mechanics needed to realize the routing physically.

The phase update finishes before the marble enters A. Thus the next phase is already stored when different INC paths merge. No caller identity needs to travel through the incrementer.

This is useful reusable-operation behavior, but limited: successor phases are fixed by the counter. Calling the bypass `JUMP(1)` does not create an arbitrary address-writing operation. `P` is a phase counter, not yet a general program counter.

## What these machines teach us

Keep three roles separate:

- **Persistent data:** the A gates.
- **Persistent control:** the P gates, or a future program counter.
- **Transient control:** which physical path the marble currently occupies.

A known successor may be stored before the current operation completes, provided that update does not destroy information the operation still needs. This permits paths to merge into a reusable module. The stored continuation must survive the module unchanged.

For a conditional operation, the successor may depend on a data result not yet obtained. The design must either wait for that result or provide an explicit mechanical protocol for updating the successor afterward.

Duplicating operation entrances is different from duplicating the register. Separate copies of A that merely start equal are not shared storage.

## Small memory constructions to investigate

### A standalone fixed-value write

A useful logical feedback construction exists for setting one toggle to a fixed value:

| Operation | Re-enter the gate from this output | Leave from this output |
| --- | --- | --- |
| SET-0 | Output 0, which has just stored 1 | Output 1, which has just stored 0 |
| SET-1 | Output 1, which has just stored 0 | Output 0, which has just stored 1 |

Each finishes after one or two gate passages under the abstract rule. Re-entry requires a physical return path, potentially a lift. The module's completion exit must remain distinct from its internal feedback route.

These are **two alternative fixed wirings**. They do not yet give one gate selectable READ, SET-0, and SET-1 interfaces. A controller that chooses the operation and preserves the right continuation is additional work. Nor does this primitive establish a multi-bit address writer.

### A nondestructive read

Two toggles restore the original state, but “pass through twice” is not a complete circuit. A read assembly must:

1. Retain the information obtained on the first passage.
2. Arrange the second passage and distinguish it from the first.
3. Exit after restoration on the correct branch for the original value.
4. Restore its temporary state for reuse.

Pitt achieves related behavior with coupled gear bits. Independent VTech gates cannot be assumed coupled. A stock pulley, see-saw, release mechanism, or a local marble protocol might help; no such replacement is established.

## From phase control to actual branching

A proposed program with execution order `1 → 3 → 2 → 4 → 1` is still a fixed four-phase cycle. Relabeling a phase counter's states can produce that order. It is not, by itself, evidence of arbitrary JUMP or address writing.

A stronger next control experiment is:

> At the same instruction entrance, choose successor X or Y according to a stored data bit.

Run that entrance with both data values and observe different successors. Specify whether the branch preserves or consumes the bit; either is meaningful if the contract is explicit. To test general address writing later, separately demonstrate selecting a requested destination, storing it, and having the dispatcher follow it after the common return.

The longer-term architectural proposal is:

```text
stored control state
    → dispatcher selects operation
    → update known continuation when appropriate
    → shared data operation
    → resolve any data-dependent continuation
    → common return
```

This is an interface sketch, not an implemented dispatcher. Even a conditional branch is only a further ingredient, not a universality proof.

## Borrowing from Turing Tumble

Our “natural transformation” means a systematic behavior-preserving translation, not a formal category-theoretic construction.

| Source mechanism | Useful lesson or UMC candidate |
| --- | --- |
| Ordinary bit | T-gate read-and-toggle, with output conventions adjusted. |
| Ramp and crossover | Fixed tracks and potentially crossings at separate heights. Actual clearance and connector geometry need checking. |
| Interceptor | A stock collector that permanently retains the control marble. |
| Trigger/hopper | A new cycle must begin only under the required conditions. Recirculation is a possible replacement, not automatically equivalent. |
| State Transition Module and router | Store the next state while the current marble's path still identifies the operation to finish. |
| Nondestructive read and controlled writes | Define explicit memory-operation interfaces and reset conditions. |
| Gear chains | Shared state at multiple access sites needs an actual coupling or an equivalent protocol. |
| Nested read/write layout | Physical routing constrains operation order; Pitt reads variables in one order and writes in reverse to avoid gear-chain crossings. |
| Repeated tape cells | Unbounded computation needs an extensible storage construction, not just more execution time. |

See Pitt sections 2.2–6. His theorem applies to his extended Turing Tumble model, not directly to stock VTech parts. The final query-ladder variant is sketched rather than supplied as a complete physical blueprint.

A replacement may take several mechanical actions per source operation. At completed-operation checkpoints it must give the corresponding data, control state, and output, and be ready for reuse. In symbols, if source state `C` steps to `C′`, a valid UMC representation of `C` must reach a representation of `C′` in finitely many internal actions.

## The universality boundary

Two routes remain worth considering:

- A counter machine with increment and conditional decrement/zero-test (`DECJZ`), plus suitable extensible counter storage.
- A finite controller with repeated read/write tape cells, following the broad structure of Pitt's construction.

We have not selected or realized either complete route. A two-bit wrapping counter does not implement an unbounded integer register. Extending a counter requires handling carry and capacity explicitly. `DECJZ`, general shared memory access, and a universal fixed interpreter remain open.

The eventual fixed machine should accept program and input encodings through initialization. Early hardwired examples are useful mechanical experiments, but do not yet demonstrate that kind of programmability.

For a universality argument, every simulated instruction must finish correctly, preserve unrelated data, leave admissible conditions for the next instruction, and compose across a repeatable storage design. Each finite computation must fit some sufficiently large member of that uniform family. Capacity exhaustion, jams, and escaped marbles are distinct from a successful halt.

## Current status and progression

| Item | Status |
| --- | --- |
| Alternating T-gate passage | User-reported; exact part and retention still to characterize. |
| Ferris-wheel transport | Manufacturer-documented; our connections and operating conditions untested. |
| One-gate return loop | Proposed physical experiment. |
| Two-bit increment and overflow | Logical construction given above; physical layout unvalidated. |
| Four-phase selector with shared incrementer | Logical construction given above; physical layout unvalidated. |
| Standalone SET-0 or SET-1 | Logical feedback construction; physical layout unvalidated. |
| Selectable read/write interface on shared state | Not constructed. |
| Data-dependent successor after a shared return | Not constructed. |
| Arbitrary address writing and dispatch | Not constructed. |
| DECJZ and extensible counter/tape storage | Not constructed. |
| Universal stock-VTech computer | Open research question. |

Proceed slowly: characterize the gate, establish circulation, build the two-bit counter, then the four-phase machine. Investigate controlled memory and branching after those foundations are clear. Add complexity only when a specific missing behavior requires it.

## Physical evidence and simulation

A future abstract simulator can check these routing rules; a physical simulator must obtain gate transitions and marble paths from geometry, collisions, joints, gravity, friction, and documented motors. An observer can decode states and compare checkpoints, but must not choose routes, overwrite bits, or reposition a marble to make a run succeed.

Finite successful runs provide evidence for their tested conditions. They do not alone establish indefinitely reliable mechanics or a general composition theorem.

References: [useful items](USEFUL-ITEMS.md), [document archive](references/README.md), [Pitt's paper](references/turing-tumble/pitt-turing-tumble.pdf).

## Archived two-bit counter (semantic prototype)

This historical prototype remains in source; it is not an active gallery choice.
The machine has nine instances on the common lattice: elevator, top track,
TGate A, bypass, carry track, TGate B, two B return tracks, and a merge.
A occupies level 2–3 and B level 1–2; the elevator restores level 0 to level 3.
All connected ports coincide and allocated component cells do not overlap.

Left is bit 0; right is bit 1. A's old 0 takes the bypass. A's old 1
routes through B, propagating the carry. Both outputs of B return to the
same merge, so their merge does not discard a required destination choice.
After each completed lap, bits **B A** count **00 → 01 → 10 → 11 → 00**.
The live readout also shows intermediate ripple states while a lap is running;
read the completed count when the marble returns to the elevator.

A bypass lap takes five discrete passages and nine base time units; a carry
lap takes seven passages and eleven units. Each component has fixed duration,
scaled by the execution speed. Longer routes therefore take longer virtual time.
The catalog duration is the maximum lap duration, not a fixed lap clock.
The computation log records the actual route and both gates' state transitions.
Reset restores both bits to zero.

This is semantic execution with a proposed 3D layout, not qualified physical
transport. The bypass descent, merge, elevator handoffs, and gate switching
still need physical engineering. Tests check 100 laps at three scales and two
speeds, indexed marble locations, branch counts, state reset, and disabled
physical modes. Browser checks exercise the four-state cycle and both routes.

The archived five-address routing demo demonstrated explicit instruction addresses
on the existing two-branch layout. Its fixed program alternates
`1 → 3 → 2 → 4 → 1` and `1 → 5 → 2 → 4 → 1`; the marble location is its
instruction pointer. See [JUMPS.md](JUMPS.md) for the instruction table and limitations.

## Actual instruction-machine work

The [seven-instruction specification](SEVEN-INSTRUCTION-MACHINE.md) supersedes
calling the five-node routing demo an instruction machine. The current simulator
executes INC(a), INC(b), and JUMP with shared register state in both the instruction
reference and a nested physical component assembly. Register bits, carries, and
continuations now use actual T-gates, Ferris wheels, and level tracks. See
[the current audit](COMPONENT-AUDIT.md) for backend-specific verification and
finite-capacity overflow behavior.
