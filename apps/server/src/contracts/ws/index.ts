import * as z from "zod";

import { matchWsContracts } from "./match";
import { queueWsContracts } from "./queue";
import { setupWsContracts } from "./setup";
import { vsAiWsContracts } from "./vs-ai";

type MessageContract = {
  summary: string;
  payload: z.ZodTypeAny;
};

type WsContract = {
  channel: string;
  description: string;
  joinOptions: z.ZodTypeAny;
  roomCreationOptions?: z.ZodTypeAny;
  clientToServer: Record<string, MessageContract>;
  serverToClient: Record<string, MessageContract>;
};

export const allWsContracts: WsContract[] = [
  matchWsContracts,
  queueWsContracts,
  setupWsContracts,
  vsAiWsContracts,
];

function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const jsonSchema =
    typeof schema.toJSONSchema === "function"
      ? schema.toJSONSchema()
      : z.toJSONSchema(schema);
  return jsonSchema as Record<string, unknown>;
}

function buildMessageSchema(payload: z.ZodTypeAny) {
  return zodToJsonSchema(payload);
}

export function generateAsyncApiSpec(): Record<string, unknown> {
  const channels: Record<string, unknown> = {};
  const components: Record<string, unknown> = {
    messages: {},
  };

  for (const contract of allWsContracts) {
    const publishKeys = Object.keys(contract.clientToServer);
    const subscribeKeys = Object.keys(contract.serverToClient);

    for (const [key, msg] of Object.entries(contract.clientToServer)) {
      const msgId = `${contract.channel}_${key}`;
      (components.messages as Record<string, unknown>)[msgId] = {
        name: key,
        title: msg.summary,
        payload: buildMessageSchema(msg.payload),
      };
    }

    for (const [key, msg] of Object.entries(contract.serverToClient)) {
      const msgId = `${contract.channel}_${key}`;
      (components.messages as Record<string, unknown>)[msgId] = {
        name: key,
        title: msg.summary,
        payload: buildMessageSchema(msg.payload),
      };
    }

    channels[contract.channel] = {
      description: contract.description,
      publish: publishKeys.length
        ? {
            summary: `Client messages for ${contract.channel}`,
            message:
              publishKeys.length === 1
                ? {
                    $ref: `#/components/messages/${contract.channel}_${publishKeys[0]}`,
                  }
                : {
                    oneOf: publishKeys.map((key) => ({
                      $ref: `#/components/messages/${contract.channel}_${key}`,
                    })),
                  },
          }
        : undefined,
      subscribe: subscribeKeys.length
        ? {
            summary: `Server messages for ${contract.channel}`,
            message:
              subscribeKeys.length === 1
                ? {
                    $ref: `#/components/messages/${contract.channel}_${subscribeKeys[0]}`,
                  }
                : {
                    oneOf: subscribeKeys.map((key) => ({
                      $ref: `#/components/messages/${contract.channel}_${key}`,
                    })),
                  },
          }
        : undefined,
      "x-colyseus-joinOptions": zodToJsonSchema(contract.joinOptions),
      ...(contract.roomCreationOptions
        ? {
            "x-colyseus-roomCreationOptions": zodToJsonSchema(
              contract.roomCreationOptions,
            ),
          }
        : {}),
    };
  }

  return {
    asyncapi: "2.6.0",
    info: {
      title: "Generals Plus WebSocket API",
      version: "1.0.0",
      description:
        "WebSocket message contracts for Generals Plus game rooms (Colyseus)",
    },
    servers: {
      development: {
        url: "ws://localhost:2567",
        protocol: "colyseus",
        description: "Local development server",
      },
    },
    channels,
    components,
  };
}
