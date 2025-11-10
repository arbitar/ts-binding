/**
 * Represents an element that can be transformed between two types bi-directionally.
 * By default, the destination/representation type is a JSON Literal.
 */
export interface Bound<TSource, TTarget = Literal> {
  transform(object: TSource, stack?: Stack): TTarget
  restore(json: TTarget, stack?: Stack): TSource
  attributes?: Record<string, any>
}

export type Literal = Primitive | PrimitiveRecord | PrimitiveArray
export type Primitive = string | number | boolean | null | undefined
export type PrimitiveArray = Literal[]
export type PrimitiveRecord = { [key: string]: Literal }

export type ToStringable = string | number | boolean | { toString(): string }

export type DefaultStackType = string

/**
 * Represents a stack of error messages with a helper function to concat new ones
 */
export interface Stack<T extends ToStringable = DefaultStackType> {
  with: (message: T) => Stack<T>
  stack: T[]
}

/** Configure your desired serialization and deserialization functions */
export interface SerializationConfig<TUnserialized extends Literal = Literal, TSerialized = string>
{
  serializer: (lit: TUnserialized) => TSerialized
  deserializer: (json: TSerialized) => TUnserialized
}

type DeepUnwrap<T> = 
  T extends Bound<any, any>
    ? Unwrap<T> // if it's a Bound, unwrap it
    : T extends Array<infer U>
      ? Array<DeepUnwrap<U>> // if it's an array, unwrap elements
      : T extends object
        ? { [K in keyof T]: DeepUnwrap<T[K]> } // if it's an object, unwrap properties
        : T // primitive, return as-is

/** Get a type that represents a value this schema could successfully be applied to */
export type Unwrap<T> =
  T extends Bound<infer U, any>
    ? DeepUnwrap<U>
    : T
