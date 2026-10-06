# Quote attachment email link — 2026-10-06

## Ownership

- Agent: Codex
- Branch: `codex/quote-attachment-email-20261006`
- Base: `516df73`
- Worktree: `.codex-tmp/quote-attachment-email-20261006`

## Goal

Make the requisites/specification reference in staff email and MAX notifications actionable without exposing a private or quarantined customer document through a public URL.

## Acceptance

- Only an exact bridged quote request with an actual stored attachment receives a staff-workspace URL.
- The email renders an explicit protected action instead of a plain-text filename.
- The link opens the authenticated request detail, where the existing download endpoint enforces manager permissions and `private, no-store` delivery.
- MAX receives the same protected request URL.
- Invalid request identities and requests without files fail closed.
