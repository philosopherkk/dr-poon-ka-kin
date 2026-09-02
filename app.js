(async () => {
  const files = ["app.p1.js", "app.p2.js", "app.p3.js"];
  const parts = await Promise.all(files.map(async (f) => {
    const r = await fetch(f);
    if (!r.ok) throw new Error("Missing " + f);
    return r.text();
  }));
  const script = document.createElement("script");
  script.textContent = parts.join("");
  document.body.appendChild(script);
})().catch((err) => {
  const el = document.getElementById("status");
  if (el) el.textContent = "Failed to load app: " + err.message;
});
