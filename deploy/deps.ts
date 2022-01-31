import { ApiFactory } from "https://deno.land/x/aws_api@v0.6.0/client/mod.ts";
import {
  DefaultCredentialsProvider,
  getDefaultRegion,
} from "https://deno.land/x/aws_api@v0.6.0/client/credentials.ts";
export { AwsServiceError } from "https://deno.land/x/aws_api@v0.6.0/client/common.ts";

export type { AttributeValue, ExecuteStatementInput } from "https://aws-api.deno.dev/v0.3/services/dynamodb.ts?actions=ExecuteStatement";

import { DynamoDB } from "https://aws-api.deno.dev/v0.3/services/dynamodb.ts?actions=ExecuteStatement";
export const dynamodb = new ApiFactory().makeNew(DynamoDB);

import { S3 } from "https://aws-api.deno.dev/v0.3/services/s3.ts?actions=PutObject,CopyObject,DeleteObject";
export const s3 = new ApiFactory().makeNew(S3);

export const objectBucket = (() => {
  const val = Deno.env.get('CHART_BUCKET');
  if (!val) throw `Envvar 'CHART_BUCKET' is required`;
  return val;
})();
export const objectUrlPrefix = `s3://${objectBucket}/`;

export type { Manifest, ManifestOCI } from "https://deno.land/x/docker_registry_client@v0.3.1/types.ts";

export { Sha256, HmacSha256 } from 'https://deno.land/std@0.120.0/hash/sha256.ts'

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
