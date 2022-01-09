# `helm-land.deno.dev`

This is an experimental, from-scratch helm chart registry for hosting public charts.

I looked at options for publishing a basic helm chart and the options seemed to be one of:

1. Set up a `gh-pages` branch and CI to upload a YAML index file, which points to tarballs attached to Github Releases
2. Upload the files to my own cloud bucket somewhere (AWS, GCP, etc) and use tooling to replace the index file for releases

I didn't want to tie helm chart releases to my repository's actual Github Releases,
and I didn't want to just toss some files into a random public bucket either.
So I did the obvious thing and created a new registry instead.

## Available charts

There's only one chart namespace hosted at this time, and that's for [CloudyDeno](https://github.com/cloudydeno).
This isn't due to technical limitations, it's just because I haven't thought about a management API yet.

You can view the published charts on ArtifactHub:

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/cloudydeno)](https://artifacthub.io/packages/search?repo=cloudydeno)

You can also kick the tires locally, of course:

```sh
> helm repo add cloudydeno https://helm-land.deno.dev/cloudydeno

> helm search repo | grep cloudydeno
cloudydeno/dns-sync     0.1.0           latest          Manage hosted DNS providers using a Kubernetes ...
```

## Future work

### Web page

I have download counts and such, would be cool to have a webpage which shows some of that stuff.
I wouldn't want to replicate ArtifactHub too much of course.

### OCI Support

I want to try serving packages over `oci://helm-land.deno.dev/...`.
I'm not sure what this takes. I want to *try* it though.

### Uploads

Obviously, this registry needs to support writes.
Both creating new repos/charts and uploading new versions of existing charts.

I think push might actually be implemented *using Helm's OCI support*
if I manage to get OCI working in general. That would be pretty cool.
