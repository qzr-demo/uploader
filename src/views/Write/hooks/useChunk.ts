import utils from '@constq/qzr-utils'

export default function({ CHUNKSIZE }) {
  let totalSize = ref(0)
  let totalChunk = ref(0) // 总分片数

  /**
   * 处理文件列表添加属性
   * @param files 文件列表
   */
  function createChunk(files) {
    const resultList = files
      .map((item) => {
        const { size, type, lastModifiedDate, name } = item
        const chunks = Math.ceil(size / CHUNKSIZE)
        // 埋点统计
        totalChunk.value += chunks
        totalSize.value += size
        return {
          path: item?.path,
          chunkList: createChunkList(item),
          size,
          type,
          lastModifiedDate,
          name,
          chunks, // 总分片数
          completed: 0, // 已完成分片
          hashPercentage: 0, // hash计算进度
          merge: -1,
          id: utils.core.Core.randomString(10)
        }
      })

    return resultList
  }

  /**
     * 生成分片方法
     * @param file 需分片的文件
     */
  function createChunkList(file) {
    const chunkList: any = []
    const { size } = file

    let cur = 0
    let index = 1
    while (cur < size) {
      chunkList.push({
        file: file.slice(cur, cur + CHUNKSIZE),
        chunk: index
      })
      cur += CHUNKSIZE
      index++
    }
    return chunkList
  }

  return { createChunk, totalSize, totalChunk }
}
