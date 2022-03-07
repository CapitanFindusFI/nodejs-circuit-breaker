type CircuitBreakerOptions = {
    openCircuitTimeout?: number;
    closedCircuitTimeout?: number;
    failedRequestNumberThreshold?: number;
    failurePercentageThreshold?: number;
}

enum CircuitBreakerState {
    OPENED = "opened",
    CLOSED = "closed",
    FAILING = "failing"
}

class CircuitBreaker<T> {
    private options: Required<CircuitBreakerOptions>;
    private state: CircuitBreakerState;

    private resetFailingTime: number | undefined = undefined;
    private retryTriggerTime: number | undefined = undefined;

    private failureCount = 0;
    private successCount = 0;

    constructor(
        private request: () => Promise<T>,
        opts: CircuitBreakerOptions
    ) {
        this.options = {
            openCircuitTimeout: opts.openCircuitTimeout || 5000,
            closedCircuitTimeout: opts.closedCircuitTimeout || 5000,
            failedRequestNumberThreshold: opts.failedRequestNumberThreshold || 10,
            failurePercentageThreshold: opts.failurePercentageThreshold || 50
        }
    }

    async run() {
        // is closed, or is still waiting for the retry time to be expired
        if (this.state === CircuitBreakerState.CLOSED && (Date.now() < this.retryTriggerTime)) {
            throw new Error("Circuit breaker is closed");
        }

        try {
            const response = await this.request();
            return this.onSuccess(response)
        } catch (e) {
            return this.onFailure(e)
        }
    }

    private resetCounters() {
        this.failureCount = 0;
        this.successCount = 0;
        this.resetFailingTime = undefined;
    }

    private onSuccess(response: T) {
        // Was failing, update success count and see if it can be reopened
        if (this.state === CircuitBreakerState.FAILING) {
            this.successCount++;

            if (Date.now() >= this.resetFailingTime) {
                this.state = CircuitBreakerState.OPENED;
                this.resetCounters();
            }
        }

        // Was closed, reopen
        if (this.state === CircuitBreakerState.CLOSED) {
            this.state = CircuitBreakerState.OPENED;
            this.resetCounters();
        }

        // return original response
        return response
    }

    private onFailure(error: any) {
        // Was closed, increase retry trigger timeout and return error
        if (this.state === CircuitBreakerState.CLOSED) {
            // Set new retry timestamp
            this.retryTriggerTime = Date.now() + this.options.closedCircuitTimeout;

            // Return error
            return error;
        }

        // First failed request
        if (this.state === CircuitBreakerState.OPENED) {
            this.failureCount = 1;

            // Circuit breaker is failing
            this.state = CircuitBreakerState.FAILING;

            // Set new failure timestamp
            this.resetFailingTime = Date.now() + this.options.openCircuitTimeout;

            // Return error
            return error;
        }

        if (this.state === CircuitBreakerState.FAILING) {
            this.failureCount++;

            // Failing time was expired, but circuit wasn't closed yet
            if (Date.now() > this.resetFailingTime) {
                this.resetCounters();
                this.failureCount = 1;
                this.resetFailingTime = Date.now() + this.options.openCircuitTimeout;
                return error;
            }

            // Still checking failing status
            if (this.failureCount >= this.options.failurePercentageThreshold) {
                const failureRate = this.failureCount * 100 / (this.failureCount + this.successCount);

                // Failure rate has been exceeded, circuit will be closed
                if (failureRate >= this.options.failurePercentageThreshold) {
                    this.state = CircuitBreakerState.CLOSED;
                    this.resetCounters();
                    this.retryTriggerTime = Date.now() + this.options.closedCircuitTimeout;
                    return error;
                }

                // normal status, but update tracking period
                this.resetCounters();
                this.failureCount = 1;
                this.resetFailingTime = Date.now() + this.options.openCircuitTimeout;
                return error;
            }
        }
    }
}