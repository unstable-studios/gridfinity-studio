# Testing GitHub Actions Locally with `act`

This project uses GitHub Actions for CI/CD. You can test workflows locally before pushing using the [act](https://github.com/nektos/act) tool.

## Installation

```bash
brew install act
```

## Testing Individual Workflows

### Test lint and typecheck (without release-please):

```bash
act pull_request -j lint
act pull_request -j typecheck
act pull_request -j build
```

### Test full CI on pull_request event:

```bash
act pull_request
```

### Test push to main (triggers release-please):

```bash
act push -b main
```

## Important Notes

- **Secrets**: `act` will prompt you for secrets. For testing release-please, you can skip by using `-s GH_PAT_RELEASEPLEASE=fake-token` (won't actually create releases locally).
- **Container**: `act` runs actions in Docker, so install Docker Desktop first.
- **Event filters**: Use `-j <job>` to run a specific job, or `-l` to list all available jobs.
- **Environment**: To test with specific env vars, use `-e VAR=value`.

## Example: Full Test Before Pushing

```bash
# Test all CI checks on a PR
act pull_request

# Test commit validation
act pull_request -j commitlint

# Test release-please (won't publish without real secrets)
act push -b main -s GH_PAT_RELEASEPLEASE=fake
```

## Gotchas

- Some actions may not work perfectly in `act` due to containerization differences (e.g., signing on macOS).
- For release workflows that trigger on `workflow_run`, you'll need to manually test the build step.
- GitHub Actions logs are more verbose; `act` may suppress some debug output.

See [act documentation](https://github.com/nektos/act) for more options.
