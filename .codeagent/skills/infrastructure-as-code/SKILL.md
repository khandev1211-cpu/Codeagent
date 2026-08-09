---
name: infrastructure-as-code
description: Write or review infrastructure-as-code (Terraform, CloudFormation, Pulumi, CDK). Use when defining or changing cloud infrastructure through code.
allowed-tools: read_file, write_file, edit_file, run_bash
---

# Infrastructure as Code

- Always review the plan/diff (`terraform plan` or equivalent, `run_bash`) before applying — infrastructure changes can be destructive (a resource replacement that recreates and briefly deletes something), and the plan output is exactly where that's visible ahead of time.
- Use modules/reusable components for infrastructure patterns repeated across environments, rather than copy-pasting the same resource definitions with minor differences per environment.
- Keep environment-specific values (instance sizes, replica counts) in variables/parameters, not hardcoded into the module definition — the same module should be usable for dev, staging, and production with different inputs.
- Never edit cloud resources manually (console/CLI) that are managed by IaC — manual drift causes the next `apply` to either silently revert the manual change or, worse, produce a confusing unexpected diff.
- Store state securely and with locking (remote state backend with locking, e.g. Terraform's S3+DynamoDB pattern) for anything beyond solo local experimentation — concurrent applies against unlocked state can corrupt it.
- Destructive changes (especially anything involving data — a database resource) deserve extra scrutiny in the plan output before applying, specifically checking whether the plan shows a replace (destroy+create) rather than an in-place update.
