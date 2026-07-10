export default async (req, res) => {
  res.json({
    ok: true,
    app: 'kindred',
    env: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      DATABASE_URL: !!process.env.DATABASE_URL,
      SESSION_SECRET: !!process.env.SESSION_SECRET,
      VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
      CRON_SECRET: !!process.env.CRON_SECRET,
    },
    durable: !!(process.env.DATABASE_URL && process.env.SESSION_SECRET),
    push: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  });
};
