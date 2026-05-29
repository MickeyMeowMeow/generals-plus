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
    """Creates bot instances per connection, with optional ML model loading."""

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self._ml_bot = None

        if model_path and os.path.exists(model_path):
            try:
                from .ml_bot import MLBot
                self._ml_bot = MLBot(model_path)
                logger.info(f"ML bot loaded from {model_path}")
            except Exception as e:
                logger.warning(f"Failed to load ML model: {e}. Falling back to heuristic.")

    def create_bot(self):
        if self._ml_bot is not None:
            return self._ml_bot
        return HeuristicBot()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def bot_websocket(websocket: WebSocket):
    await websocket.accept()
    factory: BotFactory = getattr(websocket.app.state, "bot_factory", None) or BotFactory()
    bot = factory.create_bot()
    player_id = "unknown"

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")

            if msg_type == "start":
                player_id = msg.get("player_id", player_id)
                bot.reset(msg.get("config"))
                logger.info(f"Bot started for player {player_id}")

            elif msg_type == "tick":
                action = bot.decide(msg)
                await websocket.send_json({
                    "type": "action",
                    "action": action,
                })

            elif msg_type == "end":
                bot.reset()
                logger.info(f"Bot ended for player {player_id}")
                break

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: player={player_id}")
    except Exception as e:
        logger.exception(f"Error handling connection for player={player_id}")


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
