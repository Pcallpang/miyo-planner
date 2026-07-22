/** 빈 화면에 미요 캐릭터와 안내 문구를 표시한다. src로 미요 변형을 지정할 수 있다. */
export default function EmptyMiyo({
  message,
  size = 64,
  src = '/miyo.png',
}: {
  message: string;
  size?: number;
  src?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <img src={src} alt="미요" width={size} height={size} className="opacity-80" draggable={false} />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
