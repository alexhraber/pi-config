# Intent

<!-- decapod:declared-capabilities:start -->

## Declared Capability Surfaces

- `agent-helper`
- `governance-kernel`
- `persistent-state`

<!-- decapod:declared-capabilities:end -->

## Product Outcome
- A Decapod-centered pi agent workflow with an elegant theme, reusable prompt templates, and an automatic governance extension.
- Every incoming non-command request is safety-evaluated, oriented, context-resolved, and preflighted before inference; Decision Gates stop automation for human judgment.
- Completion is an honest, evidence-backed state: inference validation and repository validation are both surfaced, while missing proof remains explicitly unproven.

## What This Project Is
pi-config is a application project built using TypeScript.
A Decapod-centered pi agent workflow with an elegant theme, reusable prompt templates, and a lightweight governance extension.

Key operating facts:
- **Primary languages**: TypeScript
- **Detected surfaces**: cli, pi

## Product View
```mermaid
flowchart LR
  U[Primary User] --> P[pi-config]
  P --> O[User-visible Outcome]
  P --> G[Proof Gates]
  G --> E[Evidence Artifacts]
```

## Inferred Baseline
- Repository: pi-config
- Product type: application
- Primary languages: TypeScript
- Detected surfaces: cli, pi

## Scope
| Area | In Scope | Proof Surface |
|---|---|---|
| Core workflow | Define a concrete user-visible workflow | Acceptance criteria + tests |
| Data contracts | Document canonical inputs/outputs | [INTERFACES.md](./INTERFACES.md) and schema checks |
| Delivery quality | Block promotion on broken proof surfaces | [VALIDATION.md](./VALIDATION.md) blocking gates |

## Non-Goals (Falsifiable)
| Non-goal | How to falsify |
|---|---|
| Feature creep beyond the primary outcome | Any PR adds capability not tied to outcome criteria |
| Shipping without evidence | Missing validation artifacts for promoted changes |
| Ambiguous ownership boundaries | Missing owner/system-of-record in interfaces |

## Constraints
- Technical: runtime, dependency, and topology boundaries are explicit.
- Operational: deployment, rollback, and incident ownership are defined.
- Security/compliance: sensitive data handling and authz are mandatory.

## Acceptance Criteria (must be objectively testable)
- [ ] The pi configuration is installable, Decapod validation passes, and the integration never claims proof without evidence.
- [ ] Non-functional targets are met (latency, reliability, cost, etc.).
- [ ] Validation gates pass and artifacts are attached.
- [ ] `npm test` (or `pnpm test`) passes for unit/integration suites
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes for strict TS projects

## Epistemic Custody Fields

### Active Assumptions
- [ ] List any assumptions made to proceed.
- [ ] Flag assumptions that require future verification.

### Confidence & Risk Level
- **Confidence**: Low/Medium/High (Rationale: )
- **Risk**: Low/Medium/High (Impact of wrong assumptions: )

### Measured vs Inferred Facts
| Fact | Source (Provenance) | Type (Measured/Inferred) |
|---|---|---|
| | | |

### Unresolved Contradictions
- [ ] List any evidence that conflicts with current assumptions or intent.

### Deferred Questions
- [ ] Questions to be answered later.

### Stop Conditions
- [x] Decapod safety evaluation blocks or cannot run.
- [x] Orientation or context resolution fails, or emits a Decision Gate.
- [x] Verification is unavailable, fails, or cannot distinguish evidence from confidence; the agent must not claim completion.
- [ ] Explicit conditions under which the agent should stop and ask for help.

### Proof Required Before Completion
- [x] Decapod inference validation for the original intent and final assistant result.
- [x] `decapod validate` evidence for repository methodology compliance.
- [x] Exact observed check results are reported; confidence alone is never proof.

## Tradeoffs Register
| Decision | Benefit | Cost | Review Trigger |
|---|---|---|---|
| Simplicity vs extensibility | Faster iteration | Potential rework | Feature set expands |
| Strict gates vs dev speed | Higher confidence | More upfront discipline | Lead time regressions |

## First Implementation Slice
- [ ] Define the smallest user-visible workflow to ship first.
- [ ] Define required data/contracts for that workflow.
- [ ] Define what is intentionally postponed until v2.

## User and Actor Contract
- Primary user/agent:
- Authorized actors and their allowed mutations:
- Preconditions required before the primary workflow:
- Observable success result:
- Observable failure result and recovery action:
- Human decision points that automation must not infer:

## Outcome Decomposition
| Outcome | Trigger | State Written | Evidence | Owner |
|---|---|---|---|---|
| Primary outcome | | | | |
| Safety/quality outcome | | | | |
| Operational outcome | | | | |

## Change Impact Rules
- A change to user intent updates this document and acceptance criteria.
- A change to a runtime boundary updates [ARCHITECTURE.md](./ARCHITECTURE.md).
- A change to a callable or persisted contract updates [INTERFACES.md](./INTERFACES.md).
- A change to proof or promotion behavior updates [VALIDATION.md](./VALIDATION.md).
- A breaking change requires an explicit migration trigger, compatibility note,
  rollback condition, and an agent-facing instruction.

## Open Questions (with decision deadlines)
| Question | Owner | Deadline | Decision |
|---|---|---|---|
| Which interfaces are versioned at launch? | TBD | YYYY-MM-DD | |
| Which non-functional target is hardest to hit? | TBD | YYYY-MM-DD | |

<!-- decapod:codebase-attestation:start -->

## Codebase Attestation

- Repository signal fingerprint: `1982ef6f6e588cfdb93e8f5b0267f94b78a6712abbe8856b643ef20ca883d7ee`
- Significant implementation surfaces: `.github/` (1 files), `README.md/` (1 files), `package.json/` (1 files)
- Refreshed from the current codebase by `decapod specs.refresh`
<!-- decapod:codebase-attestation:end -->
