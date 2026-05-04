import { useState, useEffect, useCallback } from 'react'
import { getFileTree, getExternalTree } from '../api.js'

export function useFileTree(externalRoot = null) {
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(false)
  const [rootPath, setRootPath] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      let data
      if (externalRoot) {
        data = await getExternalTree(externalRoot)
      } else {
        data = await getFileTree()
      }
      setTree(data.tree || [])
      setRootPath(data.root || null)
    } catch (e) {
      console.error('Failed to load file tree:', e)
    } finally {
      setLoading(false)
    }
  }, [externalRoot])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { tree, loading, refresh, rootPath }
}
