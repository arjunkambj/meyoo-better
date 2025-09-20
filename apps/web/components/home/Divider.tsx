export default function Divider({ className }: { className?: string }) {
  return (
    <div className={`w-full bg-background ${className}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12">
        <div className="relative w-full h-[1px] overflow-visible">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary/20 to-transparent animate-pulse" />
        </div>
      </div>
    </div>
  );
}
