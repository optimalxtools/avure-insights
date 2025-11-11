# Avure

A Next.js-based business insights and analytics platform forked from Vera Insights.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
# or on a specific port
npm run dev -- -p 3001
```

Open [http://localhost:3000](http://localhost:3000) (or your specified port) with your browser to see the result.

## Environment Setup

Copy `.env.local.template` to `.env.local` and fill in your Firebase credentials:

```bash
cp .env.local.template .env.local
```

## Firebase Configuration

This project uses Firebase for authentication and data storage. Make sure you have:
- Created a Firebase project
- Enabled Authentication (Email/Password)
- Set up Firestore database
- Added your Firebase config to `.env.local`

## Tech Stack

- **Framework:** Next.js 14
- **UI:** React, Tailwind CSS, shadcn/ui
- **Authentication:** Firebase Auth
- **Database:** Firestore
- **Charts:** Recharts
- **Deployment:** Firebase Hosting / Vercel

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
