export default function () {
  interface FileTree {
    label: string
    children?: FileTree[]
    self: any
  }

  const fileTree = ref<FileTree[]>([])

  function renderTree(fileList) {
    for (const item of fileList) {
      const path = item.path[0] === '/' ? item.path.slice(1) : item.path
      const pathList = path.split('/')

      const fileInfo = {
        label: item.name,
        children: [],
        self: item
      }

      console.log(pathList, path, item)
      traverseTree(fileTree.value, fileInfo, 0, pathList)
    }
  }

  function traverseTree(tree, info, deep, pathList) {
    const nowPath = pathList[deep]
    if (deep === pathList.length - 1) {
      for (const item of tree) {
        if (item.label === nowPath) return
      }
      tree.push(info)
      return
    } else {
      for (const item of tree) {
        if (item.label === nowPath) {
          traverseTree(item.children, info, deep + 1, pathList)
          return
        }
      }

      tree.push({
        label: nowPath,
        children: []
      })
      traverseTree(tree, info, deep, pathList)
    }
  }

  return { renderTree, fileTree }
}
