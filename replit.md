# Lacivert Teknoloji

Lacivert Teknoloji için ekip, pano ve kişisel görev yönetimi uygulaması.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the shared API server through its managed workflow
- `pnpm --filter @workspace/lacivert run dev` — run the frontend through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/lacivert` frontend app, mounted at `/`
- `artifacts/api-server/src/routes` auth, management, tasks, workspace API
- `lib/db/src/schema` PostgreSQL models
- `lib/api-spec/openapi.yaml` API contract, regenerate clients after changes
- User-supplied logos and visual reference are preserved in `.local/conversation-workspace/files/attached_assets`

## Architecture decisions

- Use PostgreSQL exclusively, including sessions and login throttling. The user explicitly requires PostgreSQL as the only database.
- Use local username/password authentication, explicitly requested by the user, rather than introducing social login.
- Company work is visible to authorized board participants and admins. Personal tasks stay private to their creator, including from admins.
- Team assignments require a named responsible person so an assigned task cannot become nobody's responsibility.
- First administrator is created through the one-time setup screen. No default credentials or automatic demo sign-in. PostgreSQL advisory locking prevents duplicate first administrators.
- Calendar dates are date-only values. Event timestamps are timezone-aware and displayed in Europe/Istanbul.

## Product

- Admins manage members, teams, boards and columns, and assign tasks to themselves, members or teams.
- Members create private self-assigned tasks and update progress on tasks assigned to them or their teams.
- Tasks support descriptions, priorities, dates, labels, checklists, comments and activity.
- Dashboard and notifications use real authorized workspace data.

## User preferences

- Brand: Lacivert Teknoloji. Use the supplied navy and white logos.
- Keep the Lacivert logo large and prominent in the navigation and login screen.
- The login screen must be minimal: a large logo and the login form, without decorative panels, slogans or unnecessary explanations.
- The supplied Mobbin document is a visual reference, not a request for a screenshot gallery or marketing site.
- Visible text is Turkish. Turkish uppercase conversion uses `toLocaleUpperCase("tr-TR")` where applicable.
- Do not use em dash or semicolon in user-visible text.
- Use plain, natural interface copy. Headings and short interface labels should start each word with a capital letter, respecting Turkish casing. Avoid decorative periods at the end of headings.
- For deadline shortcuts, “Hafta Sonu” means Friday, not Sunday. On Saturday or Sunday, use the upcoming Friday. Calculate shortcuts using Istanbul's current date.

## Gotchas

- Run schema push only against development. Do not add startup-time production DDL.
- First-run setup remains available only while there are no users. Complete setup before sharing a publicly accessible fresh deployment.
- Authentication cookies are HTTP-only, SameSite=Lax and secure on HTTPS. Passwords use Argon2id.
- Signed-in frontend screens require an actual account. Never add an auth bypass for screenshots.

## Ubuntu hosting requirements

- GitHub repository: https://github.com/j1vetr/lcteam.
- Domains: team.lacivertteknoloji.com and www.team.lacivertteknoloji.com.
- API port: 1453. Serve the built frontend through Nginx.
- Nginx site filenames must end in `.conf`. Let Certbot generate SSL configuration.
- Reuse the server's existing PM2 installation and account. Do not create multiple PM2 daemons or duplicate processes for this app.
- Configure PostgreSQL locally on Ubuntu, with generated credentials kept outside Git.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
