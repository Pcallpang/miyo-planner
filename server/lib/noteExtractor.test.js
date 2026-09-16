import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeEvent, normalizeTodo } from './noteExtractor.js';

test('normalizeEvent는 날짜가 없으면 null', () => {
  assert.equal(normalizeEvent({ title: '회의' }), null);
});

test('normalizeEvent는 유효한 입력을 정규화한다', () => {
  const ev = normalizeEvent({ title: '학년부 협의회', date: '2026-09-20', startTime: '15:0', endTime: '16:00' });
  assert.equal(ev.title, '학년부 협의회');
  assert.equal(ev.date, '2026-09-20');
  assert.equal(ev.startTime, null); // '15:0'은 HH:mm 형식이 아니므로 무효 처리
  assert.equal(ev.allDay, true); // startTime이 없으면 종일
});

test('normalizeTodo는 text가 없으면 null', () => {
  assert.equal(normalizeTodo({ category: '업무' }), null);
});

test('normalizeTodo는 category가 목록에 없으면 업무로 기본값 처리', () => {
  const t = normalizeTodo({ text: '평가계획 제출', category: '기타' });
  assert.equal(t.category, '업무');
});
