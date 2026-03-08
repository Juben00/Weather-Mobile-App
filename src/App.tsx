import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MdDarkMode } from "react-icons/md";
import { MdOutlineDarkMode } from "react-icons/md";
import { Button } from "@/components/ui/button";
import Home from "@/pages/Home";
import Weather from "@/pages/Weather";
import "./App.css";

function App() {
  const [isDarkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!isDarkMode);
  };

  return (
    <BrowserRouter>
      <main className={`container ${isDarkMode ? "dark" : ""}`}>
        <Routes>
          <Route path="/" element={<Home isDarkMode={isDarkMode} />} />
          <Route path="/weather" element={<Weather isDarkMode={isDarkMode} />} />
        </Routes>

        <Button
          onClick={toggleDarkMode}
          variant={isDarkMode ? "outline" : "default"}
          className="fixed bottom-6 right-6 rounded-full w-12 h-12 p-0 shadow-lg"
        >
          {isDarkMode ? <MdDarkMode size={24} /> : <MdOutlineDarkMode size={24} />}
        </Button>
      </main>
    </BrowserRouter>
  );
}

export default App;
