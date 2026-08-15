import { renderPanelSvg } from "./render.js";
import { LAYOUT_SPECS } from "./layout.js";
import { PANEL_WIDTH } from "./palette.js";
import type { Panel, Character, BookData } from "./schema.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 确定性的小角度倾斜，让拟声词有手写的随意感（同一文本每次结果相同） */
function tilt(text: string): number {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 31) - 15;
}

const CSS = `
/* 每页按版式声明 aspect-ratio（列×4 : 行×3），宽度封顶在 --page-fit 换算出来的值，
   于是浏览器自己把整页缩到一屏之内。不同版式的页高本来就不一样（2 行的矮、3 行的高），
   这没关系——要的不是"每页一样高"，是"按一次方向键正好翻过一整页"。
   --page-fit 是一页允许占的最大高度，留 8% 余量：1280×800 的笔记本上 92vh = 736px。
   它同时决定 3 行版式的格子有多大（页高封顶 → 页宽跟着封顶），别随手调小。 */
:root { --gap: 12px; --page-fit: 92vh; }
* { box-sizing: border-box; }
body { margin: 0; background: #333; font-family: "Comic Sans MS", "Chalkboard SE", sans-serif; }
.book { max-width: 900px; margin: 0 auto; padding: 24px; }
h1 { color: #fff; text-align: center; }
h2 { color: #F5C518; margin: 32px 0 8px; }
.page { display: grid; gap: var(--gap); background: #fff; padding: var(--gap);
        border-radius: 8px; margin: 0 auto 24px; }
.panel { position: relative; border: 6px solid #000; border-radius: 4px;
         overflow: hidden; background: #fff; }
.panel svg { display: block; width: 100%; height: 100%; }
.not-drawn { display: flex; align-items: center; justify-content: center;
             height: 100%; color: #999; font-size: 14px; }
.bubble { position: absolute; max-width: 60%;
          background: #fff; border: 4px solid #000; border-radius: 14px;
          padding: 6px 10px; font-weight: bold; font-size: 15px; line-height: 1.2; }
/* 气泡贴在说话角色所在的一侧，尾巴也在那一侧，指向格子中间的角色 */
.bubble.left { left: 8px; }
.bubble.right { right: 8px; }
.bubble.top { top: 8px; }
.bubble.bottom { bottom: 8px; }
.captioned .bubble.top { top: 44px; }
/* 拟声词固定在右上角，会和贴上沿的气泡抢同一块地方（说话人在右半边时正好压在一起）。
   有拟声词的格子带 .sfxed，上沿气泡整体下移让开：拟声词 30px 且带 ±15° 倾斜，实测最长的
   WHOOSH! 外接框底边离格子上沿 62px，64px 刚好让开。左右两侧都要让——窄格子里 60% 宽的
   左气泡照样会伸到拟声词底下。
   这条和上一条特异性相同，靠书写顺序让 .sfxed 赢，所以既有旁白又有拟声词时取大的那个。 */
.sfxed .bubble.top { top: 64px; }
.bubble::after { content: ""; position: absolute; border: 7px solid transparent; }
.bubble.top::after { bottom: -14px; border-top-color: #000; }
.bubble.bottom::after { top: -14px; border-bottom-color: #000; }
.bubble.left::after { left: 18px; }
.bubble.right::after { right: 18px; }
.sfx { position: absolute; top: 8px; right: 8px; font-size: 30px; font-weight: 900;
       color: #F5C518; -webkit-text-stroke: 3px #000; }
.caption { position: absolute; top: 8px; left: 8px; background: #fff;
           border: 4px solid #000; padding: 4px 8px; font-size: 13px; font-weight: bold; }
`.trim();

const JS = `
const pages = [...document.querySelectorAll('.page')];
let i = 0;
function go(n) {
  i = Math.max(0, Math.min(pages.length - 1, n));
  pages[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
}
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(i + 1);
  if (e.key === 'ArrowLeft') go(i - 1);
});
`.trim();

/**
 * 气泡该贴哪一侧：按说话人在画面里的横向位置决定。
 * 说话人不在这一格的 cast 里（旁白式台词、还没画的格）时左右交替，至少两个气泡不会撞在一起。
 */
export function bubbleSide(
  speaker: string,
  index: number,
  drawn: Panel | undefined,
  characters: Map<string, Character>,
): "left" | "right" {
  const member = drawn?.cast.find((m) => m.id === speaker);
  if (!member) return index % 2 === 0 ? "left" : "right";
  const width = characters.get(member.id)?.viewBox[2] ?? 100;
  const centre = member.x + (width * member.scale) / 2;
  return centre < PANEL_WIDTH / 2 ? "left" : "right";
}

export function buildHtml(book: BookData): string {
  const { script, panels, characters } = book;
  const parts: string[] = [];

  for (const chapter of script.chapters) {
    parts.push(`<h2>Chapter ${chapter.number}: ${esc(chapter.title)}</h2>`);

    for (const page of chapter.pages) {
      const spec = LAYOUT_SPECS[page.layout];
      const cells: string[] = [];

      page.panels.forEach((sp, idx) => {
        const area = spec.areas[idx] ?? "auto";
        const drawn = panels.get(sp.id);
        const art = drawn
          ? renderPanelSvg(drawn, characters)
          : `<div class="not-drawn">${esc(sp.id)} not drawn yet</div>`;

        const overlay: string[] = [];
        if (sp.caption) overlay.push(`<div class="caption">${esc(sp.caption)}</div>`);
        sp.dialogue.forEach((line, i) => {
          // schema 限死最多 2 个气泡：第一个贴上沿，第二个贴下沿
          const slot = i === 0 ? "top" : "bottom";
          const side = bubbleSide(line.speaker, i, drawn, characters);
          overlay.push(`<div class="bubble ${slot} ${side}">${esc(line.text)}</div>`);
        });
        if (sp.sfx) {
          overlay.push(
            `<div class="sfx" style="transform: rotate(${tilt(sp.sfx)}deg)">${esc(sp.sfx)}</div>`,
          );
        }

        const cls = ["panel"];
        if (sp.caption) cls.push("captioned");
        if (sp.sfx) cls.push("sfxed");
        cells.push(
          `<div class="${cls.join(" ")}" style="grid-area: ${area}">${art}${overlay.join("")}</div>`,
        );
      });

      // 一页的形状：列数 × 4 : 行数 × 3，因为每一格都是 4:3 且这些版式里格子全等。
      // 宽度封顶让整页高度不超过 --page-fit，浏览器按比例把整页缩小，画面仍然满格。
      const w = spec.columns * 4;
      const h = spec.rows * 3;
      parts.push(
        `<div class="page" style="grid-template-columns: repeat(${spec.columns}, 1fr);` +
        ` grid-template-rows: repeat(${spec.rows}, 1fr);` +
        ` aspect-ratio: ${w} / ${h};` +
        ` width: min(100%, calc(var(--page-fit) * ${w} / ${h}))">` +
        cells.join("") +
        `</div>`,
      );
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(script.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="book">
<h1>${esc(script.title)}</h1>
${parts.join("\n")}
</div>
<script>${JS}</script>
</body>
</html>`;
}
