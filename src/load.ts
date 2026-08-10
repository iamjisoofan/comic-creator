import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { z } from "zod";
import {
  ScriptSchema, PanelSchema, CharacterSchema,
  type Panel, type Character, type Script, type BookData,
} from "./schema.js";

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

/** 剧本里所有格的 id，按剧本顺序 */
export function scriptPanelIds(script: Script): string[] {
  return script.chapters.flatMap((c) => c.pages).flatMap((p) => p.panels).map((sp) => sp.id);
}

export async function loadBook(bookDir: string, charactersDir: string): Promise<BookData> {
  const script = await parseFile(join(bookDir, "script.json"), ScriptSchema);

  const characterFiles = await listJson(charactersDir);
  if (characterFiles.length === 0) {
    // 一本没有角色的书不是真实状态：要么路径错了，要么角色库还没建。
    // 静默返回空 Map 会让 check 通过、build 才炸（"未知角色 X"），把人引去查错文件。
    throw new Error(`角色库 ${charactersDir} 不存在或没有任何 .json —— 先造角色（/comic character）再作画`);
  }
  const characters = new Map<string, Character>();
  for (const file of characterFiles) {
    const character = await parseFile(join(charactersDir, file), CharacterSchema);
    characters.set(character.id, character);
  }

  const knownPanelIds = new Set(scriptPanelIds(script));
  const panelsDir = join(bookDir, "panels");
  const panels = new Map<string, Panel>();
  for (const file of await listJson(panelsDir)) {
    const path = join(panelsDir, file);
    const panel = await parseFile(path, PanelSchema);
    if (panel.id !== basename(file, ".json")) {
      throw new Error(`${path} 的 id "${panel.id}" 与文件名不符`);
    }
    // 孤儿格：文件名/id 在 script.json 里找不到。它永远不会被渲染，
    // 却会把"已作画 N 格"顶高——而那个数字是判断一章画完没有的依据。
    if (!knownPanelIds.has(panel.id)) {
      throw new Error(`${path} 的 id "${panel.id}" 不在 script.json 的任何一页里（多半是文件名打错了）`);
    }
    for (const member of panel.cast) {
      if (!characters.has(member.id)) {
        throw new Error(`${path} 用了未知角色 "${member.id}" —— ${charactersDir} 下没有这个角色`);
      }
    }
    panels.set(panel.id, panel);
  }

  return { script, panels, characters };
}
