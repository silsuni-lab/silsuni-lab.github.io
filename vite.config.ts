// vitest 설정을 함께 두므로 'vite'가 아니라 'vitest/config'에서 defineConfig를 가져온다.
// 'vite'의 defineConfig에는 test 필드 타입이 없어 `tsc --noEmit`이 실패한다.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/*
 * package.json이 "type": "module"이라 이 파일에는 __dirname이 없다.
 * 설정 파일 자기 위치를 기준으로 절대 경로를 만든다.
 */
const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
  /*
   * 페이지를 둘로 나눈다. 나누면 각 화면이 자기 제목을 가지므로 사이트
   * 제목을 안 바꿔도 되고, 종류를 고르는 UI도 필요 없다. base가 './'라
   * 하위 경로에서 자산 경로가 '../assets/'로 알아서 맞는다.
   */
  build: {
    rollupOptions: {
      input: {
        main: entry('index.html'),
        round: entry('round/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
