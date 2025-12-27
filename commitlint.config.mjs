export default {
  extends: ['@commitlint/config-conventional'],
  // Skip non-conventional messages typically authored by tooling or bots
  // This prevents CI from failing on auto-generated commits that don't follow the spec
  ignores: [
    (message) => /^Merge\b/.test(message),
    (message) => /^Update\b/.test(message),
    (message) => /Co-authored-by:\s*Copilot\b/.test(message),
    (message) => /^Initial plan\b/i.test(message)
  ],
  rules: {
    // Allow empty scope
    'scope-empty': [0],
    'scope-enum': [
      2,
      'always',
      ['core', 'ui', 'middleware', 'ci', 'test', 'docs', 'repo', 'infra', 'deps']
    ],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'chore', 'ci']
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']]
  },
  // commitlint prompt configuration (used by @commitlint/prompt and @commitlint/cz-commitlint)
  prompt: {
    settings: {
      enableMultipleScopes: false,
      scopeEnumSeparator: ',',
      allowCustomScopes: false
    },
    messages: {
      skip: 'or skip',
      max: '(max %d chars)',
      min: '(min %d chars)',
      emptyWarning: 'cannot be empty',
      upperLimitWarning: 'over limit',
      lowerLimitWarning: 'below limit'
    },
    questions: {
      type: {
        description: "Select the type of change that you're committing",
        enum: {
          feat: {
            description: 'A new feature',
            title: 'Features',
            emoji: '✨'
          },
          fix: {
            description: 'A bug fix',
            title: 'Bug Fixes',
            emoji: '🐛'
          },
          docs: {
            description: 'Documentation only changes',
            title: 'Documentation',
            emoji: '📚'
          },
          style: {
            description:
              'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
            title: 'Styles',
            emoji: '🎨'
          },
          refactor: {
            description: 'A code change that neither fixes a bug nor adds a feature',
            title: 'Code Refactoring',
            emoji: '♻️ '
          },
          perf: {
            description: 'A code change that improves performance',
            title: 'Performance Improvements',
            emoji: '🚀'
          },
          test: {
            description: 'Adding missing tests or correcting existing tests',
            title: 'Tests',
            emoji: '🧪'
          },
          build: {
            description:
              'Changes that affect the build system or external dependencies (example scopes: webpack, deps)',
            title: 'Builds',
            emoji: '🔧'
          },
          chore: {
            description: "Other changes that don't modify src or test files",
            title: 'Chores',
            emoji: '🧹'
          },
          ci: {
            description: 'Changes to our CI configuration files and scripts',
            title: 'Continuous Integrations',
            emoji: '👷'
          }
        }
      },
      scope: {
        description: 'Select the area (scope) this change touches',
        enum: {
          core: {
            description: 'Core application logic',
            title: 'Core',
            emoji: '🧠'
          },
          ui: {
            description: 'User interface components and styles',
            title: 'UI',
            emoji: '💅'
          },
          middleware: {
            description: 'Middleware and API interaction code',
            title: 'Middleware',
            emoji: '🧩'
          },
          ci: {
            description: 'Continuous integration and deployment configs',
            title: 'CI/CD',
            emoji: '🤖'
          },
          test: {
            description: 'Test suites and testing utilities',
            title: 'Tests',
            emoji: '✅'
          },
          docs: {
            description: 'Documentation changes in docs/',
            title: 'Docs',
            emoji: '📖'
          },
          repo: {
            description: 'Repository-wide changes: configs, root docs, workspace maintenance',
            title: 'Repo',
            emoji: '📁'
          },
          infra: {
            description: 'Infrastructure: CI/CD, runners, workflows, deployment scripts',
            title: 'Infra',
            emoji: '🛠️'
          },
          deps: {
            description: 'Dependency updates',
            title: 'Dependencies',
            emoji: '⬆️ '
          }
        }
      },
      subject: {
        description: 'Write a short, imperative tense description of the change'
      },
      body: {
        description: 'Provide a longer description of the change'
      },
      isBreaking: {
        description: 'Are there any breaking changes?'
      },
      breakingBody: {
        description:
          'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself'
      },
      breaking: {
        description: 'Describe the breaking changes'
      },
      isIssueAffected: {
        description: 'Does this change affect any open issues?'
      },
      issuesBody: {
        description:
          'If issues are closed, the commit requires a body. Please enter a longer description of the commit itself'
      },
      issues: {
        description: 'Add issue references (e.g. "fix #123", "re #123".)'
      }
    }
  }
}
