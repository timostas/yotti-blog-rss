# Yotti Blog project instructions

This repository is the autonomous bilingual content and RSS pipeline for Yotti.
Before material work, read `README.md`, `config/editorial-policy.json`,
`content/queue.json` and `docs/autonomous-editorial-system.md`.

## Boundaries

- Do not mix this project with eSIM.press, Yotti advertising, reviews or other repositories.
- The goal is qualified organic traffic for Yotti through useful RU/EN travel content.
- Follow the active ramp and daily ceiling in `config/editorial-policy.json`.
- The owner manually synchronizes the published RU and EN RSS feeds in Yotti admin.
- Never edit unrelated Yotti website files or Tilda content from this repository.

## Execution

- Use a separate worktree and one short-lived branch per daily content batch.
- Branches: `content/<date>-<cluster>`, `fix/<slug>` and `ops/<yyyy-mm>`.
- Keep `main` deployable; merge only after tests, queue validation, RSS build and CI pass.
- Do not use admin merge or bypass failed checks.
- Record the actual model, effort, attempts, content format and creative concept in the queue.

## Efficiency and quality

- Regular production uses Sol / medium for research, writing and voice; Luna / low is limited to metadata and deterministic checks.
- Reuse one light research package across RU and EN; avoid risky or volatile topics.
- Allow one text generation per locale, one short repair and one cover generation.
- Rotate countries, content formats and cover concepts according to policy.
- RU and EN must be naturally localized rather than mechanically translated.
- Use the canonical category for the content format from `config/editorial-taxonomy.json`; do not invent or vary category labels.

After changes report files, result, checks, risks, actual model/effort and only
the user action that cannot be automated.
