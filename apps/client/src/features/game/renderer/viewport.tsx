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
  initialFitRatio: number;
  initialMaxScale: number;
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
  initialFitRatio,
  initialMaxScale,
  minScale,
  maxScale,
}: PropsWithChildren<ViewportProps>) {
  const { app } = useApplication();
  const viewportRef = useRef<ViewportWrapper>(null);
  const initializedWorldRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (app.screen.width <= 0 || app.screen.height <= 0) return;

    viewport.resize(
      app.screen.width,
      app.screen.height,
      worldWidth,
      worldHeight,
    );
    viewport.clampZoom({ minScale, maxScale });
    viewport.clamp({
      left: 0,
      top: 0,
      right: worldWidth,
      bottom: worldHeight,
      direction: "all",
      underflow: "center",
    });

    const viewportKey = `${app.screen.width}:${app.screen.height}:${worldWidth}:${worldHeight}`;
    if (initializedWorldRef.current !== viewportKey) {
      const fitScale = Math.min(
        app.screen.width / worldWidth,
        app.screen.height / worldHeight,
      );
      const adaptiveInitialScale = Math.min(
        initialMaxScale,
        fitScale * initialFitRatio,
      );
      const clampedInitialScale = Math.min(
        maxScale,
        Math.max(minScale, adaptiveInitialScale),
      );
      viewport.setZoom(clampedInitialScale, true);
      viewport.moveCenter(worldWidth / 2, worldHeight / 2);
      initializedWorldRef.current = viewportKey;
    }
  }, [
    app.screen.width,
    app.screen.height,
    worldWidth,
    worldHeight,
    initialFitRatio,
    initialMaxScale,
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
