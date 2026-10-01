import "dotenv/config";
import express from "express";

import healthRoutes from "./routes/health.routes";
import newsRoutes from "./routes/news.routes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/health", healthRoutes);
app.use("/api/news", newsRoutes);

app.listen(PORT, () => {
  console.log(`server running on: http://localhost:${PORT}`);
});
