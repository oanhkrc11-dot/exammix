"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/atoms";

type Theme = "light" | "dark";

// Dark is the legacy app's actual shipped default (confirmed by rendering
// it headlessly — body.dark is hardcoded, "Dark" is the first <option>).
// Light is the alternate, toggled via a `.light` class on <html>.
function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  localStorage.setItem("exammix_theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme((localStorage.getItem("exammix_theme") as Theme | null) ?? "dark");
  }, []);

  return (
    <Select
      value={theme}
      onChange={(e) => {
        const next = e.target.value as Theme;
        setTheme(next);
        applyTheme(next);
      }}
      className="w-auto"
      aria-label="Giao diện"
    >
      <option value="dark">🌙 Tối</option>
      <option value="light">☀️ Sáng</option>
    </Select>
  );
}
