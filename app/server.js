const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      role VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "healthy", database: "connected" });
  } catch (error) {
    res.status(503).json({ status: "unhealthy" });
  }
});

app.get("/employees", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employees ORDER BY id"
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Unable to fetch employees" });
  }
});

app.post("/employees", async (req, res) => {
  const { name, email, role } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({
      error: "Name, email and role are required"
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO employees (name, email, role) VALUES ($1, $2, $3) RETURNING *",
      [name, email, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(error.code === "23505" ? 409 : 500).json({
      error: error.code === "23505"
        ? "Email already exists"
        : "Unable to create employee"
    });
  }
});

const PORT = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Employee API running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
