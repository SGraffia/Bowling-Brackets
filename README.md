# Bowling-Brackets

## Step-by-step Guide to run in Docker:
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