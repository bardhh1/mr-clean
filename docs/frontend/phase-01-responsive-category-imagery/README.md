# Frontend Phase 01 — Responsive category imagery

## Outcome

The home-page category index now gives every product thumbnail a deterministic, centered image box at mobile, intermediate, and desktop widths. Portrait catalog artwork—including the Lavanderi detergent bag—can no longer extend beyond its allocated row or touch the surrounding dividers.

## Problem confirmed in production

The category rows allocated a `72 × 88px` image frame at the reported `602px` viewport, but the image element used `width: 100%` and `height: 100%`. In the browser, the percentage height did not produce a reliable used height for portrait replaced elements inside this grid. Their intrinsic aspect ratios won instead:

| Category | Frame | Image before | Result |
| --- | ---: | ---: | --- |
| Kimikate pastrimi | `72 × 88px` | `72 × 92.80px` | Overflowed vertically |
| Lavanderi | `72 × 88px` | `72 × 116.75px` | Overflowed vertically |
| Hotelieri | `72 × 88px` | `72 × 96.53px` | Overflowed vertically |
| Shporta mbeturinash | `72 × 88px` | `72 × 103.61px` | Overflowed vertically |

The Lavanderi source is a transparent `370 × 600px` portrait WebP, so it exposed the issue most clearly; the defect was in the shared image-frame contract rather than in that asset alone.

## Implementation

The shared category image frame now:

- owns the full width of its grid track;
- clips any unexpected overflow as a defensive boundary;
- centers each product image in both axes;
- uses `object-fit: contain` and a centered object position;
- assigns explicit image dimensions at each existing responsive breakpoint instead of relying on a percentage height.

The resulting contracts are:

| Viewport range | Grid frame | Image box |
| --- | ---: | ---: |
| Up to `767px` | `72 × 88px` | `60 × 76px` |
| `768px`–`1020px` | `92 × 118px` | `80 × 96px` |
| Above `1020px` | `112 × 118px` | `96 × 102px` |

The image box deliberately leaves breathing room around the artwork. The bitmap remains undistorted because `object-fit: contain` scales the visible product within that box.

## Verification

The fix was first evaluated against the seven-category production dataset by applying the exact final CSS in an isolated browser session. Every image remained fully inside its frame at `390`, `602`, `768`, `1020`, `1280`, and `1512px` viewport widths.

At the reported mobile layout, all seven images measured `60 × 76px` inside `72 × 88px` frames, producing a consistent `6px` inset on every edge. A full visual screenshot confirmed the Lavanderi artwork no longer intersects either row divider and remains legible alongside the category copy.

The repository checks also passed:

- frontend ESLint;
- TypeScript project build;
- Vite production bundle;
- dev-server content and error-overlay checks;
- responsive DOM geometry checks for every category at all six viewport widths.

No product image, catalog data, API response, or database row was changed in this phase.

## Release-gate dependency remediation

The clean frontend branch starts from production `main`, whose lockfiles still resolved three transitive packages now blocked by the repository-wide audit gates:

- frontend `browserslist` `4.28.4`, affected by high-severity unbounded-memory and prototype-write advisories, is resolved to `4.28.8` through Dependabot's lockfile-only patch;
- backend `qs` `6.15.3` is resolved to `6.16.0` through Dependabot's lockfile-only parser and recursion-limit patch;
- backend development tooling's `fast-uri` `3.1.5` is resolved to `3.1.7`, clearing the host-confusion and SSRF advisories affecting versions below `3.1.6`.

These exact dependency resolutions had already passed the complete CI and CodeQL workflows on the MFA branch. They do not change a direct dependency declaration or application behavior. Including them keeps every security gate intact and allows the isolated visual correction to pass the same repository-wide frontend and backend checks required of every production change.
