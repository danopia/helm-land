import {
  dynamodb,
  objectUrlPrefix,
  presignGetObject,
} from "../deps.ts";

const deployRegion = Deno.env.get('DENO_REGION');

// https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-reference.update.html

export async function renderChartDownload(ownerId: string, chartName: string, version: string, userAgent: string | null) {
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

  const removalTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60);
  await Promise.all([
    dynamodb.executeStatement({
      Statement: `UPDATE HelmReleases SET DownloadCount = DownloadCount + 1 WHERE ChartKey=? AND ChartVersion=?`,
      Parameters: [{ S: chartKey }, { S: version }],
    }),
    dynamodb.executeStatement({
      Statement: `INSERT INTO HelmGrabs VALUE {
        'ChartOwner':?,
        'ChartName':?,
        'ChartKey':?,
        'ChartVersion':?,
        'GrabbedAt':?,
        'UserAgent':?,
        'DeployRegion':?,
        'RemoveAt':?}`,
      Parameters: [
        { S: ownerId },
        { S: chartName },
        { S: chartKey },
        { S: version },
        { S: new Date().toISOString() },
        userAgent ? { S: userAgent } : { NULL: true },
        deployRegion ? { S: deployRegion } : { NULL: true },
        { N: `${removalTimestamp}` },
      ],
    }),
  ]);

  return new Response('Redirecting!', {
    status: 302,
    headers: {
      'location': signedUrl,
    }});
}
