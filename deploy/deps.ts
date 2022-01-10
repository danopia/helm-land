// import { ApiFactory } from "https://deno.land/x/aws_api@v0.5.0/client/mod.ts";
// import {
//   DefaultCredentialsProvider,
//   getDefaultRegion,
// } from "https://deno.land/x/aws_api@v0.5.0/client/credentials.ts";
import { ApiFactory } from "https://raw.githubusercontent.com/cloudydeno/deno-aws_api/e9a755913de0054473f272a85cccc340dbe5bf11/lib/client/mod.ts";
import {
  DefaultCredentialsProvider,
  getDefaultRegion,
} from "https://raw.githubusercontent.com/cloudydeno/deno-aws_api/e9a755913de0054473f272a85cccc340dbe5bf11/lib/client/credentials.ts";

import { DynamoDB } from "https://aws-api.deno.dev/v0.3/services/dynamodb.ts?actions=ExecuteStatement";
export const dynamodb = new ApiFactory().makeNew(DynamoDB);

export const objectBucket = Deno.env.get('CHART_BUCKET');
if (!objectBucket) throw `Envvar 'CHART_BUCKET' is required`;
export const objectUrlPrefix = `s3://${objectBucket}/`;

export { serve } from "https://deno.land/std@0.114.0/http/server.ts";

import {
  getSignedUrl,
} from "./presign.ts";
// } from "https://deno.land/x/aws_s3_presign@1.2.1/mod.ts";
export async function presignGetObject(bucket: string, key: string, params?: Record<string,string>) {
  const credentials = await DefaultCredentialsProvider.getCredentials();
  return getSignedUrl({
    accessKeyId: credentials.awsAccessKeyId,
    secretAccessKey: credentials.awsSecretKey,
    sessionToken: credentials.sessionToken,
    region: credentials.region ?? getDefaultRegion(),

    host: `${bucket}.s3.dualstack.${getDefaultRegion()}.amazonaws.com`,
    objectPath: `/${key}`,
    queryParams: params,
  });
}

export * as semver from "https://deno.land/x/semver@v1.4.0/mod.ts";
