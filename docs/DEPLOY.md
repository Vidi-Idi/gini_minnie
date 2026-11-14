# Deploying gini_minnie (free, no credit card)

Both parts run on **Vercel's free Hobby plan** as two projects from the same GitHub repo:

| Project | Root Directory | What it is | Example address |
|---------|----------------|------------|-----------------|
| `gini-minnie-api` | `backend` | The API (FastAPI) | `https://gini-minnie-api.vercel.app` |
| `gini-minnie` | `frontend` | The app you open | `https://gini-minnie.vercel.app` |

Both redeploy automatically every time you merge to `main`.

## 1. Backend (~5 min)

1. Go to https://vercel.com and **sign in with GitHub** (no card needed).
2. **Add New…** → **Project** → import **Vidi-Idi/gini_minnie**.
   If the repo isn't listed, click "Adjust GitHub App Permissions" and give Vercel access to it.
3. **Project Name:** `gini-minnie-api`.
4. **Root Directory:** click **Edit** and choose `backend`. The framework should show **FastAPI**.
5. **Environment Variables:** add `CORS_ORIGINS` = `http://localhost:3000` for now (updated in step 3).
6. Click **Deploy**. When it finishes, copy the project's domain (e.g. `https://gini-minnie-api.vercel.app`).
   Check it: open `<that address>/api/health`. You should see `{"status":"ok"}`.

## 2. Frontend (~5 min)

1. In Vercel again: **Add New…** → **Project** → import **Vidi-Idi/gini_minnie** a second time.
2. **Project Name:** `gini-minnie` (this becomes your app's address).
3. **Root Directory:** `frontend`. The framework should show **Next.js**.
4. **Environment Variables:** `NEXT_PUBLIC_API_URL` = the backend address from step 1.6 (no trailing slash).
5. Click **Deploy**. Vercel shows your app URL when it's done.

## 3. Connect them

1. Open the **gini-minnie-api** project → **Settings** → **Environment Variables**.
2. Edit `CORS_ORIGINS` and set it to your app URL, e.g. `https://gini-minnie.vercel.app` (no trailing slash).
3. Go to **Deployments**, open the menu (⋯) on the latest one and click **Redeploy**, so the new value takes effect.
4. Open your app URL, enter a portfolio and click **Analyze**.

## Good to know

- **Cold starts:** the API runs as a serverless function. The first request after a quiet period takes a few seconds to start; after that it's fast.
- **Your data:** for now your portfolio is saved only in your browser, not on the server. Login and saved reviews come with the Supabase step.
- **Yahoo Finance limits:** Yahoo sometimes rate-limits requests from cloud servers. If analyses start failing with data errors, tell me. The data layer is built so another provider can be plugged in.
