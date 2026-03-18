/** Matches server StatusMessage (published on mycarium/status/<device-id>) */
export interface StatusMessage {
  ts: number;
  temp_c: number;
  temp_f?: number;
  humidity: number;
  temp_min_c?: number;
  temp_max_c?: number;
  humidity_min?: number;
  humidity_max?: number;
  heater_on: boolean;
  fogger_on: boolean;
  heater_action?: string;
  fogger_action?: string;
  heater_mode?: string;
  fogger_mode?: string;
}

/** Published on mycarium/control/<device-id> */
export interface ControlMessage {
  temp_min_c?: number;
  temp_max_c?: number;
  humidity_min?: number;
  humidity_max?: number;
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

/** Stored after login/register */
export interface Session {
  token: string;
  clientCert: string;
  clientKey: string;
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
