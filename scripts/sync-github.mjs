import fs from "node:fs/promises";

const OWNER = "nararyajayautamagroub";
const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

async function gh(path) {
  const r = await fetch(`https://api.github.com${path}`, { headers });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}
async function optional(path, fallback) { try { return await gh(path); } catch { return fallback; } }

const config = JSON.parse(await fs.readFile("sync-config.json","utf8"));
const repos = await gh(`/user/repos?per_page=100&affiliation=owner&sort=updated`);
const allowed = new Map(config.repositories.map(x => [x.name, x]));
const selected = repos.filter(r => r.owner?.login === OWNER);

const records = [];
for (const r of selected) {
  const cfg = allowed.get(r.name) || { company:"UNMAPPED", unit:"UNMAPPED", project:r.name };
  const commits = await optional(`/repos/${OWNER}/${r.name}/commits?per_page=1`, []);
  const workflows = await optional(`/repos/${OWNER}/${r.name}/actions/runs?per_page=1`, {workflow_runs:[]});
  const branches = await optional(`/repos/${OWNER}/${r.name}/branches?per_page=100`, []);
  const issues = await optional(`/repos/${OWNER}/${r.name}/issues?state=open&per_page=100`, []);
  const prs = issues.filter(x => !!x.pull_request).length;
  const openIssues = issues.length - prs;
  const lastCommit = commits[0] || null;
  const run = workflows.workflow_runs?.[0] || null;
  records.push({
    id:r.id,name:r.name,fullName:r.full_name,private:r.private,archived:r.archived,
    url:r.html_url,defaultBranch:r.default_branch,description:r.description || "",
    language:r.language || "Unknown",languagesUrl:r.languages_url,sizeKb:r.size,
    stars:r.stargazers_count,forks:r.forks_count,openIssues,openPullRequests:prs,
    branches:branches.length,updatedAt:r.updated_at,pushedAt:r.pushed_at,
    latestCommit:lastCommit ? {sha:lastCommit.sha,message:lastCommit.commit?.message?.split("\n")[0] || "",date:lastCommit.commit?.author?.date || lastCommit.commit?.committer?.date || null,url:lastCommit.html_url} : null,
    latestWorkflow:run ? {name:run.name,status:run.status,conclusion:run.conclusion,updatedAt:run.updated_at,url:run.html_url} : null,
    company:cfg.company,unit:cfg.unit,project:cfg.project
  });
}

const snapshot = {
  generatedAt:new Date().toISOString(),
  owner:OWNER,
  source:"GitHub API",
  repositoryCount:records.length,
  records
};
const js = `window.GITHUB_LIVE_DATA=${JSON.stringify(snapshot)};\n`;
await fs.writeFile("github-live.js", js);
console.log(`Synced ${records.length} repositories at ${snapshot.generatedAt}`);
