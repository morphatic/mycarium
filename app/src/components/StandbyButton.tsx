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
        className="w-full text-sm bg-myc-teal dark:bg-myc-teal-deep text-white py-2 rounded hover:bg-myc-teal-mid dark:hover:bg-myc-teal"
      >
        Resume Auto Mode
      </button>
    );
  }

  return (
    <button
      onClick={onEnter}
      className="w-full text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
    >
      Enter Standby
    </button>
  );
}
