export class UseCaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class GetHealthUseCaseError extends UseCaseError {
  constructor(options?: ErrorOptions) {
    super('failed_to_get_health_status', 'health_check_failed', options);
  }
}

export class GetMetricsUseCaseError extends UseCaseError {
  constructor(options?: ErrorOptions) {
    super('failed_to_get_metrics', 'metrics_fetch_failed', options);
  }
}

export class ListDlqEventsUseCaseError extends UseCaseError {
  constructor(options?: ErrorOptions) {
    super('failed_to_list_dlq_events', 'dlq_list_failed', options);
  }
}

export class IngestEventUseCaseError extends UseCaseError {
  constructor(options?: ErrorOptions) {
    super('failed_to_ingest_event', 'ingest_event_failed', options);
  }
}

export class InvalidPayloadError extends UseCaseError {
  constructor(public readonly details: string[]) {
    super('invalid_payload', 'invalid_payload');
  }
}

export class DuplicateEventError extends UseCaseError {
  constructor() {
    super('event_id_already_exists', 'duplicate_event');
  }
}
