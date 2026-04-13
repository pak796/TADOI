# Patch Sizing Rules

Good atomic patch characteristics:

- one main objective
- one primary validation route
- minimal cross-module coupling
- clear rollback boundary

Merge tasks only when they share the same files and test path.
