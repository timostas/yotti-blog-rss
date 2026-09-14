---
name: yotti-editorial-voice
description: Write, localize, revise, and quality-check Yotti Blog RU/EN travel articles in a natural journalistic voice. Use for every new or edited Markdown article under articles/, including titles, leads, headings, SEO sections, and the mandatory human editorial pass before publication.
---

# Yotti Editorial Voice

Before writing or revising, read
[references/human-editorial-standard.md](references/human-editorial-standard.md)
and
[references/competitor-informed-scorecard.md](references/competitor-informed-scorecard.md)
in full.

## Workflow

1. Preserve the reader intent, verified facts, sources, permanent slug, categories, and stable metadata.
2. Write five plain title candidates. Say each aloud. Reject titles that sound like a slogan, essay theme, advertising line, translation, or AI-generated metaphor. Choose the clearest natural title, not the cleverest one.
3. Build an article-specific structure from the material. Do not start from a universal template. Use a list, takeaway block, conclusion, or FAQ only when it makes this article easier to use.
   For `route-or-itinerary`, complete the enhanced route section in
   `templates/article-brief.md` and satisfy
   `quality.enhancedRouteGuideGates` in `config/editorial-policy.json` before
   drafting.
4. Draft with concrete nouns and verbs. Let facts, places, choices, and observed details carry the prose. Do not manufacture a cinematic opening when a direct opening is stronger.
5. Localize independently. Write RU as contemporary edited Russian and EN as idiomatic English travel journalism; never mirror sentences or headings line by line.
6. Perform a separate human editorial pass after the draft. Apply **Literary review of service prose** in `references/human-editorial-standard.md`: reader distance, repeated caveats, abstract wording, paragraph movement and the ending. Record excerpts, proposed/applied changes and a meaning-preservation check in existing editorial evidence. Re-read without defending the draft; do not invent facts or scenes. For an audit-only request, label rewrites as proposals and do not silently edit the published article.
7. Score both locales with the competitor-informed scorecard. Require at least 82/100 and every dimension floor. Record the score, two weakest dimensions, and the editorial change in the brief or queue quality notes. Use the single allowed repair when the score is 76–81; stop at 75 or below.
8. Run `npm run style-check -- <RU file> <EN file>`. Treat every reported error as blocking. If the single allowed repair has not already been used, it may address a style failure; then run the check and score again.

## Publication gate

Publish only when all statements below are true:

- the title could be said naturally in conversation and accurately describes the article;
- headings identify useful sections without trying to sound profound;
- paragraphs do not repeatedly follow thesis, contrast, lesson, and uplifting conclusion;
- the writer does not order the reader around when a neutral explanation would work;
- removing the country name would break the article because its details are genuinely local;
- RU and EN feel independently edited;
- each locale reaches 82/100 and every essential score floor;
- the style checker passes with zero blocking markers.

Use `gpt-6-astra / high` for regular drafting and the distinct human editorial
pass. Use `gpt-6-astra / xhigh` for an enhanced route guide. A stronger model
does not replace this workflow.

Before release, read and apply `docs/astra-editorial-acceptance.md` from the
repository root. Record concrete findings and their resolution for each locale;
a self-assigned score is not proof. A human editorial pass here means a distinct
AI editorial review for natural language, not a claim that a human reviewed it.
