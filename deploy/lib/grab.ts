import { dynamodb, objectUrlPrefix, presignGetObject } from "../deps.ts";

export async function presignGrabUrl(method: 'GET' | 'HEAD', urlOptions: string[]) {
  const knownUrl = urlOptions.find(x => x.startsWith(objectUrlPrefix));
  if (!knownUrl) return null;

  const { hostname, pathname, searchParams } = new URL(knownUrl);
  const params: Record<string,string> = {};
  if (searchParams.has('versionId')) {
    params.versionId = searchParams.get('versionId')!;
  }

  return await presignGetObject(method, hostname, pathname.slice(1), params);
}

const deployRegion = Deno.env.get('DENO_REGION');

export async function recordGrab(opts: {
  ownerId: string,
  chartName: string,
  chartKey: string,
  version: string,
  userAgent: string | null,
  httpHost: string,
  protocol: 'http' | 'oci',
}) {
  const expiryTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60);
  await Promise.all([

    dynamodb.executeStatement({
      Statement: `UPDATE HelmReleases SET DownloadCount = DownloadCount + 1 WHERE ChartKey=? AND ChartVersion=?`,
      Parameters: [{ S: opts.chartKey }, { S: opts.version }],
    }),

    dynamodb.executeStatement({
      Statement: `INSERT INTO HelmGrabs VALUE {
        'ChartOwner':?,
        'ChartName':?,
        'ChartKey':?,
        'ChartVersion':?,
        'GrabbedAt':?,
        'UserAgent':?,
        'Protocol':?,
        'DeployHost':?,
        'DeployRegion':?,
        'RemoveAt':?}`,
      Parameters: [
        { S: opts.ownerId },
        { S: opts.chartName },
        { S: opts.chartKey },
        { S: opts.version },
        { S: new Date().toISOString() },
        opts.userAgent ? { S: opts.userAgent } : { NULL: true },
        { S: opts.protocol },
        { S: opts.httpHost },
        deployRegion ? { S: deployRegion } : { NULL: true },
        { N: `${expiryTimestamp}` },
      ],
    }),

  ]);
  console.log(`Recorded grab of ${opts.chartKey}@${opts.version} by ${opts.userAgent}`);
}
