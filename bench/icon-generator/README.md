# Icon generator comparison

Use this worksheet to compare the Design glyph draft with the owner's Fonos reference. Keep the same prompt, style, and generation count for both products. Do not infer a Fonos score from another icon product; enter its product URL and capture the exact version or date used.

## Run

1. Record the Design release and Fonos URL/version in `scorecard.csv`. Use a signed-out Design session for the free tier and a signed-in session for the Anthropic route. Do not buy credits for this comparison; mark a product unavailable when its free allowance does not cover a prompt.
2. For each row in `prompts.json`, generate three candidates per product with the same prompt and style. Save the returned SVG or screenshot with the prompt id, product, and candidate number. Record the model shown by each product, elapsed time, and any visible price. Keep failures and refusals.
3. Place each candidate at 16, 24, 32, and 48 CSS pixels on both white and near-black backgrounds. Score the criteria below from 0 to 2 without knowing which product produced the candidate. Two reviewers score independently; keep both rows and their notes in `scorecard.csv`.
4. Report each criterion's median across the ten prompts and both reviewers, plus the number of failures, free generations available, median elapsed time, and the displayed cost. Include candidate files and the filled scorecard with the report.

## Rubric

| Criterion | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Alignment | Visibly off center or clipped at any size | Small offset or uneven margin | Centered with balanced margins at every size |
| Legibility | Meaning is unclear at 24 px | Meaning is clear at 32 px | Meaning is clear at 16 and 24 px |
| Consistency | Stroke, corners, or fill conflict within one icon | One visible mismatch | Coherent stroke, corner, and fill style throughout the icon |
| Reuse | Cannot export a usable vector or transparent asset | Export needs manual cleanup | Ready to use in a UI without cleanup |

The prompt set exercises simple forms, diagonals, thin details, and negative space. A higher score needs the saved outputs, not just the products' previews. Design's `test/glyph-fit.test.js` separately checks its 24-unit alignment invariant; this worksheet measures what a person sees after rendering.
