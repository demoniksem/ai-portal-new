"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const middleware_1 = require("../middleware");
const ai_1 = require("../schemas/ai");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
// POST /api/integrations/jira
router.post('/jira', middleware_1.authMiddleware, (0, middleware_1.validate)(ai_1.jiraIntegrationSchema), async (req, res) => {
    try {
        const { jiraUrl, jql, maxResults = 10 } = req.body;
        const authHeader = req.headers['x-jira-auth'];
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
        const data = await resp.json();
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
    }
    catch (e) {
        res.status(500).json({ error: 'Jira integration error: ' + e.message });
    }
});
// GET /api/integrations/github
router.get('/github', middleware_1.authMiddleware, (0, validation_1.validateQuery)(validation_1.querySchemas.githubIssues), async (req, res) => {
    const reqHeaders = req.headers;
    const q = req.query;
    const repo = q.repo ?? '';
    const state = q.state;
    const labels = q.labels;
    const sort = q.sort;
    try {
        let url = `https://api.github.com/repos/${repo}/issues?state=${state || 'open'}&sort=${sort || 'created'}&per_page=10`;
        if (labels)
            url += `&labels=${encodeURIComponent(labels)}`;
        const headers = { 'Accept': 'application/vnd.github+json' };
        const ghToken = (process.env.GITHUB_TOKEN || req.headers['x-github-token']);
        if (ghToken)
            headers['Authorization'] = `Bearer ${ghToken}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
            const errText = await resp.text();
            res.status(resp.status).json({ error: 'GitHub API error', details: errText });
            return;
        }
        const issues = await resp.json();
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
    }
    catch (e) {
        res.status(500).json({ error: 'GitHub integration error: ' + e.message });
    }
});
exports.default = router;
//# sourceMappingURL=integrations.js.map