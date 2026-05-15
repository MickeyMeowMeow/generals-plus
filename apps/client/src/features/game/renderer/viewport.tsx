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
  initialHudReserveRight: number;
  initialHudReserveTop: number;
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
  initialHudReserveRight,
  initialHudReserveTop,
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

    viewport.eventMode = "static";
    // Let pixi-viewport keep its hit area aligned with the visible world.
    // A forced screen-sized rect lives in local/world coordinates, so it gets
    // scaled with the camera and can silently shrink the clickable region.
    viewport.forceHitArea = null;
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
      const reservedWidth = Math.min(
        initialHudReserveRight,
        app.screen.width * 0.42,
      );
      const reservedHeight = Math.min(
        initialHudReserveTop,
        app.screen.height * 0.32,
      );
      const availableWidth = Math.max(1, app.screen.width - reservedWidth);
      const availableHeight = Math.max(1, app.screen.height - reservedHeight);
      const fitScale = Math.min(
        availableWidth / worldWidth,
        availableHeight / worldHeight,
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
      viewport.x -= reservedWidth / 2;
      viewport.y += reservedHeight / 2;
      initializedWorldRef.current = viewportKey;
    }
  }, [
    app.screen.width,
    app.screen.height,
    worldWidth,
    worldHeight,
    initialFitRatio,
    initialMaxScale,
    initialHudReserveRight,
    initialHudReserveTop,
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
