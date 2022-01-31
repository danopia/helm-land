import { OciStore, RequestContext } from "../lib/oci-store.ts";

const tagPattern = /^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$/;
const digestPattern = /^[a-z0-9+._-]+:[a-zA-Z0-9=_-]+$/;

export async function routeOciRequest(store: OciStore, request: Request, url: URL) {
  const pathParts = url.pathname.split('/').slice(2);

  if (pathParts.length == 1 && pathParts[0] == 'token') {
    if (request.method !== 'GET')
      return new Response('Must be GET', {
        status: 405,
      });
    if (url.searchParams.get('service') != url.hostname)
      return new Response('I expected more parameters', {
        status: 400,
      });
    const token = await store.getAuthToken(url.searchParams, request.headers.get('authorization'));
    if (!token) console.log('-->', 'Token request declined');
    return tokenResponse(token);
  }

  const isDir = (pathParts.slice(-1)[0] == '');
  if (isDir) pathParts.pop();
  const parameter = pathParts.pop();
  const route = pathParts.pop();

  const action =
      pathParts.length == 0
    ? 'index'
    : ['HEAD', 'GET'].includes(request.method)
    ? 'pull'
    : 'push';
  console.log('oci:', {action, pathParts, parameter, route, isDir});

  const context: RequestContext = {
    isHeadersOnly: request.method == 'HEAD',
    action,
    repoName: pathParts.join('/'),
    repoNames: pathParts.map(x => decodeURIComponent(x)),
    httpHost: url.hostname,
    bearerToken: request.headers.get('authorization')?.match(/^bearer (.+)$/i)?.[1] ?? null,
    userAgent: request.headers.get('user-agent'),
  };

  if (context.bearerToken) {
    const isOk = await store.checkAuthToken(context);
    if (!isOk) context.bearerToken = null;
    else console.log('Auth checks out!');
  }

  if (!context.bearerToken) {
    const needsAuth = !pathParts.length || await store.requiresAuth(context);
    const scope = ['repository', pathParts.join('/'), action].join(':');
    if (needsAuth) return new Response(`{"errors":[{"code":"UNAUTHORIZED","message":"authentication required"}]}`, {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'www-authenticate': `Bearer realm="${url.origin}/v2/token",service="${url.hostname}",scope=${JSON.stringify(scope)}`,
      }});
  }

  if (pathParts.length < 1 || !parameter || !route) return null;
  // https://github.com/opencontainers/distribution-spec/blob/main/spec.md
  switch (true) {

    case route == 'tags' && parameter == 'list' && !isDir: {
      const numberRaw = url.searchParams.get('n');
      const number = typeof numberRaw == 'string' ? parseInt(numberRaw, 10) : undefined;
      const last = url.searchParams.get('last') ?? undefined;

      return new Response(JSON.stringify({
        name: pathParts.slice(-1)[0],
        tags: await store.listTags(context, number, last),
      }), {
        headers: {
          'content-type': 'application/json',
        }});
    }

    case route == 'blobs' && !isDir: {
      if (!parameter.startsWith('sha256:')) return null;
      return await store.getBlob(context, parameter);
    }

    case route == 'manifests' && !isDir: {
      if (request.method == 'PUT') {
        const blob = new Uint8Array(await request.arrayBuffer());
        const hash = await crypto.subtle.digest('SHA-256', blob);
        const ourDigest = `sha256:${bytesToHex(hash)}`;
        if (digestPattern.test(parameter)) {
          if (parameter !== ourDigest) throw new Error(
            `Blob digest mismatch; ${parameter} (you) vs ${ourDigest} (me)`);
          await store.putManifest(context, ourDigest, blob, {
            contentType: request.headers.get('content-type'),
          });
          return new Response('Uploaded', {
            status: 201,
            headers: {
              location: `/v2/${context.repoName}/manifests/${ourDigest}`,
              'docker-content-digest': ourDigest,
              'docker-distribution-api-version': 'registry/2.0',
            } });
        } else if (tagPattern.test(parameter)) {
          await store.putManifest(context, ourDigest, blob, {
            contentType: request.headers.get('content-type'),
            desiredTag: parameter,
          });
          return new Response('Uploaded', {
            status: 201,
            headers: {
              location: `/v2/${context.repoName}/manifests/${parameter}`,
              'docker-content-digest': ourDigest,
              'docker-distribution-api-version': 'registry/2.0',
            } });
        } else return null;
      }

      if (!parameter.startsWith('sha256:')) {
        const digest = await store.resolveTag(context, parameter);
        if (!digest) return null;
        return await store.getManifest(context, digest, { requestedTag: parameter });
      } else {
        return await store.getManifest(context, parameter);
      }
    }

    case route == 'blobs' && parameter == 'uploads' && isDir: {
      const digest = url.searchParams.get('digest');
      const session = url.searchParams.get('session');
      const contentLength = request.headers.get('content-length');
      const contentType = request.headers.get('content-type');
      console.log(request.headers);
      console.log({ digest, session, contentLength, contentType, method: request.method });
      if (digest) {
        if (request.method !== 'PUT') return methodNotAllowed(['PUT']);
        if (!contentLength) throw new Error(`content-length is required for uploads`);

        const blob = new Uint8Array(await request.arrayBuffer());
        const hash = await crypto.subtle.digest('SHA-256', blob);
        const ourDigest = `sha256:${bytesToHex(hash)}`;
        if (digest !== ourDigest) throw new Error(
          `Blob digest mismatch; ${digest} (you) vs ${ourDigest} (me)`);

        // const length = parseInt(contentLength);
        await store.putBlob(context, digest, blob);
        return new Response('Uploaded', {
          status: 201,
          headers: {
            location: `/v2/${context.repoName}/blobs/${digest}`,
            'docker-content-digest': ourDigest,
            'docker-distribution-api-version': 'registry/2.0',
          } });
      } else {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        return new Response('Created', {
          status: 202,
          headers: {
            location: `${url.pathname}?${new URLSearchParams({
              'session': crypto.randomUUID(), // We don't maintain 'sessions'
            }) }`,
          } });
      }
    }

  }

  return null;
}

function methodNotAllowed(allowed: string[]) {
  return new Response('405 Unexpected Method', {
    status: 405,
    headers: {
      allowed: allowed.join(', '),
    } });
}

function tokenResponse(token: string | null) {
  if (token) {
    return new Response(JSON.stringify({token}), {
      headers: {
        'content-type': 'application/json',
        'docker-distribution-api-version': 'registry/2.0',
      } });

  } else {
    return new Response(JSON.stringify({
      errors: [{
        code: "DENIED",
        message: "requested access to the resource is denied",
      }],
    }), {
      status: 403,
      headers: {
        'content-type': 'application/json',
        'docker-distribution-api-version': 'registry/2.0',
      } });
  }
}


function bytesToHex(data: ArrayBuffer) {
  return [...new Uint8Array(data)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}
