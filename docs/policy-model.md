# Policy Model

## Policy File Layout

The starter policy lives at `.agentops/policy.yaml`.

Top-level sections:

- `defaults`
- `paths`
- `tools`
- `overlays`

## Defaults

Phase 1 default posture:

- `execution_mode: inspect`
- `model_access: false`
- `network: deny`
- `writes: approval_required`

## Path Rules

- `allowed_read`: where read access is permitted
- `allowed_write`: where writes may be considered
- `blocked`: sensitive paths that are denied even if broader patterns would otherwise match

Blocked patterns win over allow patterns.

The policy engine also denies repository escape attempts such as `../secret.txt` or absolute paths outside the workspace root.

## Tool Rules

Each tool has an effect:

- `allow`
- `deny`
- `approval_required`

Policy decisions override both workflow intent and adapter capability. If a tool is `approval_required`, runtime must block it before execution.

## Overlays

`local` and `ci` overlays let you tighten or change policy by execution environment without duplicating the whole document.

Typical CI overlay uses:

- keep network denied
- narrow writes further
- change reporting behavior without relaxing core protections

## Redaction

Policy owns redaction hooks because artifacts and logs should be sanitized consistently regardless of which adapter or agent produced the content.

Current default redaction targets include:

- GitHub tokens
- API keys
- AWS access keys
- bearer tokens
- password and token assignments
- PEM private keys
