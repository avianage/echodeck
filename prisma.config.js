try {
  await import('dotenv').then((m) => m.config());
} catch {
  // dotenv is optional (not present in production standalone builds)
}

const config = {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

export default config;
