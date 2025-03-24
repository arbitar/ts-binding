import { Bound, DefaultStackType, Stack, ToStringable } from "./types"

export class TransformationError<T extends ToStringable> {
  constructor(public message: string, customStack: Stack<T> = stack(), public offender?: any) {
    this.location = customStack.stack.map(e => e.toString()).join(' -> ') + "(!!)"
  }

  location: string

  toString(): string {
    return "hi"
  }
}

export function stack<T extends ToStringable = DefaultStackType>(existing: T[] = []): Stack<T> {
  return {
    with: (message: T) => stack(existing.concat(message)),
    stack: existing
  }
}

/** convenience wrapper to push a stack message on simple alias types */
export function stackwrap<T, U>(upstream: Bound<T, U>, thisMessage: string): Bound<T, U> {
  return {
    transform: (object: T, s: Stack = stack()) => {
      s = s.with(thisMessage)
      return upstream.transform(object, s)
    },
    restore: (json: U, s: Stack = stack()) => {
      s = s.with(thisMessage)
      return upstream.restore(json, s)
    }
  }
}
