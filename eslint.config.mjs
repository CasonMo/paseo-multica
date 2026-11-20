// 核心防线：检测 React Hooks 顺序问题（如条件分支里调用 hooks 导致的渲染崩溃）
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["client/**/*.ts", "client/**/*.tsx", "index.client.tsx"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/rules-of-hooks": "error" },
  },
];