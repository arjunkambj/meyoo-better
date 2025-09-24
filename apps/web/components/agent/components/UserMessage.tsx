"use client";

export default function UserMessage({
  content,
  timeLabel,
}: {
  content: React.ReactNode;
  timeLabel?: string;
}) {
  return (
    <div className="flex justify-end py-1">
      <div className="max-w-[85%] text-right">
        <div className="rounded-medium bg-primary text-primary-foreground text-sm px-3 py-2 inline-block">
          {content}
        </div>
        {timeLabel ? (
          <div className="text-[10px] text-default-500 mt-1">{timeLabel}</div>
        ) : null}
      </div>
    </div>
  );
}

