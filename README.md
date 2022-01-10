# `helm-land.deno.dev`

This is an experimental, from-scratch helm chart registry for hosting public charts.
The registry is currently read-only, and serves a Helm repo as well as `oci://` pulling.
*Please* contact me (issues, etc) if you have interest in publishing!

I looked at options for publishing a basic helm chart and the options seemed to be one of:

1. Set up a `gh-pages` branch and CI to upload a YAML index file, which points to tarballs attached to Github Releases
2. Upload the files to my own cloud bucket somewhere (AWS, GCP, etc) and use tooling to replace the index file for releases

I didn't want to tie helm chart releases to my repository's actual Github Releases,
and I didn't want to just toss some files into a random public S3 bucket either.
So I did the obvious thing and built a new registry around an S3 bucket instead.

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

**Helm's experimental OCI support** is also available for pulling, e.g.:

```sh
> export HELM_EXPERIMENTAL_OCI=1

> helm pull oci://helm-land.deno.dev/cloudydeno/dns-sync --version 0.1.0
Pulled: helm-land.deno.dev/cloudydeno/dns-sync:0.1.0
Digest: sha256:bd9b04bf60b83cb52be2dd869579a007a629911c01b3001dea872548ec34bb87
```

## Future work

### Web page

I have download counts and such, would be cool to have a webpage which shows some of that stuff.
I wouldn't want to replicate ArtifactHub too much of course.

### Uploads

Obviously, this registry needs to support writes.
Both creating new repos/charts and uploading new versions of existing charts.

I think push might only get implemented *using Helm's OCI support*.
OCI has a pretty strong 'push' story and otherwise Helm doesn't really have built-in uploading.
So I'm going to definitely try OCI push first and see how it goes.
