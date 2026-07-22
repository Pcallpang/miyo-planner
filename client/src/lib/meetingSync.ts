import type { GEvent, Meeting } from '../types';

export interface DateRange {
  min: string; // YYYY-MM-DD
  max: string; // YYYY-MM-DD
}

/** 구글 이벤트에서 회의록에 반영할 필드(제목/날짜/시간/메모)를 뽑는다. */
function fieldsFromEvent(ev: GEvent): Pick<Meeting, 'title' | 'date' | 'time' | 'memo'> {
  return {
    title: ev.title,
    date: ev.start.slice(0, 10),
    time: ev.allDay ? undefined : ev.start.slice(11, 16) || undefined,
    memo: ev.description || '',
  };
}

function sameFields(m: Meeting, f: Pick<Meeting, 'title' | 'date' | 'time' | 'memo'>): boolean {
  return m.title === f.title && m.date === f.date && (m.time ?? undefined) === f.time && (m.memo ?? '') === f.memo;
}

/**
 * 구글 캘린더가 원본이라는 전제로, 연동된(googleEventId 보유) 회의록을 조회된 이벤트와 대조해 반영한다.
 * - 이벤트가 남아 있으면 제목/날짜/시간/메모를 구글 기준으로 갱신
 * - range 안인데 이벤트가 사라졌으면 구글에서 삭제된 것 → 연동만 해제(메모는 보존)
 * - range 밖이면 판단 불가이므로 그대로 둔다
 * @returns 갱신된 목록과 변경 여부
 */
export function reconcileMeetings(
  meetings: Meeting[],
  events: GEvent[],
  range: DateRange,
): { meetings: Meeting[]; changed: boolean } {
  const byId = new Map(events.map((e) => [e.id, e]));
  let changed = false;

  const next = meetings.map((m) => {
    if (!m.googleEventId) return m;

    const ev = byId.get(m.googleEventId);
    if (ev) {
      const fields = fieldsFromEvent(ev);
      if (sameFields(m, fields)) return m;
      changed = true;
      return { ...m, ...fields };
    }

    // 이벤트가 조회 결과에 없음: range 안에서 사라졌다면 삭제된 것으로 본다.
    if (m.date >= range.min && m.date <= range.max) {
      changed = true;
      const { googleEventId: _drop, ...rest } = m;
      return rest;
    }
    return m;
  });

  return { meetings: next, changed };
}
