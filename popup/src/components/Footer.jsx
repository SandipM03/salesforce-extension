import { formatDateTime } from '../utils/format';

export default function Footer({ lastSync }) {
  return (
    <footer className="px-4 py-2.5 bg-white border-t border-gray-200 flex justify-between text-[11px] text-gray-500 shrink-0">
      <span>
        {lastSync ? `Last sync: ${formatDateTime(lastSync)}` : 'Never synced'}
      </span>
      <span>v1.0.0</span>
    </footer>
  );
}
