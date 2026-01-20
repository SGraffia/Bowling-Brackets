# Bowling-Brackets

A bowling league bracket management system with user registration, admin approval workflow, and prize pool calculation.

## Table of Contents
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Core Functions](#core-functions)
- [Data Structures](#data-structures)
- [Docker Guide](#docker-guide)

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template and configure
cp .env.example .env
# Edit .env with your secrets

# Initialize data file
cp data/data.json.example data/data.json

# Start server
npm start
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `BUY_IN` | Buy-in amount per bowler ($) | `5` |
| `MAX_BOWLERS` | Maximum bowlers per bracket | `8` |
| `NODE_ENV` | Environment (`development`/`production`) | `development` |
| `ADMIN_SECRET` | Secret key for admin registration | **Required** |
| `SESSION_SECRET` | Secret for session encryption | Auto-generated |

---

## API Reference

### Authentication Routes

#### `GET /login`
Renders the login page.

#### `POST /login`
Authenticates a user.

**Request Body:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | User's name |
| `lane` | number | Lane number (1-100) |
| `password` | string | User's password |

**Responses:**
| Status | Description |
|--------|-------------|
| `302` | Redirect to `/dashboard` on success |
| `400` | Missing required fields |
| `401` | Invalid credentials |
| `429` | Rate limit exceeded (5 attempts/15 min) |

**Example:**
```bash
curl -X POST http://localhost:3000/login \
  -d "name=John Doe&lane=5&password=mypassword"
```

#### `GET /logout`
Destroys the session and redirects to login.

---

### Registration Routes

#### `GET /register`
Renders the user registration page.

#### `POST /register`
Registers a new bowler (requires admin approval).

**Request Body:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | User's name (max 100 chars) |
| `lane` | number | Lane number (1-100) |
| `password` | string | Password (min 8 chars) |
| `average` | number | Bowling average (0-300) |

**Responses:**
| Status | Description |
|--------|-------------|
| `302` | Redirect to `/login` on success |
| `400` | Invalid input |
| `409` | User with same name/lane exists |
| `429` | Rate limit exceeded |

**Example:**
```bash
curl -X POST http://localhost:3000/register \
  -d "name=Jane Doe&lane=10&password=securepass123&average=180"
```

#### `GET /admin/register`
Renders the admin registration page.

#### `POST /admin/register`
Registers a new admin user.

**Request Body:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Admin's name |
| `lane` | number | Lane number (1-100) |
| `password` | string | Password (min 8 chars) |
| `average` | number | Bowling average (0-300) |
| `secret` | string | Admin secret from environment |

**Responses:**
| Status | Description |
|--------|-------------|
| `200` | Success message |
| `400` | Invalid input |
| `403` | Invalid admin secret |
| `409` | User already exists |
| `500` | Server configuration error |

---

### Protected Routes

#### `GET /dashboard`
Displays user dashboard with brackets. **Requires authentication.**

**Response:** Renders `dashboard.ejs` with:
- `user` - Current user object
- `brackets` - Array of bracket objects
- `data` - Full data object (for admin views)

#### `POST /admin/approve/:userId`
Approves a user's buy-in. **Requires admin authentication.**

**URL Parameters:**
| Parameter | Description |
|-----------|-------------|
| `userId` | UUID of user to approve |

**Responses:**
| Status | Description |
|--------|-------------|
| `302` | Redirect to `/dashboard` on success |
| `403` | Admin access required |
| `404` | User not found |

**Example:**
```bash
curl -X POST http://localhost:3000/admin/approve/ca515e93-14ad-4997-9ee9-08ac0acde755 \
  --cookie "connect.sid=your-session-cookie"
```

---

## Core Functions

### server.js

#### `rateLimiter(req, res, next)`
Express middleware that limits authentication attempts.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `req` | Request | Express request object |
| `res` | Response | Express response object |
| `next` | Function | Next middleware function |

**Behavior:**
- Tracks attempts by IP address
- Allows 5 attempts per 15-minute window
- Returns `429` status when limit exceeded

**Example:**
```javascript
app.post('/login', rateLimiter, async (req, res) => {
  // Login logic
});
```

---

#### `readData(): Promise<Object>`
Reads and parses the JSON data file asynchronously.

**Returns:** `Promise<Object>` - Parsed data with `registrations` and `brackets` arrays

**Throws:** Error if file cannot be read (except ENOENT, which initializes empty data)

**Example:**
```javascript
const data = await readData();
console.log(data.registrations.length); // Number of users
```

---

#### `writeData(data): Promise<void>`
Writes data object to JSON file asynchronously.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `data` | Object | Data object to persist |

**Example:**
```javascript
const data = await readData();
data.registrations.push(newUser);
await writeData(data);
```

---

#### `requireAuth(req, res, next)`
Middleware that ensures user is authenticated.

**Behavior:**
- Checks `req.session.userId` exists
- Redirects to `/login` if not authenticated

**Example:**
```javascript
app.get('/dashboard', requireAuth, async (req, res) => {
  // Only authenticated users reach here
});
```

---

#### `requireAdmin(req, res, next): Promise<void>`
Async middleware that ensures user is an authenticated admin.

**Behavior:**
- Checks session exists
- Verifies user has `isAdmin: true`
- Returns `403` if not admin

**Example:**
```javascript
app.post('/admin/approve/:id', requireAdmin, async (req, res) => {
  // Only admins reach here
});
```

---

#### `sanitizeString(str): string`
Sanitizes string input for safe storage.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `str` | any | Input to sanitize |

**Returns:** Trimmed string, max 100 characters. Returns empty string for non-strings.

**Example:**
```javascript
sanitizeString('  John Doe  ');     // 'John Doe'
sanitizeString(null);               // ''
sanitizeString('a'.repeat(200));    // 'aaa...' (100 chars)
```

---

#### `validateNumber(val, min, max): number|null`
Validates and converts input to number within range.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `val` | any | Value to validate |
| `min` | number | Minimum allowed value |
| `max` | number | Maximum allowed value |

**Returns:** Number if valid, `null` if invalid or out of range.

**Example:**
```javascript
validateNumber('42', 1, 100);   // 42
validateNumber('150', 1, 100);  // null (out of range)
validateNumber('abc', 1, 100);  // null (not a number)
```

---

### bracket.js

#### `createBrackets(registrations, maxBowlers, buyIn): Array<Bracket>`
Creates bracket groups from approved registrations.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `registrations` | Array | All user registration objects |
| `maxBowlers` | number | Max bowlers per bracket |
| `buyIn` | number | Buy-in amount per bowler |

**Returns:** Array of bracket objects

**Behavior:**
- Filters only approved bowlers
- Groups into brackets of `maxBowlers` size
- Fills incomplete brackets with placeholder IDs

**Example:**
```javascript
const brackets = createBrackets(data.registrations, 8, 5);
// Returns: [{ id: 'bracket-1', bowlers: [...], prizePool: {...} }]
```

---

#### `calculatePrizePool(numBowlers, buyIn): PrizePool`
Calculates prize distribution for a bracket.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `numBowlers` | number | Number of bowlers in bracket |
| `buyIn` | number | Buy-in amount per bowler |

**Returns:** Prize pool object

**Example:**
```javascript
calculatePrizePool(8, 5);
// Returns: { total: 40, firstPlace: 35, secondPlace: 5 }
```

---

### utils/snapshot.js

#### `generateWeeklySnapshot(brackets, registrations): Array<SnapshotBracket>`
Generates a snapshot of all brackets with bowler details.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `brackets` | Array | Array of bracket objects |
| `registrations` | Array | Array of user registrations |

**Returns:** Array of snapshot objects with resolved bowler data

**Example:**
```javascript
const snapshot = generateWeeklySnapshot(data.brackets, data.registrations);
// Returns detailed bracket info with bowler names and scores
```

---

#### `createBowlerPDF(snapshot, bowlerId): string`
Generates a PDF document from snapshot data.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `snapshot` | Array\|Object | Snapshot data (array for all brackets, object for single bowler) |
| `bowlerId` | string | Bowler ID for filename |

**Returns:** File path to generated PDF

**Example:**
```javascript
const pdfPath = createBowlerPDF(snapshot, 'bowler-123');
// Returns: '/path/to/data/snapshot_bowler-123_1695219200000.pdf'
```

---

## Data Structures

### User Object
```javascript
{
  id: string,           // UUID
  name: string,         // Display name
  lane: number,         // Lane number (1-100)
  passwordHash: string, // bcrypt hash
  average: number,      // Bowling average (0-300)
  approved: boolean,    // Admin approval status
  games: Array,         // Game scores
  scoresLocked: boolean,
  isAdmin?: boolean     // Only for admin users
}
```

### Bracket Object
```javascript
{
  id: string,           // 'bracket-1', 'bracket-2', etc.
  bowlers: string[],    // Array of user IDs
  status: string,       // 'open', 'closed'
  buyIn: number,        // Buy-in amount
  prizePool: {
    total: number,
    firstPlace: number,
    secondPlace: number
  }
}
```

### Data File Structure (data/data.json)
```javascript
{
  registrations: User[],
  brackets: Bracket[]
}
```

---

## Docker Guide

### Step-by-step Guide to run in Docker:
1️⃣ Build the Docker Image

From the root of your project (bowling-league/):

docker-compose build


This will:

Pull the Node.js image

Install dependencies (npm install)

Copy your app code into the container

2️⃣ Start the App
docker-compose up


Exposes port 3000 (or whatever you set in .env)

Mounts data/, views/, and public/ so changes are live

App logs will appear in your terminal

3️⃣ Access the App

Open your browser:

http://localhost:3000


Login page → login with userId from data/data.json (e.g., bowler1)

Register page → add new bowlers (for testing)

Dashboard → see brackets, submit scores, download snapshots

4️⃣ Generate Snapshots
Bowler Snapshot

Log in as a bowler (e.g., bowler1)

Click “Download My Bracket” → generates PDF in data/ folder

Admin Snapshot

Log in as the admin (or any admin placeholder)

Click “Download Weekly Snapshot” → generates PDF in data/ folder

5️⃣ Persistent Storage

Because docker-compose.yml mounts data/:

volumes:
  - ./data:/usr/src/app/data


All user registrations, scores, and snapshots persist even if the container is stopped or rebuilt

6️⃣ Optional: Run in Detached Mode
docker-compose up -d


App runs in the background

Use docker-compose logs -f to watch logs

7️⃣ Access PDFs

Generated PDFs are saved in:

bowling-league/data/


Example: snapshot_bowler1_1695219200000.pdf

Admin snapshot example: snapshot_admin_1695219200000.pdf