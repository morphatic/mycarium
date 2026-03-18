import mqtt from "mqtt";
import type { MqttClient } from "mqtt";

let client: MqttClient | null = null;

export type MqttMessageHandler = (topic: string, payload: string) => void;

interface ConnectOptions {
  host: string;
  token: string;
  onMessage: MqttMessageHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (err: Error) => void;
}

export function connectMqtt(opts: ConnectOptions): MqttClient {
  if (client) {
    client.end(true);
  }

  const clientId = `app-${Math.random().toString(36).slice(2, 10)}`;
  const url = `wss://${opts.host}/mqtt`;

  client = mqtt.connect(url, {
    clientId,
    username: opts.token,
    password: "",
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    opts.onConnect?.();
  });

  client.on("message", (_topic, payload) => {
    opts.onMessage(_topic, payload.toString());
  });

  client.on("close", () => {
    opts.onDisconnect?.();
  });

  client.on("error", (err) => {
    opts.onError?.(err);
  });

  return client;
}

export function subscribe(topic: string): void {
  client?.subscribe(topic);
}

export function unsubscribe(topic: string): void {
  client?.unsubscribe(topic);
}

export function publish(topic: string, payload: string): void {
  client?.publish(topic, payload);
}

export function disconnectMqtt(): void {
  if (client) {
    client.end(true);
    client = null;
  }
}
