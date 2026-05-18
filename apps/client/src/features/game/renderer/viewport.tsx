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
  worldWidth: number;
  worldHeight: number;
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
  worldWidth,
  worldHeight,
  initialTarget,
}: PropsWithChildren<ViewportProps>) {
  const { app } = useApplication();
  const viewportRef = useRef<ViewportWrapper>(null);

  const isZoomInitialized = useRef(false);
  const cameraInitializedWith = useRef<typeof initialTarget>(null);

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
      left: -marginX,
      top: -marginY,
      right: worldWidth + marginX,
      bottom: worldHeight + marginY,
      underflow: "none",
    });
  }, [
    app.screen.width,
    app.screen.height,
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

    // Initial camera centering should only run when the initial target changes
    if (cameraInitializedWith.current !== initialTarget) {
      // Determine initial target coordinates, defaulting to world center
      const { x, y } = initialTarget ?? {
        x: worldWidth / 2,
        y: worldHeight / 2,
      };

      const marginX = Math.min(
        (app.screen.width * (0.5 - RenderConfig.initialMarginRatioX)) /
          defaultZoom,
        worldWidth / 2,
      );
      const marginY = Math.min(
        (app.screen.height * (0.5 - RenderConfig.initialMarginRatioX)) /
          defaultZoom,
        worldHeight / 2,
      );

      const clampedX = Math.max(marginX, Math.min(x, worldWidth - marginX));
      const clampedY = Math.max(marginY, Math.min(y, worldHeight - marginY));

      viewport.moveCenter(clampedX, clampedY);
      cameraInitializedWith.current = initialTarget;
    }
  }, [
    app.screen.width,
    app.screen.height,
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
