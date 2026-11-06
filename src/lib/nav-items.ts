import type { NavAccent } from "@/components/molecules/NavItem";

const CYAN: NavAccent = ["34,211,238", "32,164,255"];

export interface NavItemDef {
  href: string;
  glyph: string;
  label: string;
  accent: NavAccent;
}

export const NAV_ITEMS: NavItemDef[] = [
  { href: "/dashboard", glyph: "⌂", label: "Trang chủ", accent: ["255,255,255", "255,255,255"] },
  { href: "/exam-mixer", glyph: "🎯", label: "Trộn đề thi", accent: ["255,104,74", "245,158,11"] },
  { href: "/classroom-tools", glyph: "⚡", label: "Lớp học LIVE", accent: ["245,158,11", "249,115,22"] },
  { href: "/academy", glyph: "🎓", label: "Học viện tri thức", accent: ["14,165,233", "20,184,166"] },
  { href: "/virtual-lab", glyph: "🧪", label: "Phòng thí nghiệm ảo", accent: ["16,185,129", "6,182,212"] },
  { href: "/gemini-ai", glyph: "🤖", label: "Gemini AI", accent: CYAN },
  { href: "/game-center", glyph: "🎮", label: "Game Center", accent: CYAN },
];
