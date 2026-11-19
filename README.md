# Universal Marble Computer

**[Open the live simulator →](https://umc-rust.vercel.app/simulator/)** · [Logic gates and half-adder](https://umc-rust.vercel.app/simulator/logic.html) · [Physical machine](https://umc-rust.vercel.app/simulator/?component=seven-instruction-lattice&mode=cpu)

A component simulator with three top-level assemblies:

1. **Ferris wheel + ramp closed circuit** — the wheel raises the marble; the ramp returns it to the original height.
2. **Ferris wheel + T-gate closed circuit** — the wheel raises the marble; the retained seesaw alternates the two descending exits. Both return paths stay level.
3. **Seven-instruction machine** — shared finite registers implement INC/JUMP using T-gates, Ferris wheels, level tracks, and receiving junctions. A wheel/ramp pair supplies energy for the long return.

Every simulator page has the same horizontal component browser. Swipe on mobile, scroll or use the arrows on desktop, and filter by Simple parts, Gates, Assemblies, or Machines. The selected card is highlighted; selecting another example opens its simulator in Physical · CPU mode. The expandable **Component hierarchy** shows each assembly’s nested parts.

| Category | Available examples |
| --- | --- |
| Simple parts | Straight track, 90° curve, ramp, Ferris elevator, T-gate |
| Gates | Buffer, NOT, AND, OR, NAND, NOR, XOR, XNOR — each in a closed circuit |
| Assemblies | Two connected tracks, Ferris/ramp loop, Ferris/T-gate loop, four-bit INC register |
| Machines | Seven-instruction physical assembly, XOR + AND half-adder |

The runnable catalog has **19 CPU-physical choices**. The shared-register routing proposal, five-address routing demo, and abstract two-bit counter remain archived in source. The [instruction-reference page](https://umc-rust.vercel.app/simulator/machine.html) is a separate semantic comparison tool, not a physical component.

Current verification and limitations are recorded in [COMPONENT-AUDIT.md](COMPONENT-AUDIT.md). CPU success is not GPU qualification. Geometry and materials are estimates, not measured stock VTech parts.

## How UMC works

UMC models a computer made from tracks and mechanisms. A marble is a moving control
signal: its route determines what happens next. The motorized Ferris wheels supply
energy. Gravity, momentum, and collisions carry the marble through the remaining parts.

### From components to circuits

A **primitive component** is an executable part with defined entry/exit ports,
geometry, and behavior. Straight tracks and curves stay at the same height; ramps
and T-gates descend; Ferris wheels raise the marble. A standalone flat track test
starts with an incoming marble because gravity alone cannot move it along a level floor.

A **circuit**, or supercomponent, connects instances of other components at aligned
ports. It may contain smaller circuits, which themselves contain primitives. Each
instance has its own state. The simulator runs the underlying primitive mechanisms;
a box representing a composite does not replace their physics.

A primitive has composition Level 0. Every circuit has Level `1 + max(child levels)`.
This is nesting depth, not elevation. Expand **Component hierarchy** to inspect the
actual tree. For example, a Ferris/ramp loop combines a wheel with a return-track
subassembly, while a machine combines register mechanisms, collectors, and routes.

A **closed circuit** returns the same marble to its entry. It does not respawn or
teleport it at the end of a lap. A wheel supplies upward motion and a ramp or T-gate
provides the descent; ordinary tracks provide no hidden drop or propulsion.

### Gates and the half-adder

Choose **Gates** in the component browser for Buffer, NOT, AND, OR, NAND, NOR, XOR,
and XNOR. Set A/B before starting. These inputs configure fixed routing tracks, and
the moving marble physically selects an output rail. The displayed measured output
comes from the observed crossing; the truth table is an independent expected result.
Repeated laps use the same inputs. These are custom idealized routing mechanisms,
not an assertion that an unmodified commercial track switch implements Boolean logic.

The **half-adder** composes XOR and AND circuits: `Sum = A XOR B`, `Carry = A AND B`.
One marble visits the two modules sequentially. The simulator publishes the output
pair when the complete lap finishes. This circuit demonstrates addition of two bits;
it does not write the result into the instruction machine’s registers.

### How a circuit becomes a machine

The **seven-instruction machine** gives the marble a program to follow. A register
stores bits in T-gates: left is 0 and right is 1. A read selects the gate’s old branch
and toggles its bit. To increment a register, a 0 becomes 1 and completes the INC;
a 1 becomes 0 and carries to the next bit. Ferris inlets lift the marble between
successive gate operations. Collectors and return tracks bring it to the next instruction.

JUMP instructions are routes to another instruction’s entry. The program runs
`1 → 2 → 5 → 6 → 3 → 4 → 7 → 1`, sharing register a between instructions 1 and 5.
Its return T-gate retains which continuation is needed. This is physical control
state, not a software teleport to the next instruction.

Below the simulation, the program panel highlights the current instruction and
shows **all register values and bits**. During carry, those bits can be intermediate.
The floating triad shows the previous/current instruction and the planned successor;
overflow stops execution instead of proceeding to that successor. Four-bit registers
have finite capacity; the last carry exits rather than silently creating a larger register.

### Running and inspecting

1. Select a part, gate, circuit, or machine. **Physical · CPU** is the default.
2. Use **Run/Pause**, **Step**, and **Reset**. A physical Step advances a simulation
   frame; a Semantic Step completes a component passage. Semantic mode follows the
   same topology but does not establish that the geometry works physically.
3. **Follow marble** zooms in and tracks its motion. **Unfollow** restores the overview.
   Drag to orbit, pinch/scroll to zoom, and use the cube button to show spatial cells.
4. Inspect the hierarchy, register panel, truth table, and execution log as appropriate.

The machine is a concrete INC/JUMP demonstration with finite registers and one marble.
Its name does not establish universality, arbitrary-program support, or commercial-part
fit. Physical correctness is checked by travel, crossings, gate state, repeated laps,
and agreement with instruction/logic reference results—not by a successful animation alone.

## Hosted demo and mobile use

**Live: [umc-rust.vercel.app](https://umc-rust.vercel.app)**

The site is deployed on Vercel from [pauloabelha/umc](https://github.com/pauloabelha/umc).
The GitHub integration is connected: pushes to `main` deploy to production,
and pull requests receive preview deployments.
The component and logic simulators default to Physical · CPU execution, which
runs entirely in the browser. Explicit execution modes in links are preserved. CUDA/GPU execution requires the local service described
below and is not hosted on Vercel.

All three simulator pages adapt to phones and tablets: single-column layouts,
44px touch controls, readable form inputs, and horizontally scrollable data tables.
On phones, Run/Pause, Step, and Reset appear first, directly above the live
simulation; component browsing and settings follow below. **Follow marble** beside
Run zooms into the marble’s neighborhood and tracks it while preserving the viewing
angle. You can adjust zoom while following; Unfollow restores the normal full-circuit view. The
seven-instruction simulation has a fixed Previous / Current / Next overlay next
to the wireframe toggle; Next is the programmed successor, conditional on no overflow.
Directly below the view, the machine panel highlights the instruction and shows
all register values and bits, including intermediate carry states.
Drag the 3D view to orbit and pinch to zoom. Start with Semantic mode on phones;
physical simulation performance depends on the device.

### Deploy

```sh
npm ci
npm test
npm run build
vercel link --project umc --scope pauloabelhas-projects
vercel --prod
```

Vercel builds the Vite multi-page app into `dist/` using `vercel.json`.
No environment variables are required. Local credentials, CUDA dependencies,
research downloads, and test artifacts are excluded from deployment uploads.

## Run

```sh
npm ci
npm run dev:cpu
```

Open **http://127.0.0.1:5173/simulator/**. Choose Semantic or Physical · CPU, then Run, Pause, Step, or Reset. The cube icon in the upper-right corner of the 3D view toggles a wireframe of spatial cells (60 mm at reference scale), including while the simulation runs.

For the CUDA backend:

```sh
python3 -m venv .venv-gpu
.venv-gpu/bin/pip install -r gpu/requirements.txt
npm run dev
```

Node 20+, Python 3.12+, and an NVIDIA GPU with a compatible driver are required for GPU execution. The launcher supervises the loopback CUDA service on port 8792 and Vite on 5173. There is no CPU fallback when GPU execution fails. This project is independent of `~/umr`.

## Composition levels and physical elevation

A primitive has **Level 0**. A composite has:

```text
Level(component) = 1 + max(Level(child) for child in component.children)
```

Composition levels express structural depth, not physical height. The two closed circuits are Level 2; the seven-instruction machine is Level 3. [Composition](src/composition.js) stores the actual nested instance tree. [Circuit](src/circuit.js) checks that its leaves contain every executable instance exactly once. State belongs to an execution and instance, so repeated instances of the same definition never share gate memory.

Physical elevation has a separate contract:

- Straight tracks, curves, and receiving junctions stay level.
- Ferris wheels provide upward transfer.
- T-gates and ramps provide downward transfer.

The circuit exposes `elevationIssues`; violating primitive paths cannot be enabled as physical components. Connected ports must coincide and have opposite normals with matching up vectors. Ordinary level tracks need incoming momentum; isolated primitive fixtures specify that velocity explicitly. There are no hidden track drops or semantic pushes in a physical circuit.

## Execution

**Semantic execution** advances to the next passage completion. A T-gate selects its old state and then toggles. Passage durations are component parameters divided by semantic speed. The event queue preserves marble identity, instance state, and entry/exit history. Stateful semantic passages serialize arrivals; physical simultaneous-marble handling is not qualified. These demonstrations use one control marble.

**Physical execution** uses Rapier on CPU or Newton/Warp on CUDA. Gravity and contact forces move the marble. Only Ferris rotors have prescribed motor motion. Hinged seesaws move through contact; the observer reads crossings and rotations without steering the marble or choosing its destination. Both backends consume the same primitive definitions; CUDA uses compound-box approximations for channel collisions. Material settings deliberately model low-loss travel (`TRACK_FRICTION = 0.002`, `MARBLE_FRICTION = 0`); they are not measurements of real plastic.

Scale multiplies geometry, ports, and marble radius together. Mass scales with volume; physical time and motor periods scale with the square root of length. Physics is solved in normalized base units. Semantic time is independent of geometric scale.

Run continues a closed circuit until paused or a failure occurs. Tests use lap targets without adding a production lap limit. Reset clears the execution. Explicit marble re-entry restores the inlet fixture and preserves mechanism state, identity, and accumulated time.

## Seven-instruction machine

```text
1 INC(a)   2 JUMP(5)   3 INC(b)   4 JUMP(7)
5 INC(a)   6 JUMP(3)   7 JUMP(1)
```

The order is **1 → 2 → 5 → 6 → 3 → 4 → 7 → 1**. Instructions 1 and 5 use the same register a. The return T-gate retains the phase that selects continuation 2 or 6 for this fixed program. It does not read a software caller tag.

Each bit has a T-gate and a Ferris inlet. Right carries to the next bit; left completes the increment through the level collector. The default registers have four bits. An overflow exits the highest bit's right port, stops execution, and does not count as a completed INC. Intermediate bit values during carry are not completed instruction results. On overflow the physical bits have wrapped to zero; the last completed instruction record remains the pre-overflow value.

[physical-machine.js](src/machine/physical-machine.js) constructs the planar assembly from primitives. The old lift-column layout is archived in `src/machine/legacy-lattice-machine.js`; it is not used by the current machine. `/simulator/machine.html` supplies the instruction oracle, logical wiring view, and semantic execution of the actual component topology. See [the specification](SEVEN-INSTRUCTION-MACHINE.md).

## Logic gates and half-adder

Open the **[hosted logic simulator](https://umc-rust.vercel.app/simulator/logic.html)** (locally: `http://127.0.0.1:5173/simulator/logic.html`) for closed-circuit Buffer, NOT, AND, OR, NAND, NOR, XOR, XNOR, and the XOR + AND half-adder. Set A/B before running; measured outputs come from the marble’s output-track crossings. These examples use fixed input track switches, so repeated laps preserve the same inputs. See [construction, scope, and verification](LOGIC-CIRCUITS.md). Every input combination passes three physical laps on CPU and GPU at reference scale.

## Checks

```sh
npm test
npm run test:gpu-schema
npm run build
npm run demo
```

With the development server running:

```sh
npx playwright install chromium
npm run test:browser
npm run test:mobile # touch interaction and overflow at 320, 390, and 768px
npm run test:browser:gpu # requires the CUDA service; checks a completed lap
npm run test:catalog:cpu # every runnable component + all logic inputs + machine oracle
npm run test:components
npm run test:physical    # repeated physical laps and instruction-by-instruction oracle checks
```

Reports are written under `artifacts/`. Semantic checks compare register values and instruction order against the exact-integer reference. Physical checks must additionally verify actual gate exits, handoffs, repeated laps, and overflow. A successful standalone primitive does not qualify an assembled circuit; an implemented physical model is not automatically a reliable model.

Research: [UMC.md](UMC.md), [USEFUL-ITEMS.md](USEFUL-ITEMS.md), [references](references/README.md). Passing a simulation is not proof of stock-part fit or universality.
