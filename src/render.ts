import { PALETTE, STROKE, PANEL_WIDTH, PANEL_HEIGHT } from "./palette.js";
import type { Shape, Panel, Character } from "./schema.js";

function fillOf(shape: Shape): string {
  return "fill" in shape && shape.fill ? PALETTE[shape.fill] : "none";
}

function attrs(pairs: Array<[string, string | number]>): string {
  return pairs.map(([k, v]) => `${k}="${v}"`).join(" ");
}

export function renderShape(shape: Shape): string {
  const fill = fillOf(shape);
  switch (shape.t) {
    case "circle":
      return `<circle ${attrs([["cx", shape.cx], ["cy", shape.cy], ["r", shape.r], ["fill", fill]])}/>`;
    case "ellipse":
      return `<ellipse ${attrs([["cx", shape.cx], ["cy", shape.cy], ["rx", shape.rx], ["ry", shape.ry], ["fill", fill]])}/>`;
    case "rect": {
      const pairs: Array<[string, string | number]> = [["x", shape.x], ["y", shape.y], ["width", shape.w], ["height", shape.h]];
      if (shape.r !== undefined) pairs.push(["rx", shape.r]);
      pairs.push(["fill", fill]);
      return `<rect ${attrs(pairs)}/>`;
    }
    case "line":
      return `<line ${attrs([["x1", shape.x1], ["y1", shape.y1], ["x2", shape.x2], ["y2", shape.y2], ["fill", "none"]])}/>`;
    case "polyline":
    case "polygon": {
      const points = shape.pts.map(([x, y]) => `${x},${y}`).join(" ");
      return `<${shape.t} ${attrs([["points", points], ["fill", fill]])}/>`;
    }
  }
}

export function renderPanelSvg(panel: Panel, characters: Map<string, Character>): string {
  const body: string[] = [];

  for (const shape of panel.shapes) {
    body.push(renderShape(shape));
  }

  for (const member of panel.cast) {
    const character = characters.get(member.id);
    if (!character) {
      throw new Error(`未知角色 "${member.id}"（出现在画面 ${panel.id}）`);
    }
    const shapes = character.poses[member.pose].map(renderShape).join("");
    body.push(
      `<g transform="translate(${member.x} ${member.y}) scale(${member.scale})">${shapes}</g>`,
    );
  }

  const strokeAttrs = attrs([
    ["stroke", STROKE.color],
    ["stroke-width", STROKE.width],
    ["stroke-linecap", STROKE.linecap],
    ["stroke-linejoin", STROKE.linejoin],
  ]);

  return (
    // 不写 preserveAspectRatio：格子本身就是 4:3（版式里所有格子全等，页面按版式设了
    // aspect-ratio），画面正好满格铺开，默认值 xMidYMid meet 不会留出可见的白边
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}" ` +
    `${strokeAttrs}>` +
    body.join("") +
    `</svg>`
  );
}
