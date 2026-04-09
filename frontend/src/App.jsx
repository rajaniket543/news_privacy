import { useEffect, useState } from "react";
import Home from "./pages/Home";

const THEME_KEY = "habitflow-secure-theme";

function App() {
  const [theme, setTheme] = useState(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedTheme) {
      return storedTheme;
    }

    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <Home
      theme={theme}
      toggleTheme={() =>
        setTheme((currentTheme) =>
          currentTheme === "dark" ? "light" : "dark"
        )
      }
    />
  );
}

export default App;
