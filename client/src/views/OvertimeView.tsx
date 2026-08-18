import { useState, type Dispatch, type SetStateAction } from 'react';
import { useData } from '../context/DataContext';
import OvertimeCard from '../components/dashboard/OvertimeCard';
import OvertimeModal from '../components/OvertimeModal';
import type { OvertimeLog } from '../types';

/** 하단 탭바에서 바로 진입하는 초과근무 전용 화면. 대시보드까지 스크롤하지 않아도 되게 한다. */
export default function OvertimeView() {
  const { data, update } = useData();
  const overtimeLogs = data.overtimeLogs;
  const setOvertimeLogs: Dispatch<SetStateAction<OvertimeLog[]>> = (next) =>
    update((prev) => ({ overtimeLogs: typeof next === 'function' ? next(prev.overtimeLogs) : next }));

  const [overtimeModal, setOvertimeModal] = useState<{ editing?: OvertimeLog } | null>(null);

  return (
    <div className="mx-auto max-w-xl">
      <OvertimeCard
        logs={overtimeLogs}
        setLogs={setOvertimeLogs}
        onAdd={() => setOvertimeModal({})}
        onEdit={(log) => setOvertimeModal({ editing: log })}
      />

      {overtimeModal && (
        <OvertimeModal
          editing={overtimeModal.editing}
          onClose={() => setOvertimeModal(null)}
          onSave={(log) =>
            setOvertimeLogs((prev) =>
              overtimeModal.editing ? prev.map((l) => (l.id === log.id ? log : l)) : [...prev, log],
            )
          }
        />
      )}
    </div>
  );
}
