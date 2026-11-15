// Estado de CI y PRs abiertos de los repos configurados, con la API pública de GitHub.
// Sin token se puede (60 pedidos por hora); con GITHUB_TOKEN en el entorno, repos privados.
export function ciState(run) {
  if (!run) return 'none';
  if (run.status !== 'completed') return 'running';
  if (run.conclusion === 'success') return 'success';
  if (['failure', 'timed_out', 'startup_failure'].includes(run.conclusion)) return 'failure';
  return 'other';
}

const REPO = /^[\w.-]+\/[\w.-]+$/;

export async function fetchRepo(repo, { fetchImpl = fetch, token } = {}) {
  if (!REPO.test(repo)) throw new Error(`Repo inválido: ${repo}`);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'deskpanel' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const get = async (path) => {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, { headers });
    if (!res.ok) throw new Error(`GitHub respondió ${res.status} para ${repo}`);
    return res.json();
  };
  const [runs, pulls] = await Promise.all([
    get('/actions/runs?per_page=1'),
    get('/pulls?state=open&per_page=30'),
  ]);
  const run = runs.workflow_runs?.[0];
  return {
    repo,
    ci: ciState(run),
    branch: run?.head_branch ?? null,
    updatedAt: run?.updated_at ?? null,
    prs: Array.isArray(pulls) ? pulls.length : 0,
    url: `https://github.com/${repo}`,
  };
}

export async function fetchAll(repos, opts) {
  const results = await Promise.allSettled(repos.map((r) => fetchRepo(r, opts)));
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { repo: repos[i], ci: 'error', prs: 0, url: `https://github.com/${repos[i]}` },
  );
}

export function startGithub(bus, repos, { everyMs = 5 * 60 * 1000, token = process.env.GITHUB_TOKEN } = {}) {
  if (!repos?.length) return () => {};
  const refresh = () => fetchAll(repos, { token }).then((list) => bus.publish('github', { repos: list })).catch(() => {});
  const timer = setInterval(refresh, everyMs);
  timer.unref();
  refresh();
  return () => clearInterval(timer);
}
