// https://github.com/opencontainers/distribution-spec/blob/main/spec.md#endpoints

export interface OciStore_Auth {
  requiresAuth(ctx: RequestContext): Promise<boolean>;
  checkAuthToken(ctx: RequestContext): Promise<boolean>;
  getAuthToken(params: URLSearchParams, authHeader: string | null): Promise<string | null>;
}

export interface OciStore_Pull {
  getBlob(ctx: RequestContext, digest: string): Promise<Response | null>;
  getManifest(ctx: RequestContext, digest: string, opts?: {
    requestedTag?: string;
  }): Promise<Response | null>;
  resolveTag(ctx: RequestContext, reference: string): Promise<string | null>;
}

export interface OciStore_Push {
  // putManifest(ctx: RequestContext, reference: string, data: Uint8Array): Promise<void>;
  putManifest(ctx: RequestContext, digest: string, data: Uint8Array, opts: {
    contentType?: string | null,
    desiredTag?: string | null,
  }): Promise<void>;
  putBlob(ctx: RequestContext, digest: string, data: Uint8Array): Promise<void>;
  // postBlobUpload(ctx: RequestContext, request: Request): Promise<Response>;
  // postBlobUploadWithDigest(ctx: RequestContext, digest: string, request: Request): Promise<Response>;
  // patchBlobUpload(ctx: RequestContext, reference: string, request: Request): Promise<Response>;
  // putBlobUploadWithDigest(ctx: RequestContext, reference: string, digest: string, request: Request): Promise<Response>;
  // mountBlobUpload(ctx: RequestContext, digest: string, from: string): Promise<Response>;
}

export interface OciStore_Discovery {
  listTags(ctx: RequestContext, maxCount?: number, lastReceived?: string): Promise<string[]>;
}

export interface OciStore_Management {
  deleteManifest(ctx: RequestContext, reference: string): Promise<void>;
  deleteBlob(ctx: RequestContext, digest: string): Promise<void>;
}

export type OciStore =
  & OciStore_Auth
  & OciStore_Pull
  & OciStore_Push
  & OciStore_Discovery
  // & OciStore_Management
;

// export type OciScope =
//   | ['repository', string, 'pull' | 'push']
// ;

export interface RequestContext {
  repoName: string; // joined by slash
  repoNames: string[]; // split by slash
  action: 'index' | 'pull' | 'push';
  isHeadersOnly: boolean;
  bearerToken: string | null;
  userAgent: string | null;
  httpHost: string;
}
