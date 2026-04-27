import type { PixiReactElementProps } from "@pixi/react";
import { extend, useApplication } from "@pixi/react";
import type { Application } from "pixi.js";
import type { IViewportOptions } from "pixi-viewport";
import { Viewport as BaseViewport } from "pixi-viewport";
import type { PropsWithChildren } from "react";
import { useLayoutEffect, useRef } from "react";

class ViewportWrapper extends BaseViewport {
  constructor(
    options: Omit<IViewportOptions, "events"> & { app: Application },
  ) {
    const { app, ...rest } = options;
    super({
      ...rest,
      events: app.renderer.events,
    });
    this.drag().pinch().wheel().decelerate();
  }
}

extend({ ViewportWrapper });

declare module "@pixi/react" {
  interface PixiElements {
    pixiViewportWrapper: PropsWithChildren<
      PixiReactElementProps<typeof ViewportWrapper>
    > & {
      app: Application;
    };
  }
}

interface ViewportProps {
  worldWidth: number;
  worldHeight: number;
  minScale: number;
  maxScale: number;
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
}: PropsWithChildren<ViewportProps>) {
  const { app } = useApplication();
  const viewportRef = useRef<ViewportWrapper>(null);

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
  }, [
    app.screen.width,
    app.screen.height,
    worldWidth,
    worldHeight,
    minScale,
    maxScale,
  ]);

  return (
    app?.renderer && (
      <pixiViewportWrapper
        ref={viewportRef}
        app={app}
        worldWidth={worldWidth}
        worldHeight={worldHeight}
      >
        {children}
      </pixiViewportWrapper>
    )
  );
}
