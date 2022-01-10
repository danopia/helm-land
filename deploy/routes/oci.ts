import { dynamodb, objectUrlPrefix } from "../deps.ts";
import { presignGrabUrl, recordGrab } from "../lib/grab.ts";

export async function renderOciManifest(requestUrl: URL, headers: Headers, ownerId: string, chartName: string, type: string, lookup: string) {
  const chartKey = `${encodeURIComponent(ownerId)}/${encodeURIComponent(chartName)}`;

  // if (!authorization) {
  //   return new Response(`{"errors":[{"code":"UNAUTHORIZED","message":"authentication required"}]}`, {
  //     status: 401,
  //     headers: {
  //       'content-type': 'application/json',
  //       'www-authenticate': `Bearer realm="${requestUrl.origin}/v2/token",service="${requestUrl.hostname}",scope="repository:${chartKey}:pull"`,
  //     }});
  // }

  if (lookup.startsWith('sha256:')) {
    return await serveLayer(chartKey, type, lookup, requestUrl.hostname, headers.get('user-agent'));
  }

  const release = await dynamodb.executeStatement({
    Statement: `SELECT Digest FROM HelmReleases WHERE ChartKey=? AND ChartVersion=?`,
    Parameters: [{ S: chartKey }, { S: lookup }],
  }).then(x => x.Items?.[0]);
  if (!release) return null;

  const digest = release?.Digest?.M?.oci?.S;
  if (!digest) return null;

  return await serveLayer(chartKey, type, digest, requestUrl.hostname, headers.get('user-agent'));
}

async function serveLayer(chartKey: string, expectedType: string, digest: string, httpHost: string, userAgent: string | null) {
  const layer = await dynamodb.executeStatement({
    Statement: `SELECT * FROM HelmOCI WHERE ChartKey=? AND Digest=?`,
    Parameters: [{ S: chartKey }, { S: digest }],
  }).then(x => x.Items?.[0]);
  if (!layer) return null;
  if (!layer.ChartVersion?.S) return null;

  const actualType = (layer.Type?.S?.startsWith('manifest.')) ? 'manifest' : 'blob';
  if (actualType !== expectedType) return null;

  switch (layer.Type?.S) {
    case 'manifest.v1': return new Response(layer.Data?.S, {
      headers: {
        'content-type': 'application/vnd.oci.image.manifest.v1+json',
        'docker-content-digest': digest,
        'docker-distribution-api-version': 'registry/2.0',
        'etag': `"${digest}"`,
        'x-content-type-options': 'nosniff',
      }});
    case 'config.v1': return new Response(layer.Data?.S, {
      headers: {
        'cache-control': 'max-age=31536000, public, immutable',
        'content-type': 'application/vnd.cncf.helm.config.v1+json',
        'docker-content-digest': digest,
        'docker-distribution-api-version': 'registry/2.0',
        'etag': `"${digest}"`,
        'x-content-type-options': 'nosniff',
      }});
    case 'content.v1': {
      const signedUrl = await presignGrabUrl(layer.Storage?.SS ?? []);
      if (!signedUrl) return null;

      const [ownerId, chartName] = chartKey.split('/').map(decodeURIComponent);
      await recordGrab({
        ownerId, chartName, chartKey,
        version: layer.ChartVersion?.S,
        httpHost, userAgent,
        protocol: 'oci',
      });

      return new Response('Redirecting!', {
        status: 302,
        headers: {
          'location': signedUrl,
          'docker-distribution-api-version': 'registry/2.0',
        }});
    }; break;
  }

}

// export async function renderOciToken(requestUrl: URL) {
//   const scope = requestUrl.searchParams.get('scope');
//   const service = requestUrl.searchParams.get('service');
//   console.log({ scope, service });
//   return new Response('TODO', {status: 500});
// }
