import { writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBook, scriptPanelIds } from "./load.js";
import { buildHtml } from "./build.js";

// 角色库跟着仓库走，不跟着 cwd 走：从别的目录运行时 resolve("comics/characters")
// 会指向不存在的路径，check 会拿到 0 个角色却照样通过。
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHARACTERS_DIR = join(REPO_ROOT, "comics", "characters");

function usage(): never {
  console.error(`用法:
  tsx src/cli.ts build <book-dir>   重建 index.html
  tsx src/cli.ts check <book-dir>   只校验，不写文件`);
  process.exit(2);
}

async function main() {
  const [command, target] = process.argv.slice(2);
  if (!command || !target) usage();
  if (command !== "check" && command !== "build") usage();

  const bookDir = resolve(target);
  const book = await loadBook(bookDir, CHARACTERS_DIR);
  const total = scriptPanelIds(book.script).length;
  const drawn = `已作画 ${book.panels.size}/${total} 格`;

  if (command === "check") {
    console.log(`✓ 校验通过：${total} 格，${drawn}，角色 ${book.characters.size} 个`);
    return;
  }

  const out = join(bookDir, "index.html");
  await writeFile(out, buildHtml(book), "utf8");
  console.log(`✓ 已生成 ${out}（${drawn}）`);
}

main().catch((e: unknown) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
