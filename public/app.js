const $ = (sel) => document.querySelector(sel);

const THEME_SWATCHES = {
  warm: "hsl(25 55% 35%)",
  forest: "hsl(150 40% 26%)",
  slate: "hsl(220 45% 32%)",
  wine: "hsl(350 50% 32%)"
};

let selectedTheme = "warm";
let currentSiteId = null;

async function init() {
  // theme picker
  const themes = await fetch("/api/themes").then((r) => r.json());
  const picker = $("#theme-picker");
  for (const theme of themes) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "theme-chip" + (theme === selectedTheme ? " active" : "");
    chip.dataset.theme = theme;
    chip.innerHTML = `<span class="swatch" style="background:${THEME_SWATCHES[theme] ?? "#888"}"></span>${theme}`;
    chip.addEventListener("click", () => {
      selectedTheme = theme;
      picker.querySelectorAll(".theme-chip").forEach((c) => c.classList.toggle("active", c === chip));
    });
    picker.appendChild(chip);
  }
  refreshGallery();
}

$("#generate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#generate-btn");
  const status = $("#status");
  status.classList.remove("error");

  const formData = new FormData();
  formData.append("description", $("#description").value);
  formData.append("theme", selectedTheme);
  for (const file of $("#documents").files) formData.append("documents", file);

  btn.disabled = true;
  status.textContent = "Generating your website… this can take up to a minute.";
  try {
    const res = await fetch("/api/generate", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Generation failed");
    status.textContent = data.mode === "demo"
      ? "Generated in demo mode — set ANTHROPIC_API_KEY on the server for AI-written content."
      : "Done.";
    showResult(data.id);
    refreshGallery();
  } catch (err) {
    status.textContent = err.message;
    status.classList.add("error");
  } finally {
    btn.disabled = false;
  }
});

function showResult(id) {
  currentSiteId = id;
  $("#result").hidden = false;
  $("#editor").hidden = true;
  $("#preview-link").href = `/sites/${id}/`;
  $("#download-link").href = `/api/sites/${id}/download`;
  $("#preview-frame").src = `/sites/${id}/?t=${Date.now()}`;
  $("#result").scrollIntoView({ behavior: "smooth" });
}

$("#edit-btn").addEventListener("click", async () => {
  if (!currentSiteId) return;
  const data = await fetch(`/api/sites/${currentSiteId}`).then((r) => r.json());
  $("#spec-editor").value = JSON.stringify(data.spec, null, 2);
  $("#editor").hidden = false;
  $("#editor").scrollIntoView({ behavior: "smooth" });
});

$("#rerender-btn").addEventListener("click", async () => {
  const status = $("#editor-status");
  status.classList.remove("error");
  let spec;
  try {
    spec = JSON.parse($("#spec-editor").value);
  } catch {
    status.textContent = "Invalid JSON — please fix and try again.";
    status.classList.add("error");
    return;
  }
  const res = await fetch(`/api/sites/${currentSiteId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec, theme: selectedTheme })
  });
  const data = await res.json();
  if (!res.ok) {
    status.textContent = data.error;
    status.classList.add("error");
    return;
  }
  status.textContent = "Re-rendered.";
  $("#preview-frame").src = `/sites/${currentSiteId}/?t=${Date.now()}`;
});

async function refreshGallery() {
  const sites = await fetch("/api/sites").then((r) => r.json());
  const list = $("#site-list");
  list.innerHTML = "";
  if (!sites.length) {
    list.innerHTML = '<p class="hint">Nothing yet — generate your first website above.</p>';
    return;
  }
  for (const site of sites) {
    const card = document.createElement("div");
    card.className = "card site-card";
    card.innerHTML = `
      <h3></h3>
      <div class="tag"></div>
      <div class="row">
        <a href="${site.previewUrl}" target="_blank" rel="noopener">Preview</a>
        <a href="/api/sites/${site.id}/download">Download</a>
        <button class="btn-danger btn-delete" type="button">Delete</button>
      </div>`;
    card.querySelector("h3").textContent = site.businessName;
    card.querySelector(".tag").textContent = site.tagline;
    card.querySelector(".btn-delete").addEventListener("click", async () => {
      if (!confirm(`Delete the site for "${site.businessName}"?`)) return;
      await fetch(`/api/sites/${site.id}`, { method: "DELETE" });
      refreshGallery();
    });
    list.appendChild(card);
  }
}

init();
