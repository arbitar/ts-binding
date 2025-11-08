import * as _ from '../src'
import { test, expect, describe } from 'vitest'

type FilterConfig = {
  filterData: string
}
const filterSchema: _.Bound<FilterConfig> = _.object({
  filterData: _.string()
})

type OneConfig = {
  oneConfig: string,
  remote: Array<{ filters: string }>
}
const oneConfigSchema: _.Bound<OneConfig> = _.object({
  metaConfig: _.string(),
  remote: _.array(
    _.object({ filters: _.document(filterSchema) })
  )
})

type OneComponent = { Type: "One", Config: string }
const oneComponentSchema: _.Bound<OneComponent> = _.object({
  Type: _.literal("One"),
  Config: _.document(oneConfigSchema)
})

type TwoComponent = { Type: "Two" }
const twoComponentSchema: _.Bound<TwoComponent> = _.object({
  Type: _.literal("Two")
})

type AnyComponent = OneComponent | TwoComponent
const anyComponentSchema = _.union<AnyComponent>(
  v => v.Type === "One" && oneComponentSchema,
  v => v.Type === "Two" && twoComponentSchema
)

type Entity = { [key: string]: AnyComponent }
const entitySchema: _.Bound<Entity> = _.record(_.string(), anyComponentSchema)

const testEntity: Entity = {
  "my_one": {
    Type: "One",
    Config: JSON.stringify({
      metaConfig: "test",
      remote: [
        { filters: JSON.stringify({ filterData: "test" }) },
        { filters: JSON.stringify({ filterData: "toast" }) }
      ]
    })
  },
  "my_two": {
    Type: "Two"
  }
}

const entityDocumentSchema = _.document<Entity>(entitySchema)

const entityDocumentSchema2 = _.document(
  _.record(_.string(), _.union<AnyComponent>(

    v => v.Type === "One" && _.object({
      Type: _.literal("One"),
      Config: _.document(
        _.object({
          metaConfig: _.string(),
          remote: _.array(
            _.object({ filters: _.document(
              _.object({
                filterData: _.string()
              })
            ) })
          )
        })
      )
    }),

    v => v.Type === "Two" &&  _.object({
      Type: _.literal("Two")
    })
    
  ))
)

describe('bidirectionality', () => {
  describe('primitive', () => {
    test('string', () => {
      const test = 'test'
      const transformed = _.string().transform(test)
      const restored = _.string().restore(transformed)

      expect(restored).toStrictEqual(test)
      expect(transformed).toStrictEqual(test)
    })

    test('number', () => {
      const test = 123
      const transformed = _.number().transform(test)
      const restored = _.number().restore(transformed)

      expect(restored).toStrictEqual(test)
      expect(transformed).toStrictEqual(test)
    })

    test('boolean', () => {
      const test = true
      const transformed = _.boolean().transform(test)
      const restored = _.boolean().restore(transformed)

      expect(restored).toStrictEqual(test)
      expect(transformed).toStrictEqual(test)
    })

    test('null', () => {
      const test = null
      const transformed = _.nil().transform(test)
      const restored = _.nil().restore(transformed)

      expect(restored).toStrictEqual(test)
      expect(transformed).toStrictEqual(test)
    })

    test('literal', () => {
      const test = { abc: 123 }
      const transformed = _.literal(test).transform(test)
      const restored = _.literal(test).restore(transformed)

      expect(restored).toStrictEqual(test)
      expect(transformed).toStrictEqual(test)
    })
  })

  describe('complex', () => {
    test('record', () => {
      const test = { abc: 123 }
      const transformed = _.record(_.string(), _.number()).transform(test)
      const restored = _.record(_.string(), _.number()).restore(transformed)

      expect(restored).toStrictEqual(test)
      expect(transformed).toStrictEqual(test)
    })

    test('array', () => {
      const test = [1, 2, 3]
      const transformed = _.array(_.number()).transform(test)
      const restored = _.array(_.number()).restore(transformed)

      expect(restored).toStrictEqual(test)
      expect(transformed).toStrictEqual(test)
    })

    test('union', () => {
      type One = { a: 1, one: string }
      type Two = { a: 2, two: string }
      type Unioned = One|Two

      const test_one: One = { a: 1, one: 'howdy' }
      const test_two: Two = { a: 2, two: 'pardner' }

      const schema = _.union<Unioned>(
        v => v.a === 1 && _.object({ a: _.number(), one: _.string() }),
        v => v.a === 2 && _.object({ a: _.number(), two: _.string() })
      )

      const transformed_one = schema.transform(test_one)
      const restored_one = schema.restore(transformed_one)

      expect(restored_one).toStrictEqual(test_one)
      expect(transformed_one).toStrictEqual(test_one)

      const transformed_two = schema.transform(test_two)
      const restored_two = schema.restore(transformed_two)

      expect(restored_two).toStrictEqual(test_two)
      expect(transformed_two).toStrictEqual(test_two)

      expect(restored_one).not.toStrictEqual(restored_two)
    })

    test('object', () => {
      const test = { abc: 123 }
      const transformed = _.object({ abc: _.number() }).transform(test)
      const restored = _.object({ abc: _.number() }).restore(transformed)

      expect(restored).toStrictEqual(test)
      expect(transformed).toStrictEqual(test)
    })
  })
})

describe('document', () => {
  test('simple', () => {
    const schema = _.document(
      _.object({ howdy: _.string() })
    )

    const serialized = JSON.stringify({ howdy: 'pardner' }, null, 2)
    expect(serialized).toBeTypeOf('string')

    const restored = schema.restore(serialized)
    expect(restored).toBeTypeOf('object')

    const retransformed = schema.transform(restored)
    expect(retransformed).toBeTypeOf('string')

    // does it roundtrip predictably despite prettification?
    const rerestored = schema.restore(retransformed)
    expect(rerestored).toStrictEqual(restored)
  })

  test('complex', () => {
    const serializedLayer = JSON.stringify(testEntity, null, 2)
    expect(serializedLayer).toBeTypeOf('string')

    const restored = entityDocumentSchema.restore(serializedLayer)
    expect(restored).toBeTypeOf('object')

    const retransformed = entityDocumentSchema.transform(restored)
    expect(retransformed).toBeTypeOf('string')

    // does it roundtrip predictably despite prettification?
    const rerestored = entityDocumentSchema.restore(retransformed)
    expect(rerestored).toStrictEqual(restored)
  })
})

test('optionals', () => {
  type Test = { howdy: string, pardner?: string }
  const schema = _.document<Test>(
    _.object({ howdy: _.string(), pardner: _.optional(_.string()) })
  )

  const serialized1 = JSON.stringify({ howdy: 'pardner' }, null, 2)
  const serialized2 = JSON.stringify({ howdy: 'pardner', pardner: 'howdy' }, null, 2)

  const restored1 = schema.restore(serialized1)
  expect(restored1).toBeTypeOf('object')
  expect(restored1.pardner).toBeUndefined()

  const restored2 = schema.restore(serialized2)
  expect(restored2).toBeTypeOf('object')
  expect(restored2.pardner).toBe('howdy')

  const retransformed1 = schema.transform(restored1)
  const retransformed2 = schema.transform(restored2)

  const rerestored1 = schema.restore(retransformed1)
  expect(rerestored1).toBeTypeOf('object')
  expect(rerestored1.pardner).toBeUndefined()

  const rerestored2 = schema.restore(retransformed2)
  expect(rerestored2).toBeTypeOf('object')
  expect(rerestored2.pardner).toBe('howdy')
})

test('nullables', () => {
  type Test = { howdy: string, pardner: string|null }
  const schema = _.document<Test>(
    _.object({ howdy: _.string(), pardner: _.nullable(_.string()) })
  )

  const serialized1 = JSON.stringify({ howdy: 'pardner', pardner: null }, null, 2)
  const serialized2 = JSON.stringify({ howdy: 'pardner', pardner: 'howdy' }, null, 2)

  const restored1 = schema.restore(serialized1)
  expect(restored1).toBeTypeOf('object')
  expect(restored1.pardner).toStrictEqual(null)

  const restored2 = schema.restore(serialized2)
  expect(restored2).toBeTypeOf('object')
  expect(restored2.pardner).toBe('howdy')

  const retransformed1 = schema.transform(restored1)
  const retransformed2 = schema.transform(restored2)

  const rerestored1 = schema.restore(retransformed1)
  expect(rerestored1).toBeTypeOf('object')
  expect(rerestored1.pardner).toStrictEqual(null)

  const rerestored2 = schema.restore(retransformed2)
  expect(rerestored2).toBeTypeOf('object')
  expect(rerestored2.pardner).toBe('howdy')
})

test('extension', () => {
  type Base = { howdy: string }
  const baseSchema = _.object<Base>({ howdy: _.string() })

  type Extension = { pardner: string }
  const extensionSchema = _.object<Extension>({ pardner: _.string() })

  type Extended = Base & { pardner: string }
  const extendedSchema = _.extendObject(
    baseSchema,
    extensionSchema
  )

  const documentExtendedSchema = _.document<Extended>(extendedSchema)

  const serialized = JSON.stringify({ howdy: 'pardner', pardner: 'howdy' }, null, 2)

  const restored = documentExtendedSchema.restore(serialized)
  expect(restored).toBeTypeOf('object')
  expect(restored.howdy).toBe('pardner')
  expect(restored.pardner).toBe('howdy')
})