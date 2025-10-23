"use client";

export default function UserMessage({
  content,
  timeLabel,
}: {
  content: React.ReactNode;
  timeLabel?: string;
}) {
  return (
    <div className="flex justify-end py-1.5">
      <div className="max-w-[80%] text-right">
        <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground text-sm px-4 py-3 inline-block leading-relaxed">
          {content}
        </div>
        {timeLabel ? (
          <div className="text-[10px] text-default-500 mt-1.5 px-1">
            {timeLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
