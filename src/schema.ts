import { z } from "zod";
import { PALETTE } from "./palette.js";
import { LAYOUT_SPECS, panelCount, type LayoutName } from "./layout.js";

const colorNames = Object.keys(PALETTE) as [keyof typeof PALETTE, ...Array<keyof typeof PALETTE>];
export const ColorSchema = z.enum(colorNames);

const Point = z.tuple([z.number(), z.number()]);

export const ShapeSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("circle"), cx: z.number(), cy: z.number(), r: z.number().positive(), fill: ColorSchema.optional() }).strict(),
  z.object({ t: z.literal("ellipse"), cx: z.number(), cy: z.number(), rx: z.number().positive(), ry: z.number().positive(), fill: ColorSchema.optional() }).strict(),
  z.object({ t: z.literal("rect"), x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive(), r: z.number().nonnegative().optional(), fill: ColorSchema.optional() }).strict(),
  z.object({ t: z.literal("line"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }).strict(),
  z.object({ t: z.literal("polyline"), pts: z.array(Point).min(2).max(6), fill: ColorSchema.optional() }).strict(),
  z.object({ t: z.literal("polygon"), pts: z.array(Point).min(3).max(6), fill: ColorSchema.optional() }).strict(),
]);
export type Shape = z.infer<typeof ShapeSchema>;

export const PoseSchema = z.enum(["idle", "happy", "shocked", "angry"]);
export type Pose = z.infer<typeof PoseSchema>;

const poseShapes = z.array(ShapeSchema).max(16, "一个姿势最多 16 个图形");

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  viewBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  poses: z.object({
    idle: poseShapes,
    happy: poseShapes,
    shocked: poseShapes,
    angry: poseShapes,
  }).strict(),
}).strict();
export type Character = z.infer<typeof CharacterSchema>;

export const CastMemberSchema = z.object({
  id: z.string().min(1),
  pose: PoseSchema,
  x: z.number(),
  y: z.number(),
  scale: z.number().positive().default(1),
}).strict();

export const PanelSchema = z.object({
  id: z.string().min(1),
  shapes: z.array(ShapeSchema).max(20, "一格最多 20 个图形"),
  cast: z.array(CastMemberSchema).max(3, "一格最多 3 个角色"),
}).strict();
export type Panel = z.infer<typeof PanelSchema>;

// ---- 剧本 ----

export const ShotSchema = z.enum(["wide", "medium", "close-up"]);
export const ToneSchema = z.enum(["funny", "adventure", "warm", "spooky"]);
const layoutNames = Object.keys(LAYOUT_SPECS) as [LayoutName, ...LayoutName[]];
export const LayoutSchema = z.enum(layoutNames);

export const DialogueSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1).refine(
    (t) => t.trim().split(/\s+/).length <= 12,
    "一个气泡最多 12 个单词",
  ),
}).strict();

export const ScriptPanelSchema = z.object({
  id: z.string().min(1),
  shot: ShotSchema,
  description: z.string().min(1),
  cast: z.array(z.string()),
  dialogue: z.array(DialogueSchema).max(2, "一格最多 2 个气泡，第三个会画不下").default([]),
  sfx: z.string().optional(),
  caption: z.string().optional(),
}).strict();

export const ScriptPageSchema = z.object({
  number: z.number().int().positive(),
  layout: LayoutSchema,
  panels: z.array(ScriptPanelSchema).min(4).max(6),
}).strict().superRefine((page, ctx) => {
  const expected = panelCount(page.layout);
  if (page.panels.length !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `版式 ${page.layout} 需要 ${expected} 格，实际 ${page.panels.length} 格`,
      path: ["panels"],
    });
  }
});

export const ScriptChapterSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  pages: z.array(ScriptPageSchema).min(4).max(5),
}).strict();

export const ScriptSchema = z.object({
  title: z.string().min(1),
  tone: ToneSchema,
  chapters: z.array(ScriptChapterSchema).min(4).max(5),
}).strict();
export type Script = z.infer<typeof ScriptSchema>;

// ---- 整本书（load 产出，build 消费）----

export interface BookData {
  script: Script;
  panels: Map<string, Panel>;
  characters: Map<string, Character>;
}
