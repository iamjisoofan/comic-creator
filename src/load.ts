import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { z } from "zod";
import { ScriptSchema, PanelSchema, CharacterSchema, type Panel, type Character } from "./schema.js";
import type { BookData } from "./build.js";

export function formatZodError(filePath: string, error: z.ZodError): string {
  const lines = error.issues.map((i) => `  · ${i.path.join(".") || "(根)"}：${i.message}`);
  return `${filePath} 不合法：\n${lines.join("\n")}`;
}

async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${filePath} 不是合法 JSON：${(e as Error).message}`);
  }
}

async function parseFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T> {
  const data = await readJson(filePath);
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(formatZodError(filePath, result.error));
  return result.data;
}

async function listJson(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith(".json")).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function loadBook(bookDir: string, charactersDir: string): Promise<BookData> {
  const script = await parseFile(join(bookDir, "script.json"), ScriptSchema);

  const characters = new Map<string, Character>();
  for (const file of await listJson(charactersDir)) {
    const character = await parseFile(join(charactersDir, file), CharacterSchema);
    characters.set(character.id, character);
  }

  const panelsDir = join(bookDir, "panels");
  const panels = new Map<string, Panel>();
  for (const file of await listJson(panelsDir)) {
    const panel = await parseFile(join(panelsDir, file), PanelSchema);
    if (panel.id !== basename(file, ".json")) {
      throw new Error(`${join(panelsDir, file)} 的 id "${panel.id}" 与文件名不符`);
    }
    panels.set(panel.id, panel);
  }

  return { script, panels, characters };
}
