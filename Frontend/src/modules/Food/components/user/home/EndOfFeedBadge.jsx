import chefMascot from "@food/assets/chef-mascot.png";

export default function EndOfFeedBadge({ className = "" }) {
  return (
    <div className={`w-full py-10 px-4 flex flex-col items-center justify-center select-none ${className}`}>
      <div className="relative w-full max-w-sm flex items-center justify-center">
        {/* Left divider line */}
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-800 to-gray-500 dark:to-gray-700" />

        {/* Center circular badge with chef mascot */}
        <div className="mx-3.5 flex items-center justify-center w-14 h-14 rounded-full bg-[#181818] border-2 border-gray-700/80 shadow-md shadow-black/20 overflow-hidden p-2.5">
          <img
            src={chefMascot}
            alt="Jharkhand Rasoi"
            className="w-full h-full object-contain filter drop-shadow"
          />
        </div>

        {/* Right divider line */}
        <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-gray-300 dark:via-gray-800 to-gray-500 dark:to-gray-700" />
      </div>

      {/* Caption text */}
      <p className="mt-3.5 text-xs font-black uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400 text-center">
        THAT&apos;S ALL FOR NOW
      </p>
    </div>
  );
}
