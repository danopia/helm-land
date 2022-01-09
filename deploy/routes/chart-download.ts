import {
  dynamodb,
  objectUrlPrefix,
  presignGetObject,
} from "../deps.ts";

export async function renderChartDownload(ownerId: string, chartName: string, version: string) {
  const chartKey = `${encodeURIComponent(ownerId)}/${encodeURIComponent(chartName)}`;
  const chart = await dynamodb.executeStatement({
    Statement: `SELECT Download FROM HelmReleases WHERE ChartKey=? AND ChartVersion=?`,
    Parameters: [{ S: chartKey }, { S: version }],
  }).then(x => x.Items?.[0]);
  if (!chart) return null;

  const knownUrl = chart.Download?.SS?.find(x => x.startsWith(objectUrlPrefix));
  if (!knownUrl) return null;

  const { hostname, pathname, searchParams } = new URL(knownUrl);
  const params: Record<string,string> = {};
  if (searchParams.has('versionId')) {
    params.versionId = searchParams.get('versionId')!;
  }
  const signedUrl = await presignGetObject(hostname, pathname.slice(1), params);

  await dynamodb.executeStatement({
    Statement: `UPDATE HelmReleases SET DownloadCount = DownloadCount + 1 WHERE ChartKey=? AND ChartVersion=?`,
    Parameters: [{ S: chartKey }, { S: version }],
  });

  return new Response('Redirecting!', {
    status: 302,
    headers: {
      'location': signedUrl,
    }});
}
