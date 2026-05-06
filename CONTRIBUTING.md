# Contributing

## Commit conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`,
  `chore`, `test`, `refactor`, `perf`, `build`, `ci`, `style`.
- NO `Co-authored-by:` lines. Not in commit bodies, not in squash-merge bodies.
- NO AI attribution of any kind.
- One concern per commit.

## Squash-merge guidance

The repo squash-merge default is configured to use the **PR title as the commit subject** and
the **PR description as the commit body** (`squash_merge_commit_title=PR_TITLE`,
`squash_merge_commit_message=PR_BODY`). This prevents individual commit metadata — including
`Co-authored-by:` lines from co-authored commits — from leaking into the merge commit.

When merging via the GitHub UI:
1. The prefilled subject should match the PR title (conventional commit format).
2. The prefilled body should be the PR description. Verify it contains no `Co-authored-by:`
   lines before confirming. If any appear, remove them manually.

## Doc-consistency gate

`scripts/verify-doc-consistency.sh` runs as a step inside the `lint-typecheck` CI job on every
push to `main` and on every tag push matching `v*`. After creating a release tag, the rubric
**must** be refreshed in a follow-up PR before pushing the tag — otherwise the gate will fail
on main, surfacing the staleness immediately.
