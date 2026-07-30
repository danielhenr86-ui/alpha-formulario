# MetOn Branding — Design QA

## Comparison target

- Source visual truth:
  - `../upload/B4CF1F3D-67DD-46CC-9B5C-CCCB72B009EC.png` — primary white/green wordmark on graphite.
  - `../upload/910BC0FB-8917-498D-B8D2-273B0FCA20D3.png` — transparent light wordmark used in the header.
  - `../upload/8A0BC2D7-781D-499F-8AB6-E0ED6113E6EB.png` — transparent dark wordmark used in the footer.
  - `../upload/icon.svg` — official target icon used in the favicon and result states.
- Rendered implementation:
  - `qa/implementation-intro-desktop.jpg`
  - `qa/implementation-result-desktop.jpg`
  - `qa/implementation-intro-mobile.jpg`
  - `qa/implementation-result-mobile.jpg`
- Combined comparison evidence:
  - `qa/brand-comparison-desktop.jpg`
  - `qa/brand-comparison-mobile.jpg`
  - `qa/brand-logo-focused.jpg`

## Viewports and normalization

- Desktop CSS viewport: `1363 × 936`, `devicePixelRatio: 1`.
- Desktop intro screenshot: `1363 × 936`.
- Desktop result screenshot: `1348 × 1261`; the 15 px width difference is the browser scrollbar, not horizontal overflow.
- Mobile CSS viewport: `390 × 844`, `devicePixelRatio: 1`, rendered in a same-origin browser iframe with that exact viewport.
- Mobile screenshots: `390 × 844`.
- Primary source board: `1200 × 604`; transparent light logo: `1200 × 328`.
- Full-view comparisons resize only for presentation in the combined evidence. The focused logo comparison downsamples the source to the implementation's rendered width of 220 px; it does not upscale the implementation.
- State compared: initial diagnosis screen and completed `Organizado · 100%` result.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: the official wordmark remains an image asset. Sora provides the rounded, high-weight display hierarchy; Inter and IBM Plex Mono separate body copy from diagnostic metadata. Desktop and mobile wrapping preserve the intended hierarchy without truncation.
- Spacing and layout rhythm: the graphite masthead, green rule, centered 720 px content column, 18 px cards, 54–58 px controls, and compact mobile margins produce consistent rhythm. No horizontal overflow was detected at either tested viewport.
- Colors and visual tokens: the implementation uses the exact supplied `#0E1B17` graphite and `#12B76A` green. White, fog, border, and semantic status colors maintain readable contrast. No gradients were introduced.
- Image quality and asset fidelity: the page uses the supplied wordmark and icon files directly. Natural logo size is `1200 × 328`, rendered at 220 px desktop and 164 px mobile, so it remains sharp without enlargement. No inline or handcrafted logo substitute remains.
- Copy and content: the standalone intro clearly explains the 8-question flow, the no-registration start, the result, and the MetOn plan of action. Existing privacy and delivery language remains intact.
- Icons and marks: the supplied target icon is used for favicon and result/thanks states. The only other arrow is a text affordance on answer buttons, not a brand-asset substitute.
- Accessibility and interaction: semantic buttons, field labels, visible focus rings, progressbar values, reduced-motion handling, alt text, and practical tap targets are present.
- Browser behavior: all 8 questions were completed on desktop and mobile; both reached `Organizado · 100%`. Invalid contact validation preserved both entered values and displayed the intended error. Page-origin console errors: none.

## Comparison history

1. First result pass found one P2 alignment issue: the checkbox inherited the 52 px minimum height and bottom margin from text inputs, shifting it below its label.
2. Fix applied: text-field sizing was narrowed to `.lead-form input:not([type="checkbox"])`.
3. Post-fix evidence: `qa/implementation-result-desktop.jpg` shows the checkbox and label aligned; measured top-edge delta is 2 px. The mobile result remains within the 390 px viewport with no horizontal overflow.

## Focused comparison evidence

- `qa/brand-logo-focused.jpg` compares the source and rendered wordmark at equal display scale. Letterforms, white/green split, target-shaped “O”, proportions, and transparency treatment match because the implementation uses the supplied asset directly.
- Focused form evidence is readable in `qa/implementation-result-desktop.jpg`; a separate crop is unnecessary at the captured resolution.

## Implementation checklist

- [x] Replace the approximate inline wordmark with supplied official assets.
- [x] Apply exact graphite and green brand tokens.
- [x] Carry the target icon through favicon and result states.
- [x] Verify intro, quiz, result, validation, responsiveness, focus, and console state.
- [x] Correct the checkbox alignment found in the first result pass.

## Follow-up polish

- P3: none required for this branding pass.

final result: passed
