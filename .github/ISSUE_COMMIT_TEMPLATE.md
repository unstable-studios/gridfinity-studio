# Issue Template - Commit Standards Quick Reference

<!--
Copy this section into GitHub issues when requesting work from Copilot
This ensures Copilot follows our commit standards
-->

---

## 📝 Commit Standards

When working on this issue, **all commits must follow conventional commit format**:

```
<type>(<scope>): <subject>
```

### Quick Reference

**Types:** `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `chore` `ci`

**Scopes (optional):** `core` `ui` `middleware` `ci` `test` `docs` `repo` `infra` `deps` `release`

**Subject rules:**

- Use imperative mood ("add" not "added")
- Lowercase, no period at end
- Max 72 characters

### Examples for This Issue

<!-- Update these examples to match your specific issue -->

```bash
# If adding a new feature:
feat(core): add canonical project schema

# If fixing a bug:
fix(ui): resolve viewport rendering issue

# If updating docs:
docs: update architecture documentation

# If refactoring code:
refactor(core): simplify serialization logic
```

---

<!-- End of copy-paste section -->
