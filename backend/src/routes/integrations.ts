import { Router, Response, Request } from 'express';
import { authMiddleware, validate } from '../middleware';
import { jiraIntegrationSchema } from '../schemas/ai';
import { validateQuery, querySchemas } from '../middleware/validation';

const router: Router = Router();

interface JiraBody {
  jiraUrl: string;
  jql: string;
  maxResults?: number;
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status?: { name?: string };
    assignee?: { displayName?: string };
    priority?: { name?: string };
    issuetype?: { name?: string };
  };
}

// POST /api/integrations/jira
router.post('/jira', authMiddleware, validate(jiraIntegrationSchema), async (req: Request, res: Response) => {
  try {
    const { jiraUrl, jql, maxResults = 10 } = req.body as unknown as JiraBody;
    const authHeader = req.headers['x-jira-auth'] as string | undefined;
    const resp = await fetch(`${jiraUrl}/rest/api/3/search`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ jql, maxResults })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(resp.status).json({ error: 'Jira API error', details: errText });
      return;
    }

    const data = await resp.json() as { issues?: JiraIssue[]; total?: number; [key: string]: unknown };
    const issues = (data.issues || []).map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      priority: issue.fields.priority?.name || 'Medium',
      issuetype: issue.fields.issuetype?.name || 'Task',
      url: `${jiraUrl}/browse/${issue.key}`
    }));

    res.json({ issues, total: data.total });
  } catch (e) {
    res.status(500).json({ error: 'Jira integration error: ' + (e as Error).message });
  }
});

// GET /api/integrations/github
router.get('/github', authMiddleware, validateQuery(querySchemas.githubIssues), async (req: Request, res: Response) => {
  const reqHeaders = req.headers as Record<string, string | undefined>;
  const q = req.query as { repo?: string; state?: string; labels?: string; sort?: string };
  const repo = q.repo ?? '';
  const state = q.state;
  const labels = q.labels;
  const sort = q.sort;

  try {
    let url = `https://api.github.com/repos/${repo}/issues?state=${state || 'open'}&sort=${sort || 'created'}&per_page=10`;
    if (labels) url += `&labels=${encodeURIComponent(labels)}`;

    const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json' };
    const ghToken = (process.env.GITHUB_TOKEN || (req.headers['x-github-token'] as string)) as string | undefined;
    if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const errText = await resp.text();
      res.status(resp.status).json({ error: 'GitHub API error', details: errText });
      return;
    }

    const issues = await resp.json() as Array<{ number: number; title: string; state: string; labels: Array<{ name: string }>; assignee?: { login?: string }; html_url: string; created_at: string }>;
    const formatted = issues.map(issue => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.map(l => l.name),
      assignee: issue.assignee?.login || 'Unassigned',
      url: issue.html_url,
      created_at: issue.created_at
    }));

    res.json({ issues: formatted, repo });
  } catch (e) {
    res.status(500).json({ error: 'GitHub integration error: ' + (e as Error).message });
  }
});

export default router;
