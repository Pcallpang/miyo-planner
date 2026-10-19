/** 메뉴 옆에 붙이는 작은 "N" 알림 배지(새 소식이 있다는 표시). */
export default function NewBadge() {
  return (
    <span
      className="ml-auto grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white"
      aria-label="새 소식"
    >
      N
    </span>
  );
}
