import Image from "next/image";

import { cn } from "@/lib/utils";

/** The clinic logo. `inverse` paints its shape in the inverse token for dark grounds. */
function Wordmark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  if (inverse) {
    return (
      <div
        data-slot="wordmark"
        role="img"
        aria-label="The Schoeman Clinic"
        className={cn(
          "aspect-[869/371] w-[148px] bg-content-inverse mask-[url(/brand/schoemanClinic-logo.png)] mask-contain mask-no-repeat",
          className,
        )}
      />
    );
  }

  return (
    <Image
      data-slot="wordmark"
      src="/brand/schoemanClinic-logo.png"
      alt="The Schoeman Clinic"
      width={148}
      height={63}
      preload
      className={cn("h-auto w-[148px]", className)}
    />
  );
}

export { Wordmark };
