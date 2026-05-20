# Changelog

All notable changes to this project are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-20

### Changed
- Gated chatty `[extract]` logs behind `DEBUG_EXTRACT=true`. The user email
  is no longer logged on every extract call by default.
- Added Open Graph / Twitter card metadata to `index.html` so shared links
  render a proper preview.

### Added
- README hero demo video plus Dashboard / Applications / Kanban screenshots
  under `docs/screenshots/`.

### Docs
- Moved internal `OSS_PLAN.md` under `docs/internal/` so it stays out of the
  public repo root.
- Documented `DEBUG_EXTRACT` in `.env.example` and `docs/CONFIGURATION.md`.

## [0.1.1] - 2026-05-18

### Changed
- Renamed the project to **Jobvault**.
- Hardened AI provider configuration: stricter per-provider key handling and
  tightened rate limiting on `/api/extract`.

## [0.1.0] - 2026-05-16

Initial OSS release.

### Added
- Single-process Bun + Hono server serving the React SPA and REST API.
- SQLite storage via Drizzle ORM and `bun:sqlite`, with auto-applied migrations
  on boot.
- Multi-provider AI extraction (OpenAI, Anthropic, Google, MiniMax,
  OpenRouter, OpenAI-compatible) with env-wins / DB-fallback config and a
  Settings page for in-app provider/model/key management.
- Google OAuth + env/SQL allowlist for optional shared deployments. Default
  `AUTH_MODE=none` for single-user self-host; fail-closed in production unless
  `ALLOW_NO_AUTH=true` is explicit.
- Dashboard (streak, funnel, weekday heatmap), Applications grid with
  group/sort/filter and expandable rows, Kanban board with drag-and-drop, bulk
  paste + pending triage.
- Multi-arch Docker image (amd64 + arm64) published to GHCR, GitHub Actions
  CI, and OSS scaffolding (AGPL-3.0 license, CONTRIBUTING, CODE_OF_CONDUCT,
  SECURITY policy, issue/PR templates).

[Unreleased]: https://github.com/Mclovin0213/jobvault/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Mclovin0213/jobvault/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Mclovin0213/jobvault/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Mclovin0213/jobvault/releases/tag/v0.1.0
