# Useful items for a Universal Marble Computer

Living inventory, updated 2026-11-18. Start with stock VTech Marble Rush parts and derive the computer from their actual behavior. Set names and contents vary by region. This records useful ingredients, not an established universality proof. The [design proposal](UMC.md) now starts with one toggle, a two-bit counter, and three increments followed by a bypass.

Evidence labels: **Observed** means reported by the user; **Documented** means described in manufacturer material; **Candidate** means a possible computational use that still needs investigation. Part identification and physical behavior are separate questions.

## Priority mechanisms

| Item | Behavior and evidence | Possible computational role | Open questions |
| --- | --- | --- | --- |
| **T-gate / alternating switch** | **Observed:** a ball passes, the gate switches right and the ball exits left; the next ball switches it left and exits right. “T-gate” is the user's name; set and molded part ID are not yet identified. | Branching and, if its position persists, one bit of memory. Each passage changes the state: a destructive read/toggle. Candidate for counters and control circuits. | Does it retain both positions indefinitely at rest? Can a marble enter from a side or reverse direction and set its position? Can other stock parts actuate it? What spacing between marbles is needed? |
| **Motorized Ferris-wheel elevator (M-09 in the archived Ultimate guide)** | **Documented:** picks up arriving marbles and raises them; runs while switched on. See [Ultimate build guide](references/vtech/ultimate-xl100e-build.pdf) and [operating manual](references/vtech/ultimate-xl100e-manual-fr.pdf). | Supplies energy for return paths and repeated visits to gates. A circulation mechanism, not by itself a logic gate. | Pickup/discharge geometry, throughput, phase sensitivity, and reliable closed-loop connections. |
| **See-saw track** | **Documented:** included in Corkscrew Rush. [VTech product description](https://www.vtechkids.com/product/detail/20334). The archived [Super Action construction guide](references/vtech/super-action-5194-build.pdf) also illustrates M-18; equating that part with a particular memory behavior remains unverified. | **Candidate:** retained position, conditional routing, or mechanical interaction between marbles. | Stable positions, effect of each entrance, reset behavior, and whether another marble can read or change the state. |
| **Fill-and-tip bucket / teetering baskets** | **Documented:** fill-and-tip bucket in Vertical Free Fall; teetering baskets in Tip & Swirl. [VTech Vertical Free Fall](https://www.vtech.co.uk/product/detail/21413/Marble_Rush_Free_Fall_Vertical_Set), [VTech range](https://www.vtechkids.com/marblerush). | **Candidate:** marble storage, accumulation, threshold-triggered release, or a handshake between paths. | Does loading alone trigger tipping? How many marbles? Is resetting automatic? Can output depend reproducibly on stored contents? Do not assume the different bucket designs behave identically. |
| **Up/down pulley** | **Documented:** part of Vertical Free Fall. [VTech description](https://www.vtech.co.uk/product/detail/21413/Marble_Rush_Free_Fall_Vertical_Set), [build guide](references/vtech/5801-Ultimate-Vertical-Run-V100.pdf). | **Candidate:** transfer a mechanical effect between locations; possibly gate or release another marble. | Manual versus marble actuation, retained positions, coupling, and repeatability. |
| **Directional selector** | **Documented:** Space Magnetic manual describes selecting direction, with an upright setting giving random left/right routing. [Manual, printed page 10](references/vtech/space-magnetic-xl300e-manual-de.pdf). | Configurable routing; **candidate** for writable state only if marbles can set it. | Not yet identified as the user's alternating T-gate. Manual describes setting the selector, not a marble-actuated toggle contract. |

## Transport and supporting parts

| Item | Potential use | Evidence / limitation |
| --- | --- | --- |
| Straight tracks, curves, ramps, supports | Fixed connections; adjust elevation and path length. | Illustrated in the [Ultimate build guide](references/vtech/ultimate-xl100e-build.pdf). Exact dimensions and reliable arrival conditions remain to be measured. |
| Funnels, receiving trays, merge slides | Collect marbles, merge paths, or retain output. | Ultimate and [Vertical Free Fall](https://www.vtech.co.uk/product/detail/21413/Marble_Rush_Free_Fall_Vertical_Set). Merging paths can lose information about which entrance a marble used. |
| Motorized spiral lift / sky elevator | Alternative height restoration and recirculation. | [Vertical Free Fall](https://www.vtech.co.uk/product/detail/21413/Marble_Rush_Free_Fall_Vertical_Set), [Sky Elevator](https://www.vtechkids.com/product/detail/20688/Marble_Rush_Sky_Elevator_Set). Do not assume interchangeable connection geometry. |
| Motorized freight train | Transport a group of marbles between locations. | [Sky Elevator](https://www.vtechkids.com/product/detail/20688/Marble_Rush_Sky_Elevator_Set). Automatic loading, unloading, and control behavior need characterization. |
| Magnetic UFO lift and rocket mechanisms | **Candidate:** capture, transport, or release using magnetic marbles. | [Space Magnetic manual](references/vtech/559805-Marble-Rush---Space-Magnetic-Mission-Set-XL300E.pdf). Controlled state storage and automatic reset are not established. |
| Launchers | Input injection or height restoration. | Illustrated in the Ultimate guide. A manually pressed launcher is external input; autonomous use requires demonstrated marble actuation. |
| Slowdown slides | Adjust transit timing. | Vertical Free Fall documentation. A delay is not automatically a reliable clock or synchronizer. |

## T-gate observation record

User description, 2026-11-18, paraphrased: one ball moves the gate right and exits left; the next moves it left and exits right.

Assuming “right/left” denotes the gate's final position:

| Gate before | Marble exits | Gate after |
| --- | --- | --- |
| Left | Left | Right |
| Right | Right | Left |

The alternating exits and alternating gate positions are the reported behavior. The table infers the starting position from the preceding passage. Confirm the orientation convention against the physical piece before using it in a model.

If both positions persist, encode left = 0 and right = 1: a passage routes according to the old state and flips it. That establishes a candidate toggle bit, not independently writable memory or universality.

## Assemblies derived from the toggle rule

These are logical constructions, not physically demonstrated assemblies. Gate counts exclude transport and supports. See [UMC.md](UMC.md) for routing, checkpoint tables, and limitations.

| Assembly | Ingredients and behavior | What remains open |
| --- | --- | --- |
| Circulating toggle | One gate and a return path; successive passages alternate exits. | Retention, pickup/discharge, and reliable repeated circulation. |
| Two-bit incrementer | Two gates; send the low bit's old-1 output to the high bit to propagate carry. Counts 00 → 01 → 10 → 11 → 00. | Physical connections, explicit overflow path, and arrival conditions. |
| Three increments and one bypass | Two phase gates plus the same two data gates. Phase non-overflow paths share the data incrementer; phase overflow bypasses it. | Physical layout; this is cyclic control, not arbitrary JUMP. |
| Standalone SET-0 | Re-enter the gate on its old-0 output; leave on its old-1 output. Ends at 0 after one or two passages. | A reliable feedback path. Does not provide selectable read/write operations on the same gate. |
| Standalone SET-1 | Re-enter on old-1; leave on old-0. Ends at 1 after one or two passages. | An alternative fixed wiring to SET-0, not an already combined interface. |

The next control question is a data-dependent successor from the same instruction entrance. A fixed sequence such as 1 → 3 → 2 → 4 can be a relabeled phase counter and does not establish address writing.

Wheel pocket count and exact geometry remain unverified. The eight-paddle simulated wheel in `~/umr` is an approximation, not evidence about the stock part.

## Components for jumps

See [Jumps and control flow](JUMPS.md) for the paper comparison and precise distinctions. Fixed transfers need transport; backward transfers need height restoration. The T-gate selects between two fixed routes while toggling its state. A shared elevator that must return to different destinations needs a mechanically stored selection and a reader, or separate paths. Such writable dispatch is not yet established for our VTech parts.

The new T-gate/elevator lattice loop is executable semantically. The gate drops one level; its proposed footprint is 3 × 3 cells. Footprint and cell pitch are design choices awaiting measurements. Its physical switch is not implemented.

## What the inventory must eventually support

- Persistent state that marbles can affect and use to select subsequent behavior.
- Enough interactions between state and routing to implement a known universal model; alternating switches alone are not yet a proof.
- Autonomous repetition, with explicit energy supply and no person choosing each computational step.
- A repeatable way to add storage. A fixed finite stock of finite-state gates provides only bounded memory.
- Reliable composition: outputs of one mechanism must be valid inputs for the next, including speed, direction, timing, and reset state.
- Distinct successful halt/output and failures such as jams, escape, or insufficient capacity.

Turing Tumble's proof is useful background, but its gear-coupled bits cannot be assumed available in VTech. See the [reference library](references/README.md).

## How to extend this file

For each new item, record its set/region, molded ID if known, photo or source, usable entrances/exits, stable states, effect of one marble from each entrance, reset mechanism, energy/manual actions, and observed failure cases. Keep proposed computational uses separate from observed behavior.
