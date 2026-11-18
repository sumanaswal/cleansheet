/** Thrown when an operation cannot run. The message is shown to the user. */
export class OperationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'OperationError'
    }
}