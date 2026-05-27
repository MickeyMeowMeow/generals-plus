import type { PixiReactElementProps } from "@pixi/react";
import { extend, useApplication } from "@pixi/react";
import type { Application } from "pixi.js";
import type { IViewportOptions } from "pixi-viewport";
import { Viewport as BaseViewport } from "pixi-viewport";
import type { PropsWithChildren } from "react";
import { useLayoutEffect, useRef } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config";

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
  worldBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  initialTarget?: { x: number; y: number };
}

function calculateZoomScale(
  screenWidth: number,
  screenHeight: number,
  worldWidth: number,
  worldHeight: number,
) {
  const fitScale = Math.min(
    screenWidth / worldWidth,
    screenHeight / worldHeight,
  );
  const clampedScale = Math.max(
    RenderConfig.initialMinScale,
    Math.min(
      RenderConfig.initialMaxScale,
      fitScale * RenderConfig.initialFitRatio,
    ),
  );
  return clampedScale;
}

/**
 * Viewport component that manages the Pixi viewport, including resizing, zoom clamping, and centering.
 */
export function Viewport({
  children,
  worldBounds,
  initialTarget,
}: PropsWithChildren<ViewportProps>) {
  const { app } = useApplication();
  const viewportRef = useRef<ViewportWrapper>(null);

  const isZoomInitialized = useRef(false);
  const isCameraInitialized = useRef(false);

  const worldWidth = worldBounds.right - worldBounds.left;
  const worldHeight = worldBounds.bottom - worldBounds.top;

  const defaultZoom = calculateZoomScale(
    app.screen.width,
    app.screen.height,
    worldWidth,
    worldHeight,
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Resizing and clamping boundaries should happen on every screen resize
    viewport.resize(
      app.screen.width,
      app.screen.height,
      worldWidth,
      worldHeight,
    );

    viewport.clampZoom({
      minScale: RenderConfig.minScale,
      maxScale: RenderConfig.maxScale,
    });

    const marginX =
      (app.screen.width * RenderConfig.clampMarginRatioX) / defaultZoom;
    const marginY =
      (app.screen.height * RenderConfig.clampMarginRatioY) / defaultZoom;
    viewport.clamp({
      left: worldBounds.left - marginX,
      top: worldBounds.top - marginY,
      right: worldBounds.right + marginX,
      bottom: worldBounds.bottom + marginY,
      underflow: "none",
    });
  }, [
    app.screen.width,
    app.screen.height,
    worldBounds,
    worldWidth,
    worldHeight,
    defaultZoom,
  ]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Initial zoom should only happen once
    if (isZoomInitialized.current === false) {
      viewport.setZoom(defaultZoom, true);
      isZoomInitialized.current = true;
    }
  }, [defaultZoom]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Initial camera centering should only run after zoom initialized
    if (!isZoomInitialized.current) return;

    // Initial camera centering should only run when initialTarget first becomes available
    if (isCameraInitialized.current || !initialTarget) return;
    isCameraInitialized.current = true;

    // Determine initial target coordinates, defaulting to world center
    const { x, y } = initialTarget ?? {
      x: worldBounds.left + worldWidth / 2,
      y: worldBounds.top + worldHeight / 2,
    };

    const marginX = Math.min(
      (app.screen.width * (0.5 - RenderConfig.initialMarginRatioX)) /
        defaultZoom,
      worldWidth / 2,
    );
    const marginY = Math.min(
      (app.screen.height * (0.5 - RenderConfig.initialMarginRatioY)) /
        defaultZoom,
      worldHeight / 2,
    );

    const clampedX = Math.max(
      worldBounds.left + marginX,
      Math.min(x, worldBounds.right - marginX),
    );
    const clampedY = Math.max(
      worldBounds.top + marginY,
      Math.min(y, worldBounds.bottom - marginY),
    );

    viewport.moveCenter(clampedX, clampedY);
  }, [
    app.screen.width,
    app.screen.height,
    worldBounds,
    worldWidth,
    worldHeight,
    initialTarget,
    defaultZoom,
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
