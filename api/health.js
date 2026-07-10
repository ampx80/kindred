export default async (req, res) => {
  res.json({
    ok: true,
    app: 'kindred',
    env: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  });
};
