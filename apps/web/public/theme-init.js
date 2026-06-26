try {
  const theme = localStorage.getItem("propninja_theme");
  if (theme !== "light") {
    document.documentElement.classList.add("dark");
  }
} catch {
  // ignore storage errors in restricted contexts
}
