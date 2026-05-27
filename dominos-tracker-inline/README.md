# Dominos Delivery Tracker

## Deploy to Render.com

### IMPORTANT: File Structure
Your GitHub repo should look like this:
```
RD-s-Income-Tracker/
├── package.json
├── server.js
├── .gitignore
├── README.md
└── public/
    ├── index.html
    └── app.js
```

### Steps:
1. Upload ALL files to GitHub repo root (not in subfolders)
2. On Render, set:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Root Directory:** (leave blank or set to `.`)
3. Deploy

### Fix for "package.json not found" error:
If you see "ENOENT: no such file or directory, open '/opt/render/project/src/package.json'",
it means your files are in the wrong location in GitHub.

Make sure:
- `package.json` is in the ROOT of your repo
- `server.js` is in the ROOT of your repo
- The `public/` folder is in the ROOT of your repo
