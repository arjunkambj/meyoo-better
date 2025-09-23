import { cn } from '@/libs/utils';
import type { Experimental_GeneratedImage } from 'ai';
import NextImage from 'next/image';

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
};

export const Image = ({
  base64,
  mediaType,
  className,
  alt,
  width,
  height,
}: ImageProps) => {
  const fallbackSize = 1024;

  return (
    <NextImage
      alt={alt ?? 'Generated image'}
      className={cn(
        'h-auto max-w-full overflow-hidden rounded-md',
        className
      )}
      src={`data:${mediaType};base64,${base64}`}
      width={width ?? fallbackSize}
      height={height ?? fallbackSize}
      unoptimized
    />
  );
};
