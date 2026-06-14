const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://echodeck:echodeck123@192.168.0.41:5435/echodeck"
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, title, "createdAt" FROM "Stream" ORDER BY "createdAt" DESC LIMIT 5;');
  console.log('--- Stream Table ---');
  console.table(res.rows);
  
  const res2 = await client.query('SELECT "userId", title, "updatedAt" FROM "CurrentStream" LIMIT 5;');
  console.log('--- CurrentStream Table ---');
  console.table(res2.rows);
  
  await client.end();
}

run().catch(console.error);
