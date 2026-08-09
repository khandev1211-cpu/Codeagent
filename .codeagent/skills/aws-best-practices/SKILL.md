---
name: aws-best-practices
description: Follow AWS best practices when writing infrastructure code or reviewing AWS resource configuration. Use when working with AWS services (S3, EC2, Lambda, IAM, RDS, etc.).
allowed-tools: read_file, write_file, edit_file, run_bash
---

# AWS Best Practices

- IAM: grant the minimum permissions actually needed (least privilege), scoped to specific resources where possible, not a wildcard `*` action/resource "to make it work" — a broad policy is a real security liability, not a shortcut.
- Never hardcode AWS credentials in code or config files — use IAM roles (for compute) or the project's existing secrets-management convention.
- S3 buckets: private by default, public access only for the specific prefix/use case that genuinely needs it, with public access explicitly reviewed, not left as an accidental default.
- Use infrastructure-as-code (CloudFormation, CDK, Terraform) for anything beyond a quick manual experiment — manually-clicked console changes aren't reproducible or reviewable.
- Tag resources consistently (environment, owner, project) for cost tracking and cleanup — untagged resources are a common source of both cost surprises and "can we delete this?" uncertainty later.
- Check the project's existing region/account conventions before provisioning a new resource — a resource in the wrong region/account is an easy, costly mistake.
