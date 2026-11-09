# Build note — November 9, 2026

Eval Detective explored whether a model response deserves trust. Evidence Atlas explored which source passages get selected. Agent Replay moves to the workflow around the model: what happens when a tool fails, returns malformed data, or proposes an action that needs a decision?

I chose deterministic scenarios so each transition is easy to inspect. Planning is represented by a scripted tool proposal. The state machine, rather than a prompt, enforces the call limit and approval pause. This makes failures reproducible and lets tests check invariants across many budget combinations.

The most useful experiment is a successful lookup with only one permitted tool call. Approval is still required, but approval cannot create more execution budget. These are separate constraints.

The next learning step is to substitute model-generated proposals while preserving these controls in trusted application code. This simulator does not establish that a real agent will make good choices; it demonstrates how to make those choices observable and bounded.
