interface JiraIssueFields {
  summary: string;
  status?: { name?: string };
  assignee?: { displayName?: string };
  priority?: { name?: string };
  issuetype?: { name?: string };
}

interface JiraSearchResult {
  issues: Array<{ key: string; fields: JiraIssueFields }>;
  total: number;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: Array<{ name: string }>;
  assignee?: { login?: string };
  html_url: string;
  created_at: string;
}

class IntegrationsService {
  async proxyJira(data: { jiraUrl: string; jql: string; maxResults?: number }, authHeader?: string): Promise<any> {
    const resp = await fetch(`${data.jiraUrl}/rest/api/3/search`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ jql: data.jql, maxResults: data.maxResults || 10 })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { error: 'Jira API error', details: errText, status: resp.status };
    }

    const result = await resp.json() as JiraSearchResult;
    const issues = result.issues.map((issue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      priority: issue.fields.priority?.name || 'Medium',
      issuetype: issue.fields.issuetype?.name || 'Task',
      url: `${data.jiraUrl}/browse/${issue.key}`
    }));

    return { issues, total: result.total };
  }

  async proxyGitHub(data: { repo: string; state?: string; labels?: string; sort?: string }, ghToken?: string): Promise<any> {
    let url = `https://api.github.com/repos/${data.repo}/issues?state=${data.state || 'open'}&sort=${data.sort || 'created'}&per_page=10`;
    if (data.labels) url += `&labels=${encodeURIComponent(data.labels)}`;

    const headers: Record<string, string> = { 'Accept': 'application/vnd.github+json' };
    if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const errText = await resp.text();
      return { error: 'GitHub API error', details: errText, status: resp.status };
    }

    const issues = await resp.json() as GitHubIssue[];
    const formatted = issues.map((issue) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.map((l) => l.name),
      assignee: issue.assignee?.login || 'Unassigned',
      url: issue.html_url,
      created_at: issue.created_at
    }));

    return { issues: formatted, repo: data.repo };
  }
}

export { IntegrationsService };