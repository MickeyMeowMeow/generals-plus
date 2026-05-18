import {
  CheckCircle,
  CircleX,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import type { ToasterProps } from "sonner";
import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group font-sans"
      icons={{
        success: <CheckCircle className="size-4" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
        error: <CircleX className="size-4" />,
        loading: <LoaderCircle className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--game-surface)",
          "--normal-text": "var(--game-text)",
          "--normal-border": "var(--game-border)",
          "--border-radius": "0",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group/toast border-game-border/80 bg-game-surface font-sans text-game-text shadow-xl shadow-black/30",
          warning: "border-warning/70",
          success: "border-success/70",
          error: "border-error/70",
          info: "border-game-border/80",
          title:
            "font-sans text-sm font-semibold tracking-normal text-game-text",
          description:
            "font-sans text-xs leading-5 tracking-normal text-game-text-dim",
          icon: "text-warning",
          closeButton:
            "rounded-none border-game-border bg-game-surface font-sans text-game-text-dim transition hover:text-game-text",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
