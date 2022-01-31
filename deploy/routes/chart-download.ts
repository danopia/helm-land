import {
  dynamodb,
} from "../deps.ts";
import { presignGrabUrl, recordGrab } from "../lib/grab.ts";

export async function renderChartDownload(method: 'GET' | 'HEAD', ownerId: string, chartName: string, version: string, httpHost: string, userAgent: string | null) {
  const chartKey = `${encodeURIComponent(ownerId)}/${encodeURIComponent(chartName)}`;
  const chart = await dynamodb.executeStatement({
    Statement: `SELECT Download, Digest FROM HelmReleases WHERE ChartKey=? AND ChartVersion=?`,
    Parameters: [{ S: chartKey }, { S: version }],
  }).then(x => x.Items?.[0]);
  if (!chart) return null;

  if (chart.Download?.SS?.length) {

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

  } else if (chart.Digest?.M?.sha256?.S) {
    const layer = await dynamodb.executeStatement({
      Statement: `SELECT Data FROM HelmOCI WHERE ChartKey=? AND Digest=?`,
      Parameters: [{ S: chartKey }, { S: `sha256:${chart.Digest?.M?.sha256?.S}` }],
    }).then(x => x.Items?.[0]);
    if (!layer) return null;

    const inlineData = layer.Data?.S ?? layer.Data?.B;
    if (!inlineData) return null;

    await recordGrab({
      ownerId, chartName, chartKey, version,
      httpHost, userAgent,
      protocol: 'http',
    });

    return new Response(inlineData, {
      headers: {
        'cache-control': `max-age=31536000, public, immutable`,
        'content-type': `application/gzip`,
        'x-content-type-options': 'nosniff',
      }});
  }

}
