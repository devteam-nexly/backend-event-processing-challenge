export interface DlqEvent {
  id: number;
  event_id: string;
  tenant_id: string;
  type: string;
  payload: Record<string, unknown>;
  retry_count: number;
  failure_reason: string;
  created_at: string;
}
