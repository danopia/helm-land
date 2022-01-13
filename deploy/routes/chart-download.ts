import {
  dynamodb,
} from "../deps.ts";
import { presignGrabUrl, recordGrab } from "../lib/grab.ts";

export async function renderChartDownload(method: 'GET' | 'HEAD', ownerId: string, chartName: string, version: string, httpHost: string, userAgent: string | null) {
  const chartKey = `${encodeURIComponent(ownerId)}/${encodeURIComponent(chartName)}`;
  const chart = await dynamodb.executeStatement({
    Statement: `SELECT Download FROM HelmReleases WHERE ChartKey=? AND ChartVersion=?`,
    Parameters: [{ S: chartKey }, { S: version }],
  }).then(x => x.Items?.[0]);
  if (!chart) return null;

  const signedUrl = await presignGrabUrl(method, chart.Download?.SS ?? []);
  if (!signedUrl) return null;

  await recordGrab({
    ownerId, chartName, chartKey, version,
    httpHost, userAgent,
    protocol: 'http',
  });

  return new Response('Redirecting!', {
    status: 302,
    headers: {
      'location': signedUrl,
    }});
}
