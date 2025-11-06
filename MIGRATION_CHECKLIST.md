# Avure Migration Checklist

## ✅ Immediate Tasks
- [x] Create new Firebase project and update `.env.local`
- [x] Install dependencies: `npm install`
- [x] Run dev server on alternate port: `npm run dev -- -p 3001`
- [ ] Replace sessionStorage/localStorage keys with `STORAGE_KEYS`
- [x] Configure git remote: `git remote add origin <your-repo>`
- [x] Initial commit: `git add . && git commit -m "Initial Avure fork"`

## 🏗️ Optional Follow-ups
- [ ] Update branding assets (logos, colors)
- [ ] Review module access rules
- [ ] Verify Firebase security rules
- [ ] Configure deployment pipeline (Firebase Hosting / Vercel / etc.)