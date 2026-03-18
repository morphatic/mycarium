interface StandbyButtonProps {
  isStandby: boolean;
  onEnter: () => void;
  onExit: () => void;
}

export function StandbyButton({ isStandby, onEnter, onExit }: StandbyButtonProps) {
  if (isStandby) {
    return (
      <button
        onClick={onExit}
        className="w-full text-sm bg-emerald-700 text-white py-2 rounded hover:bg-emerald-800"
      >
        Resume Auto Mode
      </button>
    );
  }

  return (
    <button
      onClick={onEnter}
      className="w-full text-sm bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
    >
      Enter Standby
    </button>
  );
}
