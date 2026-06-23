try {
  const theme = localStorage.getItem("propninja_theme");
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  }
} catch {
  // ignore storage errors in restricted contexts
}
