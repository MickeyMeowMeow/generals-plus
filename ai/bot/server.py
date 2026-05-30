"""
Bot server: FastAPI + WebSocket entry point for Python bot service.

Receives vision snapshots from the TS server via WebSocket,
returns actions. Supports both HeuristicBot (always available) and
MLBot (loaded when trained model exists).
"""

import argparse
import json
import logging
import os
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .heuristic import HeuristicBot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [BotServer] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Generals Plus Bot Service")


class BotFactory:
    """Creates bot instances per player, with optional ML model loading.

    Each player gets their own bot instance so that stateful bots (MLBot with
    LSTM hidden state, HeuristicBot with cached enemy general position) do not
    leak information across players sharing a single WebSocket connection.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self._bots: dict[str, object] = {}

    def get_bot(self, player_id: str):
        """Return (or lazily create) the bot instance for *player_id*."""
        if player_id not in self._bots:
            if self.model_path and os.path.exists(self.model_path):
                try:
                    from .ml_bot import MLBot

                    self._bots[player_id] = MLBot(self.model_path)
                    logger.info(
                        f"ML bot created for player {player_id} from {self.model_path}"
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to load ML model: {e}. Falling back to heuristic."
                    )
                    self._bots[player_id] = HeuristicBot()
            else:
                self._bots[player_id] = HeuristicBot()
                logger.info(f"Heuristic bot created for player {player_id}")
        return self._bots[player_id]

    def remove_bot(self, player_id: str) -> None:
        """Remove and reset the bot for *player_id*."""
        bot = self._bots.pop(player_id, None)
        if bot is not None:
            logger.info(f"Bot removed for player {player_id}")

    def remove_all(self) -> None:
        """Remove all bots (e.g. on disconnect)."""
        for pid in list(self._bots.keys()):
            self.remove_bot(pid)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def bot_websocket(websocket: WebSocket):
    await websocket.accept()
    factory: BotFactory = getattr(websocket.app.state, "bot_factory", None) or BotFactory()
    player_id = "unknown"
    bots_seen: set[str] = set()

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")

            if msg_type == "start":
                player_id = msg.get("player_id", player_id)
                bot = factory.get_bot(player_id)
                bot.reset(msg.get("config"))
                bots_seen.add(player_id)
                logger.info(f"Bot started for player {player_id}")

            elif msg_type == "tick":
                # Use the player_id embedded in the tick message so every
                # player's state is routed to their own bot instance.
                tick_player_id = msg.get("player_id", player_id)
                tick_bot = factory.get_bot(tick_player_id)
                action = tick_bot.decide(msg)
                await websocket.send_json({
                    "type": "action",
                    "player_id": tick_player_id,
                    "action": action,
                })

            elif msg_type == "end":
                end_player_id = msg.get("player_id", player_id)
                end_bot = factory.get_bot(end_player_id)
                end_bot.reset()
                factory.remove_bot(end_player_id)
                bots_seen.discard(end_player_id)
                logger.info(f"Bot ended for player {end_player_id}")
                # Don't break — other players may still be active on this connection

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: player={player_id}")
        factory.remove_all()
    except Exception as e:
        logger.exception(f"Error handling connection for player={player_id}")
        factory.remove_all()


def main():
    import uvicorn

    parser = argparse.ArgumentParser(description="Generals Plus Bot Service")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8765, help="Port to bind to")
    parser.add_argument("--model", default=None, help="Path to trained model (.eqx for JAX, .onnx for CPU deployment)")
    args = parser.parse_args()

    app.state.bot_factory = BotFactory(args.model)

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
