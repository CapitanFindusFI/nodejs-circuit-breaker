export type CircuitBreakerOptions = {
    openCircuitTimeout?: number;
    closedCircuitTimeout?: number;
    failedRequestNumberThreshold?: number;
    failurePercentageThreshold?: number;
}

export enum CircuitBreakerState {
    OPENED = "opened",
    CLOSED = "closed",
    FAILING = "failing"
}