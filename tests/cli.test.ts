// CLI 的行为测试：参数处理和退出码。全部从 os.tmpdir() 里跑，
// 因为 F1 就是"换个 cwd 跑，角色库找不到却照样通过"。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const run = promisify(execFile);
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(REPO_ROOT, "src", "cli.ts");
const TSX = join(REPO_ROOT, "node_modules", ".bin", "tsx");
const SAMPLE = join(REPO_ROOT, "comics", "books", "00-hello");

interface Result { code: number; stdout: string; stderr: string }

/** 永远在 os.tmpdir() 里跑，绝不在仓库根目录 */
async function cli(...args: string[]): Promise<Result> {
  try {
    const { stdout, stderr } = await run(TSX, [CLI, ...args], { cwd: tmpdir() });
    return { code: 0, stdout, stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { code: err.code ?? -1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

let scratch: string;

beforeAll(async () => { scratch = await mkdtemp(join(tmpdir(), "comic-cli-")); });
afterAll(async () => { await rm(scratch, { recursive: true, force: true }); });

describe("cli 参数处理", () => {
  it("不给参数 → 打印用法，退出码 2", async () => {
    const r = await cli();
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("用法");
  });

  it("只给命令不给书目录 → 退出码 2", async () => {
    const r = await cli("check");
    expect(r.code).toBe(2);
  });

  it("不认识的命令 → 退出码 2，不去读文件", async () => {
    const r = await cli("draw", SAMPLE);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("用法");
  });
}, 30_000);

describe("cli check", () => {
  it("在别的 cwd 下也能找到角色库（F1），并报出 M/N 格", async () => {
    const r = await cli("check", SAMPLE);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("角色 1 个");
    // 只断言 M/N 的形状，不写死样例书画了几格 —— 那是会变的内容，不是行为
    expect(r.stdout).toMatch(/已作画 \d+\/64 格/);
  });

  it("书不存在 → 退出码 1，并说清是哪个文件", async () => {
    const r = await cli("check", join(scratch, "no-such-book"));
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("✗");
    expect(r.stderr).toContain("script.json");
  });

  it("孤儿格 → 退出码 1（原来会通过，还把已作画数顶高）", async () => {
    const book = join(scratch, "orphan-book");
    await cp(SAMPLE, book, { recursive: true });
    await cp(
      join(SAMPLE, "panels", "ch1-p1-01.json"),
      join(book, "panels", "ch1-p9-99.json"),
    );
    const r = await cli("check", book);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("ch1-p9-99");
  });
}, 30_000);

describe("cli build", () => {
  it("写出 index.html，并报出 M/N 格", async () => {
    const book = join(scratch, "build-book");
    await cp(SAMPLE, book, { recursive: true });
    const r = await cli("build", book);
    expect(r.code).toBe(0);
    // 只断言 M/N 的形状，不写死样例书画了几格 —— 那是会变的内容，不是行为
    expect(r.stdout).toMatch(/已作画 \d+\/64 格/);
    const html = await readFile(join(book, "index.html"), "utf8");
    expect(html).toContain("<svg");
    expect(html).toContain("Hello, Dog Man");
  });
}, 30_000);
