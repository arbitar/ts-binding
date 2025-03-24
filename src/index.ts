import { stack, stackwrap, TransformationError } from "./errors"
import { DefaultSerializationConfig } from "./serialization"
import { Bound, Stack, Literal, PrimitiveRecord, SerializationConfig } from "./types"

export * from "./serialization"
export { Bound, Stack } from "./types"

/** represents any type. use with care. */
export function any(): Bound<any, any> {
  return {
    transform: (object: any) => object,
    restore: (json: any) => json
  }
}

/** validate a value with given functions upon transformation/restoration */
export function validated<T extends Literal>(
  validator: (v: any) => boolean,
  reason: (v: any) => string = () => 'Failed validation'
): Bound<T, Literal> {
  return {
    transform: (object: T, s: Stack) => {
      if (!validator(object)) {
        throw new TransformationError(reason(object), s, object)
      }

      return object as Literal
    },
    restore: (json: Literal, s: Stack) => {
      if (!validator(json)) {
        throw new TransformationError(reason(object), s, object)
      }

      return json as T
    }
  }
}

export function optional<T, L>(schema: Bound<T, L>): Bound<T|undefined, L|undefined> {
  return {
    transform: (object: T|undefined, s: Stack) => {
      return object === undefined ? undefined : schema.transform(object, s)
    },
    restore: (json: L, s: Stack) => {
      return json === undefined ? undefined : schema.restore(json, s)
    },
    attributes: {
      optional: true
    }
  }
}

/** expresses a literal value of any type */
export function literal<T extends Literal>(value: T): Bound<T, T> {
  return stackwrap(validated<T>((v: any) => v === value) as unknown as Bound<T, T>, 'literal')
}

/** expresses a string value */
export const string = () => stackwrap(
  validated<string>((v: any) => typeof v === 'string', v => `expected 'string', received '${typeof v}'`),
  'string'
) as Bound<string, string>

/** expresses a numeric value */
export const number = () => stackwrap(
  validated<number>((v: any) => typeof v === 'number', v => `expected 'number', received '${typeof v}'`),
  'number'
) as Bound<number, number>

/** expresses a boolean value */
export const boolean = () => stackwrap(
  validated<boolean>((v: any) => typeof v === 'boolean', v => `expected 'boolean', received '${typeof v}'`),
  'boolean'
) as Bound<boolean, boolean>

/** expresses a null value (called nil, because null is a reserved keyword) */
export const nil = () => stackwrap(
  validated<null>((v: any) => v === null, v => `expected 'null', received '${typeof v}'`),
  'nil'
) as Bound<null, null>

/**
 * Express an object with unknown key values and associated values
 * @param keySchema expression of key type
 * @param valueSchema expression of value type
 */
export function record<
  K extends string,
  V,
  R extends Record<K, V>
>(
  keySchema: Bound<K>,
  valueSchema: Bound<V>
): Bound<R, Literal> {
  return {
    transform: (object: R, s: Stack = stack()) => {
      return Object.fromEntries(
        Object.entries(object).map(
          ([key, value]) => [
            keySchema.transform(key as K, s.with(`record:transform['key of ${key}']`)),
            valueSchema.transform(value as V, s.with(`record:transform[value of '${key}']`))
          ]
        )
      ) as PrimitiveRecord
    },
    restore: (json: Literal, s: Stack = stack()) => {
      return Object.fromEntries(
        Object.entries(json as PrimitiveRecord).map(
          ([key, value]) => [
            keySchema.restore(key, s.with(`record:restore['key of ${key}']`)),
            valueSchema.restore(value, s.with(`record:restore[value of '${key}']`))
          ]
        )
      ) as R
    }
  }
}

/**
 * Expresses an array of items all typed-alike.
 * For arrays containing multiple types, you'll want to use `union` within this.
 * @param itemSchema expression of array element
 */
export function array<T>(itemSchema: Bound<T>): Bound<Array<T>, Literal> {
  return {
    transform: (array: T[], s: Stack = stack()) => {
      return array.map((e, i) => itemSchema.transform(e, s.with(`array:transform[${i}]`)))
    },
    restore: (array: Literal, s: Stack = stack()) => {
      if (!Array.isArray(array)) {
        throw new TransformationError('Not an array', s.with('array:restore'))
      }

      return array.map((e, i) => itemSchema.restore(e, s.with(`array:restore[${i}]`)))
    }
  }
}

/**
 * Expresses an object with a known structure.
 * If you're looking for an object with unknown keys, use `record`.
 * @param schemaObject Object prototype expressing the structure and expressed types therewithin
 */
export function object<T, O extends { [key: string]: Bound<any, any> }>(
  schemaObject: { [K in keyof O as K extends keyof T ? K : never]: O[K] }
): Bound<T, Literal> {
  return {
    transform: (object: T, s: Stack = stack()) => {
      return Object.fromEntries(
        Object.entries(schemaObject as O).map(
          ([key, value]) => [key, value.transform(object[key as keyof T], s.with(`object:transform['${key}']`))]
        )
      )
    },
    restore: (json: Literal, s: Stack = stack()) => {
      if (typeof json !== 'object' || Array.isArray(json) || json === null) {
        const t = Array.isArray(json) ? 'array' : typeof json
        throw new TransformationError(`Not an object. Expected 'object', got '${t}'`, s.with('object:transform'))
      }

      for (const key of Object.keys(schemaObject)) {
        if (!(key in json) && (schemaObject as any)[key]?.attributes?.optional !== true) {
          throw new TransformationError(`Missing required object key '${key}'`, s.with('object:transform'))
        }
      }

      return Object.fromEntries(
        Object.entries(schemaObject as O).map(
          ([key, value]) => [key, value.restore(json[key], s.with(`object:restore['${key}']`))]
        )
      ) as T
    }
  }
}

/**
 * Expresses a discriminated union.
 * @param discriminators validation functions that either return the selected type expression or false
 */
export function union<TUnion>(
  ...discriminators: Array<(value: TUnion) => Bound<any, any>|false>
): Bound<TUnion, Literal> {
  return {
    transform: (object: TUnion, s: Stack = stack()) => {
      for (let i = 0; i < discriminators.length; i++) {
        const discriminator = discriminators[i]
        const discriminated = discriminator(object)
        if (discriminated === false) {
          continue
        }

        return discriminated.transform(object, s.with(`union:transform[${i}]`))
      }

      throw new TransformationError('No matching union discriminator', s.with('union:transform'))
    },
    restore: (json: Literal, s: Stack = stack()) => {
      for (let i = 0; i < discriminators.length; i++) {
        const discriminator = discriminators[i]
        const discriminated = discriminator(json as TUnion)
        if (discriminated === false) {
          continue
        }

        return discriminated.restore(json, s.with(`union:restore[${i}]`))
      }

      throw new TransformationError('No matching union discriminator', s.with('union:restore'))
    }
  }
}

/**
 * Express a serialized string that matches a specific schema.
 * Unpacked into an object of matching type during transformation,
 * and re-packed into a serialized string during restoration.
 * @param schema expression of serialized type
 */
export function document<T, S = string>(
  schema: Bound<T>,
  { serializer, deserializer  }: SerializationConfig<Literal, S>
    = (DefaultSerializationConfig as unknown as SerializationConfig<Literal, S>)
): Bound<T, S> {
  return {
    transform: (object: T, s: Stack = stack()) => {
      const literal = schema.transform(object, s.with('document:transform'))
      const transformed = serializer(literal)
      return transformed
    },
    restore: (str: S, s: Stack = stack()) => {
      const literal = deserializer(str)
      const restored = schema.restore(literal, s.with('document:restore'))
      return restored
    }
  }
}