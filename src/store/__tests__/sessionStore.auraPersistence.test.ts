// reduceAuraMotion은 zustand persist의 partialize 대상이 아니라 별도 AsyncStorage 키
// ('twin_aura_settings_v1')로 직접 저장/복원된다(sessionStore.ts 주석 참고). 이 테스트는
// "저장은 되는데 재시작 시 복원이 안 되는" 회귀를 잡기 위해 실제 앱 재시작을
// jest.resetModules()로 시뮬레이션해서, 콜드 스타트 후에도 값이 유지되는지 검증한다.
//
// jest.resetModules()는 "JS 런타임 재시작"만 흉내낸다 — 실제 기기의 AsyncStorage(디스크)는
// 앱 프로세스 종료와 무관하게 남아있어야 하므로, 아래 커스텀 목은 데이터를 모듈 스코프가
// 아니라 globalThis에 둬서 resetModules()로도 지워지지 않게 한다(공식
// async-storage/jest/async-storage-mock은 모듈 스코프 저장이라 resetModules()에 데이터가
// 함께 날아가 "재시작 시뮬레이션"이 아니라 "디스크까지 밀어버리는 시뮬레이션"이 돼버린다).
const TEST_STORAGE_GLOBAL_KEY = '__TWIN_TEST_ASYNC_STORAGE__';

jest.mock('@react-native-async-storage/async-storage', () => {
  const g = globalThis as unknown as Record<string, Map<string, string>>;
  if (!g[TEST_STORAGE_GLOBAL_KEY]) g[TEST_STORAGE_GLOBAL_KEY] = new Map();
  const store = g[TEST_STORAGE_GLOBAL_KEY];

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';

const AURA_SETTINGS_KEY = 'twin_aura_settings_v1';

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('sessionStore — reduceAuraMotion 영속성', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.resetModules();
  });

  it('setReduceAuraMotion(true)가 AURA_SETTINGS_KEY에 그대로 직렬화된다', async () => {
    const { useSessionStore } = require('../sessionStore');
    useSessionStore.getState().setReduceAuraMotion(true);
    await flushMicrotasks();

    const raw = await AsyncStorage.getItem(AURA_SETTINGS_KEY);
    expect(raw).toBe('true');
  });

  it('콜드 스타트(모듈 재로드) 후에도 reduceAuraMotion=true가 복원된다', async () => {
    // 1) 기존 세션에서 오라 끄기를 켠다.
    const first = require('../sessionStore');
    first.useSessionStore.getState().setReduceAuraMotion(true);
    await flushMicrotasks();
    expect(await AsyncStorage.getItem(AURA_SETTINGS_KEY)).toBe('true');

    // 2) 앱 완전 종료 후 재시작을 시뮬레이션 — JS 모듈 레지스트리만 비우고(디스크 값은
    //    globalThis에 그대로 남는다) 스토어를 새로 require한다. 이러면 sessionStore.ts
    //    최하단의 모듈-레벨 하이드레이션 코드가 처음부터 다시 실행된다.
    jest.resetModules();
    const second = require('../sessionStore');

    // 하이드레이션은 AsyncStorage.getItem().then(...)으로 비동기 실행되므로 초기값은 아직 false다.
    expect(second.useSessionStore.getState().reduceAuraMotion).toBe(false);

    // 3) 하이드레이션 프라미스가 resolve될 때까지 기다린 뒤 최종 상태를 확인한다.
    await flushMicrotasks();
    expect(second.useSessionStore.getState().reduceAuraMotion).toBe(true);
  });

  it('reset() 호출 시 AURA_SETTINGS_KEY도 함께 삭제되어 다음 콜드 스타트에서 false로 복원된다', async () => {
    const first = require('../sessionStore');
    first.useSessionStore.getState().setReduceAuraMotion(true);
    await flushMicrotasks();

    first.useSessionStore.getState().reset();
    await flushMicrotasks();
    expect(await AsyncStorage.getItem(AURA_SETTINGS_KEY)).toBeNull();

    jest.resetModules();
    const second = require('../sessionStore');
    await flushMicrotasks();
    expect(second.useSessionStore.getState().reduceAuraMotion).toBe(false);
  });
});
