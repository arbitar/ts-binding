import { Literal, SerializationConfig } from "./types"

export const JsonPrettySerializationConfig: SerializationConfig<Literal, string> = {
  serializer: (lit: Literal) => JSON.stringify(lit, null, 2),
  deserializer: JSON.parse
}

export const JsonSerializationConfig: SerializationConfig<Literal, string> = {
  serializer: (lit: Literal) => JSON.stringify(lit),
  deserializer: JSON.parse
}

export let DefaultSerializationConfig: SerializationConfig = JsonPrettySerializationConfig
export function SetDefaultSerializationConfig(config: SerializationConfig) {
  DefaultSerializationConfig = config
}
