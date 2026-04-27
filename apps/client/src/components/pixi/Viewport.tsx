import type { PixiReactElementProps } from "@pixi/react";
import { extend, useApplication } from "@pixi/react";
import type { Application } from "pixi.js";
import type { IViewportOptions } from "pixi-viewport";
import { Viewport as BaseViewport } from "pixi-viewport";
import type { PropsWithChildren } from "react";
import { useLayoutEffect, useRef } from "react";

class ViewportWrapper extends BaseViewport {
  constructor(
    options: Omit<IViewportOptions, "events"> & {
      app: Application;
      dragMouseButtons: string;
    },
  ) {
    const { app, dragMouseButtons, ...rest } = options;
    super({
      ...rest,
      events: app.renderer.events,
    });
    this.drag({ mouseButtons: dragMouseButtons }).pinch().wheel().decelerate();
  }
}

extend({ ViewportWrapper });

declare module "@pixi/react" {
  interface PixiElements {
    pixiViewportWrapper: PropsWithChildren<
      PixiReactElementProps<typeof ViewportWrapper>
    > & {
      app: Application;
      dragMouseButtons: string;
    };
  }
}

export interface ViewportBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly scale: number;
}

interface ViewportProps {
  worldWidth: number;
  worldHeight: number;
  minScale: number;
  maxScale: number;
  /** Mouse buttons that can drag the viewport (pixi-viewport format). */
  dragMouseButtons?: string;
  /** Emits current world-space bounds whenever camera state changes. */
  onViewportChange?(bounds: ViewportBounds): void;
}

class ViewportBoundsReader {
  /** Reads current world-space bounds from the viewport instance. */
  read(viewport: ViewportWrapper): ViewportBounds {
    return {
      left: viewport.left,
      top: viewport.top,
      right: viewport.right,
      bottom: viewport.bottom,
      scale: viewport.scale.x,
    };
  }
}

/**
 * Viewport component that manages the Pixi viewport, including resizing, zoom clamping, and centering.
 */
export function Viewport({
  children,
  worldWidth,
  worldHeight,
  minScale,
  maxScale,
  dragMouseButtons = "left middle",
  onViewportChange,
}: PropsWithChildren<ViewportProps>) {
  const { app } = useApplication();
  const viewportRef = useRef<ViewportWrapper>(null);
  const boundsReaderRef = useRef(new ViewportBoundsReader());

  useLayoutEffect(() => {
    const canvas = app.canvas as HTMLCanvasElement | undefined;
    if (!canvas) return;

    const preventContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    canvas.addEventListener("contextmenu", preventContextMenu);
    return () => {
      canvas.removeEventListener("contextmenu", preventContextMenu);
    };
  }, [app]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.resize(
      app.screen.width,
      app.screen.height,
      worldWidth,
      worldHeight,
    );
    viewport.clampZoom({ minScale, maxScale });
    viewport.clamp({ direction: "all" });

    viewport.fit();
    viewport.moveCenter(worldWidth / 2, worldHeight / 2);
    onViewportChange?.(boundsReaderRef.current.read(viewport));
  }, [
    app.screen.width,
    app.screen.height,
    worldWidth,
    worldHeight,
    minScale,
    maxScale,
    onViewportChange,
  ]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !onViewportChange) return;

    // Keep React state in sync with runtime camera updates.
    const publishBounds = () => {
      onViewportChange(boundsReaderRef.current.read(viewport));
    };

    viewport.on("frame-end", publishBounds);
    viewport.on("moved", publishBounds);
    viewport.on("zoomed", publishBounds);

    return () => {
      viewport.off("frame-end", publishBounds);
      viewport.off("moved", publishBounds);
      viewport.off("zoomed", publishBounds);
    };
  }, [onViewportChange]);

  return (
    app?.renderer && (
      <pixiViewportWrapper
        ref={viewportRef}
        app={app}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
        dragMouseButtons={dragMouseButtons}
      >
        {children}
      </pixiViewportWrapper>
    )
  );
}
