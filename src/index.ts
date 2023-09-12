import chalk from "chalk"
import { unstable_cache } from "next/cache"
// @ts-expect-error
import { cache } from "react"

type MemoizePropType = {
  persist?: boolean,
  duration?: number,
  log?: ('dedupe' | 'datacache')[],
  revalidateTags?: string[],
  additionalCacheKey?: string[]
}

/**   ###  MEMOIZE: unstable_cache() + cache()
         A way to generalize the data caching function in Next.js     
**/

export function memoize(
  cb: Function,
  opts?: MemoizePropType
) {
  const { // default values
    persist = true,
    duration = Infinity,
    log = ['datacache', 'dedupe'],
    revalidateTags = [],
    additionalCacheKey = []
  } = opts ?? {}
  const logDataCache = log.includes('datacache')
  const logDedupe = log.includes('dedupe')

  let oldData: any
  let renderCacheHit: boolean
  renderCacheHit = false

  const cachedFn = cache(
    async (...args: any[]) => {
      renderCacheHit = true
      if (persist) {
        // Initialize unstable_cache
        const cacheKey = [cb.toString(), JSON.stringify(args), ...additionalCacheKey]
        const nextOpts = {
          revalidate: duration,
          tags: ['all', ...revalidateTags]
        }
        if (logDataCache) {
          let dataCacheMiss = false
          const audit = new Audit()
          const data = await unstable_cache(
            async () => {
              dataCacheMiss = true
              return cb(...args)
            },
            cacheKey, nextOpts
          )()
          const time = audit!.getSec()
          const isSame = oldData === data
          console.log(
            `${chalk.hex('#AA7ADB').bold("Data Cache")} - ` +
            `${cb.name} ${chalk.hex('#AA7ADB').bold(dataCacheMiss ? "MISS" : "HIT")} ` +
            `${chalk.hex('A0AFBF')(time.toPrecision(3) + 's')} ` +
            `${chalk.hex('#AA7ADB').bold(dataCacheMiss ? isSame ? 'background-revalidation' : 'on-demand revalidation' : "")} ` +
            ''
          )
          oldData = data
          return data

        } else {
          const data = await unstable_cache(
            async () => {
              return cb(...args)
            }, [cb.toString(), JSON.stringify(args), ...additionalCacheKey], {
            revalidate: duration,
            tags: ['all', ...revalidateTags]
          }
          )()
          return data
        }
      } else {
        // return callback directly
        return cb(...args)
      }

    }
  )
  return async (...args: any) => {

    if (logDedupe) {
      let audit2 = new Audit()
      let data = await cachedFn(...args)
      let time = audit2.getSec()
      console.log(
        `${chalk.hex('#FFB713').bold("Memoization")} - ` +
        `${cb.name} ${chalk.hex('#FFC94E').bold(renderCacheHit ? "MISS" : "HIT")} ` +
        `${chalk.hex('A0AFBF')(time.toPrecision(3) + 's')} ` +
        ''
      )
      renderCacheHit = false
      return data
    } else {
      return await cachedFn(...args)
    }
  }
}



class Audit {
  private _start: number = performance.now()
  private _end: number | null = null
  getSec() {
    this._end = performance.now()
    return ((this._end - this._start) / 1000)
  }
}