/**
 * 并发promise控制器
 * @param max 最大并发数
 * @param cb 发送请求
 */
class Limit {
  max: number
  cb: any
  pool: any[]
  pathList: string[]
  resolve: any
  reject: any
  constructor(max: number, cb: any) {
    this.pool = []
    this.max = max
    this.cb = cb
    this.pathList = []
  }

  /**
   * 开始
   * @param path 请求路径
   */
  start(path: any[]) {
    return new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
      this.pathList = [...path]
      while (this.pool.length < this.max && this.pathList.length > 0) {
        this._setTask(this.pathList.shift())
      }
      const race = Promise.race(this.pool)
      this._run(race)
    })
  }

  cancel() {
    this.pool.length = 0
    this.pathList.length = 0
    this.reject()
  }

  private _run(race: any) {
    race.then(() => {
      const path = this.pathList.shift()
      this._setTask(path)
      this._run(Promise.race(this.pool))
    })
  }

  private _setTask(path: string | undefined) {
    if (!path) return
    const promise = this.cb(path)
    this.pool.push(promise)

    promise.then(() => {
      this.pool.splice(this.pool.indexOf(promise), 1)
      if (this.pool.length === 0) {
        this.resolve()
      }
    })
  }
}

export default Limit
