import { verify } from "https://deno.land/x/djwt@v2.4/mod.ts";

export async function validateOidcJwt(jwt: string) {
  const parts = jwt.split('.');
  const headPart = JSON.parse(atob(parts[0])) as Record<string, unknown>;
  const dataPart = JSON.parse(atob(parts[1])) as Record<string, unknown>;
  const issuer = dataPart.iss;
  if (typeof issuer !== 'string') throw new Error('bad iss');
  if (!issuer.startsWith('https://')) throw new Error('bad iss');

  // https://token.actions.githubusercontent.com/.well-known/openid-configuration
  const oidcConfig = await fetch(new URL('.well-known/openid-configuration', issuer)).then(x => x.json()) as {
    issuer: string;
    jwks_uri: string;
    subject_types_supported: string[];
    response_types_supported: string[];
    claims_supported: string[];
    id_token_signing_alg_values_supported: string[];
    scopes_supported: string[];
  };

  const jwksRaw = await fetch(oidcConfig.jwks_uri).then(x => x.json()) as {
    keys: Array<{
      n: string;
      kty: "RSA" | string;
      kid: string;
      alg: "RS256" | string;
      e: string;
      use: "sig" | string;
    }>;
  };

  const key = jwksRaw.keys.find(x => x.kid == headPart.kid && x.use == 'sig' && x.kty == 'RSA');
  if (!key) throw new Error('key not found')

  const result = await crypto.subtle.importKey(
    'jwk',
    key,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: `SHA-${key.alg.slice(2)}`,
    },
    true,
    ['verify'],
  );

  const payload = await verify(jwt, result);
  console.log('Successfully validated JWT from', payload.sub);
  return payload;
}

// sub: "repo:danopia/helm-land-push-test:ref:refs/heads/main",
// aud: "helm-land.deno.dev",
// ref: "refs/heads/main",
// sha: "195dfeb5ccd83c4ffd5cdf69ec9bc264560693f8",
// repository: "danopia/helm-land-push-test",
// repository_owner: "danopia",
// run_id: "1695522530",
// run_number: "3",
// run_attempt: "3",
// actor: "danopia",
// workflow: "Push helm chart",
// head_ref: "",
// base_ref: "",
// event_name: "push",
// ref_type: "branch",
// job_workflow_ref: "danopia/helm-land-push-test/.github/workflows/chart-push.yaml@refs/heads/main",
// iss: "https://token.actions.githubusercontent.com",
