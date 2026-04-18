import stylisticPlugin from "@stylistic/eslint-plugin";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  {
    ignores: [
      "*.js",
      "!.projenrc.js",
      "*.d.ts",
      "node_modules/",
      "*.generated.ts",
      "coverage",
      "!.projenrc.ts",
      "!projenrc/**/*.ts",
    ],
  },
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
      import: importPlugin,
      "@stylistic": stylisticPlugin,
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/resolver": {
        node: true,
        typescript: {
          project: "./tsconfig.json",
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      indent: "off",
      "@/indent": ["error", 2],
      quotes: ["error", "single", { avoidEscape: true }],
      "comma-dangle": ["error", "always-multiline"],
      "comma-spacing": ["error", { before: false, after: true }],
      "no-multi-spaces": ["error", { ignoreEOLComments: false }],
      "array-bracket-spacing": ["error", "never"],
      "array-bracket-newline": ["error", "consistent"],
      "object-curly-spacing": ["error", "always"],
      "object-curly-newline": ["error", { multiline: true, consistent: true }],
      "object-property-newline": [
        "error",
        { allowAllPropertiesOnSameLine: true },
      ],
      "keyword-spacing": ["error"],
      "brace-style": ["error", "1tbs", { allowSingleLine: true }],
      "space-before-blocks": ["error"],
      curly: ["error", "multi-line", "consistent"],
      "@stylistic/member-delimiter-style": ["error"],
      semi: ["error", "always"],
      "max-len": [
        "error",
        {
          code: 150,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreComments: true,
          ignoreRegExpLiterals: true,
        },
      ],
      "quote-props": ["error", "consistent-as-needed"],
      "@typescript-eslint/no-require-imports": ["error"],
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: true,
          optionalDependencies: false,
          peerDependencies: true,
        },
      ],
      "import/no-unresolved": ["error"],
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external"],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "no-duplicate-imports": ["error"],
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": ["error"],
      "key-spacing": ["error"],
      "no-multiple-empty-lines": ["error"],
      "@typescript-eslint/no-floating-promises": ["error"],
      "no-return-await": "off",
      "@typescript-eslint/return-await": ["error"],
      "no-trailing-spaces": ["error"],
      "dot-notation": ["error"],
      "no-bitwise": ["error"],
      "@typescript-eslint/member-ordering": [
        "error",
        {
          default: [
            "public-static-field",
            "public-static-method",
            "protected-static-field",
            "protected-static-method",
            "private-static-field",
            "private-static-method",
            "field",
            "constructor",
            "method",
          ],
        },
      ],
    },
  },
  {
    files: [".projenrc.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/no-extraneous-dependencies": "off",
    },
  },
];

