import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {ignores: ["dist"]},
    {
        files: ["src/**/*.{ts,tsx}"],
        extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
        plugins: {"react-hooks": reactHooks},
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                project: "./tsconfig.app.json",
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "@typescript-eslint/no-misused-promises": ["error", {checksVoidReturn: {attributes: false}}],
        },
    }
);
