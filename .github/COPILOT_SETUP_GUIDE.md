# Ensuring GitHub Copilot Follows Commitlint Standards - Quick Guide

## ✅ Files Created

1. **CONTRIBUTING.md** - Main contributing guide (GitHub auto-detects this)
2. **.github/COPILOT_COMMIT_STANDARDS.md** - Detailed Copilot-specific guide
3. **.github/PULL_REQUEST_TEMPLATE.md** - PR template with commit checklist
4. **.github/ISSUE_COMMIT_TEMPLATE.md** - Copy-paste template for issues

## 🚀 How to Use These

### When Creating Issues

Copy the commit standards section from `.github/ISSUE_COMMIT_TEMPLATE.md` into your issue description:

```markdown
## Acceptance Criteria

- [ ] Implement feature X
- [ ] Add tests

## 📝 Commit Standards

When working on this issue, use format: `<type>(<scope>): <subject>`

Example for this issue:
feat(core): add canonical project schema
```

### When Reviewing Copilot PRs

1. **Check the commits** in the PR
2. If bad, comment:

   ```
   Please update commit messages to follow our conventional commit standards.
   See CONTRIBUTING.md for format: `<type>(<scope>): <subject>`

   Example: feat(core): add schema validation
   ```

3. Or use **Squash and merge** with a proper commit message

### When Starting New Work

Point Copilot to the standards:

```
@github-copilot please follow the commit standards in CONTRIBUTING.md
Use format: feat(core): <description>
```

## 🎯 Best Practices

1. **Be explicit in issue descriptions** - Tell Copilot the exact commit message
2. **Reference CONTRIBUTING.md** - GitHub auto-links this file
3. **Use PR template** - It includes commit checklist
4. **Review before merging** - Always check commit messages
5. **Squash messy commits** - Use "Squash and merge" when needed

## 📋 Quick Reference

Your commit format:

```
<type>(<scope>): <subject>
```

Types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `chore` `ci`

Scopes: `core` `ui` `middleware` `ci` `test` `docs` `repo` `infra` `deps` `release`

Examples:

- `feat(core): add project validation`
- `fix(ui): resolve rendering bug`
- `docs: update schema documentation`

## 🔍 Why This Works

1. **CONTRIBUTING.md** - GitHub automatically shows this to contributors and PRs
2. **PR Template** - Auto-populated when creating PRs, includes commit checklist
3. **Explicit Instructions** - Issue templates give Copilot clear guidance
4. **Existing Config** - Your commitlint.config.mjs already enforces standards in CI

## 📚 Related Files

- `commitlint.config.mjs` - Your full commitlint configuration
- `.husky/commit-msg` - Local pre-commit validation
- `.github/workflows/ci.yml` - CI runs commitlint

## 🧪 Testing

Test commit messages locally:

```bash
echo "feat(core): add feature" | npx commitlint
# ✅ passes

echo "Add feature" | npx commitlint
# ❌ fails - shows why
```

## 💡 Pro Tips

1. **Use in issue creation**: Include "Commit as: `feat(core): <description>`"
2. **Tag PRs**: Add `copilot` label to PRs created by Copilot
3. **Review regularly**: Check Copilot PRs for compliance
4. **Update templates**: Adjust templates as standards evolve
5. **Share standards**: Point team members to CONTRIBUTING.md

---

**Remember**: GitHub Copilot reads repository documentation like CONTRIBUTING.md, so having clear standards documented helps it generate better commits!
