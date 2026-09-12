import { useState } from "react";
import { Palette, X, RotateCcw, Check } from "lucide-react";

interface ColorConfig {
  label: string;
  variable: string;
  defaultValue: string;
}

const colorConfigs: ColorConfig[] = [
  { label: "Primary (Azioni)", variable: "--primary", defaultValue: "142 71% 45%" },
  { label: "Accent (Nav)", variable: "--accent", defaultValue: "231 72% 60%" },
  { label: "Background", variable: "--background", defaultValue: "214 32% 94%" },
  { label: "Card", variable: "--card", defaultValue: "0 0% 100%" },
  { label: "Coral (Bordi)", variable: "--brand-coral", defaultValue: "0 84% 60%" },
  { label: "Teal", variable: "--brand-teal", defaultValue: "173 80% 40%" },
  { label: "Purple", variable: "--brand-purple", defaultValue: "280 68% 60%" },
];

const presetThemes = [
  {
    name: "Default",
    colors: {
      "--primary": "142 71% 45%",
      "--accent": "231 72% 60%",
      "--background": "214 32% 94%",
      "--brand-coral": "0 84% 60%",
    }
  },
  {
    name: "Ocean",
    colors: {
      "--primary": "199 89% 48%",
      "--accent": "217 91% 60%",
      "--background": "200 20% 94%",
      "--brand-coral": "199 89% 48%",
    }
  },
  {
    name: "Sunset",
    colors: {
      "--primary": "25 95% 53%",
      "--accent": "330 81% 60%",
      "--background": "30 20% 94%",
      "--brand-coral": "25 95% 53%",
    }
  },
  {
    name: "Forest",
    colors: {
      "--primary": "152 69% 40%",
      "--accent": "152 69% 31%",
      "--background": "150 20% 94%",
      "--brand-coral": "152 69% 40%",
    }
  },
  {
    name: "Lavender",
    colors: {
      "--primary": "262 83% 58%",
      "--accent": "280 68% 60%",
      "--background": "270 20% 96%",
      "--brand-coral": "262 83% 58%",
    }
  },
];

function hslToHex(hsl: string): string {
  const parts = hsl.split(" ");
  if (parts.length < 3) return "#000000";
  
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  const toHex = (val: number) => {
    const hex = Math.round((val + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function ColorPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [colors, setColors] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    colorConfigs.forEach(c => {
      initial[c.variable] = c.defaultValue;
    });
    return initial;
  });

  const updateColor = (variable: string, hslValue: string) => {
    document.documentElement.style.setProperty(variable, hslValue);
    setColors(prev => ({ ...prev, [variable]: hslValue }));
  };

  const handleColorChange = (variable: string, hexValue: string) => {
    const hslValue = hexToHsl(hexValue);
    updateColor(variable, hslValue);
  };

  const resetColors = () => {
    colorConfigs.forEach(config => {
      document.documentElement.style.setProperty(config.variable, config.defaultValue);
    });
    const initial: Record<string, string> = {};
    colorConfigs.forEach(c => {
      initial[c.variable] = c.defaultValue;
    });
    setColors(initial);
  };

  const applyTheme = (theme: typeof presetThemes[0]) => {
    Object.entries(theme.colors).forEach(([variable, value]) => {
      document.documentElement.style.setProperty(variable, value);
      setColors(prev => ({ ...prev, [variable]: value }));
    });
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-4 top-4 z-50 w-12 h-12 bg-card rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform border border-border"
      >
        <Palette className="w-5 h-5 text-foreground" />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="color-picker-panel animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">🎨 Cambia Colori</h3>
            <div className="flex gap-2">
              <button
                onClick={resetColors}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Preset Themes */}
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Temi Predefiniti</p>
            <div className="flex flex-wrap gap-2">
              {presetThemes.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => applyTheme(theme)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-secondary hover:bg-secondary/80 transition-colors font-medium"
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-border my-4" />

          {/* Individual Colors */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {colorConfigs.map((config) => (
              <div key={config.variable} className="flex items-center justify-between">
                <label className="text-sm text-foreground font-medium">
                  {config.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={hslToHex(colors[config.variable] || config.defaultValue)}
                    onChange={(e) => handleColorChange(config.variable, e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <div
                    className="w-8 h-8 rounded-lg border border-border"
                    style={{ backgroundColor: `hsl(${colors[config.variable] || config.defaultValue})` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Clicca sui colori per modificarli in tempo reale
            </p>
          </div>
        </div>
      )}
    </>
  );
}
