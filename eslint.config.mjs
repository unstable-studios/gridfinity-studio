import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["node_modules", ".husky", "package-lock.json"],
  },
  js.configs.recommended,
  importPlugin.flatConfigs.recommended,
  prettier,
  {
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".mjs", ".cjs", ".json"],
        },
      },
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
];
