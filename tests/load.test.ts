import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBook, scriptPanelIds } from "../src/load.js";

let root: string;
let bookDir: string;
let charsDir: string;

const character = {
  id: "dog-man", name: "Dog Man", viewBox: [0, 0, 200, 300],
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

  it("panels/ 还不存在时当作一格没画，不报错（新书第一天就是这个状态）", async () => {
    const fresh = join(root, "fresh-book");
    await mkdir(fresh, { recursive: true });
    await writeFile(join(fresh, "script.json"), JSON.stringify(script));
    const book = await loadBook(fresh, charsDir);
    expect(book.panels.size).toBe(0);
  });
});

describe("loadBook 的跨文件校验（F2）", () => {
  it("角色库目录不存在 → 响亮报错，而不是 0 个角色照样通过", async () => {
    await expect(loadBook(bookDir, join(root, "no-such-characters")))
      .rejects.toThrow(/角色库/);
  });

  it("角色库是空目录 → 同样报错", async () => {
    const empty = join(root, "empty-characters");
    await mkdir(empty, { recursive: true });
    await expect(loadBook(bookDir, empty)).rejects.toThrow(/角色库/);
  });

  it("画面里的 cast id 在角色库里不存在 → check 阶段就报错", async () => {
    const bad = join(bookDir, "panels", "ch1-p1-02.json");
    await writeFile(bad, JSON.stringify({
      id: "ch1-p1-02", shapes: [],
      cast: [{ id: "dog-mann", pose: "idle", x: 0, y: 0 }],
    }));
    await expect(loadBook(bookDir, charsDir)).rejects.toThrow(/未知角色 "dog-mann"/);
    await rm(bad);
  });

  it("孤儿格（id 不在剧本里）→ 报错，不会悄悄把已作画数顶高", async () => {
    const orphan = join(bookDir, "panels", "ch1-p9-01.json");
    await writeFile(orphan, JSON.stringify({ id: "ch1-p9-01", shapes: [], cast: [] }));
    await expect(loadBook(bookDir, charsDir)).rejects.toThrow(/不在 script\.json/);
    await rm(orphan);
  });
});

describe("scriptPanelIds", () => {
  it("按剧本顺序列出全部格 id，数量就是全书总格数", async () => {
    const book = await loadBook(bookDir, charsDir);
    const ids = scriptPanelIds(book.script);
    expect(ids.length).toBe(4 * 4 * 4);
    expect(ids[0]).toBe("ch1-p1-01");
  });
});
