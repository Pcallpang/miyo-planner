import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NeisError,
  extractRows,
  extractTotalCount,
  fetchSchedule,
  parseDish,
  splitLines,
  toCompact,
  toDashed,
} from './neis.js';

test('정상 응답에서 row 배열을 꺼낸다', () => {
  const body = {
    schoolInfo: [
      { head: [{ list_total_count: 1 }, { RESULT: { CODE: 'INFO-000', MESSAGE: '정상' } }] },
      { row: [{ SCHUL_NM: '선인고등학교' }] },
    ],
  };
  assert.deepEqual(extractRows(body, 'schoolInfo'), [{ SCHUL_NM: '선인고등학교' }]);
});

test('조회 결과 없음(INFO-200)은 오류가 아니라 빈 배열이다', () => {
  // 방학·주말에는 급식이 없으므로 정상적인 상황이다
  const body = { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } };
  assert.deepEqual(extractRows(body, 'mealServiceDietInfo'), []);
});

test('head 안에 담겨 오는 INFO-200도 빈 배열로 처리한다', () => {
  const body = {
    mealServiceDietInfo: [{ head: [{ list_total_count: 0 }, { RESULT: { CODE: 'INFO-200' } }] }],
  };
  assert.deepEqual(extractRows(body, 'mealServiceDietInfo'), []);
});

test('인증키 오류는 NeisError로 던진다', () => {
  const body = { RESULT: { CODE: 'ERROR-290', MESSAGE: '인증키가 유효하지 않습니다.' } };
  assert.throws(() => extractRows(body, 'schoolInfo'), NeisError);
});

test('알 수 없는 형태의 응답은 빈 배열로 넘어간다', () => {
  assert.deepEqual(extractRows({}, 'schoolInfo'), []);
  assert.deepEqual(extractRows(null, 'schoolInfo'), []);
});

test('<br/>로 이어진 텍스트를 줄 단위로 자른다', () => {
  assert.deepEqual(splitLines('차수수밥 <br/>배추된장국 <br />콩나물무침'), [
    '차수수밥',
    '배추된장국',
    '콩나물무침',
  ]);
});

test('빈 값은 빈 배열이 된다', () => {
  assert.deepEqual(splitLines(null), []);
  assert.deepEqual(splitLines(''), []);
});

test('요리명에서 알레르기 번호를 분리한다', () => {
  assert.deepEqual(parseDish('목살소시지야채구이 (2.5.6.10.15.16)'), {
    name: '목살소시지야채구이',
    allergens: ['2', '5', '6', '10', '15', '16'],
  });
});

test('알레르기 표기가 없는 요리는 그대로 둔다', () => {
  assert.deepEqual(parseDish('차수수밥'), { name: '차수수밥', allergens: [] });
});

test('괄호가 알레르기 번호가 아니면 이름의 일부로 남긴다', () => {
  assert.deepEqual(parseDish('오므라이스(자율)'), { name: '오므라이스(자율)', allergens: [] });
});

test('날짜 형식을 서로 변환한다', () => {
  assert.equal(toDashed('20260701'), '2026-07-01');
  assert.equal(toCompact('2026-07-01'), '20260701');
});

test('형식이 다른 날짜 값은 건드리지 않는다', () => {
  assert.equal(toDashed(''), '');
  assert.equal(toDashed(null), '');
});

test('head에서 전체 건수를 꺼낸다', () => {
  const body = {
    SchoolSchedule: [{ head: [{ list_total_count: 23 }, { RESULT: { CODE: 'INFO-000' } }] }],
  };
  assert.equal(extractTotalCount(body, 'SchoolSchedule'), 23);
});

test('전체 건수가 없으면 null이다', () => {
  assert.equal(extractTotalCount({}, 'SchoolSchedule'), null);
  assert.equal(extractTotalCount(null, 'SchoolSchedule'), null);
});

/** 지정한 페이지들을 순서대로 돌려주는 가짜 fetch를 깐다 */
function stubNeis(pages) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const pIndex = Number(new URL(String(url)).searchParams.get('pIndex'));
    const rows = pages[pIndex - 1] ?? [];
    const total = pages.flat().length;
    return {
      ok: true,
      json: async () => ({
        SchoolSchedule: [
          { head: [{ list_total_count: total }, { RESULT: { CODE: 'INFO-000' } }] },
          { row: rows },
        ],
      }),
    };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function scheduleRow(ymd, name) {
  return { AA_YMD: ymd, EVENT_NM: name, EVENT_CNTNT: '', SBTR_DD_SC_NM: '해당없음' };
}

test('여러 페이지에 걸친 응답을 모두 모아 온다', async () => {
  // pSize(1000)를 꽉 채운 페이지가 오면 다음 페이지를 이어 받아야 한다
  const page1 = Array.from({ length: 1000 }, (_, i) => scheduleRow('20260801', `일정${i}`));
  const page2 = [scheduleRow('20260802', '개학식')];
  const { calls, restore } = stubNeis([page1, page2]);
  try {
    const result = await fetchSchedule({
      atptCode: 'B10',
      schoolCode: 'TEST-PAGING',
      from: '2026-08-01',
      to: '2026-08-31',
    });
    assert.equal(result.length, 1001);
    assert.equal(calls.length, 2);
    assert.ok(result.some((e) => e.name === '개학식'));
  } finally {
    restore();
  }
});

test('받은 행이 요청량보다 적으면 더 조르지 않는다', async () => {
  // 인증키가 없을 때 나이스는 pIndex를 무시하고 같은 5건을 계속 준다.
  // 여기서 멈추지 않으면 같은 페이지를 무한히 받게 된다.
  const five = Array.from({ length: 5 }, (_, i) => scheduleRow('20260801', `일정${i}`));
  const { calls, restore } = stubNeis([five, five, five]);
  try {
    const result = await fetchSchedule({
      atptCode: 'B10',
      schoolCode: 'TEST-NOKEY',
      from: '2026-08-01',
      to: '2026-08-31',
    });
    assert.equal(result.length, 5);
    assert.equal(calls.length, 1, '첫 페이지만 요청해야 한다');
  } finally {
    restore();
  }
});
