# VibeTracker

Lightweight internal hackathon scoring and leaderboard web app.
**No authentication** — designed for trusted internal networks.

**Live:** [vibetracker-nine.vercel.app](https://vibetracker-nine.vercel.app)

## Features

- **Event Customization**: Set event name, icon, tagline, and an optional **countdown timer**.
- **TV Mode**: Full-screen auto-refreshing leaderboard with countdown clock, team details, and pinned announcements.
- **Scoring Interface**: Interactive tile-based team selector with real-time status indicators.
- **Sample Data**: Automatically seeds with 3 sample teams and scores for immediate demonstration.
- **Announcements**: Create and pin announcements to display on the TV board.

## Tech Stack

- **Runtime:** Node.js + Express
- **Database:** [Turso](https://turso.tech) (libSQL / SQLite-compatible cloud database)
- **Package Manager:** pnpm
- **Hosting:** [Vercel](https://vercel.com) (serverless functions)
- **Frontend:** Vanilla HTML/CSS/JS (SPA-style client-side routing)

## Quick Start

### Local Development

```bash
# Install dependencies
pnpm install

# Start the server
pnpm start

# Or with auto-reload for development
pnpm dev
```

The app runs at **http://localhost:3000** (or set `PORT` env variable).

By default, the app uses a **local SQLite file** at `data/vibetracker.db`. To connect to Turso instead, set environment variables:

```bash
export TURSO_DATABASE_URL="libsql://your-database.turso.io"
export TURSO_AUTH_TOKEN="your-auth-token"
```

### Deploying to Vercel

The project is configured for Vercel deployment with a serverless function entry point at `api/index.js`.

**Required environment variables** (set in Vercel dashboard or CLI):

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | Your Turso database URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso authentication token |

```bash
# Deploy to production
vercel deploy --prod
```

The GitHub repo is connected — pushing to `main` triggers automatic deployments.

## Routes

| Route    | Purpose                              |
|----------|--------------------------------------|
| `/setup` | Configure event, teams, rubric, announcements |
| `/score` | Enter scores per team (1–10 per criterion)    |
| `/tv`    | Full-screen leaderboard for TV display        |

## Scoring Model

**10 criteria** scored 1–10 each:

- **Business (1–5):** Problem importance · Value & ROI · Customer/UX · Strategic alignment · Innovation
- **Technical (6–10):** Architecture · AI correctness · Security/compliance · Reliability · Ship-ability

**Ranking:** Total desc → Business subtotal desc → Technical subtotal desc → Team name asc

## Data

The database is powered by [Turso](https://turso.tech) (libSQL), a SQLite-compatible edge database. Locally, it falls back to a SQLite file at `data/vibetracker.db`.

Tables are created automatically on first run and seeded with sample data (default event settings, 10 rubric criteria, 3 sample teams with scores, and 2 announcements).

## API Endpoints

| Method   | Endpoint                  | Description             |
|----------|---------------------------|-------------------------|
| `GET`    | `/api/settings`           | Get event settings      |
| `PUT`    | `/api/settings`           | Update event settings   |
| `GET`    | `/api/teams`              | List all teams          |
| `POST`   | `/api/teams`              | Create team             |
| `PUT`    | `/api/teams/:id`          | Update team             |
| `DELETE` | `/api/teams/:id`          | Delete team             |
| `GET`    | `/api/rubric`             | Get rubric criteria     |
| `PUT`    | `/api/rubric`             | Bulk update rubric      |
| `GET`    | `/api/scores`             | All teams with scores + ranks |
| `GET`    | `/api/scores/:teamId`     | Single team scores      |
| `PUT`    | `/api/scores/:teamId`     | Update team scores      |
| `GET`    | `/api/announcements`      | List announcements      |
| `POST`   | `/api/announcements`      | Create announcement     |
| `PUT`    | `/api/announcements/:id`  | Update announcement     |
| `DELETE` | `/api/announcements/:id`  | Delete announcement     |

## Tests

```bash
pnpm test
```

Covers scoring math, status computation, and ranking/tie-break logic.

## Project Structure

```
VibeTracker/
├── api/
│   └── index.js          # Vercel serverless entry point
├── db/
│   └── database.js       # Turso/libSQL database layer
├── lib/
│   └── scoring.js        # Score computation & ranking logic
├── public/
│   ├── css/style.css     # Application styles
│   ├── js/               # Client-side JavaScript (SPA)
│   └── index.html        # Main HTML shell
├── routes/
│   ├── announcements.js  # Announcements CRUD
│   ├── rubric.js         # Rubric criteria management
│   ├── scores.js         # Score entry & leaderboard
│   ├── settings.js       # Event configuration
│   └── teams.js          # Team management
├── tests/
│   └── scoring.test.js   # Unit tests
├── server.js             # Express app
├── vercel.json           # Vercel deployment config
├── .npmrc                # pnpm config (hoisted for Vercel)
└── package.json
```
