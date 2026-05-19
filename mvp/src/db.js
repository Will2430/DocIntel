const { Pool } = require("pg");
const pgvector = require("pgvector");
const { config } = require("./config");

const pool = new Pool({ connectionString: config.pgUrl });

module.exports = { pool };
