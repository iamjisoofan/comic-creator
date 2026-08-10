// 冒烟测试：跑仓库里真实的示例数据。
// 其余测试都用手搓的 fixture，只有这里会在示例数据和 schema 走偏时立刻响。
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadBook, scriptPanelIds } from "../src/load.js";
import { buildHtml } from "../src/build.js";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BOOK_DIR = join(REPO_ROOT, "comics", "books", "00-hello");
const CHARACTERS_DIR = join(REPO_ROOT, "comics", "characters");

describe("真实示例数据（comics/books/00-hello + comics/characters）", () => {
  it("载入不抛错，且角色、剧本、已画的格都在", async () => {
    const book = await loadBook(BOOK_DIR, CHARACTERS_DIR);
    expect(book.characters.get("dog-man")?.name).toBe("Dog Man");
    expect(scriptPanelIds(book.script).length).toBeGreaterThan(0);
    expect(book.panels.size).toBeGreaterThan(0);
  });

  it("成书不抛错，画好的格真的渲染进了 HTML", async () => {
    const book = await loadBook(BOOK_DIR, CHARACTERS_DIR);
    const html = buildHtml(book);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<svg");
    expect(html).toContain("HI! I AM DOG MAN!");
    expect(html).toContain("not drawn yet"); // 增量作画：其余格还是占位
  });

  it("四个姿势都渲染得出来（角色文件没有半途损坏）", async () => {
    const book = await loadBook(BOOK_DIR, CHARACTERS_DIR);
    const dogMan = book.characters.get("dog-man")!;
    for (const pose of ["idle", "happy", "shocked", "angry"] as const) {
      expect(dogMan.poses[pose].length).toBeGreaterThan(0);
      expect(dogMan.poses[pose].length).toBeLessThanOrEqual(12);
    }
  });
});
