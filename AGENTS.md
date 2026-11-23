# Agent Instructions

## Project

Ganzo Video Converter is an Electron desktop app built with React and TypeScript. The application source is under `src/`. Current extraction features are MP3 audio and JPG video frames.

## Code and architecture

- Document exported types, functions, classes, React components, and non-obvious behavior with concise TSDoc. Prefer TSDoc to inline comments.
- Keep media processing and filesystem access in the Electron main process. The renderer must use the narrow API exposed by `src/main/preload.ts`; preserve context isolation, sandboxing, and IPC sender validation.
- Keep the main project dependencies in sync with `package-lock.json`. `.erb/tooling` is intentionally isolated from the root TypeScript 7 install because some tooling still requires the TypeScript 6 compiler API.
- Do not add credentials or enable release publishing without explicit configuration.

## Validation

- `npm run lint`
- `npm exec tsc -- --noEmit`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:smoke`
- `npm run build`
