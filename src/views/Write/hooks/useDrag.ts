export default function (fileChangeHandle) {
  let dragText = ref<string>('拖拽至此处进行上传')

  function dragenter(e) {
    dragText.value = '释放添加文件'
  }

  function dragleave(e) {
    dragText.value = '拖拽至此处进行上传'
  }

  async function drop(e) {
    e.stopPropagation()
    e.preventDefault()
    let dropFileList:any = []
    const { items } = e.dataTransfer
    console.log(Array.from(items))
    const transferList = Array.from(items)

    for (const item of items) {
      let it = (<any>item).webkitGetAsEntry()
      if (it) {
        dropFileList.push(scanFiles(it))
      }
    }

    dropFileList = await Promise.all(dropFileList)
    dropFileList = dropFileList.flat(Infinity)
    console.log(dropFileList)

    const resultList = await Promise.all(dropFileList.map(item => getFile(item)))
    console.log(resultList)

    fileChangeHandle(resultList, 1)

    async function scanFiles(item) {
      const result:any = []
      if (item.isDirectory) {
        const entries:any = await readEntries(item)

        for (const entry of entries) {
          result.push(await scanFiles(entry))
        }
      } else {
        result.push(item)
      }

      return result
    }

    // 封装读取文件promise
    function getFile(entry) {
      return new Promise((resolve, reject) => {
        entry.file(res => {
          res.path = entry.fullPath
          resolve(res)
        }, err => {
          reject(err)
        })
      })
    }

    // 封装读取文件夹promise
    function readEntries(entry) {
      return new Promise((resolve, reject) => {
        let directoryReader = entry.createReader()

        directoryReader.readEntries((entries) => {
          resolve(entries)
        })
      })
    }
  }

  function dragover(e) {
    e.preventDefault()
  }

  return { dragenter, dragleave, drop, dragover, dragText }
}
