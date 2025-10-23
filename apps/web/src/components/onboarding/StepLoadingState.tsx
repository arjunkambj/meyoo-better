import React from "react";

interface StepLoadingStateProps {
  message?: string;
}

const StepLoadingState = React.memo(function StepLoadingState({
  message = "Loading...",
}: StepLoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[50vh] md:min-h-[60vh] gap-4 bg-gradient-to-b from-transparent to-content2/20 px-4">
      <div className="w-full max-w-2xl">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/3 bg-default-200 rounded" />
          <div className="h-3 w-2/3 bg-default-200 rounded" />
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="h-20 bg-default-200 rounded-lg" />
            <div className="h-20 bg-default-200 rounded-lg" />
            <div className="h-20 bg-default-200 rounded-lg" />
          </div>
        </div>
      </div>
      <p className="text-default-600 text-sm sm:text-base md:text-lg text-center">
        {message}
      </p>
    </div>
  );
});

export default StepLoadingState;
