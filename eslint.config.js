import eslint from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // 全局忽略
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/lib/**",
      "**/.tauri/**",
      "**/coverage/**",
      "**/*.min.js",
      "core/resources/**",
    ],
  },

  // ========== 根目录：Vue 前端 (src/) ==========
  {
    files: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...pluginVue.configs["flat/recommended"],
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },

  // ========== 根目录：Vite / build 脚本 (Node 环境) ==========
  {
    files: ["vite.config.ts", "build/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // ========== core 包：Node 侧主运行时 ==========
  {
    files: ["core/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  }
);
