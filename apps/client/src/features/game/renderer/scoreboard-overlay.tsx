import { PlayerStatus } from "@generals-plus/engine";
import { extend, useApplication } from "@pixi/react";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { useCallback, useMemo } from "react";

import { RenderConfig } from "#/features/game/renderer/render-config.ts";
import type { RenderScoreboardData } from "#/features/game/renderer/scoreboard-types";

extend({ Container, Graphics, Text });

interface ScoreboardOverlayProps {
  readonly data: RenderScoreboardData | null;
}

function formatPlayerName(name: string): string {
  const maxLength = RenderConfig.scoreboardPlayerNameMaxLength;
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength - 1)}...`;
}

export function ScoreboardOverlay({ data }: ScoreboardOverlayProps) {
  const { app } = useApplication();

  const visibleRows = useMemo(() => {
    return data?.rows.slice(
      RenderConfig.scoreboardFirstVisibleRowIndex,
      RenderConfig.scoreboardMaxVisibleRows,
    );
  }, [data]);

  const panelHeight =
    RenderConfig.scoreboardHeaderHeight +
    (visibleRows?.length ?? 0) * RenderConfig.scoreboardRowHeight;
  const panelX =
    app.screen.width -
    RenderConfig.scoreboardWidth -
    RenderConfig.scoreboardMargin;
  const panelY = RenderConfig.scoreboardMargin;
  const armyColumnX =
    RenderConfig.scoreboardWidth -
    RenderConfig.scoreboardHorizontalPadding -
    RenderConfig.scoreboardArmyColumnWidth -
    RenderConfig.scoreboardLandColumnWidth -
    RenderConfig.scoreboardColumnGap;
  const landColumnX =
    RenderConfig.scoreboardWidth -
    RenderConfig.scoreboardHorizontalPadding -
    RenderConfig.scoreboardLandColumnWidth;

  const textStyle = useMemo(
    () =>
      new TextStyle({
        fontFamily: RenderConfig.scoreboardFontFamily,
        fontSize: RenderConfig.scoreboardFontSize,
        fontWeight: RenderConfig.scoreboardFontWeight,
        fill: RenderConfig.scoreboardTextColor,
      }),
    [],
  );
  const mutedTextStyle = useMemo(
    () =>
      new TextStyle({
        fontFamily: RenderConfig.scoreboardFontFamily,
        fontSize: RenderConfig.scoreboardFontSize,
        fontWeight: RenderConfig.scoreboardFontWeight,
        fill: RenderConfig.scoreboardMutedTextColor,
      }),
    [],
  );
  const headerTextStyle = useMemo(
    () =>
      new TextStyle({
        fontFamily: RenderConfig.scoreboardFontFamily,
        fontSize: RenderConfig.scoreboardHeaderFontSize,
        fontWeight: RenderConfig.scoreboardHeaderFontWeight,
        fill: RenderConfig.scoreboardHeaderTextColor,
      }),
    [],
  );

  const drawPanel = useCallback(
    (g: Graphics) => {
      g.clear();
      g.roundRect(
        0,
        0,
        RenderConfig.scoreboardWidth,
        panelHeight,
        RenderConfig.scoreboardBorderRadius,
      )
        .fill({
          color: RenderConfig.scoreboardBackground,
          alpha: RenderConfig.scoreboardBackgroundAlpha,
        })
        .stroke({
          color: RenderConfig.scoreboardBorderColor,
          alpha: RenderConfig.scoreboardBorderAlpha,
          width: RenderConfig.scoreboardBorderWidth,
        });

      g.moveTo(0, RenderConfig.scoreboardHeaderHeight)
        .lineTo(
          RenderConfig.scoreboardWidth,
          RenderConfig.scoreboardHeaderHeight,
        )
        .stroke({
          color: RenderConfig.scoreboardDividerColor,
          alpha: RenderConfig.scoreboardDividerAlpha,
          width: RenderConfig.scoreboardDividerWidth,
        });
    },
    [panelHeight],
  );

  const drawRowBackground = useCallback((g: Graphics) => {
    g.clear();
    g.roundRect(
      RenderConfig.scoreboardHorizontalPadding / 2,
      2,
      RenderConfig.scoreboardWidth - RenderConfig.scoreboardHorizontalPadding,
      RenderConfig.scoreboardRowHeight - 4,
      RenderConfig.scoreboardRowBorderRadius,
    ).fill({
      color: RenderConfig.scoreboardCurrentPlayerBackground,
      alpha: RenderConfig.scoreboardCurrentPlayerBackgroundAlpha,
    });
  }, []);

  if (!data || !visibleRows || visibleRows.length === 0) return null;

  return (
    <pixiContainer x={panelX} y={panelY} eventMode="none">
      <pixiGraphics draw={drawPanel} />
      <pixiText
        text={RenderConfig.scoreboardRankHeader}
        x={RenderConfig.scoreboardRankColumnX}
        y={RenderConfig.scoreboardHeaderTextY}
        style={headerTextStyle}
      />
      <pixiText
        text={RenderConfig.scoreboardPlayerHeader}
        x={RenderConfig.scoreboardPlayerColumnX}
        y={RenderConfig.scoreboardHeaderTextY}
        style={headerTextStyle}
      />
      <pixiText
        text={RenderConfig.scoreboardArmyHeader}
        x={armyColumnX}
        y={RenderConfig.scoreboardHeaderTextY}
        style={headerTextStyle}
      />
      <pixiText
        text={RenderConfig.scoreboardLandHeader}
        x={landColumnX}
        y={RenderConfig.scoreboardHeaderTextY}
        style={headerTextStyle}
      />
      {visibleRows.map((row, index) => {
        const y =
          RenderConfig.scoreboardHeaderHeight +
          index * RenderConfig.scoreboardRowHeight;
        const rowAlpha =
          row.status === PlayerStatus.ELIMINATED
            ? RenderConfig.scoreboardEliminatedRowAlpha
            : RenderConfig.scoreboardActiveRowAlpha;
        const rowTextStyle =
          row.status === PlayerStatus.ELIMINATED ? mutedTextStyle : textStyle;

        return (
          <pixiContainer
            key={row.playerId}
            y={y}
            alpha={rowAlpha}
            eventMode="none"
          >
            {row.isCurrentPlayer ? (
              <pixiGraphics draw={drawRowBackground} />
            ) : null}
            <pixiGraphics
              draw={(g) => {
                g.clear();
                g.rect(
                  0,
                  3,
                  RenderConfig.scoreboardColorBarWidth,
                  RenderConfig.scoreboardRowHeight - 6,
                ).fill(row.color);
              }}
            />
            <pixiText
              text={`${index + RenderConfig.scoreboardRankOffset}`}
              x={RenderConfig.scoreboardRankColumnX}
              y={RenderConfig.scoreboardRowTextOffsetY}
              style={rowTextStyle}
            />
            <pixiText
              text={formatPlayerName(row.displayName)}
              x={RenderConfig.scoreboardPlayerColumnX}
              y={RenderConfig.scoreboardRowTextOffsetY}
              style={rowTextStyle}
            />
            <pixiText
              text={`${row.troops}`}
              x={armyColumnX}
              y={RenderConfig.scoreboardRowTextOffsetY}
              style={rowTextStyle}
            />
            <pixiText
              text={`${row.land}`}
              x={landColumnX}
              y={RenderConfig.scoreboardRowTextOffsetY}
              style={rowTextStyle}
            />
          </pixiContainer>
        );
      })}
    </pixiContainer>
  );
}
