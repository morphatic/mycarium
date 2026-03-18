import { z } from "zod/v4";

export const statusMessageSchema = z.object({
  ts: z.number(),
  temp_c: z.number(),
  temp_f: z.number().optional(),
  humidity: z.number(),
  temp_min_c: z.number().optional(),
  temp_max_c: z.number().optional(),
  humidity_min: z.number().optional(),
  humidity_max: z.number().optional(),
  heater_on: z.boolean(),
  fogger_on: z.boolean(),
  heater_action: z.string().optional(),
  fogger_action: z.string().optional(),
  heater_mode: z.string().optional(),
  fogger_mode: z.string().optional(),
});

export type StatusMessage = z.infer<typeof statusMessageSchema>;

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

export interface ReadingRow {
  id: number;
  deviceId: string;
  ts: number;
  tempC: number;
  humidity: number;
  heaterOn: boolean;
  foggerOn: boolean;
}
