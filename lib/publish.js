import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);

export const REPO_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/;

/**
 * Publish a generated site directory to GitHub Pages using the gh CLI.
 * Creates (or updates) a public repo named `repo` under the authenticated
 * user and enables Pages on the main branch. Returns { url, repoUrl }.
 */
export async function publishSite(dir, repo) {
  if (!REPO_NAME_RE.test(repo)) {
    const err = new Error("Repository name must be 1-64 letters, digits, or hyphens.");
    err.status = 400;
    throw err;
  }
  await fs.access(path.join(dir, "index.html"));

  let owner;
  try {
    owner = (await run("gh", ["api", "user", "-q", ".login"])).stdout.trim();
  } catch {
    const err = new Error("GitHub CLI is not available or not authenticated. Run `gh auth login` on the server.");
    err.status = 400;
    throw err;
  }

  const git = (...args) => run("git", args, { cwd: dir });

  // The site directory becomes its own repository (generated/ is gitignored
  // in the app repo, so this nested repo is isolated).
  try {
    await fs.access(path.join(dir, ".git"));
  } catch {
    await git("init", "-b", "main");
  }
  await git("add", "-A");
  try {
    await git(
      "-c", "user.name=website-automation",
      "-c", "user.email=website-automation@localhost",
      "commit", "-m", "Publish site"
    );
  } catch (err) {
    if (!/nothing to commit/.test(String(err.stderr ?? err.message))) throw err;
  }

  const repoUrl = `https://github.com/${owner}/${repo}`;
  try {
    await run("gh", ["repo", "create", repo, "--public", "--source=.", "--push"], { cwd: dir });
  } catch (err) {
    if (!/already exists/i.test(String(err.stderr ?? err.message))) {
      const friendly = new Error(`Could not create repository: ${String(err.stderr ?? err.message).trim()}`);
      friendly.status = 400;
      throw friendly;
    }
    // Repo exists (republish): point origin at it and push the update.
    try { await git("remote", "remove", "origin"); } catch { /* no origin yet */ }
    await git("remote", "add", "origin", `${repoUrl}.git`);
    await git("push", "-u", "origin", "main", "--force");
  }

  // Enable GitHub Pages from the main branch root (409 = already enabled).
  try {
    await run("gh", [
      "api", `repos/${owner}/${repo}/pages`, "-X", "POST",
      "-f", "source[branch]=main", "-f", "source[path]=/"
    ]);
  } catch (err) {
    if (!/409|already exist/i.test(String(err.stderr ?? err.message))) throw err;
  }

  return { url: `https://${owner}.github.io/${repo}/`, repoUrl };
}
