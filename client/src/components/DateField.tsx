interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** 접근성 라벨 */
  'aria-label'?: string;
}

/**
 * 달력으로만 날짜를 고르는 입력. 클릭·Enter·Space로 달력이 열리고,
 * 키보드로 직접 숫자 타이핑은 막는다(Tab·Esc 네비게이션은 허용).
 */
export default function DateField({ value, onChange, className, ...rest }: Props) {
  function openPicker(el: HTMLInputElement) {
    try {
      el.showPicker();
    } catch {
      /* showPicker 미지원 브라우저는 기본 동작 */
    }
  }

  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => openPicker(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Tab') return; // 포커스 이동 허용
        if (e.key === 'Escape') return; // 팝업 닫기 허용
        e.preventDefault(); // 직접 타이핑 방지
        if (e.key === 'Enter' || e.key === ' ') openPicker(e.currentTarget);
      }}
      className={className}
      {...rest}
    />
  );
}
