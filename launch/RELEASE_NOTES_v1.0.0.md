# Quill AI v1.0.0 - Public Launch

Quill AI v1.0.0 is the first public launch release.

Quill AI is a personal AI agent plus builder canvas for research, writing, coding, and app/page artifact generation in one loop:
ask -> generate -> inspect -> refine.

## Highlights

- Personal AI agent experience with streaming chat
- Builder targets for `page`, `react-app`, and `nextjs-bundle`
- Canvas workflow for code plus preview iteration
- Dynamic social cards (Open Graph and Twitter)
- Public repo credibility pack:
  - README
  - MIT License
  - Contributing, Security, and Code of Conduct docs
  - Issue and PR templates

## Technical Improvements Included

- Hydration mismatch fixes on agent UI
- Empty assistant bubble suppression during streaming
- Improved abort handling with meaningful fallback behavior
- Better React bundle entry detection
- CSS and SCSS import handling in preview runtime
- Canvas UX improvements across generation, code, and preview flow

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Known Limitations

- Demo GIF placeholder should be replaced with a real capture at `public/demo.gif`
- Some hardening work remains in backlog (distributed rate limiting, billing integration)

## Repository

https://github.com/tovrr/quill-ai
