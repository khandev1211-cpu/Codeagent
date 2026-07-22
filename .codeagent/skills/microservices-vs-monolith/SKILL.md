---
name: microservices-vs-monolith
description: Assess whether a microservices split or a monolithic structure is the right fit for a given situation. Use when asked to evaluate or propose a service architecture.
allowed-tools: read_file, search_code
---

# Microservices vs. Monolith

- Default to a well-structured monolith unless there's a specific, real reason for services — independent scaling needs for different components, genuinely separate teams needing independent deploy cycles, or a hard technology/compliance boundary. "Microservices are the modern way to do it" is not a specific reason.
- A poorly-modularized monolith doesn't become well-architected by splitting it into services — it becomes a distributed system with the same coupling problems plus network calls, serialization, and partial-failure handling added on top.
- If proposing a split, identify the actual service boundaries by business capability/domain (see domain-modeling), not by technical layer (a "database service," a "business logic service") — the latter just distributes what should be one cohesive unit.
- Consider the operational cost honestly: more services means more deployment pipelines, more observability surface, more places a request can partially fail, and real cross-team coordination for anything spanning services.
- A "modular monolith" (clear internal module boundaries, single deployable) is often the right middle ground — it gets much of the organizational clarity of service boundaries without the distributed-systems cost, and can be split later if a specific need actually emerges.
