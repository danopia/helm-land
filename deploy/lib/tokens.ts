import { dynamodb, JwtPayload } from "../deps.ts";

// https://stackoverflow.com/a/27747377/3582903
function dec2hex(dec: number) {
  return dec.toString(16).padStart(2, "0");
}
function generateId(len: number) {
  var arr = new Uint8Array((len || 40) / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
}

export async function issueToken(jwtData: JwtPayload, scope: string | null) {
  // We're actually making a token now
  const token = generateId(32);
  await dynamodb.executeStatement({
    Statement: `INSERT INTO HelmTokens VALUE {
      'BearerToken':?,
      'TokenScope':?,
      'JwtIssuer':?,
      'JwtSubject':?,
      'JwtExpires':?,
      'RemoveAt':?}`,
    Parameters: [
      { S: token },
      scope ? { S: scope } : { NULL: true },
      { S: jwtData.iss },
      { S: jwtData.sub },
      { S: new Date(jwtData.exp! * 1000).toISOString() },
      { N: `${jwtData.exp}` },
    ],
  });
  console.log('-->', 'Issued token', token, 'to', {scope, subject:jwtData.sub, issuer:jwtData.iss})
  return token;
}

export async function lookupToken(bearerToken: string) {
  const resp = await dynamodb.executeStatement({
    Statement: `SELECT * FROM HelmTokens WHERE BearerToken = ?`,
    Parameters: [{ S: bearerToken }],
  });
  if (!resp.Items?.length) return false;
  const [record] = resp.Items;

  const expiresAt = record.JwtExpires?.S;
  if (!expiresAt) return false;
  const expires = new Date(expiresAt);
  if (expires < new Date()) return false;

  return {
    scope: record.TokenScope?.S ?? null,
    issuer: record.JwtIssuer?.S ?? null,
    subject: record.JwtSubject?.S ?? null,
  };
}
