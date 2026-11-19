# Seven-instruction milestone status

The active machine is now composed entirely from physical primitives: level
tracks, quarter turns, receiving junctions, Ferris wheels, T-gates and a return
ramp. Abstract lift/drop columns are no longer in the active machine. The
composition tree has Level 3, with primitive leaves at Level 0. All active
assemblies satisfy their elevation contracts.

The default four-bit machine completed 51 instructions on both CPU and GPU with the correct
instruction pointer and both shared register values at every boundary, then
stopped at the expected a-register overflow. The same primitive topology matches
the instruction reference semantically. The two closed circuits complete repeated
CPU and GPU laps at all offered scales (¼, ½, 1, 2).

The three requested assemblies are the only gallery/selector choices. Intermediate
components remain inspectable in the hierarchy. Browser tests exercise the current
UI, machine stepping, controls, actual CPU/GPU laps, and GPU-offline behavior without fallback.

The contact-solver correction passed the complete GPU run, repeated loop tests,
and all 128 repeated T-gate passages across both backends, both initial states,
and four scales. All 83 Node tests, four GPU schema tests, browser checks, and
the production build pass. See [COMPONENT-AUDIT.md](COMPONENT-AUDIT.md) for traces
and precise qualification limits. The machine run covers the default four-bit
assembly at reference scale. Estimated geometry and idealized low-loss materials
are not a measured stock VTech replica.
