import { ApiFactory } from "https://deno.land/x/aws_api@v0.6.0/client/mod.ts";
import {
  DefaultCredentialsProvider,
  getDefaultRegion,
} from "https://deno.land/x/aws_api@v0.6.0/client/credentials.ts";

export type { AttributeValue, ExecuteStatementInput } from "https://aws-api.deno.dev/v0.3/services/dynamodb.ts?actions=ExecuteStatement";
import { DynamoDB } from "https://aws-api.deno.dev/v0.3/services/dynamodb.ts?actions=ExecuteStatement";
export const dynamodb = new ApiFactory().makeNew(DynamoDB);

export const objectBucket = Deno.env.get('CHART_BUCKET');
if (!objectBucket) throw `Envvar 'CHART_BUCKET' is required`;
export const objectUrlPrefix = `s3://${objectBucket}/`;

export { serve } from "https://deno.land/std@0.120.0/http/server.ts";

export { verify as verifyJwt } from "https://deno.land/x/djwt@v2.4/mod.ts";
export type { Payload as JwtPayload } from "https://deno.land/x/djwt@v2.4/mod.ts";

import {
  getSignedUrl,
} from "./presign.ts";
// } from "https://deno.land/x/aws_s3_presign@1.2.1/mod.ts";
export async function presignGetObject(method: 'GET' | 'HEAD', bucket: string, key: string, params?: Record<string,string>) {
  const credentials = await DefaultCredentialsProvider.getCredentials();
  return getSignedUrl({
    accessKeyId: credentials.awsAccessKeyId,
    secretAccessKey: credentials.awsSecretKey,
    sessionToken: credentials.sessionToken,
    region: credentials.region ?? getDefaultRegion(),

    method,
    host: `${bucket}.s3.dualstack.${getDefaultRegion()}.amazonaws.com`,
    objectPath: `/${key}`,
    queryParams: params,
    expiresIn: 300,
  });
}
