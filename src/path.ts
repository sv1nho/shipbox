import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BASE_DIR = (folder: "dist" | "src" = "dist") =>
  path.resolve(__dirname, "..", folder);
