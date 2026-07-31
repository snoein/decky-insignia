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

## Combining / converting

```bash
magick shot1.jpg shot2.jpg +append combined.png   # side-by-side
convert shot.jpg shot.png                          # plain format conversion
```

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
