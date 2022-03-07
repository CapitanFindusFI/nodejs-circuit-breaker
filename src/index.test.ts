import CircuitBreaker from ".";
import { CircuitBreakerState } from "./types";

describe("circuit breaker test suite", () => {
    const SUCCESS_MESSAGE = "wow!";
    const ERROR_MESSAGE = "oh no!";

    const request = (num: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (num < 10) {
                resolve(SUCCESS_MESSAGE);
            } else {
                reject(ERROR_MESSAGE);
            }
        })
    }

    it("should check circuit breaker statuses", async () => {
        const breaker = new CircuitBreaker<string>(request, {
            failedRequestNumberThreshold: 1
        });

        const firstResponse = await breaker.run(3);

        expect(firstResponse).toBe(SUCCESS_MESSAGE);
        expect(breaker.getState()).toBe(CircuitBreakerState.OPENED);

        const secondResponse = await breaker.run(1);
        expect(breaker.getState()).toBe(CircuitBreakerState.OPENED);

        expect(secondResponse).toBe(SUCCESS_MESSAGE);

        await breaker.run(11);
        expect(breaker.getState()).toBe(CircuitBreakerState.FAILING);

        await breaker.run(11);
        expect(breaker.getState()).toBe(CircuitBreakerState.FAILING);
    })

    it("should test thresholds", async () => {

        const breaker = new CircuitBreaker<string>(request, {
            failedRequestNumberThreshold: 2
        });

        const requestPromises = [...Array(10).keys()].map((val: number) => {
            const sendNumber = val * 2;
            return breaker.run(sendNumber);
        })

        const responses = await Promise.all(requestPromises)

        expect(responses).toContain([
            SUCCESS_MESSAGE,
            SUCCESS_MESSAGE,
            SUCCESS_MESSAGE,
            SUCCESS_MESSAGE,
            SUCCESS_MESSAGE,
            ERROR_MESSAGE,
            ERROR_MESSAGE,
            ERROR_MESSAGE,
            ERROR_MESSAGE,
            ERROR_MESSAGE,
        ]);
    })
})