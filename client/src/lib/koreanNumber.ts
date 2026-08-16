const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const SMALL_UNITS = ['', '십', '백', '천'];
const BIG_UNITS = ['', '만', '억', '조', '경'];

/** 0~9999 사이의 4자리 묶음을 한글로 변환한다. 십/백/천 앞의 '일'은 생략한다. */
function convertGroup(num: number): string {
  let result = '';
  const str = String(num).padStart(4, '0');
  for (let i = 0; i < 4; i++) {
    const d = Number(str[i]);
    if (d === 0) continue;
    const isOnesPlace = i === 3;
    result += (d === 1 && !isOnesPlace ? '' : DIGITS[d]) + SMALL_UNITS[3 - i];
  }
  return result;
}

/** 음이 아닌 정수를 한글 숫자 표기로 변환한다 (만/억/조 단위 앞의 '일'은 생략하지 않음). */
export function numberToKorean(num: number): string {
  const n = Math.round(Math.abs(num));
  if (n === 0) return '영';
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 10000);
    rest = Math.floor(rest / 10000);
  }
  let result = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    result += convertGroup(groups[i]) + BIG_UNITS[i];
  }
  return result;
}

/** 공문서용 금액 표기: "금450,000원(금사십오만원)" */
export function formatKoreanCurrency(num: number): string {
  const n = Math.round(Math.abs(num));
  return `금${n.toLocaleString('ko-KR')}원(금${numberToKorean(n)}원)`;
}
