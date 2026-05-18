import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 transition-colors"
            aria-label="Toggle theme"
        >
            {theme === "dark" ? (
                <Sun className="w-4 h-4 text-muted-foreground" />
            ) : (
                <Moon className="w-4 h-4 text-muted-foreground" />
            )}
        </button>
    );
}
