# Store image (`plugin.json` → `publish.image`)

## Requirements

- **Filetype**: PNG (the store backend also accepts JPEG/WebP/AVIF, but PNG is the documented
  expectation).
- **Resolution/size**: no enforced limit — any reasonable screenshot resolution is fine.
- Must be a URL the store's CI can actually fetch over HTTP *before* you submit — a broken or
  unreachable URL fails the PR outright.

## Capturing screenshots

1. In Gaming Mode, open whatever you want to capture (QAM panel, library-page badge, home-tile
   badge).
2. Press **Steam + R1**.
3. Saved as `.jpg` on the Deck under:
   ```
   ~/.local/share/Steam/userdata/<steamid>/760/remote/<appid>/screenshots/
   ```

## Downloading

Reuses the SSH key/connection already set up for the `builddeploy`/`deploy` VSCode tasks
(`.vscode/settings.json`):

```bash
ssh -i ~/.ssh/id_rsa deck@<deckip> \
  "find ~/.local/share/Steam/userdata/*/760/remote -name '*.jpg' -newermt '-5 minutes'"
scp -i ~/.ssh/id_rsa deck@<deckip>:"<path-from-above>" images/
```

## Building the composite

Layout: a hero screenshot (`library-page-badge.jpg`) fills the whole canvas: two large circular
insets sit at the bottom, bleeding off the left/right/bottom edges, each showing a crop of
another screenshot with a colored ring border. Left inset = `home-tile-badge.jpg` (home-grid
tile + Insignia badge); right inset = `qam-active-games.jpg` (QAM sidebar). `qam-events.jpg`
isn't used in the current composite but is available in `images/` as a fourth option if you
want to swap one of the insets for it.

Requires Pillow (`python3 -c "import PIL"` — already available in this repo's environment).

```python
from PIL import Image, ImageDraw

W, H = 1280, 800
hero = Image.open("images/library-page-badge.jpg").convert("RGB").resize((W, H), Image.LANCZOS)

def circular_inset(src_path, box, diameter, ring_color=(26,159,255), ring_width=8):
    src = Image.open(src_path).convert("RGB")
    crop = src.crop(box)
    w, h = crop.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    crop = crop.crop((left, top, left + side, top + side)).resize((diameter, diameter), Image.LANCZOS)

    mask = Image.new("L", (diameter, diameter), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, diameter, diameter), fill=255)

    ring_layer = Image.new("RGBA", (diameter, diameter), (0,0,0,0))
    ImageDraw.Draw(ring_layer).ellipse((0,0,diameter-1,diameter-1), outline=ring_color, width=ring_width)

    return crop, mask, ring_layer

canvas = hero.convert("RGBA")

DIAM = 700
left_center  = (200, 550)   # (canvas x, canvas y) of each circle's center
right_center = (1030, 620)

left_box  = (74, 160, 714, 800)   # (left, top, right, bottom) crop taken from the source image
right_box = (480, 0, 1280, 800)   # gets center-cropped to square, then resized to DIAM

for center, box, src_key in [
    (left_center, left_box, "images/home-tile-badge.jpg"),
    (right_center, right_box, "images/qam-active-games.jpg"),
]:
    crop, mask, ring = circular_inset(src_key, box, DIAM)
    top_left = (center[0] - DIAM // 2, center[1] - DIAM // 2)
    canvas.paste(crop, top_left, mask)
    canvas.alpha_composite(ring, top_left)

canvas.convert("RGB").save("publish-image.png", "PNG")
```

### Tuning it for new screenshots

The four knobs are `DIAM` (circle size), `left_center`/`right_center` (where the circles sit on
the 1280×800 canvas), and `left_box`/`right_box` (which region of the source screenshot each
circle shows — always cropped to a square first). Everything is trial and error: change a
number, re-run, re-view the PNG, adjust. Things learned doing this the first time:

- **A screenshot is only 800px tall**, so any `box` is capped at 800×800 — you can't "zoom out"
  a circle's content past that no matter how big `DIAM` is. Hitting this cap means widening the
  circle further just re-shows the same crop bigger, it doesn't reveal more surrounding content.
- **Circle bottom can silently exceed the canvas.** `paste()` clips whatever falls outside the
  1280×800 canvas with no warning, so a badge/element positioned too low in a `box` (relative to
  the resulting circle size/position) just vanishes off the bottom — check by cropping the saved
  PNG near where it should be (`im.crop((x0,y0,x1,y1))`) rather than trusting the full-image
  preview alone.
- **Three things fight each other on the left circle**: keeping the hero image's own logo/text
  uncovered (wants the circle's top edge low, i.e. large `center[1]`), keeping a low-down badge
  in frame (wants the top edge high, i.e. small `center[1]`), and zooming out for more
  surrounding context (enlarges `box`, which pushes low-down content even further past the
  canvas bottom at a fixed circle position). There's no single setting that maximizes all three
  — pick two and compromise on the third for the current screenshot's composition.
- **Panning `box` can't fix content that's clipped by the canvas edge.** If content is falling
  outside the 1280×800 canvas, moving `box` around inside the source image doesn't help — the
  clip happens at the canvas boundary, not the source boundary. The only fixes are moving that
  circle's `center`, changing `DIAM`, or accepting the crop.
- **A circle only fully reaches the canvas edge across its whole height if the center is pushed
  far enough past that edge** (near the corner, not just past the flat edge) — otherwise there's
  a visible background gap near the top/bottom of the circle even though it "bleeds off" at its
  vertical center. Moving a circle sideways to fix this shifts its content sideways too; there's
  only room to compensate by re-panning `box` if the crop isn't already anchored at the source
  image's own edge (once `box` hits `0` or the source's width/height, there's no slack left).

## Wiring it into `plugin.json`

1. Save the final image as `publish-image.png` at the repo root.
2. Commit and **push** it to `origin/main` (`raw.githubusercontent.com` only serves what's
   actually pushed).
3. Set `publish.image` to:
   ```
   https://raw.githubusercontent.com/snoein/decky-insignia/main/publish-image.png
   ```
4. Verify before submitting:
   ```bash
   curl -sI https://raw.githubusercontent.com/snoein/decky-insignia/main/publish-image.png
   ```
   Expect `HTTP/2 200` and `content-type: image/png`.
