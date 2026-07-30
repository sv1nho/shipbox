import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

const reactRecommended = reactPlugin.configs["recommended-typescript"];

export default [
  { ignores: ["dist/**", "node_modules/**", "eslint.config.js"] },

  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        console: "readonly",
        HTMLCanvasElement: "readonly",
        DOMParser: "readonly",
        URL: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs["recommended-type-checked"].rules,
      ...tsPlugin.configs.strict.rules,
      // Turn off base rules that TS versions supersede
      "new-cap": "off",
      "camelcase": "off",
      "no-void": ["error", { allowAsStatement: true }],
      "no-unused-vars": "off",
      "no-use-before-define": "off",
      "no-console": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },

  // React — .tsx only
  {
    files: ["**/*.tsx"],
    plugins: {
      ...reactRecommended.plugins,
      "react-hooks": reactHooks,
    },
    settings: reactRecommended.settings,
    rules: {
      ...reactRecommended.rules,
      ...reactHooks.configs.recommended.rules,
      // eslint-plugin-react-hooks is the source of truth for hooks rules;
      // disable @eslint-react's duplicate implementations to avoid double-reporting.
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/set-state-in-render": "off",
      "@eslint-react/use-memo": "off",
    },
  },
];
