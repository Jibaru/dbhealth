import "dotenv/config";
import express from "express";
import handler from "./api/health.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/health", handler);

app.listen(PORT, () => {
  console.log(`▶️ Server listening on http://localhost:${PORT}`);
});
