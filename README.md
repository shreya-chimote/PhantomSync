# PhantomSync AI 🚀
### Offline-First Intelligent Notes Application with Optimistic Concurrency & AI Conflict Reconciliation

PhantomSync AI is an enterprise-grade, offline-first notes system built with **React (Vite)**, **IndexedDB**, **Node.js (Express)**, and **MongoDB (with embedded in-memory fallback)**.

It demonstrates production-grade distributed systems patterns: **Optimistic Concurrency Control (OCC)**, **Outbox Queue Synchronization**, **Tombstone Deletions**, **Idempotent Batch Replays**, **Immutable Version History**, and **3-Way AI-Powered Conflict Resolution**.

---

## 🌟 Key Features

1. **True Offline-First Architecture**:
   - Notes are immediately written to local browser storage (**IndexedDB**) with 0ms latency.
   - Edits made while offline are queued in an offline Outbox (`syncQueue`).
   - Automatically synchronizes with the server when network connectivity returns.
2. **Deterministic Conflict Detection (OCC)**:
   - Uses document versioning ($v1 \to v2 \to v3$) to detect concurrent edits.
   - Stale writes from offline clients return `HTTP 409 Conflict`.
   - **Zero silent overwrites**: Both conflicting versions are preserved.
3. **Interactive Side-by-Side Conflict Resolution**:
   - Compares your offline edits directly against current server state.
   - **Keep Local Version**: Overrides remote using the latest server version as base.
   - **Keep Server Version**: Discards local conflict and accepts server state.
   - **Manual Merge Editor**: Live editor to combine text line-by-line.
   - **AI-Powered Merge Suggestion**: Intelligently reconciles edits into a unified draft with zero API keys required (optional Gemini / OpenAI LLM support).
4. **Time Travel Version History**:
   - Every revision is immutably snapshotted in `NoteHistory`.
   - Point-in-time restore creates a new revision without destroying history.
5. **Network Resilience & Idempotency**:
   - Each queued operation carries a unique `idempotencyKey` preventing duplicate execution on network drops and retries.
   - Includes a built-in **Network Simulator Toggle** in the navbar to test offline and online behavior with a single click.

---

## 🏗️ Architecture

```
                                [ PHANTOMSYNC ARCHITECTURE ]

 ┌───────────────────────────────────────────────────────────────────────────┐
 │                         CLIENT LAYER (React 19 + Vite)                    │
 │                                                                           │
 │   [ UI: Editor, NoteList, Conflict Modal, Version History Drawer ]        │
 │                                │                                          │
 │               ┌────────────────┴────────────────┐                         │
 │               ▼                                 ▼                         │
 │      [ Local DB: IndexedDB ]            [ SyncManager Coordinator ]       │
 │        - 'notes' Store                   - Heartbeat Sync (15s)           │
 │        - 'syncQueue' (Outbox)            - Offline/Online Listener        │
 │        - 'metadata'                      - Network Simulator Toggle       │
 └───────────────────────┬─────────────────────────┬─────────────────────────┘
                         │                         │
                         │ HTTP REST               │ HTTP POST /api/sync/batch
                         ▼                         ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                         SERVER LAYER (Express + Node.js)                  │
 │                                                                           │
 │   - Note Controller (CRUD + OCC Versioning)                               │
 │   - Sync Controller (Idempotent Batch Processing & Delta Replication)     │
 │   - AI Merge Engine (Deterministic 3-Way Diff + Optional Gemini LLM)      │
 │   - History Controller (Immutable Snapshots & Point-in-Time Restore)      │
 │                                                                           │
 │                       [ DATABASE ADAPTER LAYER ]                          │
 │                                    │                                      │
 │                  ┌─────────────────┴─────────────────┐                    │
 │                  ▼                                   ▼                    │
 │         [ MongoDB / Atlas ]              [ Embedded In-Memory Store ]     │
 │       (if MONGODB_URI active)            (Zero-config local fallback)     │
 └───────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Windows Setup)

### Prerequisites
- **Node.js** (v18+ or v24+ recommended)
- **PowerShell** (Windows standard terminal)

> **Note on Windows Execution Policies**: If running `.ps1` scripts is disabled on your system, execute npm commands using `npm.cmd` as shown below.

### 1. Installation
In the project root folder:
```powershell
# Install server dependencies
npm.cmd --prefix server install

# Install client dependencies
npm.cmd --prefix client install
```

### 2. Configure Environment (Optional)
A preconfigured `.env` is already provided in `server/.env`.
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/phantomsync
CLIENT_URL=http://localhost:5173
AI_PROVIDER=built-in
GEMINI_API_KEY=
```
> **Zero-Config Database**: If you do not have MongoDB installed or running locally, the server **automatically detects this and switches to the built-in high-performance memory store**. No manual MongoDB installation is required!

### 3. Run the Application
Open two PowerShell terminals:

**Terminal 1 (Backend Server):**
```powershell
npm.cmd run server
# Server starts on http://localhost:5000
```

**Terminal 2 (Frontend Client):**
```powershell
npm.cmd run client
# Vite app opens on http://localhost:5173
```

Now open your browser and navigate to:
👉 **`http://localhost:5173`**

---

## 🧪 Running Automated Tests

PhantomSync AI includes a suite of integration and unit tests covering:
- Optimistic Concurrency Control (OCC) conflicts
- Batch offline replay & idempotency key deduplication
- Soft-delete tombstones
- Immutable revision history and point-in-time restore
- AI 3-way merge without external API keys

Run the test suite with:
```powershell
npm.cmd test
```

Expected output:
```
PASS tests/sync.test.js
PASS tests/history.test.js
PASS tests/notes.test.js
PASS tests/conflict.test.js
PASS tests/aiMerge.test.js
PASS tests/clientSyncReconciliation.test.js

Test Suites: 6 passed, 6 total
Tests:       13 passed, 13 total
```

---

## 💡 How to Test Offline Sync & Conflict Resolution

### Scenario A: Offline Note Creation & Auto-Sync
1. Open `http://localhost:5173`.
2. Click the **"Online"** pill in the top navbar to toggle **"Offline (Simulated)"**.
3. Notice the amber alert banner appears: *Offline Mode Active — All edits are saved locally in IndexedDB*.
4. Click **"New Note"**, title it *"Drafted on Airplane"*, and write some text.
5. Notice the card has an **"Offline Saved"** badge and the navbar shows `1 change queued`.
6. Click the navbar toggle back to **"Online"**.
7. The system automatically replays the Outbox queue to the server; the badge turns to a green **"Synced"**.

### Scenario B: Triggering & Resolving a Merge Conflict
1. With a synced note open, open a second browser window or private tab to `http://localhost:5173`.
2. In Window 1, toggle **"Offline (Simulated)"** and change the text to *"Updated offline by User 1"*.
3. In Window 2 (Online), update the same note's text to *"Updated online by User 2"* and let it sync.
4. Now in Window 1, toggle back to **"Online"** and click **"Sync Now"**.
5. **Conflict detected!** The server detects that Window 1 submitted an edit based on an older version ($v1$) while the server is already at $v2$.
6. A pulsing red **Conflict!** badge and modal appears with:
   - Left side: Your local offline version.
   - Right side: Server remote version.
   - Button: **"Generate AI Merge Suggestion"** (synthesizes both without data loss).
   - Options to **"Keep My Version"**, **"Keep Server Version"**, or **"Approve & Apply AI Merge"**.
7. Choose any resolution strategy and watch the note advance to revision $v3$ cleanly!

---

## 📂 Project Structure

```
PhantomSync-AI/
├── package.json                   # Root orchestrator scripts
├── README.md                      # Comprehensive guide & interview prep
├── server/
│   ├── package.json               # Server dependencies (Express, Mongoose, Jest)
│   ├── .env.example               # Environment template
│   ├── .env                       # Active server environment
│   ├── src/
│   │   ├── server.js              # Server bootstrapper & graceful shutdown
│   │   ├── app.js                 # Express app, middleware, routes
│   │   ├── config/
│   │   │   ├── db.js              # Dual-mode database connection manager
│   │   │   └── memoryStore.js     # Zero-config embedded in-memory MongoDB store
│   │   ├── models/
│   │   │   ├── Note.js            # Note schema (OCC versioning + tombstones)
│   │   │   ├── NoteHistory.js     # Snapshot revisions collection
│   │   │   └── SyncLog.js         # Idempotency cache for retries
│   │   ├── services/
│   │   │   └── aiMergeService.js  # 3-way reconciliation engine & Gemini fallback
│   │   ├── controllers/
│   │   │   ├── noteController.js  # REST CRUD, OCC validation, restore
│   │   │   ├── syncController.js  # Batch replay & delta sync
│   │   │   └── aiController.js    # AI merge suggestions
│   │   └── routes/
│   │       ├── noteRoutes.js
│   │       ├── syncRoutes.js
│   │       └── aiRoutes.js
│   └── tests/
│       ├── setup.js               # Isolated test database runner
│       ├── notes.test.js          # CRUD & soft-delete tests
│       ├── conflict.test.js       # OCC 409 conflict detection tests
│       ├── sync.test.js           # Batch sync & idempotency tests
│       ├── history.test.js        # Revisions & time travel tests
│       ├── aiMerge.test.js        # 3-way merge algorithm tests
│       └── clientSyncReconciliation.test.js # Client reconciliation rules
└── client/
    ├── package.json               # Frontend dependencies (React 19, Vite, idb)
    ├── vite.config.js             # Vite config with API reverse proxy
    ├── index.html                 # App entry HTML
    └── src/
        ├── main.jsx               # React DOM root
        ├── App.jsx                # Layout, modals, and state coordination
        ├── index.css              # Custom styling & design tokens
        ├── db/
        │   └── indexedDb.js       # IndexedDB storage layer (notes, outbox, metadata)
        ├── services/
        │   ├── api.js             # API wrapper with network failure isolation
        │   └── syncManager.js     # Central offline sync coordinator
        ├── hooks/
        │   └── useNotes.js        # Reactive hook for notes and sync state
        └── components/
            ├── Navbar.jsx         # Header with network simulator & sync trigger
            ├── OfflineBanner.jsx  # Status alert for offline mode
            ├── NoteList.jsx       # Sidebar cards, search, and filters
            ├── NoteEditor.jsx     # Live editor with auto-save & history trigger
            ├── SyncStatusBadge.jsx# Status indicators (Synced, Offline, Conflict)
            ├── ConflictResolverModal.jsx # Side-by-side comparison & AI merge
            └── VersionHistoryModal.jsx   # Point-in-time restore drawer
```

---

## 🎓 SDE Interview Deep-Dive (Technical Q&A)

### 1. What does "Offline-First" really mean?
In traditional web apps, the network is on the critical path: user clicks "Save" $\to$ UI freezes $\to$ network request $\to$ response $\to$ UI updates. If network drops, data is lost.
In **PhantomSync AI**, **local storage (IndexedDB) is the primary source of truth for the UI**. Edits write to IndexedDB with 0ms latency. The network sync happens asynchronously in the background.

### 2. How is concurrency handled? (OCC vs LWW vs CRDT)
- **Last-Write-Wins (LWW)**: Clocks decide who wins (`timestamp > otherTimestamp`).
  *Danger*: Clock drift can cause silent data loss where a user's paragraph is silently overwritten!
- **CRDTs (Conflict-free Replicated Data Types)**: Mathematically guaranteed convergence at character level.
  *Tradeoff*: Significant memory overhead, high complexity for metadata/titles.
- **Optimistic Concurrency Control (OCC) with 3-Way Merge (PhantomSync's Approach)**:
  - Document stores an integer `version`.
  - When editing, client specifies `baseVersion`.
  - If server has `version > baseVersion`, the server refuses to overwrite, returns `HTTP 409 Conflict`, and yields both versions so the user (assisted by AI) can reconcile them.

### 3. Why are deletions soft (Tombstones)?
If Client A deletes Note 1 while offline and Client B edits Note 1, a hard deletion (`db.collection.deleteOne()`) would cause Note 1 to vanish. When Client A syncs, how does the server know Note 1 was deleted versus never existing?
**Solution**: We set `isDeleted: true` and increment the version. The deletion propagates across all devices during delta sync.

### 4. How are network retries and duplicate requests handled safely?
Every client operation generates a UUID `idempotencyKey`. The server checks the `SyncLog` collection:
- If the key exists: return the previously computed response immediately without repeating database mutations.
- If the key is new: execute the mutation and cache the result in `SyncLog`.
This ensures at-most-once semantics even when requests are retried over unstable networks.
