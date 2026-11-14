# Deploying gini_minnie (free tiers)

You end up with two addresses:
- **The app** (what you open): `https://<name>.vercel.app`, hosted on Vercel.
- **The API** (used by the app behind the scenes): `https://gini-minnie-api.onrender.com`, hosted on Render.

Both redeploy automatically every time you merge to `main`.

## 1. Backend on Render (~10 min)

1. Go to https://render.com and **sign in with GitHub**.
2. Click **New +** → **Blueprint**.
3. Choose the repo **Vidi-Idi/gini_minnie**. If it isn't listed, click "Configure account" and give Render access to the repo.
4. Render reads `render.yaml` and shows a service named **gini-minnie-api**. It asks for `CORS_ORIGINS`: for now enter `http://localhost:3000` (you update it in step 3).
5. Click **Apply**. The first build takes a few minutes.
6. When it says **Live**, copy the service URL (e.g. `https://gini-minnie-api.onrender.com`).
   Check it: open `<that URL>/api/health` in the browser. You should see `{"status":"ok"}`.

## 2. Frontend on Vercel (~5 min)

1. Go to https://vercel.com and **sign in with GitHub**.
2. Click **Add New…** → **Project** → import **Vidi-Idi/gini_minnie**.
3. Set **Root Directory** to `frontend`. Vercel detects Next.js automatically.
4. Under **Environment Variables** add:
   - `NEXT_PUBLIC_API_URL` = the Render URL from step 1.6 (no trailing slash)
5. Click **Deploy**. When it finishes, Vercel shows your app URL. You can rename the project in Settings to change the address.

## 3. Connect them

1. Back in Render → **gini-minnie-api** → **Environment**.
2. Set `CORS_ORIGINS` to your Vercel URL, e.g. `https://gini-minnie.vercel.app` (no trailing slash).
   To allow several, separate them with commas.
3. Save. Render restarts the service automatically.
4. Open your Vercel URL, enter a portfolio and click **Analyze**.

## Good to know

- **Sleep on the free plan:** the Render backend sleeps after 15 minutes without use. The page wakes it as soon as it opens, but the first analysis after a break can take 30–60 seconds. The paid plan ($7/month) removes this.
- **Your data:** for now your portfolio is saved only in your browser, not on the server. Login and saved reviews come with the Supabase step.
- **Yahoo Finance limits:** Yahoo sometimes rate-limits requests from cloud servers. If analyses start failing with data errors, tell me. The data layer is built so another provider can be plugged in.
