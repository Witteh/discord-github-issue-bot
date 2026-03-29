import { Octokit } from '@octokit/rest';
import { config } from '../config';

const octokit = new Octokit({
  auth: config.githubToken,
  request: { timeout: 10_000 },
});

export async function listRepos(): Promise<string[]> {
  const repos: string[] = [];
  for await (const response of octokit.paginate.iterator(octokit.repos.listForAuthenticatedUser, {
    sort: 'pushed',
    per_page: 100,
  })) {
    for (const repo of response.data) {
      repos.push(repo.full_name);
    }
  }
  return repos;
}

export async function listLabels(owner: string, repo: string): Promise<string[]> {
  const labels: string[] = [];
  for await (const response of octokit.paginate.iterator(octokit.issues.listLabelsForRepo, {
    owner,
    repo,
    per_page: 100,
  })) {
    for (const label of response.data) {
      labels.push(label.name);
    }
  }
  return labels;
}

export async function createIssue(params: {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}) {
  const { data } = await octokit.issues.create(params);
  return { number: data.number, htmlUrl: data.html_url };
}
