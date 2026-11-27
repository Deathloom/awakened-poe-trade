// Deathloom fork (F4): data loaded the first time something needs it (a
// dynamic import of a JSON chunk). lazyOnce(load) gives a function that loads
// once and hands every caller the same promise. A failed load is tried again
// after a short wait (retries times); if it still fails, the next call starts
// over, so opening the panel again tries once more instead of staying empty.

export function lazyOnce<T> (load: () => Promise<T>, retries = 1, waitMs = 300): () => Promise<T> {
  let pending: Promise<T> | null = null
  const attempt = async (left: number): Promise<T> => {
    try {
      return await load()
    } catch (err) {
      if (left <= 0) throw err
      await new Promise(resolve => setTimeout(resolve, waitMs))
      return await attempt(left - 1)
    }
  }
  return () => {
    if (!pending) {
      const p = attempt(retries)
      pending = p
      p.catch(() => { if (pending === p) pending = null })
    }
    return pending
  }
}

// fn, but every call waits for ready first (calls stay in order). A failed
// ready still lets the calls through; an error in fn goes to onError.
export function afterReady<T> (ready: Promise<unknown>, fn: (x: T) => void, onError: (err: unknown) => void = console.error): (x: T) => void {
  const gate = ready.then(() => {}, () => {})
  return (x: T) => { gate.then(() => { fn(x) }).catch(onError) }
}
