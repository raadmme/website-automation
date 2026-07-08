const $ = (sel) => document.querySelector(sel);

const THEME_SWATCHES = {
  warm: "hsl(25 55% 35%)",
  forest: "hsl(150 40% 26%)",
  slate: "hsl(220 45% 32%)",
  wine: "hsl(350 50% 32%)",
  custom: "conic-gradient(hsl(0 60% 45%), hsl(90 60% 45%), hsl(180 60% 45%), hsl(270 60% 45%), hsl(0 60% 45%))"
};

let selectedTheme = "warm";
let selectedHue = 25;
let currentSiteId = null;
let availableThemes = [];

function buildThemePicker(picker, current, onSelect) {
  picker.innerHTML = "";
  for (const theme of availableThemes) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "theme-chip" + (theme === current ? " active" : "");
    chip.dataset.theme = theme;
    chip.innerHTML = `<span class="swatch" style="background:${THEME_SWATCHES[theme] ?? "#888"}"></span>${theme}`;
    chip.addEventListener("click", () => {
      picker.querySelectorAll(".theme-chip").forEach((c) => c.classList.toggle("active", c === chip));
      onSelect(theme);
    });
    picker.appendChild(chip);
  }
}

function updateHueRow() {
  $("#hue-row").hidden = selectedTheme !== "custom";
  $("#hue-swatch").style.background = `hsl(${selectedHue} 50% 33%)`;
}

async function init() {
  availableThemes = await fetch("/api/themes").then((r) => r.json());
  availableThemes.push("custom");
  buildThemePicker($("#theme-picker"), selectedTheme, (theme) => {
    selectedTheme = theme;
    updateHueRow();
  });
  $("#hue").addEventListener("input", () => {
    selectedHue = Number($("#hue").value);
    updateHueRow();
  });
  updateHueRow();
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
  if ($("#logo").files[0]) formData.append("logo", $("#logo").files[0]);
  for (const file of [...$("#photos").files].slice(0, 4)) formData.append("photos", file);
  formData.append("multiPage", $("#multi-page").checked ? "true" : "false");
  if (selectedTheme === "custom") formData.append("hue", String(selectedHue));

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
  inlineEditing = false;
  $("#inline-edit-btn").textContent = "Edit in Preview";
  $("#result-status").textContent = "";
  $("#result").hidden = false;
  $("#editor").hidden = true;
  $("#preview-link").href = `/sites/${id}/`;
  $("#download-link").href = `/api/sites/${id}/download`;
  $("#preview-frame").src = `/sites/${id}/?t=${Date.now()}`;
  buildThemePicker($("#result-theme-picker"), selectedTheme, async (theme) => {
    selectedTheme = theme;
    updateHueRow();
    const body = { theme };
    if (theme === "custom") body.hue = selectedHue;
    const res = await fetch(`/api/sites/${id}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.ok) $("#preview-frame").src = `/sites/${id}/?t=${Date.now()}`;
  });
  $("#result").scrollIntoView({ behavior: "smooth" });
}

$("#edit-btn").addEventListener("click", async () => {
  if (!currentSiteId) return;
  const data = await fetch(`/api/sites/${currentSiteId}`).then((r) => r.json());
  $("#spec-editor").value = JSON.stringify(data.spec, null, 2);
  $("#formspree-id").value = data.formspreeId ?? "";
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
  const body = { spec, theme: selectedTheme, formspreeId: $("#formspree-id").value.trim() };
  if (selectedTheme === "custom") body.hue = selectedHue;
  const res = await fetch(`/api/sites/${currentSiteId}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
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

$("#regen-btn").addEventListener("click", async () => {
  if (!currentSiteId) return;
  const status = $("#editor-status");
  const btn = $("#regen-btn");
  status.classList.remove("error");
  status.textContent = "Regenerating section…";
  btn.disabled = true;
  try {
    const res = await fetch(`/api/sites/${currentSiteId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: $("#regen-section").value,
        instructions: $("#regen-instructions").value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    $("#spec-editor").value = JSON.stringify(data.spec, null, 2);
    $("#preview-frame").src = `/sites/${currentSiteId}/?t=${Date.now()}`;
    status.textContent = "Section regenerated.";
  } catch (err) {
    status.textContent = err.message;
    status.classList.add("error");
  } finally {
    btn.disabled = false;
  }
});

/* ---- Inline visual editing (same-origin preview iframe) ---- */

let inlineEditing = false;

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => o?.[k], obj);
  if (target && typeof target === "object") target[last] = value;
}

$("#inline-edit-btn").addEventListener("click", async () => {
  if (!currentSiteId) return;
  const btn = $("#inline-edit-btn");
  const status = $("#result-status");
  status.classList.remove("error");
  const doc = $("#preview-frame").contentDocument;
  if (!doc) return;

  if (!inlineEditing) {
    // Replace decorated text with raw spec values so edits round-trip cleanly.
    const data = await fetch(`/api/sites/${currentSiteId}`).then((r) => r.json());
    for (const el of doc.querySelectorAll("[data-edit]")) {
      const value = getPath(data.spec, el.dataset.edit);
      if (typeof value !== "string") continue;
      el.textContent = value;
      if (el.dataset.multiline) el.style.whiteSpace = "pre-wrap";
      el.contentEditable = "true";
      el.style.outline = "1px dashed rgba(128, 96, 64, 0.6)";
      el.style.outlineOffset = "3px";
    }
    inlineEditing = true;
    btn.textContent = "Save Preview Edits";
    status.textContent = "Click any outlined text in the preview to edit it, then save.";
    return;
  }

  // Save: read edited values back into the spec and re-render.
  btn.disabled = true;
  status.textContent = "Saving…";
  try {
    const data = await fetch(`/api/sites/${currentSiteId}`).then((r) => r.json());
    for (const el of doc.querySelectorAll("[data-edit][contenteditable]")) {
      const raw = el.dataset.multiline
        ? el.innerText.replace(/\n{2,}/g, "\n\n").trim()
        : el.textContent.replace(/\s+/g, " ").trim();
      if (typeof getPath(data.spec, el.dataset.edit) === "string") {
        setPath(data.spec, el.dataset.edit, raw);
      }
    }
    const res = await fetch(`/api/sites/${currentSiteId}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: data.spec })
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error);
    inlineEditing = false;
    btn.textContent = "Edit in Preview";
    status.textContent = "Saved.";
    $("#preview-frame").src = `/sites/${currentSiteId}/?t=${Date.now()}`;
    if (!$("#editor").hidden) $("#spec-editor").value = JSON.stringify(data.spec, null, 2);
  } catch (err) {
    status.textContent = err.message;
    status.classList.add("error");
  } finally {
    btn.disabled = false;
  }
});

/* ---- Publish to GitHub Pages ---- */

$("#publish-btn").addEventListener("click", async () => {
  if (!currentSiteId) return;
  const status = $("#result-status");
  const btn = $("#publish-btn");
  status.classList.remove("error");
  const repo = prompt("Name for the GitHub repository (lowercase letters, digits, hyphens):", `site-${currentSiteId}`);
  if (!repo) return;
  btn.disabled = true;
  status.textContent = "Publishing to GitHub Pages… this can take a minute.";
  try {
    const res = await fetch(`/api/sites/${currentSiteId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    status.innerHTML = "";
    const link = document.createElement("a");
    link.href = data.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = data.url;
    status.append("Published: ", link, " (the page can take a few minutes to go live)");
  } catch (err) {
    status.textContent = err.message;
    status.classList.add("error");
  } finally {
    btn.disabled = false;
  }
});

$("#revise-btn").addEventListener("click", async () => {
  if (!currentSiteId) return;
  const message = $("#revise-message").value.trim();
  const status = $("#editor-status");
  const btn = $("#revise-btn");
  status.classList.remove("error");
  if (!message) {
    status.textContent = "Describe the change you would like.";
    status.classList.add("error");
    return;
  }
  status.textContent = "Revising the site…";
  btn.disabled = true;
  try {
    const res = await fetch(`/api/sites/${currentSiteId}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    $("#spec-editor").value = JSON.stringify(data.spec, null, 2);
    $("#preview-frame").src = `/sites/${currentSiteId}/?t=${Date.now()}`;
    $("#revise-message").value = "";
    status.textContent = "Site revised.";
  } catch (err) {
    status.textContent = err.message;
    status.classList.add("error");
  } finally {
    btn.disabled = false;
  }
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
