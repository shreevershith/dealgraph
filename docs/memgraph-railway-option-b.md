# Memgraph on Railway (Option B) — Step-by-step

Use the same Railway project as your backend. Internal hostnames use the form **`<service-name>.railway.internal`**. Name the Memgraph service **`memgraph`** so the backend can use `bolt://memgraph.railway.internal:7687`.

---

## B.1 — Add the Memgraph service

1. In your Railway project, click **+ New** → **Service** (or **Add Service**).
2. Choose **Deploy from GitHub repo** and select this repo (same as your backend).
3. After the service is created, open its **Settings**.
4. Set **Root Directory** to **`memgraph`** (the folder that contains the Memgraph Dockerfile in this repo). Save.
5. **Rename the service** to **`memgraph`** (Settings → Service name, or the name field at the top). This makes the internal hostname `memgraph.railway.internal`.
6. Trigger a deploy (or push a commit). Wait until the Memgraph service is **Running**. No need to add a public domain; the backend will use private networking.

**Alternative (no repo root):** Add a new service and choose **Deploy from Docker image**. Image: `memgraph/memgraph:latest`. Set the **start command** to `--bolt-server-name-for-init=Neo4j/` if your platform allows it. Name the service **`memgraph`**.

---

## B.2 — Point the backend at Memgraph

1. Open your **backend** service (the DealGraph API) → **Variables**.
2. Add or set:
   - **`MEMGRAPH_URI`** = `bolt://memgraph.railway.internal:7687`
3. Leave **`MEMGRAPH_USER`** and **`MEMGRAPH_PASSWORD`** empty (default Memgraph has no auth).
4. Redeploy the backend so it picks up the new variable.

---

## B.3 — Seed the graph once

The graph must be populated once. Use the **Railway CLI** so the seed runs in the same private network as Memgraph.

1. **Install Railway CLI:** [docs.railway.app/develop/cli](https://docs.railway.app/develop/cli) (e.g. `npm i -g @railway/cli` or download).
2. **Log in and link the project:**
   ```bash
   railway login
   cd backend
   railway link
   ```
   Select your project and the **backend** service (not Memgraph).
3. **Run the seed** (uses the backend service env, including `MEMGRAPH_URI=bolt://memgraph.railway.internal:7687`):
   ```bash
   railway run python seed_memgraph.py
   ```
   You should see `[seed] Done! Memgraph is ready.`
4. **Verify:** Call your backend’s `/api/health`, then run a deal analysis from the Vercel app; fact-checking and competitors should use the seeded graph.
