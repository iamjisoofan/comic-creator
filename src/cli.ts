import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadBook } from "./load.js";
import { buildHtml } from "./build.js";

const CHARACTERS_DIR = resolve("comics/characters");

function usage(): never {
  console.error(`用法:
  tsx src/cli.ts build <book-dir>   重建 index.html
  tsx src/cli.ts check <book-dir>   只校验，不写文件`);
  process.exit(2);
}

async function main() {
  const [command, target] = process.argv.slice(2);
  if (!command || !target) usage();

  const bookDir = resolve(target);

  if (command === "check") {
    const book = await loadBook(bookDir, CHARACTERS_DIR);
    const total = book.script.chapters.flatMap((c) => c.pages).flatMap((p) => p.panels).length;
    console.log(`✓ 校验通过：${total} 格，已作画 ${book.panels.size} 格，角色 ${book.characters.size} 个`);
    return;
  }

  if (command === "build") {
    const book = await loadBook(bookDir, CHARACTERS_DIR);
    const out = join(bookDir, "index.html");
    await writeFile(out, buildHtml(book), "utf8");
    console.log(`✓ 已生成 ${out}（已作画 ${book.panels.size} 格）`);
    return;
  }

  usage();
}

main().catch((e: unknown) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
