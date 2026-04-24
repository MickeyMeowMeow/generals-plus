import type { IGrid } from "@generals-plus/engine";
import { Application } from "pixi.js";
import { useEffect, useRef } from "react";

import { GridRenderer } from "#/features/match/renderer/GridRenderer";
import { renderConfig } from "#/features/match/renderer/renderConfig";

/**
 * Props for the Pixi stage wrapper.
 */
interface PixiStageProps {
  /** Grid snapshot to render into the Pixi scene. */
  readonly grid: IGrid;
}

/**
 * Owns the Pixi Application lifecycle inside React.
 */
export function PixiStage({ grid }: PixiStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    /**
     * StrictMode and HMR can remount quickly; clearing the host prevents duplicate canvases.
     */
    host.replaceChildren();

    const app = new Application<HTMLCanvasElement>({
      backgroundColor: renderConfig.stageBackground,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    const gridRenderer = new GridRenderer();

    host.appendChild(app.view);
    app.stage.addChild(gridRenderer.container);

    /**
     * Match the renderer to its host element and redraw the grid after every resize.
     */
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      app.renderer.resize(width, height);
      gridRenderer.render(grid, { width, height });
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    return () => {
      /**
       * Destroy Pixi resources explicitly so hot reloads do not retain WebGL objects.
       */
      resizeObserver.disconnect();
      app.stage.removeChild(gridRenderer.container);
      gridRenderer.destroy();
      app.destroy(true, { children: true, texture: true, baseTexture: true });
      host.replaceChildren();
    };
  }, [grid]);

  return <div ref={hostRef} className="pixi-stage" />;
}
