/** A load failure with a stable code and learner-safe text. */
export class CourseLoadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
