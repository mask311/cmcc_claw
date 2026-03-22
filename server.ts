import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs-extra";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const DB_FILE = path.join(process.cwd(), "kb_db.json");

// Ensure directories exist
fs.ensureDirSync(UPLOADS_DIR);
if (!fs.existsSync(DB_FILE)) {
  fs.writeJsonSync(DB_FILE, []);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/kb/list", async (req, res) => {
    try {
      const db = await fs.readJson(DB_FILE);
      res.json(db);
    } catch (error) {
      res.status(500).json({ error: "Failed to read database" });
    }
  });

  app.post("/api/kb/upload", upload.single("file"), async (req, res) => {
    try {
      const { name, content, summary, authorUid, fileType, size } = req.body;
      const file = req.file;

      const newDoc = {
        id: Date.now().toString(),
        name: name || file?.originalname,
        content,
        summary,
        authorUid,
        createdAt: new Date().toISOString(),
        fileUrl: file ? `/uploads/${file.filename}` : null,
        fileType: fileType || file?.mimetype,
        size: size || file?.size,
      };

      const db = await fs.readJson(DB_FILE);
      db.push(newDoc);
      await fs.writeJson(DB_FILE, db);

      res.json(newDoc);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to save document" });
    }
  });

  app.delete("/api/kb/delete/:id", async (req, res) => {
    try {
      const { id } = req.params;
      let db = await fs.readJson(DB_FILE);
      const docToDelete = db.find((d: any) => d.id === id);

      if (docToDelete && docToDelete.fileUrl) {
        const filePath = path.join(process.cwd(), docToDelete.fileUrl);
        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
        }
      }

      db = db.filter((d: any) => d.id !== id);
      await fs.writeJson(DB_FILE, db);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Serve uploads
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
