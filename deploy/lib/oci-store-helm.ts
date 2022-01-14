import { AttributeValue, dynamodb, ExecuteStatementInput } from "../deps.ts";
import { presignGrabUrl, recordGrab } from "../lib/grab.ts";
import { OciStore, RequestContext } from "./oci-store.ts";

export class OciStoreHelm implements OciStore {

  async requiresAuth(ctx: RequestContext): Promise<boolean> {
    return ctx.action != 'pull';
  }
  async checkAuthToken(ctx: RequestContext): Promise<boolean> {
    // return ctx.bearerToken == 'hiiiiiiiiiiiiiiiiiiiiiiiiiii';
    return false;
  }
  async getAuthToken(params: URLSearchParams, authHeader: string | null): Promise<string | null> {
    // TODO: let some people get tokens!
    // anon: params has scope=, service=
    // login: params has account=<user>, client_id=docker, offline_token=true, service=
    console.log('getAuthToken', params.toString, authHeader)
    if (authHeader == 'Basic aGk6aGk=') { // hi:hi
      return 'hiiiiiiiiiiiiiiiiiiiiiiiiiii';
    } else {
      return null;
    }
  }

  getBlob(ctx: RequestContext, digest: string): Promise<Response | null> {
    return serveLayer(ctx, 'blob', digest);
  }
  getManifest(ctx: RequestContext, digest: string): Promise<Response | null> {
    return serveLayer(ctx, 'manifest', digest);
  }

  async resolveTag(ctx: RequestContext, reference: string) {
    // + isn't valid in OCI, _ isn't valid in Helm
    const versionSpec = reference.replaceAll('_', '+');

    const release = await dynamodb.executeStatement({
      Statement: `SELECT Digest FROM HelmReleases WHERE ChartKey=? AND ChartVersion=?`,
      Parameters: [{ S: ctx.repoName }, { S: versionSpec }],
    }).then(x => x.Items?.[0]);
    if (!release) return null;

    const digest = release?.Digest?.M?.oci?.S;
    if (!digest) return null;

    return digest;
  }

  // TODO: how can we do max page size on the server side?
  async listTags(ctx: RequestContext, maxCount?: number, lastReceived?: string) {
    const lastVersion = lastReceived?.replaceAll('_', '+');
    const tagPage = lastReceived
      ? await fetchVersionTags({
          Statement: `SELECT ChartVersion FROM HelmReleases WHERE ChartKey=? AND ChartVersion>?`,
          Parameters: [{ S: ctx.repoName }, { S: lastVersion }],
        })
      : await fetchVersionTags({
          Statement: `SELECT ChartVersion FROM HelmReleases WHERE ChartKey=?`,
          Parameters: [{ S: ctx.repoName }],
        });

    if (maxCount) return tagPage.slice(0, maxCount);
    return tagPage;
  }
}

async function fetchVersionTags(statement: Pick<ExecuteStatementInput, 'Statement' | 'Parameters'>) {
  const tagPages = new Array<Array<string>>();
  let NextToken: string | null = null;
  do {
    const resp = await dynamodb.executeStatement({
      ...statement, NextToken,
      ReturnConsumedCapacity: 'TOTAL',
    });
    tagPages.push(extractVersionTags(resp.Items));
    NextToken = (resp.NextToken ?? null) as string | null;
    console.log(resp.ConsumedCapacity);
  } while (NextToken);
  return tagPages.flat(1);
}
function extractVersionTags(list?: Array<AttributeValue['M']> | null) {
  if (!list) return [];
  return list
    .map(x => x?.ChartVersion?.S ?? '')
    .filter(x => x)
    .map(x => x.replaceAll('_', '+'));
}


async function serveLayer(ctx: RequestContext, expectedType: string, digest: string) {
  const layer = await dynamodb.executeStatement({
    Statement: `SELECT * FROM HelmOCI WHERE ChartKey=? AND Digest=?`,
    Parameters: [{ S: ctx.repoName }, { S: digest }],
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
      const signedUrl = await presignGrabUrl(ctx.isHeadersOnly ? 'HEAD' : 'GET', layer.Storage?.SS ?? []);
      if (!signedUrl) return null;

      if (!ctx.isHeadersOnly) {
        const [ownerId, chartName] = ctx.repoNames;
        await recordGrab({
          ownerId, chartName, chartKey: ctx.repoName,
          version: layer.ChartVersion?.S,
          httpHost: ctx.httpHost,
          userAgent: ctx.userAgent,
          protocol: 'oci',
        });
      }

      return new Response('Redirecting!', {
        status: 302,
        headers: {
          'location': signedUrl,
          'docker-distribution-api-version': 'registry/2.0',
        }});
    }; break;
  }

  return null;
}
