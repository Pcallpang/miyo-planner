import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * K에듀파인 "품목내역" 엑셀 업로드 양식 셀 매핑.
 *
 * sample/품목내역(양식).xlsx 실제 파일 기준: 1행이 헤더(내용/규격/단위/수량/예상단가),
 * 2행부터 품목 데이터. 학교마다 양식이 다르면 sample/ 폴더의 파일과 아래 값만 맞춰 바꾸면 된다.
 */
export const TEMPLATE_PATH = path.resolve(__dirname, '../../sample/품목내역(양식).xlsx');

/** 품목 테이블: startRow부터 한 품목당 한 행씩 채운다 */
export const ITEM_TABLE = {
  startRow: 2,
  columns: {
    content: 'A', // 내용(품명)
    spec: 'B', // 규격
    unit: 'C', // 단위
    qty: 'D', // 수량
    unitPrice: 'E', // 예상단가
  },
};
