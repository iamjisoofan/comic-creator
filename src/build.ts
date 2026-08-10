import { renderPanelSvg } from "./render.js";
import { LAYOUT_SPECS } from "./layout.js";
import type { Script, Panel, Character } from "./schema.js";

export interface BookData {
  script: Script;
  panels: Map<string, Panel>;
  characters: Map<string, Character>;
}

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
:root { --gap: 12px; }
* { box-sizing: border-box; }
body { margin: 0; background: #333; font-family: "Comic Sans MS", "Chalkboard SE", sans-serif; }
.book { max-width: 900px; margin: 0 auto; padding: 24px; }
h1 { color: #fff; text-align: center; }
h2 { color: #F5C518; margin: 32px 0 8px; }
.page { display: grid; gap: var(--gap); background: #fff; padding: var(--gap);
        border-radius: 8px; margin-bottom: 24px; }
.panel { position: relative; border: 6px solid #000; border-radius: 4px;
         overflow: hidden; background: #fff; }
.panel svg { display: block; width: 100%; height: auto; }
.not-drawn { display: flex; align-items: center; justify-content: center;
             min-height: 160px; color: #999; font-size: 14px; }
.bubble { position: absolute; top: 8px; left: 8px; max-width: 60%;
          background: #fff; border: 4px solid #000; border-radius: 14px;
          padding: 6px 10px; font-weight: bold; font-size: 15px; line-height: 1.2; }
/* 向下的三角尾巴，指向说话的角色 */
.bubble::after { content: ""; position: absolute; bottom: -14px; left: 18px;
                 border: 7px solid transparent; border-top-color: #000; }
.bubble + .bubble { top: auto; bottom: 8px; }
.sfx { position: absolute; top: 10px; right: 10px; font-size: 30px; font-weight: 900;
       color: #F5C518; -webkit-text-stroke: 3px #000; }
.caption { position: absolute; top: 8px; left: 8px; background: #fff;
           border: 4px solid #000; padding: 4px 8px; font-size: 13px; font-weight: bold; }
.caption ~ .bubble { top: auto; bottom: 8px; }
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
          : `<div class="not-drawn">${esc(sp.id)} 还没画</div>`;

        const overlay: string[] = [];
        if (sp.caption) overlay.push(`<div class="caption">${esc(sp.caption)}</div>`);
        for (const line of sp.dialogue) {
          overlay.push(`<div class="bubble">${esc(line.text)}</div>`);
        }
        if (sp.sfx) {
          overlay.push(
            `<div class="sfx" style="transform: rotate(${tilt(sp.sfx)}deg)">${esc(sp.sfx)}</div>`,
          );
        }

        cells.push(
          `<div class="panel" style="grid-area: ${area}">${art}${overlay.join("")}</div>`,
        );
      });

      parts.push(
        `<div class="page" style="grid-template-columns: repeat(${spec.columns}, 1fr)">` +
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
