# VibeTracker

Lightweight internal hackathon scoring and leaderboard web app.
**No authentication** — designed for trusted internal networks.

## Features

- **Event Customization**: Set event name, icon, tagline, and an optional **countdown timer**.
- **TV Mode**: Full-screen auto-refreshing leaderboard with countdown clock, team details, and pinned announcements.
- **Scoring Interface**: Interactive tile-based team selector with real-time status indicators.
- **Sample Data**: Automatically seeds with 3 sample teams and scores for immediate demonstration.
- **Announcements**: Create and pin announcements to display on the TV board.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or with auto-reload for development
npm run dev
```

The app runs at **http://localhost:3000** (or set `PORT` env variable).

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

SQLite database stored at `data/vibetracker.db`. Created automatically on first run with seed data (default event settings + 10 rubric criteria).

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
npm test
```

Covers scoring math, status computation, and ranking/tie-break logic.
