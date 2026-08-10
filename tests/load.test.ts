import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBook } from "../src/load.js";

let root: string;
let bookDir: string;
let charsDir: string;

const character = {
  id: "dog-man", name: "Dog Man", viewBox: [0, 0, 100, 150],
  poses: {
    idle: [{ t: "circle", cx: 50, cy: 35, r: 28, fill: "beige" }],
    happy: [], shocked: [], angry: [],
  },
};

const scriptPanel = (id: string) => ({
  id, shot: "wide", description: "d", cast: ["dog-man"], dialogue: [],
});
const page = { number: 1, layout: "2x2", panels: ["01", "02", "03", "04"].map((n) => scriptPanel(`ch1-p1-${n}`)) };
const chapter = { number: 1, title: "Ch1", pages: [page, page, page, page] };
const script = { title: "T", tone: "funny", chapters: [chapter, chapter, chapter, chapter] };

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "comic-"));
  charsDir = join(root, "characters");
  bookDir = join(root, "book");
  await mkdir(charsDir, { recursive: true });
  await mkdir(join(bookDir, "panels"), { recursive: true });
  await writeFile(join(charsDir, "dog-man.json"), JSON.stringify(character));
  await writeFile(join(bookDir, "script.json"), JSON.stringify(script));
  await writeFile(
    join(bookDir, "panels", "ch1-p1-01.json"),
    JSON.stringify({ id: "ch1-p1-01", shapes: [], cast: [] }),
  );
});

afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe("loadBook", () => {
  it("载入剧本、已画的格、角色", async () => {
    const book = await loadBook(bookDir, charsDir);
    expect(book.script.title).toBe("T");
    expect(book.panels.size).toBe(1);
    expect(book.characters.get("dog-man")?.name).toBe("Dog Man");
  });

  it("忽略未作画的格，不报错", async () => {
    const book = await loadBook(bookDir, charsDir);
    expect(book.panels.has("ch1-p1-02")).toBe(false);
  });

  it("非法 JSON 报错时带上文件路径", async () => {
    const bad = join(bookDir, "panels", "ch1-p1-09.json");
    await writeFile(bad, JSON.stringify({ id: "ch1-p1-09", shapes: [{ t: "gradient" }], cast: [] }));
    await expect(loadBook(bookDir, charsDir)).rejects.toThrow(/ch1-p1-09\.json/);
    await rm(bad);
  });
});
