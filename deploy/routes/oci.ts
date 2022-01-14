import { OciStore, RequestContext } from "../lib/oci-store.ts";

export async function routeOciRequest(store: OciStore, request: Request, url: URL) {
  const pathParts = url.pathname.split('/').slice(2);

  if (pathParts.length == 1 && pathParts[0] == 'token') {
    if (request.method !== 'GET') return new Response('Must be GET', {
      status: 405,
    });
    const token = await store.getAuthToken(url.searchParams, request.headers.get('authorization'));
    return tokenResponse(token);
  }

  const isDir = (pathParts.slice(-1)[0] == '');
  if (isDir) pathParts.pop();
  const parameter = pathParts.pop();
  const route = pathParts.pop();

  const action = ['HEAD', 'GET'].includes(request.method) ? 'pull' : 'push';
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
  switch (true) {

    case route == 'tags' && parameter == 'list': {
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

    case route == 'blobs': {
      if (!parameter.startsWith('sha256:')) return null;
      return await store.getBlob(context, parameter);
    }
    case route == 'manifests': {
      if (!parameter.startsWith('sha256:')) {
        const digest = await store.resolveTag(context, parameter);
        if (!digest) return null;
        return await store.getManifest(context, digest);
      } else {
        return await store.getManifest(context, parameter);
      }
    }

  }

  return null;
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
