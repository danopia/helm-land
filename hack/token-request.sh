#!/bin/bash
set -euo pipefail

aud='https://helm-land.deno.dev'
seconds='1000'

kind='"apiVersion": "authentication.k8s.io/v1","kind": "TokenRequest"'
spec='"spec":{ "audiences":["'"$aud"'"], "expirationSeconds": '"$seconds"'}'

echo "{$kind,$spec}" \
| kubectl create --raw \
    /api/v1/namespaces/$1/serviceaccounts/$2/token \
    -f - \
| jq -r \
    .status.token
