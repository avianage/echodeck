try {
  require('dotenv').config()
} catch (e) {
  // dotenv is optional (not present in production standalone builds)
}

module.exports = {
  datasource: {
    url: process.env.DATABASE_URL,
  },
}
