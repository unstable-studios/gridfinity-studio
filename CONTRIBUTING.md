# Contributing to Gridfinity Studio

Thank you for your interest in contributing to Gridfinity Studio!

## Commit Message Standards

We use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages. This is **strictly enforced** by commitlint in CI.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Type (Required)

Must be one of:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semi-colons, etc.)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **perf**: Performance improvements
- **test**: Adding or correcting tests
- **build**: Changes to build system or dependencies
- **chore**: Other changes that don't modify src or test files
- **ci**: CI configuration changes

### Scope (Optional)

Must be one of:

- **core**: Core application logic
- **ui**: User interface components and styles
- **middleware**: Middleware and API interaction code
- **ci**: Continuous integration and deployment configs
- **test**: Test suites and testing utilities
- **docs**: Documentation in docs/
- **repo**: Repository-wide changes
- **infra**: Infrastructure (CI/CD, runners, workflows)
- **deps**: Dependency updates
- **release**: Release related changes

You can omit the scope if the change doesn't fit a specific area: `feat: add feature`

### Subject (Required)

- Use imperative mood: "add" not "added" or "adds"
- Don't capitalize the first letter
- No period at the end
- Maximum 72 characters
- Be concise but descriptive

### Examples

✅ **Good commits:**

```
feat(core): add canonical project schema validation
fix(ui): resolve viewport rendering issue on mobile devices
docs: update architecture documentation with schema details
refactor(core): simplify project serialization logic
chore(deps): upgrade electron to v39.2.7
ci: add commitlint check to GitHub Actions
```

❌ **Bad commits:**

```
Add feature                          # Missing type
feat: Added new feature              # Wrong tense, capitalized
feat(unknown): add feature           # Invalid scope
Feat(core): Add Feature.             # Capitalized, period at end
feat(core): This is a very long commit message that exceeds the maximum character limit  # Too long
```

## Development Workflow

1. **Fork the repository** or create a branch
2. **Make your changes** following our coding standards
3. **Write tests** for new features
4. **Commit using conventional commits**

   ```bash
   # Use the interactive commit tool
   npm run commit

   # Or commit manually
   git commit -m "feat(core): add new feature"
   ```

5. **Push and create a Pull Request**
6. **Ensure CI passes** - commitlint will validate your commits

## Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run type checking
pnpm typecheck

# Format code
pnpm format

# Lint code
pnpm lint

# Interactive commit (recommended)
pnpm commit
```

## Pull Request Guidelines

- **One feature per PR** - Keep changes focused
- **Follow conventional commits** - All commits must pass commitlint
- **Write clear PR descriptions** - Explain what and why
- **Reference issues** - Use "Fixes #123" or "Closes #123"
- **Update documentation** - If you change functionality
- **Add tests** - For new features or bug fixes

## Code Style

- We use **Prettier** for formatting - run `pnpm format`
- We use **ESLint** for linting - run `pnpm lint`
- Follow **TypeScript best practices** - no `any` types
- Write **JSDoc comments** for public APIs

## Project Structure

```
src/
├── shared/          # Shared code (main + renderer)
│   ├── types/       # TypeScript type definitions
│   └── lib/         # Shared utilities
├── main/            # Electron main process
├── preload/         # Electron preload scripts
└── renderer/        # React application
    └── src/
        ├── components/  # React components
        └── lib/         # Renderer utilities
```

## Testing Your Commits Locally

Husky will automatically check your commits, but you can test manually:

```bash
# Test a commit message
echo "feat(core): add feature" | npx commitlint
# ✅ passes

echo "Add feature" | npx commitlint
# ❌ fails with helpful error
```

## GitHub Copilot / Coding Agent

If you're using GitHub Copilot coding agent:

- **Always use conventional commit format** in your commits
- **Reference this file** in issue descriptions
- **Be explicit** about commit messages in issue acceptance criteria
- Example: "Commit as: `feat(core): implement schema validation`"

See [.github/COPILOT_COMMIT_STANDARDS.md](.github/COPILOT_COMMIT_STANDARDS.md) for more details.

## Need Help?

- Check [commitlint.config.mjs](commitlint.config.mjs) for the full configuration
- Run `pnpm commit` to use the interactive commit tool
- Review existing commits for examples
- Open an issue if you have questions

## License

By contributing, you agree that your contributions will be licensed under the project's license.
