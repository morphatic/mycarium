/** Matches firmware StatusMessage (published on mycarium/status/<device-id>) */
export interface StatusMessage {
  ts: number;
  temp_c: number;
  temp_f?: number;
  humidity: number;
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
  heater_on: boolean;
  fogger_on: boolean;
  heater_action?: string;
  fogger_action?: string;
  heater_mode?: string;
  fogger_mode?: string;
}

/** Published on mycarium/control/<device-id> — matches firmware ControlMessage */
export interface ControlMessage {
  temp_min?: number;
  temp_max?: number;
  hum_min?: number;
  hum_max?: number;
  heater_mode?: "auto" | "manual";
  fogger_mode?: "auto" | "manual";
  heater_on?: boolean;
  fogger_on?: boolean;
}

/** Device as returned by the server API */
export interface Device {
  id: number;
  deviceId: string;
  userId: string;
  name: string | null;
  status: "pending" | "active";
  createdAt: string;
}

/** Stored after login/register — only the token; cert/key are not sent to browser */
export interface Session {
  token: string;
}

/** A single historical reading row from GET /devices/:id/history */
export interface ReadingRow {
  id: number;
  deviceId: string;
  ts: number;
  tempC: number;
  humidity: number;
  heaterOn: boolean;
  foggerOn: boolean;
}
