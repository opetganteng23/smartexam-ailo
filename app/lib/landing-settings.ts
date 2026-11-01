import { z } from "zod";

/** Pengaturan tampilan landing (hero, teks berjalan, logo mitra). Disimpan di Setting key "landing"; dapat diubah admin di Settings. */
export type Partner = { name: string; logoId: string };
export type LandingSettings = {
  badge: string; title: string; subtitle: string;
  bgImageId: string; overlay: number; theme: "light" | "dark";
  marquee: string[]; partners: Partner[];
};

export const LANDING_DEFAULTS: LandingSettings = {
  badge: "Smartexam by AILO 2026",
  title: "Know your score. Know what to do next.",
  subtitle: "Online exams, analysis for every section, and reports for your institution, all in one place.",
  bgImageId: "", overlay: 60, theme: "light",
  marquee: ["Know your score", "Analysis for every section", "Secure, monitored test room", "Reports for institutions", "Excel and PDF exports"],
  partners: [{ name: "Telkom University", logoId: "" }, { name: "CoE AILO", logoId: "" }],
};

const oid = z.string().regex(/^[0-9a-f]{24}$/, "Invalid image").or(z.literal(""));
export const landingSchema = z.object({
  badge: z.string().trim().max(80),
  title: z.string().trim().min(1, "Enter a headline").max(140),
  subtitle: z.string().trim().max(320),
  bgImageId: oid,
  overlay: z.number().int().min(0).max(90),
  theme: z.enum(["light", "dark"]),
  marquee: z.array(z.string().trim().min(1).max(60)).max(10),
  partners: z.array(z.object({ name: z.string().trim().min(1, "Partner name cannot be empty").max(60), logoId: oid })).max(10),
});
