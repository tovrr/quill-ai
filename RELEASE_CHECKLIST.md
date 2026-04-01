# Release Checklist (Public Launch)

## 1. Final Repo Polish

- Ensure README demo media is updated (prefer public/demo.gif)
- Confirm LICENSE, CONTRIBUTING, SECURITY, and CODE_OF_CONDUCT are present
- Verify issue and PR templates are active

## 2. Quality Gates

- Run npm run typecheck
- Run npm run lint
- Run npm run build
- Confirm CI Smoke passes on main

## 3. Social Preview Validation

- Open /opengraph-image and /twitter-image locally
- Verify title, subtitle, and visual contrast
- Validate card previews after push using social debuggers

## 4. Launch Assets

- 12-20s product GIF (under 8 MB)
- 2 screenshots (agent flow + canvas preview)
- 1 short demo caption for X/LinkedIn

## 5. Publish Sequence

- Merge latest main
- Push release commit
- Create GitHub release notes with:
  - What Quill does
  - Key capabilities
  - Quick start commands
  - Known limitations

## 6. Distribution

- Post on X with demo GIF + repo link
- Post on LinkedIn with product story + use cases
- Share in indie dev communities with context, not just links

## 7. 24h Follow-Up

- Answer first issues quickly
- Label and triage bug reports
- Pin one high-value roadmap item for contributors
