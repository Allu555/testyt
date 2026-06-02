# YT Music Player 🎵

A premium, Spotify-inspired frontend YouTube Music Player wrapper with a beautiful "heartbeat" progress bar.

## 🚀 Deployment (Free & No Card)
Since Vercel and Netlify have strict limits for Python, we recommend using **Koyeb**. It's 100% free and easy to set up.

1.  **Log in to [Koyeb.com](https://www.koyeb.com/)** with your GitHub.
2.  Click **"Create Service"**.
3.  Choose **"GitHub"** and select your **`ytplayer`** repository.
4.  Koyeb will automatically detect the settings.
5.  Click **"Deploy"**.

### Deploying to Netlify (static frontend + functions)

This repo is Netlify-ready: the static frontend lives in `public/` and serverless functions are in `netlify/functions`.

1. In Netlify, choose **New site → Import from Git** and select this repository.
2. Set the **Publish directory** to `public`.
3. (Optional) Set an environment variable `NODE_VERSION=20` in Site settings if you need Node 20 for `ytmusic-api`.
4. Netlify will install dependencies and deploy the functions in `netlify/functions` automatically.

Local testing:

```bash
# install JS deps
npm ci

# requires netlify-cli
npm install -g netlify-cli

# run site + functions locally
netlify dev
```

If you need the Python `server.py` instead of Netlify Functions, consider hosting the Python app on Koyeb or Render and update the frontend to proxy API calls to that service.

## 🛠️ Local Setup
1. Install dependencies: `pip install -r requirements.txt`
2. Start the unified server: `python server.py`
3. Open `http://localhost:8000`
