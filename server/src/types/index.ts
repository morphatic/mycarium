import { z } from "zod/v4";

export const statusMessageSchema = z.object({
  ts: z.number(),
  temp_c: z.number(),
  temp_f: z.number().optional(),
  humidity: z.number(),
  temp_min: z.number(),
  temp_max: z.number(),
  hum_min: z.number(),
  hum_max: z.number(),
  heater_on: z.boolean(),
  fogger_on: z.boolean(),
  heater_action: z.string().optional(),
  fogger_action: z.string().optional(),
  heater_mode: z.string().optional(),
  fogger_mode: z.string().optional(),
});

export type StatusMessage = z.infer<typeof statusMessageSchema>;

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

export interface ReadingRow {
  id: number;
  deviceId: string;
  ts: number;
  tempC: number;
  humidity: number;
  heaterOn: boolean;
  foggerOn: boolean;
}
