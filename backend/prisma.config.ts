const fs = require('fs');
const path = require('path');

let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  try {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const match = envContent.match(/^DATABASE_URL=(.*)$/m);
    if (match) {
      dbUrl = match[1].trim();
      // Remove quotes if present
      if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
        dbUrl = dbUrl.slice(1, -1);
      }
    }
  } catch (e) {
    // ignore
  }
}

module.exports = {
  schema: "prisma/schema.prisma",
  datasource: {
    url: dbUrl,
  },
};
