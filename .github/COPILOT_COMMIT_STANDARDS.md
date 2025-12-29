# GitHub Copilot Commit Standards

This document explains how to ensure GitHub Copilot (coding agent) follows our commitlint standards when making commits.

## Our Commit Standards

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Valid Types

- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation only changes
- `style` - Code style changes (formatting, missing semi-colons, etc.)
- `refactor` - Code changes that neither fix a bug nor add a feature
- `perf` - Performance improvements
- `test` - Adding or correcting tests
- `build` - Changes to build system or dependencies
- `chore` - Other changes that don't modify src or test files
- `ci` - CI configuration changes

### Valid Scopes

- `core` - Core application logic
- `ui` - User interface components and styles
- `middleware` - Middleware and API interaction code
- `ci` - Continuous integration and deployment configs
- `test` - Test suites and testing utilities
- `docs` - Documentation in docs/
- `repo` - Repository-wide changes (configs, root docs, workspace maintenance)
- `infra` - Infrastructure (CI/CD, runners, workflows, deployment scripts)
- `deps` - Dependency updates
- `release` - Release related changes

**Scope is optional** - you can omit it if the change doesn't fit a specific scope.

### Subject Rules

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Maximum 72 characters

### Examples of Valid Commits

```
feat(core): add canonical project schema validation
fix(ui): resolve viewport rendering issue on mobile
docs: update architecture documentation
refactor(core): simplify project serialization logic
chore(deps): upgrade electron to v39.2.7
```

## Configuring GitHub Copilot Coding Agent

### Method 1: Pull Request Description (Recommended)

When creating or reviewing a PR created by GitHub Copilot, include commit guidelines in the PR description:

```markdown
## Commit Guidelines

Please follow our conventional commit standards:

- Format: `<type>(<scope>): <subject>`
- Types: feat, fix, docs, style, refactor, perf, test, build, chore, ci
- Scopes: core, ui, middleware, ci, test, docs, repo, infra, deps, release
- Subject: imperative mood, lowercase, no period, max 72 chars

Examples:

- feat(core): add project validation
- fix(ui): resolve rendering issue
- docs: update schema documentation
```

### Method 2: CONTRIBUTING.md File

Create a `CONTRIBUTING.md` file in the repository root that GitHub Copilot will read:

```markdown
# Contributing Guidelines

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/).

Format: `<type>(<scope>): <subject>`

Valid types: feat, fix, docs, style, refactor, perf, test, build, chore, ci
Valid scopes: core, ui, middleware, ci, test, docs, repo, infra, deps, release

Examples:

- feat(core): add new feature
- fix(ui): resolve bug
- docs: update documentation
```

### Method 3: Issue Description

When creating GitHub issues that Copilot will work on, include commit format in the issue:

```markdown
## Acceptance Criteria

- [ ] Feature X implemented
- [ ] Tests added

## Commit Message Format

Use format: `feat(core): <description of feature>`
```

### Method 4: GitHub Actions Enforcement

We already have commitlint in CI, but you can add a GitHub Action to auto-fix Copilot commits:

```yaml
# .github/workflows/copilot-commit-check.yml
name: Copilot Commit Check

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  check-commits:
    runs-on: ubuntu-latest
    if: github.actor == 'github-actions[bot]' || contains(github.event.pull_request.labels.*.name, 'copilot')

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install commitlint
        run: npm install -g @commitlint/cli @commitlint/config-conventional

      - name: Validate commits
        run: |
          npx commitlint --from ${{ github.event.pull_request.base.sha }} --to HEAD --verbose

      - name: Comment on PR if failed
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `⚠️ Commit messages don't follow our conventional commit standards.

              Please use the format: \`<type>(<scope>): <subject>\`
              
              Valid types: feat, fix, docs, style, refactor, perf, test, build, chore, ci
              Valid scopes: core, ui, middleware, ci, test, docs, repo, infra, deps, release
              
              See commitlint.config.mjs for full standards.`
            })
```

## Reviewing Copilot PRs

When GitHub Copilot creates a PR:

1. **Check commit messages** - Look at the commit history in the PR
2. **Request changes if needed** - Ask Copilot to rewrite commits:
   ```
   Please rewrite the commit messages to follow our conventional commit standards:
   - feat(core): add project schema validation
   - fix(ui): resolve viewport rendering issue
   ```
3. **Squash and merge** - If commits are messy, use "Squash and merge" with a proper commit message

## Common Issues and Fixes

### Issue: Copilot uses generic commit messages

**Fix:** Be specific in issue/PR descriptions about what the commit should say

### Issue: Copilot uses wrong type/scope

**Fix:** Include examples in the issue description:

```markdown
Commit as: `feat(core): add canonical project schema`
```

### Issue: Multiple commits in one PR with inconsistent messages

**Fix:** Use "Squash and merge" and write a proper commit message yourself

### Issue: Copilot ignores commit standards

**Fix:** Add a comment on the PR:

```markdown
@github-copilot please update commit messages to follow our conventional commit format:

- Format: `<type>(<scope>): <subject>`
- Example: `feat(core): implement schema validation`
```

## Husky Pre-commit Hook

Our repository already has commitlint configured with Husky. This will catch bad commits locally:

```bash
# When you commit
git commit -m "Add feature"  # ❌ Will fail

git commit -m "feat(core): add feature"  # ✅ Will pass
```

## Best Practices

1. **Be explicit in issues** - Tell Copilot exactly what commit message to use
2. **Review PRs carefully** - Check commit history before merging
3. **Use squash merge** - For messy commit histories
4. **Reference commitlint.config.mjs** - Point Copilot to your config file in discussions
5. **Use conventional commit tools** - Run `npm run commit` to use the interactive commit tool

## Quick Reference

```bash
# Format
<type>(<scope>): <subject>

# Types
feat fix docs style refactor perf test build chore ci

# Scopes (optional)
core ui middleware ci test docs repo infra deps release

# Examples
feat(core): add project validation system
fix(ui): resolve viewport rendering on mobile
docs: update schema documentation
refactor(core): simplify serialization logic
chore(deps): upgrade electron to v39
```

## Related Files

- `commitlint.config.mjs` - Full commitlint configuration
- `.husky/commit-msg` - Local commit validation hook
- `.github/workflows/ci.yml` - CI that runs commitlint

## Testing Commit Messages

Test a commit message locally:

```bash
echo "feat(core): add feature" | npx commitlint
# ✅ passes

echo "Add feature" | npx commitlint
# ❌ fails
```
