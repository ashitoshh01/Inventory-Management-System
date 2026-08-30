import { StorageProvider } from "./StorageProvider";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export class LocalDiskStorage implements StorageProvider {
  private baseDir: string;

  constructor() {
    // Defaults to ./public/uploads if env var is not set
    this.baseDir = process.env.UPLOAD_DIR || "./public/uploads";
  }

  async upload(file: File, folder: string): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create unique filename
    const ext = path.extname(file.name) || "";
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    
    // Ensure directory exists
    const dir = path.join(process.cwd(), this.baseDir, folder);
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    const filePath = path.join(dir, uniqueName);
    await fs.writeFile(filePath, buffer);
    
    // Return public URL path
    // Remove './public' from baseDir to get URL path
    const publicBasePath = this.baseDir.replace(/^(\.\/)?public\/?/, '/');
    return path.posix.join(publicBasePath, folder, uniqueName);
  }

  async delete(url: string): Promise<void> {
    try {
      // url is something like /uploads/products/123.jpg
      // Map it back to local path: ./public/uploads/products/123.jpg
      const urlPath = url.replace(/^\//, ''); // remove leading slash
      const localPath = path.join(process.cwd(), "public", urlPath);
      await fs.unlink(localPath);
    } catch (e) {
      console.error("Failed to delete local file:", e);
    }
  }
}
