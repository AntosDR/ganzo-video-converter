# Ganzo Video Converter

Ganzo Video Converter is a desktop media utility built with Electron, React,
and Swiper. It can extract an MP3 audio track or export selected video frames
as JPG images.

## Requirements

- Node.js 24 or newer
- npm 10 or newer

## Development

Install dependencies and start the application:

```bash
npm install
npm run dev
```

## Build and package

```bash
npm run build
npm run package
```

## Validation

```bash
npm run test:unit
npm run test:e2e
npm run test:smoke
```

FFmpeg is provided by `ffmpeg-static-electron`.

Format conversion, watermarking, and audio replacement are not available yet.

## Documentation

All project documentation lives in [`docs/`](docs/). Only `README.md` and `AGENTS.md` remain in the repository root.

- [Application Navigation](docs/navigation.md)
- [Feature & Navigation Roadmap](docs/feature-roadmap.md)
