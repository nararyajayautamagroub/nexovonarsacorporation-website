import fs from "node:fs/promises";

const OWNER = "nararyajayautamagroub";
const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
};

async function gh(path) {
  const r = await fetch(`https://api.github.com${path}`, { headers });
  if (!r.ok) throw new Error(`${r.status} ${path}: ${await r.text()}`);
  return r.json();
}
async function optional(path, fallback) {
  try { return await gh(path); } catch (error) {
    console.info(`GitHub API fallback: ${error.message}`);
    return fallback;
  }
}
async function paged(path, maxPages = 10) {
  const rows = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await gh(`${path}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

const config = JSON.parse(await fs.readFile("sync-config.json", "utf8"));
const allowed = new Map(config.repositories.map(x => [x.name, x]));
let repos = [];

try {
  repos = await paged(`/user/repos?affiliation=owner&visibility=all&sort=updated`);
} catch (error) {
  console.info(`Authenticated repository listing unavailable: ${error.message}`);
  repos = await paged(`/users/${OWNER}/repos?type=owner&sort=updated`);
}

const selected = repos.filter(r => r.owner?.login === OWNER);
const records = [];

for (const r of selected) {
  const cfg = allowed.get(r.name) || {
    company: "UNMAPPED",
    unit: "UNMAPPED",
    project: r.name
  };

  const commits = await optional(`/repos/${OWNER}/${r.name}/commits?per_page=1`, []);
  const workflows = await optional(`/repos/${OWNER}/${r.name}/actions/runs?per_page=1`, { workflow_runs: [] });
  const branches = await optional(`/repos/${OWNER}/${r.name}/branches?per_page=100`, []);
  const issues = await optional(`/repos/${OWNER}/${r.name}/issues?state=open&per_page=100`, []);
  const root = await optional(`/repos/${OWNER}/${r.name}/contents/${r.default_branch}`, []);
  const rootItems = Array.isArray(root) ? root : [];
  const topLevelFiles = rootItems.filter(x => x.type === 'file').map(x => x.name).sort();
  const topLevelDirectories = rootItems.filter(x => x.type === 'dir').map(x => x.name).sort();
  const manifests = ['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','requirements.txt','pyproject.toml','Cargo.toml','go.mod','composer.json','README.md','LICENSE'].filter(x => rootItems.some(y => y.name === x));
  const prs = issues.filter(x => !!x.pull_request).length;
  const lastCommit = commits[0] || null;
  const run = workflows.workflow_runs?.[0] || null;

  records.push({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    archived: r.archived,
    disabled: r.disabled,
    fork: r.fork,
    url: r.html_url,
    defaultBranch: r.default_branch,
    description: r.description || "",
    language: r.language || "Unknown",
    sizeKb: r.size,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: issues.length - prs,
    openPullRequests: prs,
    branches: branches.length,
    topLevelFileCount: topLevelFiles.length,
    topLevelDirectoryCount: topLevelDirectories.length,
    topLevelFiles,
    topLevelDirectories,
    manifests,
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at,
    latestCommit: lastCommit ? {
      sha: lastCommit.sha,
      message: lastCommit.commit?.message?.split("\n")[0] || "",
      date: lastCommit.commit?.author?.date || lastCommit.commit?.committer?.date || null,
      url: lastCommit.html_url
    } : null,
    latestWorkflow: run ? {
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      updatedAt: run.updated_at,
      url: run.html_url
    } : null,
    company: cfg.company,
    unit: cfg.unit,
    project: cfg.project
  });
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  owner: OWNER,
  source: TOKEN ? "GitHub API (authenticated)" : "GitHub API (public fallback)",
  repositoryCount: records.length,
  unmappedCount: records.filter(r => r.company === "UNMAPPED").length,
  records,
  integrity: {
    mappedCount: records.filter(r => r.company !== 'UNMAPPED').length,
    unmappedCount: records.filter(r => r.company === 'UNMAPPED').length,
    privateCount: records.filter(r => r.private).length,
    staleCount: records.filter(r => r.pushedAt && Date.now() - new Date(r.pushedAt).getTime() > 30 * 24 * 60 * 60 * 1000).length
  }
};

await fs.writeFile(
  "github-live.js",
  `window.GITHUB_LIVE_DATA=${JSON.stringify(snapshot)};\n`,
  "utf8"
);

console.log(`Synced ${records.length} repositories; ${snapshot.unmappedCount} unmapped; ${snapshot.generatedAt}`);
