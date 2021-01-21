import type { Context, CSSRules, Falsy, TW } from '../types'

import { tw as defaultTW } from './default'
import * as is from '../internal/is'
import { ensureMaxSize } from '../internal/util'

const ensureNoFunctions = (key: string, value: unknown): unknown => {
  if (is.function(value)) {
    throw 0
  }

  return value
}

const stringify = (data: unknown): string | undefined => {
  try {
    return JSON.stringify(data, ensureNoFunctions)
  } catch {
    /* ignore */
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Factory = (data: any, context: Context) => any
type Directive<T = any> = (context: Context) => T

const cacheByTW = new WeakMap<TW, WeakMap<Factory, Map<string, Directive>>>()
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Returns an optimized and cached function for use with `tw`.
 *
 * `tw` caches rules based on the function identity. This helper caches
 * the function based on the data.
 *
 * @param factory to use when the directive is invoked
 * @param data to use
 */
export const directive = <Data, T extends CSSRules | string | Falsy>(
  factory: (data: Data, context: Context) => T,
  data: Data,
  tw?: TW | null | undefined | void,
): Directive<T> => {
  if (!is.function(tw)) {
    tw = defaultTW
  }

  const key = stringify(data)

  let directive: Directive<T> | undefined

  if (key) {
    let cacheByFactory = cacheByTW.get(tw)
    if (!cacheByFactory) {
      cacheByTW.set(tw, (cacheByFactory = new WeakMap()))
    }

    // eslint-disable-next-line no-var
    var cache = cacheByFactory.get(factory)
    if (!cache) {
      cacheByFactory.set(factory, (cache = new Map()))
    }

    directive = cache.get(key)
  }

  if (!directive) {
    const toString = (): string => (tw as TW)(directive)

    directive = Object.defineProperties((context: Context): T => factory(data, context), {
      valueOf: {
        value: toString,
      },
      toString: {
        value: toString,
      },
      // Allow twind to generate a unique id for this directive
      // twind uses JSON.stringify which returns undefined for functions like this directive
      // providing a toJSON function allows to include this directive in the id generation
      toJSON: {
        value: () => data,
      },
    })

    if (cache) {
      cache.set(key as string, directive as Directive<T>)

      // Ensure the cache does not grow unlimited
      ensureMaxSize(cache, 10000)
    }
  }

  return directive as Directive<T>
}
