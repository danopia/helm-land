import { AttributeValue, AwsServiceError, dynamodb, ExecuteStatementInput, Manifest, ManifestOCI, objectBucket, s3 } from "../deps.ts";
import { presignGrabUrl, recordGrab } from "./grab.ts";
import { OciStore, RequestContext } from "./oci-store.ts";
import { validateOidcJwt } from "./oidc.ts";
import { issueToken, lookupToken } from "./tokens.ts";

export class OciStoreHelm implements OciStore {

  async requiresAuth(ctx: RequestContext): Promise<boolean> {
    // return ctx.action != 'pull';
    return true;
  }

  async checkAuthToken(ctx: RequestContext): Promise<boolean> {
    if (!ctx.bearerToken) return false;
    const tokenInfo = await lookupToken(ctx.bearerToken);
    if (!tokenInfo) return false;

    if (ctx.action == 'index') {
      return true;
    }
    if (!tokenInfo.scope) return false;

    const [type, key, actions] = tokenInfo.scope.split(':');
    if (!actions) return false;
    const actionList = actions.split(',');

    if (type !== 'repository') return false;
    if (key != ctx.repoName) return false;
    if (!actionList.includes(ctx.action)) return false;
    return true;
  }

  async getAuthToken(params: URLSearchParams, authHeader: string | null): Promise<string | null> {
    // anon: params has scope=, service=
    // login: params has account=<user>, client_id=docker, offline_token=true, service=
    const scopes = params.getAll('scope');

    if (authHeader?.toLowerCase().startsWith('basic ')) {
      const basicAuth = atob(authHeader.slice(6));
      if (!basicAuth.startsWith('oidc:')) return null;

      const jwtData = await validateOidcJwt(basicAuth.slice(5)).catch(err =>
        console.error(`JWT didn't verify: ${err.stack || err}`));
      if (!jwtData || !jwtData.aud) return null;

      const audiences = typeof jwtData.aud == 'string' ? [jwtData.aud] : jwtData.aud;
      if (!Array.isArray(audiences)) throw `aud claim wasn't string-array-like`;

      if (jwtData.iss?.startsWith('https://')
       && audiences.includes('https://helm-land.deno.dev')
       && typeof jwtData.sub === 'string'
       && typeof jwtData.exp === 'number') {

        switch (scopes.slice(-1)[0]) { // TODO
          case "repository:danopia/example:pull,push":
            if ( jwtData.iss === 'https://token.actions.githubusercontent.com'
              && jwtData.sub === 'repo:danopia/helm-land-push-test:ref:refs/heads/main'
            ) break;
            if ( jwtData.iss === 'https://danopia.net/kubernetes-identity'
              && jwtData.sub === 'system:serviceaccount:default:default'
            ) break;
            return null;
          case null:
          case undefined:
            // let anyone auth to the index if their auth looks reasonable
            break;
          default:
            return null;
        }

        return await issueToken(jwtData, scopes.slice(-1)[0]);
      }

    } else if (authHeader) {
      return null;
    }

    if (scopes.every(x => x.endsWith(':pull'))) return 'public-pull';
    return null;
  }

  getBlob(ctx: RequestContext, digest: string): Promise<Response | null> {
    return serveLayer(ctx, 'blob', digest, 'max-age=31536000, public, immutable');
  }
  getManifest(ctx: RequestContext, digest: string, opts?: {
    requestedTag?: string;
  }): Promise<Response | null> {
    const caching = opts?.requestedTag
      ? 'max-age=120, public' // re-resolve tags
      : 'max-age=31536000, public, immutable';
    return serveLayer(ctx, 'manifest', digest, caching);
  }

  async putBlob(ctx: RequestContext, digest: string, data: Uint8Array): Promise<void> {
    // const sha256 = await crypto.subtle.digest('SHA-256', data);
    // const calculated = `sha256:${bytesToHex(sha256)}`;
    // if (digest !== calculated) throw new Error(
    //   `Blob digest mismatch; ${calculated} (me) vs ${digest} (you)`);

    await storeLayer(ctx, 'blob', digest, data, 'application/octet-stream');
  }

  async putManifest(ctx: RequestContext, digest: string, data: Uint8Array, opts: {
    contentType?: string | null,
    desiredTag?: string | null,
  }): Promise<void> {
    const manifest: ManifestOCI = JSON.parse(new TextDecoder().decode(data));
    const manifestType = manifest.mediaType ?? opts.contentType;
    if (manifestType !== 'application/vnd.oci.image.manifest.v1+json') {
      throw new Error(`Only OCI image manifests are supported by this registry`);
    }

    if (manifestType !== manifest.mediaType && opts.desiredTag) {
      // Consider fixing the manifest to have a mediaType?
    }

    // before changing this, make sure we handle all layers properly elsewhere
    // if (manifest.layers.length !== 1) throw new Error(
    //   `Helm artifacts have only 1 layer`);

    // const sha256 = await crypto.subtle.digest('SHA-256', data);
    // const digest = `sha256:${bytesToHex(sha256)}`;

    // if (reference.startsWith('sha256:')) {
      // if (reference !== digest) throw new Error(
      //   `Manifest digest mismatch; ${digest} (me) vs ${reference} (you)`);
      await storeLayer(ctx, 'manifest', digest, data, manifestType);
    // } else {
    //   const digest = sha256
    if (opts.desiredTag) {
      const version = opts.desiredTag.replaceAll('_', '+');
      await createRelease(ctx, digest, manifest, version, manifestType);
      // throw new Error(`TODO: tagging`);
    }
  }

  // async tagManifest(ctx: RequestContext, digest: string, tag: string)

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

async function serveLayer(ctx: RequestContext, expectedType: string, digest: string, cacheControl: string) {
  const layer = await dynamodb.executeStatement({
    Statement: `SELECT * FROM HelmOCI WHERE ChartKey=? AND Digest=?`,
    Parameters: [{ S: ctx.repoName }, { S: digest }],
  }).then(x => x.Items?.[0]);
  if (!layer) return null;
  // if (!layer.ChartVersion?.S) return null;

  const endpointType = layer.EndpointType?.S ?? 'unknown';
  if (endpointType !== expectedType) return null;

  const contentType = layer.ContentType?.S ?? 'application/octet-stream';
  if (contentType.startsWith('application/vnd.cncf.helm.chart.content.')) {
    if (!ctx.isHeadersOnly) {
      const [ownerId, chartName] = ctx.repoNames;
      await recordGrab({
        ownerId, chartName, chartKey: ctx.repoName,
        version: layer.ChartVersion?.S ?? 'N/A',
        httpHost: ctx.httpHost,
        userAgent: ctx.userAgent,
        protocol: 'oci',
      });
    }
  }

  const inlineData = layer.Data?.S ?? layer.Data?.B;
  if (inlineData) {
    return new Response(inlineData, {
      headers: {
        'cache-control': cacheControl,
        'content-type': contentType,
        'docker-content-digest': digest,
        'docker-distribution-api-version': 'registry/2.0',
        'etag': `"${digest}"`,
        'x-content-type-options': 'nosniff',
      }});

  } else if (layer.Storage?.SS?.length) {
    const signedUrl = await presignGrabUrl(ctx.isHeadersOnly ? 'HEAD' : 'GET', layer.Storage?.SS ?? []);
    if (!signedUrl) return null;

    return new Response('Redirecting!', {
      status: 302,
      headers: {
        // no caching for pre-signed stuff
        'location': signedUrl,
        'docker-distribution-api-version': 'registry/2.0',
      }});
  }

  return null;
}

async function storeLayer(ctx: RequestContext, endpointType: string, digest: string, data: Uint8Array, mediaType: string) {
  let storageKey = 'Data';
  let storageValue: AttributeValue = { B: data };

  // For large blobs, fall back to S3 storage
  if (data.length > 1024*5) {
    if (endpointType !== 'blob') throw new Error(
      `Reached manifest size limit`);

    // We'll probably rename this later with a version number?
    const blobKey = `${ctx.repoName}/${digest}`;
    const object = await s3.putObject({
      Bucket: objectBucket,
      Key: blobKey,
      Body: data,
      Metadata: {
        ['endpoint']: endpointType,
        [`${digest.split(':')[0]}`]: digest.split(':')[1],
      },
      CacheControl: "public, max-age=604800, immutable",
      ContentType: mediaType,
    });

    storageKey = 'Storage';
    storageValue = { SS: [
      `s3://${objectBucket}/${blobKey}?versionId=${object.VersionId}`,
    ] };

  } else if (data[0] === '{'.charCodeAt(0)) {
    // Store JSON as a string instead of binary
    // Technically any text could be a string,
    // but most OCI things will either be JSON or gzipped
    try {
      const stringData = new TextDecoder().decode(data);
      JSON.parse(stringData);
      // const roundTripped = new TextEncoder().encode(stringData);

      // it worked, upgrade to string
      storageValue = { S: stringData };
    } catch (err) {}
  }

  await dynamodb.executeStatement({
    Statement: `INSERT INTO HelmOCI VALUE {
      'ChartKey':?,
      'Digest':?,
      'EndpointType':?,
      'ContentType':?,
      '${storageKey}':?}`,
    Parameters: [
      { S: ctx.repoName },
      { S: digest },
      { S: endpointType },
      { S: 'application/octet-stream' },
      storageValue,
    ],
  }).catch(expectDuplicateItem);
}

async function createRelease(ctx: RequestContext, manifestDigest: string, manifest: ManifestOCI, chartVersion: string, manifestType: string) {

  // const blobTypes = new Map<string, string>();
  // // blobTypes.set(manifestDigest, manifest.mediaType);
  // // blobTypes.set(manifest.config.digest, manifest.config.mediaType);
  // for (const layer of manifest.layers) {
  //   blobTypes.set(layer.digest, manifest.config.mediaType);
  // }

  // Assign all the layers their metadata
  // Also makes sure they all exist and such
  const [_, configResult] = await Promise.all([
    dynamodb.executeStatement({
      Statement: `UPDATE HelmOCI
        SET ChartVersion = ?
        SET ContentType = ?
        WHERE ChartKey = ?
        AND Digest = ?
        AND EndpointType = 'manifest'`,
      Parameters: [
        { S: chartVersion },
        { S: manifestType },
        { S: ctx.repoName },
        { S: manifestDigest },
      ] }),

    dynamodb.executeStatement({
      Statement: `UPDATE HelmOCI
        SET ChartVersion = ?
        SET ContentType = ?
        WHERE ChartKey = ?
        AND Digest = ?
        AND EndpointType = 'blob'
        RETURNING ALL NEW *`, // return the config data
      Parameters: [
        { S: chartVersion },
        { S: manifest.config.mediaType },
        { S: ctx.repoName },
        { S: manifest.config.digest },
      ] }),

    ...Object.values(manifest.layers).map(layer =>
      dynamodb.executeStatement({
        Statement: `UPDATE HelmOCI
          SET ChartVersion = ?
          SET ContentType = ?
          WHERE ChartKey = ?
          AND Digest = ?
          AND EndpointType = 'blob'`,
        Parameters: [
          { S: chartVersion },
          { S: layer.mediaType },
          { S: ctx.repoName },
          { S: layer.digest },
        ] })),
  ]);

  // const layer = await dynamodb.executeStatement({
  //   Statement: `SELECT * FROM HelmOCI WHERE ChartKey=? AND Digest=?`,
  //   Parameters: [{ S: ctx.repoName }, { S: manifest. }],
  // }).then(x => x.Items?.[0]);
  // if (!layer) return null;
  // if (!layer.ChartVersion?.S) return null;

  const configBlob = configResult.Items?.[0]?.Data?.S;
  if (!configBlob) throw new Error(`Failed to locate helm config layer`);
  console.log(configBlob);

  const chartMeta: AttributeValue['M'] & {} = {};

  for (const [key, val] of Object.entries(JSON.parse(configBlob))) {
    if (typeof val === 'string' && val.length) {
      chartMeta[key] = { S: val };
    } else if (Array.isArray(val) && val.length && val.every(x => typeof x === 'string')) {
      chartMeta[key] = { SS: val };
    } else {
      console.error(`WARN: dropping chart metadata ${key}=${JSON.stringify(val)}`);
    }
  }

  // Create the actual release
  await dynamodb.executeStatement({
    Statement: `INSERT INTO HelmReleases VALUE {
      'ChartKey':?,
      'ChartVersion':?,
      'ReleasedAt':?,
      'ChartMeta':?,
      'Digest':?,
      'DownloadCount':?}`,
    Parameters: [
      { S: ctx.repoName },
      { S: chartVersion },
      { S: new Date().toISOString() },
      { M: chartMeta },
      { M: {
        "sha256": { S: manifest.layers[0].digest.split(':')[1] },
        "oci": { S: manifestDigest },
      } },
      { N: "0" },
    ],
  });

  // Make sure the chart is registered as well
  await dynamodb.executeStatement({
    Statement: `INSERT INTO HelmCharts VALUE {
      'ChartOwner':?,
      'ChartName':?,
      'ChartKey':?}`,
    Parameters: [
      { S: ctx.repoNames.slice(0, -1).join('/') },
      { S: ctx.repoNames.slice(-1)[0] },
      { S: ctx.repoName },
    ],
  }).catch(expectDuplicateItem);
}

function expectDuplicateItem(err: unknown) {
  if (err instanceof AwsServiceError) {
    if (err.shortCode === 'DuplicateItemException') {
      return;
    }
  }
  throw err;
}
