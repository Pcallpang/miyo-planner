import { Table } from 'lucide-react';
import WeeklyGrid from '../components/timetable/WeeklyGrid';
import SubjectProgressPanel from '../components/timetable/SubjectProgressPanel';

export default function TimetableView() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Table size={18} className="text-mint-500" />
          오늘의 시간표
        </h2>
        <p className="text-xs text-slate-400">클릭하면 수정, 칸을 끌면 자리를 서로 바꿀 수 있습니다</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <WeeklyGrid />
        <SubjectProgressPanel />
      </div>
    </div>
  );
}
