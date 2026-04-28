import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // React 19 신규 strict 규칙들 — 현재 코드베이스의 패턴과 충돌하고
    // false positive가 다수라 비활성. 실제 버그 가능성 있는 setState-in-effect는
    // 코드 리뷰에서 잡고, 명시적 mutation(window.location.href 등)은 의도된 동작.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
      // exhaustive-deps는 mount-once load() 패턴과 잘 안 맞음. 의도적으로 끔.
      "react-hooks/exhaustive-deps": "off",
      // Next Image 마이그레이션은 post-launch 점진 작업. 현재는 <img> 그대로 사용.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
