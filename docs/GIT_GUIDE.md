# Git Guide

Recommended workflow for version-controlling this project. A `.gitignore`
already exists at the project root — `node_modules/`, build output and log
files are excluded.

> Note: the repository was **not** initialized by the automation; this guide
> only describes the recommended steps. No commits have been created.

## 1. Initialize

```bash
cd medication-scheduler
git init
git add .
git status          # check that node_modules/ is NOT listed
```

## 2. Recommended commits (phase by phase)

Make one commit per logical phase so the history tells the project story:

```bash
feat: initialize MediSync project
feat: add medication CRUD
feat: implement daily schedule generation
feat: add interaction rules and conflict detection
feat: implement automatic conflict resolution
feat: add dashboard and schedule status
docs: finalize project documentation
chore: add git guide and gitignore
feat: add email medication reminders (Phase 8)
```

(Adjust the exact wording to match how you actually built the project —
commit messages should describe the real work in each commit.)

## 3. Good commit message style

- Keep the subject line short and imperative (`feat:`, `fix:`, `docs:`,
  `chore:` prefixes).
- One commit = one logical change.
- Commit working, tested code — run `npm test` and the build first.

## 4. Useful commands

```bash
git status                     # what changed
git add <file>                 # stage a file
git commit -m "feat: ..."      # commit staged changes
git log --oneline              # review the history
```

## 5. What is ignored (`.gitignore`)

- `node_modules/` — installed dependencies (never commit these)
- `dist/` — frontend production build output
- `*.log` — runtime logs
- `.env` — secrets, if ever added
- OS / IDE files (`.DS_Store`, `.vscode/`, `.idea/`)

`server/db.json` is **not** ignored — it is the project's data file and
should be committed so the seeded demo data ships with the project.
