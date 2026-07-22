---
name: kubernetes-basics
description: Write or review Kubernetes manifests and configuration. Use when working with Kubernetes deployments, services, or configuration.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Kubernetes Basics

- Set resource requests and limits explicitly for every container — no requests means the scheduler can't place pods sensibly, and no limits means one misbehaving pod can starve its node's other workloads.
- Configure liveness and readiness probes correctly and distinctly — readiness controls whether traffic is routed to the pod, liveness controls whether it gets restarted; conflating them (a liveness probe that fails during normal slow-startup) causes unnecessary restart loops.
- Never store secrets in a plain ConfigMap or hardcoded in a manifest — use Kubernetes Secrets (and understand these are only base64-encoded by default, not encrypted, unless the cluster has encryption-at-rest or an external secrets manager configured).
- Use a Deployment (not a bare Pod) for anything that should self-heal and support rolling updates — a bare Pod that dies doesn't come back on its own.
- Set `replicas` >1 for anything that needs to tolerate a single pod/node failure without downtime — a single-replica deployment has no actual redundancy despite "being on Kubernetes."
- Check the project's existing manifest conventions (Helm charts, Kustomize overlays, raw YAML) before introducing a different templating approach for one new resource.
