# Demo GIF Capture Guide

Use this guide to produce a high-conversion GitHub demo GIF.

## Target Output

- Duration: 12 to 20 seconds
- Resolution: 1280x720 or 1440x810
- File size: under 8 MB
- Focus: one end-to-end workflow, no dead time

## Suggested Storyboard

1. Open agent view
2. Submit a build request
3. Show Canvas code generation
4. Auto-switch to preview
5. Do one quick refine action

## Capture Tips

- Hide bookmarks and noisy extensions
- Use 125 percent browser zoom for readability
- Keep cursor movement intentional and slow
- Avoid long waits; trim idle sections

## Compression Tips

- Reduce frame rate (12 to 16 fps is usually enough)
- Limit dimensions before exporting GIF
- Prefer short clips over full-session captures

## Apply Demo in README

After exporting to `public/demo.gif`, run:

```powershell
pwsh ./scripts/prepare-demo-gif.ps1
```

This updates README to point from `demo-preview.svg` to `demo.gif`.
