/**
 * Represents an element that can be transformed between two types bi-directionally.
 * By default, the destination/representation type is a JSON Literal.
 */
export interface Bound<TSource, TTarget = Literal> {
  transform(object: TSource, stack?: Stack): TTarget
  restore(json: TTarget, stack?: Stack): TSource
}

export type Literal = Primitive | PrimitiveRecord | PrimitiveArray
export type Primitive = string | number | boolean | null
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