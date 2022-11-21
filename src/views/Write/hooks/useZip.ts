import ZipWorker from '../script/zip?worker'

export default function ({ ZIPSIZE }) {
  let zipPercent = ref(0)
  let zipNowFile = ref('') // 正在进行压缩的文件

  /**
   * 过滤文件大小低于zip标志的文件 添加useZip标识
   * @param fileList
   * @returns
   */
  function filterSize(fileList) {
    for (const item of fileList) {
      if (item.size < ZIPSIZE) {
        item.useZip = true
      }
    }

    return {
      useZipList: toRaw(fileList).filter((item) => item.useZip),
      unZipList: toRaw(fileList).filter((item) => !item.useZip)
    }
  }

  /**
   * 启用webworker合并计算zip文件
   * @param zipName
   * @param files
   * @param options
   * @returns
   */
  function generateZipFile(zipName, files) {

    return new Promise((resolve, reject) => {
      const work = new ZipWorker()
      let pathInfo:any = {}

      for (const item of files) {
        pathInfo[item.name] = item.path
      }
      work.postMessage({ zipName, fileList: files, pathInfo })

      work.addEventListener('message', (e) => {
        const percentage = e.data.percentage
        const nowFile = e.data.nowFile
        zipNowFile.value = nowFile
        zipPercent.value = percentage
        if (e.data.file) {
          const file = e.data.file
          resolve(file)
        }
      })
    })
  }

  return { zipPercent, zipNowFile, filterSize, generateZipFile }
}
